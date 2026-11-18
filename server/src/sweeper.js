const Job = require('./models/Job');
const { jobQueue, enqueue } = require('./queue/producer');

/**
 * Outbox-lite. A job is saved in MongoDB BEFORE it is queued. If the API dies in
 * between, the record would sit in "queued" forever. This sweeper finds such
 * records and re-enqueues them. BullMQ ignores duplicate jobIds, so it is safe.
 */
async function sweepOnce({ olderThanMs = 30_000 } = {}) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const stale = await Job.find({ status: 'queued', createdAt: { $lt: cutoff } }).limit(100);
  let requeued = 0;
  for (const doc of stale) {
    const existing = await jobQueue.getJob(String(doc._id));
    if (existing) continue;
    await enqueue({
      type: doc.type,
      payload: doc.payload,
      priority: doc.priority,
      delayMs: 0,
      jobId: String(doc._id),
    });
    requeued += 1;
  }
  return requeued;
}

function startSweeper(intervalMs = 60_000) {
  const timer = setInterval(() => {
    sweepOnce().then(
      (n) => n && console.log(`[sweeper] re-enqueued ${n} orphaned job(s)`),
      (err) => console.error('[sweeper]', err.message)
    );
  }, intervalMs);
  timer.unref();
  return timer;
}

module.exports = { sweepOnce, startSweeper };
