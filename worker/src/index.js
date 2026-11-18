const os = require('os');
const mongoose = require('mongoose');
const IORedis = require('ioredis');
const { Worker } = require('bullmq');

const config = require('./config');
const Job = require('./models/Job');
const Schedule = require('./models/Schedule');
const { nextStatusAfterFailure } = require('./lib');
const { sendEmail } = require('./processors/email');
const { generateReport } = require('./processors/report');
const { processCsv } = require('./processors/csv');

const PROCESSORS = {
  'send-email': sendEmail,
  'generate-report': generateReport,
  'process-csv': processCsv,
};

const workerId = `${os.hostname()}-${process.pid}`;
const startedAt = new Date().toISOString();
let processed = 0;
let failed = 0;

async function main() {
  await mongoose.connect(config.mongoUri);
  const redis = new IORedis({ host: config.redisHost, port: config.redisPort, maxRetriesPerRequest: null });
  const connection = { host: config.redisHost, port: config.redisPort };

  const worker = new Worker(
    config.queueName,
    async (job) => {
      const meta = job.data && job.data._meta;

      // Recurring jobs are created by BullMQ itself, so no Mongo record exists yet. Create it now.
      await Job.findOneAndUpdate(
        { queueJobId: job.id },
        {
          $setOnInsert: {
            queueJobId: job.id,
            name: meta?.name || job.name,
            type: job.name,
            payload: job.data,
            priority: meta?.priority || 'normal',
            createdBy: meta?.createdBy,
            scheduleId: meta?.scheduleId,
            logs: [{ level: 'info', message: 'Created by recurring schedule' }],
          },
        },
        { upsert: true }
      );
      if (meta?.scheduleId) await Schedule.updateOne({ _id: meta.scheduleId }, { lastRunAt: new Date() });

      await Job.updateOne(
        { queueJobId: job.id },
        {
          status: 'processing',
          startedAt: new Date(),
          attempts: job.attemptsMade + 1,
          progress: 0,
          $unset: { error: 1, finishedAt: 1 },
          $push: {
            logs: {
              at: new Date(),
              level: 'info',
              message: `Attempt ${job.attemptsMade + 1}/${job.opts.attempts || 1} started on ${workerId}`,
            },
          },
        }
      );

      const processor = PROCESSORS[job.name];
      if (!processor) throw new Error(`Unknown job type: ${job.name}`); // a throw means "failed"
      return processor(job);
    },
    { connection, concurrency: config.concurrency }
  );

  worker.on('completed', async (job, result) => {
    processed += 1;
    await Job.updateOne(
      { queueJobId: job.id },
      {
        status: 'completed',
        result,
        progress: 100,
        finishedAt: new Date(),
        $push: { logs: { at: new Date(), level: 'info', message: 'Completed successfully' } },
      }
    );
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    failed += 1;
    const status = nextStatusAfterFailure(job);
    const message =
      status === 'dead'
        ? `Failed permanently after ${job.attemptsMade} attempts: ${err.message}`
        : `Attempt ${job.attemptsMade} failed: ${err.message}. Retrying with backoff.`;
    await Job.updateOne(
      { queueJobId: job.id },
      {
        status,
        error: err.message,
        attempts: job.attemptsMade,
        ...(status === 'dead' ? { finishedAt: new Date() } : {}),
        $push: { logs: { at: new Date(), level: 'error', message } },
      }
    );
  });

  // This worker noticed another worker died while holding a job. BullMQ already re-queued it.
  worker.on('stalled', async (jobId) => {
    console.warn(`[worker] job ${jobId} stalled (its worker stopped responding), re-queued`);
    await Job.updateOne(
      { queueJobId: jobId },
      {
        status: 'queued',
        progress: 0,
        $push: { logs: { at: new Date(), level: 'warn', message: 'The worker running this job stopped responding. The job was put back in the queue for another worker.' } },
      }
    ).catch(() => {});
  });

  worker.on('error', (err) => console.error('[worker]', err.message));

  // Heartbeat so the dashboard can show how many workers are alive (key expires if we die).
  const beat = () =>
    redis
      .set(`worker:${workerId}`, JSON.stringify({ id: workerId, pid: process.pid, host: os.hostname(), startedAt, processed, failed, concurrency: config.concurrency }), 'EX', 15)
      .catch(() => {});
  beat();
  const timer = setInterval(beat, 5000);

  console.log(`[worker] ${workerId} ready (concurrency ${config.concurrency})`);

  // Graceful stop on SIGTERM: finish running jobs first.
  // To demonstrate crash recovery use `docker kill`, which cannot be caught.
  const shutdown = async () => {
    console.log('[worker] draining...');
    clearInterval(timer);
    await redis.del(`worker:${workerId}`).catch(() => {});
    await worker.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
