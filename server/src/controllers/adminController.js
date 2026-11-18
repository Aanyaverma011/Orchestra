const mongoose = require('mongoose');
const Job = require('../models/Job');
const { enqueue, jobQueue } = require('../queue/producer');
const { invalidateStats } = require('../utils/cache');
const { toJobDto } = require('../utils/dto');
const { listWorkers } = require('./statsController');

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

  // BullMQ keeps the failed job (removeOnFail: false). Remove it so the same jobId can be queued again.
  const old = await jobQueue.getJob(String(job._id));
  if (old) await old.remove();

  job.status = 'queued';
  job.attempts = 0;
  job.progress = 0;
  job.error = undefined;
  job.finishedAt = undefined;
  job.logs.push({ level: 'info', message: `Re-queued by ${req.user.name || 'admin'}` });
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
