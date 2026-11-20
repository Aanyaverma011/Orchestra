const mongoose = require('mongoose');
const Job = require('../models/Job');
const { enqueue, jobQueue } = require('../queue/producer');
const { invalidateStats } = require('../utils/cache');
const { toJobDto } = require('../utils/dto');
const { listWorkers } = require('./statsController');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function listDead(req, res) {
  const jobs = await Job.find({ status: 'dead' })
    .sort({ finishedAt: -1 })
    .limit(200)
    .populate('createdBy', 'name email');
  res.json({ items: jobs.map((j) => toJobDto(j, { detail: true })) });
}

async function retryDead(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'dead') return res.status(409).json({ error: 'Only dead jobs can be retried' });

  // Retrying with the exact same input usually fails the exact same way, so fix the input first.
  const payload = { ...(job.payload || {}) };
  const notes = [];

  // "Simulate outage" is a demo switch. Leaving it on means the retry can never succeed.
  if (payload.forceFail) {
    delete payload.forceFail;
    notes.push('simulated outage switched off');
  }

  // Let the admin correct a bad email address while retrying.
  const newTo = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
  if (job.type === 'send-email') {
    if (newTo) {
      if (!EMAIL_RE.test(newTo)) return res.status(400).json({ error: `"${newTo}" is not a valid email address` });
      if (newTo !== payload.to) notes.push(`recipient changed to ${newTo}`);
      payload.to = newTo;
    }
    if (!payload.to || !EMAIL_RE.test(payload.to)) {
      return res.status(400).json({ error: 'This email has no valid recipient. Enter a correct address and retry.' });
    }
  }
  if (job.type === 'process-csv' && !payload.file) {
    return res.status(409).json({ error: 'The CSV file for this job is missing. Upload the file again as a new job.' });
  }

  // BullMQ keeps the failed job (removeOnFail: false). Remove it so the same jobId can be queued again.
  try {
    const old = await jobQueue.getJob(String(job._id));
    if (old) await old.remove();
  } catch (err) {
    return res.status(409).json({ error: 'The queue is still holding this job. Wait a few seconds and try again.' });
  }

  job.payload = payload;
  job.markModified('payload');
  job.status = 'queued';
  job.attempts = 0;
  job.progress = 0;
  job.error = undefined;
  job.finishedAt = undefined;
  job.startedAt = undefined;
  job.explanation = undefined;
  job.logs.push({ level: 'info', message: `Re-queued by ${req.user.name || 'admin'}${notes.length ? ` (${notes.join(', ')})` : ''}` });
  await job.save();

  await enqueue({ type: job.type, payload: job.payload, priority: job.priority, delayMs: 0, jobId: String(job._id) });
  await invalidateStats();
  req.app.get('io')?.to(`user:${job.createdBy}`).to('admins').emit('job:update', { id: String(job._id), status: 'queued', progress: 0 });
  res.json(toJobDto(job));
}

async function workers(req, res) {
  res.json({ items: await listWorkers() });
}

// People with the dashboard open right now. This is separate from workers, which are background processes.
async function onlineUsers(req, res) {
  res.json({ items: req.app.get('io')?.onlineUsers?.() || [] });
}

module.exports = { listDead, retryDead, workers, onlineUsers };
