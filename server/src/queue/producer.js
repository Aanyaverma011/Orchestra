const { Queue } = require('bullmq');
const config = require('../config');

const connection = { host: config.redisHost, port: config.redisPort };
const jobQueue = new Queue(config.queueName, { connection });

// In BullMQ a LOWER number runs first.
const PRIORITY = { high: 1, normal: 5, low: 10 };
const MAX_ATTEMPTS = 4;

function jobOptions({ priority = 'normal', delayMs = 0, jobId } = {}) {
  return {
    jobId, // same id twice -> BullMQ ignores the duplicate
    priority: PRIORITY[priority],
    delay: delayMs,
    attempts: MAX_ATTEMPTS, // 1 try + 3 retries
    backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s
    removeOnComplete: 1000, // history lives in MongoDB
    removeOnFail: false, // keep failed jobs for inspection
  };
}

function enqueue({ type, payload, priority, delayMs, jobId }) {
  return jobQueue.add(type, payload, jobOptions({ priority, delayMs, jobId }));
}

module.exports = { jobQueue, connection, enqueue, jobOptions, PRIORITY, MAX_ATTEMPTS };
