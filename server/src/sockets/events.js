const { Server } = require('socket.io');
const { QueueEvents } = require('bullmq');
const config = require('../config');
const Job = require('../models/Job');
const { connection, jobQueue } = require('../queue/producer');
const { verifyToken } = require('../middleware/auth');
const { invalidateStats } = require('../utils/cache');
const { toJobDto } = require('../utils/dto');

/**
 * Workers are separate processes and cannot talk to browsers.
 * BullMQ publishes queue events to Redis, we subscribe here and forward them
 * to Socket.io rooms: `user:<id>` for the owner and `admins` for admins.
 */
function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigin, credentials: true },
  });

  io.use((socket, next) => {
    try {
      socket.user = verifyToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  // Who is signed in right now. One person can have several tabs open, so count sockets per user.
  const online = new Map();
  io.onlineUsers = () =>
    [...online.values()]
      .map((u) => ({ id: u.id, name: u.name, role: u.role, tabs: u.sockets.size, since: u.since }))
      .sort((a, b) => new Date(a.since) - new Date(b.since));

  io.on('connection', (socket) => {
    const { id, name, role } = socket.user;
    socket.join(`user:${id}`);
    if (role === 'admin') socket.join('admins');

    const entry = online.get(id) || { id, name, role, sockets: new Set(), since: new Date().toISOString() };
    entry.sockets.add(socket.id);
    online.set(id, entry);

    socket.on('disconnect', () => {
      const e = online.get(id);
      if (!e) return;
      e.sockets.delete(socket.id);
      if (!e.sockets.size) online.delete(id);
    });
  });

  const queueEvents = new QueueEvents(config.queueName, { connection });

  async function findJob(queueJobId) {
    let job = await Job.findOne({ queueJobId });
    if (!job) {
      // Recurring jobs: the worker creates the record a moment after BullMQ fires the event.
      await new Promise((r) => setTimeout(r, 400));
      job = await Job.findOne({ queueJobId });
    }
    return job;
  }

  async function push(queueJobId, status, extra = {}) {
    const job = await findJob(queueJobId);
    if (!job) return;
    io.to(`user:${job.createdBy}`)
      .to('admins')
      .emit('job:update', { id: String(job._id), status, ...extra });
  }

  queueEvents.on('active', async ({ jobId }) => {
    await invalidateStats(); // keeps the "processing" count on the dashboard fresh
    push(jobId, 'processing');
  });

  queueEvents.on('progress', ({ jobId, data }) => {
    if (typeof data === 'number') push(jobId, 'processing', { progress: data });
  });

  queueEvents.on('completed', async ({ jobId }) => {
    await invalidateStats();
    push(jobId, 'completed', { progress: 100 });
  });

  queueEvents.on('failed', async ({ jobId, failedReason }) => {
    await invalidateStats();
    // The event doesn't say whether attempts remain, so ask the queue.
    const bullJob = await jobQueue.getJob(jobId);
    const exhausted = bullJob ? bullJob.attemptsMade >= (bullJob.opts.attempts || 1) : true;
    push(jobId, exhausted ? 'dead' : 'retrying', { error: failedReason });
  });

  // A worker died mid-job: BullMQ put the job back in the queue for another worker.
  queueEvents.on('stalled', async ({ jobId }) => {
    await invalidateStats();
    push(jobId, 'queued');
  });

  queueEvents.on('error', (err) => console.error('[queue-events]', err.message));

  io.emitCreated = (doc) =>
    io.to(`user:${doc.createdBy}`).to('admins').emit('job:created', toJobDto(doc));

  return io;
}

module.exports = { initSockets };
