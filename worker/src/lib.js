const Job = require('./models/Job');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Append a line to the job's execution log (shown in the dashboard drawer).
function log(job, level, message) {
  return Job.updateOne(
    { queueJobId: job.id },
    { $push: { logs: { at: new Date(), level, message } } }
  ).catch(() => {});
}

async function progress(job, pct) {
  await Promise.all([
    job.updateProgress(pct),
    Job.updateOne({ queueJobId: job.id }, { progress: pct }).catch(() => {}),
  ]);
}

/**
 * Decide what a failure means. BullMQ has no built-in dead-letter queue, so
 * Orchestra marks a job "dead" once every attempt is used up.
 */
function nextStatusAfterFailure(job) {
  const max = (job.opts && job.opts.attempts) || 1;
  return job.attemptsMade >= max ? 'dead' : 'retrying';
}

module.exports = { sleep, log, progress, nextStatusAfterFailure };
