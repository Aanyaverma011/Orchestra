const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { z } = require('zod');
const Job = require('../models/Job');
const config = require('../config');
const { enqueue, jobQueue } = require('../queue/producer');
const { invalidateStats } = require('../utils/cache');
const { toJobDto } = require('../utils/dto');
const { explainFailure } = require('../services/explain');
const redis = require('../redis');

const createJobSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: z.enum(['send-email', 'generate-report', 'process-csv']),
  payload: z.record(z.any()).default({}),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  delayMs: z.number().int().min(0).max(30 * 24 * 3600 * 1000).optional(),
  runAt: z.string().datetime().optional(),
});

const IDEMPOTENCY_TTL_S = 24 * 3600;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Find the job that an Idempotency-Key already points to. If another request holds the key but
// has not saved its job yet, wait briefly (up to about 2 seconds) for it to finish.
async function findByIdempotencyKey(userId, key, redisKey) {
  for (let i = 0; i < 20; i++) {
    const marker = await redis.get(redisKey);
    if (marker && marker !== 'pending' && mongoose.isValidObjectId(marker)) {
      const byId = await Job.findById(marker);
      if (byId) return byId;
    }
    const byKey = await Job.findOne({ createdBy: userId, idempotencyKey: key });
    if (byKey) return byKey;
    if (marker !== 'pending') return null;
    await sleep(100);
  }
  return null;
}

// Jobs that are waiting (not running) can be cancelled, including ones waiting to retry.
const CANCELLABLE = ['queued', 'scheduled', 'retrying'];

const isAdmin = (req) => req.user.role === 'admin';
const ownerFilter = (req) => (isAdmin(req) ? {} : { createdBy: req.user.id });

async function createJob(req, res) {
  const data = req.body;
  const idemKey = req.header('Idempotency-Key') || undefined;
  if (idemKey && idemKey.length > 200) return res.status(400).json({ error: 'Idempotency-Key must be 200 characters or fewer' });
  const idemRedisKey = idemKey ? `idem:${req.user.id}:${idemKey}` : null;

  if (idemKey) {
    // Claim the key atomically (SET NX). Of several simultaneous requests only one wins and
    // creates the job; the others wait for it and return the same job. The key lives 24 hours.
    // MongoDB's unique index on (createdBy, idempotencyKey) is the second safety net.
    const claimed = await redis.set(idemRedisKey, 'pending', 'EX', IDEMPOTENCY_TTL_S, 'NX');
    if (!claimed) {
      const existing = await findByIdempotencyKey(req.user.id, idemKey, idemRedisKey);
      if (existing) return res.status(200).json(toJobDto(existing));
      return res.status(409).json({ error: 'A request with this Idempotency-Key is still being processed. Try again in a moment.' });
    }
  }

  const delayMs = data.runAt ? Math.max(0, new Date(data.runAt).getTime() - Date.now()) : data.delayMs || 0;
  const _id = new mongoose.Types.ObjectId();

  let doc;
  try {
    // Save first, then enqueue: nothing is lost if the queue call fails (see sweeper.js).
    doc = await Job.create({
      _id,
      queueJobId: String(_id),
      name: data.name || data.type,
      type: data.type,
      payload: data.payload,
      priority: data.priority,
      status: delayMs > 0 ? 'scheduled' : 'queued',
      scheduledFor: delayMs > 0 ? new Date(Date.now() + delayMs) : undefined,
      createdBy: req.user.id,
      idempotencyKey: idemKey,
      logs: [{ level: 'info', message: delayMs > 0 ? 'Job scheduled' : 'Job accepted and queued' }],
    });
  } catch (err) {
    if (err.code === 11000 && idemKey) {
      const existing = await Job.findOne({ createdBy: req.user.id, idempotencyKey: idemKey });
      if (existing) {
        await redis.set(idemRedisKey, String(existing._id), 'EX', IDEMPOTENCY_TTL_S);
        return res.status(200).json(toJobDto(existing));
      }
    }
    // Nothing was saved, so release the claim and let the client retry with the same key.
    if (idemRedisKey) await redis.del(idemRedisKey).catch(() => {});
    throw err;
  }
  // Swap the "pending" claim for the real job id so waiting duplicates can return it.
  if (idemRedisKey) await redis.set(idemRedisKey, String(_id), 'EX', IDEMPOTENCY_TTL_S);

  try {
    await enqueue({ type: doc.type, payload: doc.payload, priority: doc.priority, delayMs, jobId: String(_id) });
  } catch (err) {
    console.error('[jobs] enqueue failed, sweeper will retry:', err.message);
  }

  await invalidateStats();
  req.app.get('io')?.emitCreated(doc);
  res.status(202).json(toJobDto(doc));
}

async function listJobs(req, res) {
  const { status, type, q } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = { ...ownerFilter(req) };
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (q) filter.name = { $regex: String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const [items, total] = await Promise.all([
    Job.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-logs -payload -result')
      .populate('createdBy', 'name email'),
    Job.countDocuments(filter),
  ]);

  res.json({ items: items.map((j) => toJobDto(j)), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

async function getJob(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  // Non-owners get 404, so ids of other users' jobs are not even confirmed to exist.
  const job = await Job.findOne({ _id: req.params.id, ...ownerFilter(req) }).populate('createdBy', 'name email');
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(toJobDto(job, { detail: true }));
}

async function cancelJob(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  const job = await Job.findOne({ _id: req.params.id, ...ownerFilter(req) });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!CANCELLABLE.includes(job.status)) {
    return res.status(409).json({ error: `This job is ${job.status} and can no longer be cancelled` });
  }
  const bullJob = await jobQueue.getJob(String(job._id));
  if (bullJob) {
    const state = await bullJob.getState();
    if (state === 'active') {
      return res.status(409).json({ error: 'A worker is running this job right now, so it can no longer be cancelled' });
    }
    try {
      await bullJob.remove();
    } catch {
      return res.status(409).json({ error: 'A worker picked this job up a moment ago, so it can no longer be cancelled' });
    }
  }
  job.status = 'cancelled';
  job.finishedAt = new Date();
  job.logs.push({ level: 'warn', message: `Cancelled by ${req.user.name || 'user'}` });
  await job.save();
  await invalidateStats();
  req.app.get('io')?.to(`user:${job.createdBy}`).to('admins').emit('job:update', { id: String(job._id), status: 'cancelled' });
  res.json(toJobDto(job));
}

async function downloadResult(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  const job = await Job.findOne({ _id: req.params.id, ...ownerFilter(req) });
  const file = job?.result?.file;
  if (!file) return res.status(404).json({ error: 'No file for this job' });

  const root = path.resolve(config.dataDir);
  const full = path.resolve(root, file);
  if (!full.startsWith(root + path.sep) || !fs.existsSync(full)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(full);
}

// Plain-English reason a job failed. Uses Groq when a key is set, built-in rules otherwise.
async function explainJob(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  const job = await Job.findOne({ _id: req.params.id, ...ownerFilter(req) });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!['dead', 'retrying'].includes(job.status) || !job.error) {
    return res.status(409).json({ error: 'This job has no failure to explain' });
  }
  if (job.explanation && job.explanation.forError === job.error) {
    return res.json({ summary: job.explanation.summary, source: job.explanation.source });
  }
  const result = await explainFailure(job);
  await Job.updateOne({ _id: job._id }, { explanation: { ...result, forError: job.error, at: new Date() } });
  res.json(result);
}

module.exports = { createJob, listJobs, getJob, cancelJob, downloadResult, explainJob, createJobSchema };
