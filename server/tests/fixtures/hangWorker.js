// Child process used by the stalled-job test. It takes one job, tells the parent,
// then hangs forever. The parent kills it with SIGKILL to imitate a crashed worker.
const { Worker } = require('bullmq');

new Worker(
  process.env.QUEUE_NAME,
  async () => {
    process.send('started');
    await new Promise(() => {});
  },
  {
    connection: { host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT || 6379) },
    lockDuration: 1000,
    stalledInterval: 500,
  }
);
