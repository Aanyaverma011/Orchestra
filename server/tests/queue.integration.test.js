/**
 * Queue behaviour against a REAL Redis (no mocks).
 * Skipped unless REDIS_INTEGRATION=1, so `npm test` still works without Redis.
 *   REDIS_INTEGRATION=1 npx jest tests/queue.integration.test.js
 */
process.env.QUEUE_NAME = `orchestra-test-${process.pid}-${Date.now()}`;

const path = require('path');
const { fork } = require('child_process');
const { Worker, QueueEvents } = require('bullmq');
const { jobQueue, connection, jobOptions, MAX_ATTEMPTS } = require('../src/queue/producer');
const { register } = require('../src/controllers/scheduleController');

const QUEUE = process.env.QUEUE_NAME;
const suite = process.env.REDIS_INTEGRATION ? describe : describe.skip;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await sleep(40);
  }
  throw new Error('waitFor timed out');
}
// Same decision the API and worker use to tell "retrying" from "dead".
const statusAfterFailure = (job) => (job.attemptsMade >= (job.opts.attempts || 1) ? 'dead' : 'retrying');
// Real producer options, but with a short backoff so the test runs in milliseconds.
const fast = (extra = {}) => ({ ...jobOptions(extra), backoff: { type: 'exponential', delay: 50 } });

suite('BullMQ behaviour with real Redis', () => {
  const open = [];
  const startWorker = (processor, opts = {}) => {
    const w = new Worker(QUEUE, processor, { connection, ...opts });
    open.push(w);
    return w;
  };

  // Every test starts with an empty queue and no workers left over from the previous one.
  beforeEach(async () => {
    await jobQueue.obliterate({ force: true });
  });
  afterEach(async () => {
    await Promise.all(open.splice(0).map((w) => w.close(true).catch(() => {})));
  });
  afterAll(async () => {
    await jobQueue.obliterate({ force: true }).catch(() => {});
    await jobQueue.close();
  });

  test('producer options: 4 attempts, exponential backoff of 2s, priorities map high < normal < low', () => {
    const o = jobOptions({ priority: 'high', delayMs: 0, jobId: 'x' });
    expect(MAX_ATTEMPTS).toBe(4);
    expect(o.attempts).toBe(4);
    expect(o.backoff).toEqual({ type: 'exponential', delay: 2000 });
    expect(o.priority).toBeLessThan(jobOptions({ priority: 'normal' }).priority);
    expect(jobOptions({ priority: 'normal' }).priority).toBeLessThan(jobOptions({ priority: 'low' }).priority);
  });

  test('a job that always throws is retrying, retrying, retrying, then dead', async () => {
    const statuses = [];
    const worker = startWorker(async () => { throw new Error('SMTP down'); });
    worker.on('failed', (job) => statuses.push(statusAfterFailure(job)));
    await jobQueue.add('send-email', {}, fast({ jobId: 'always-fails' }));
    await waitFor(() => statuses.length === 4);
    await sleep(300); // make sure no fifth attempt sneaks in
    expect(statuses).toEqual(['retrying', 'retrying', 'retrying', 'dead']);
  });

  test('high priority runs before normal before low', async () => {
    const order = [];
    await jobQueue.add('send-email', { n: 'low' }, fast({ priority: 'low', jobId: 'p-low' }));
    await jobQueue.add('send-email', { n: 'normal' }, fast({ priority: 'normal', jobId: 'p-normal' }));
    await jobQueue.add('send-email', { n: 'high' }, fast({ priority: 'high', jobId: 'p-high' }));
    startWorker(async (job) => { order.push(job.data.n); }, { concurrency: 1 });
    await waitFor(() => order.length === 3);
    expect(order).toEqual(['high', 'normal', 'low']);
  });

  test('a delayed job waits, then runs', async () => {
    const t0 = Date.now();
    let ranAt = 0;
    await jobQueue.add('send-email', {}, fast({ delayMs: 600, jobId: 'delayed-1' }));
    expect(await jobQueue.getJobCountByTypes('delayed')).toBe(1);
    startWorker(async () => { ranAt = Date.now(); });
    await waitFor(() => ranAt > 0);
    expect(ranAt - t0).toBeGreaterThanOrEqual(550);
  });

  test('adding the same jobId twice keeps one job', async () => {
    const a = await jobQueue.add('send-email', {}, fast({ jobId: 'dup-1' }));
    const b = await jobQueue.add('send-email', {}, fast({ jobId: 'dup-1' }));
    expect(b.id).toBe(a.id);
    // Prioritized jobs live in their own set, so count waiting and prioritized together.
    expect(await jobQueue.getJobCountByTypes('waiting', 'prioritized')).toBe(1);
  });

  test('a failed job can be removed and queued again with the same id (dead-letter retry)', async () => {
    let shouldFail = true;
    let completed = 0;
    startWorker(async () => {
      if (shouldFail) throw new Error('boom');
      completed += 1;
    });
    const once = { ...fast({ jobId: 'retry-me' }), attempts: 1 };
    await jobQueue.add('send-email', {}, once);
    await waitFor(async () => (await jobQueue.getJob('retry-me'))?.failedReason === 'boom');

    await (await jobQueue.getJob('retry-me')).remove();
    expect(await jobQueue.getJob('retry-me')).toBeUndefined();

    shouldFail = false;
    await jobQueue.add('send-email', {}, once);
    await waitFor(() => completed === 1);
  });

  test('QueueEvents reports the custom jobId, so the API can find the Mongo record', async () => {
    const id = '66f1a2b3c4d5e6f7a8b9c0d1';
    const events = new QueueEvents(QUEUE, { connection });
    await events.waitUntilReady();
    const seen = [];
    events.on('active', ({ jobId }) => seen.push(`active:${jobId}`));
    events.on('completed', ({ jobId }) => seen.push(`completed:${jobId}`));
    startWorker(async () => 'ok');
    await jobQueue.add('send-email', {}, fast({ jobId: id }));
    try {
      await waitFor(() => seen.includes(`completed:${id}`));
      expect(seen).toContain(`active:${id}`);
    } finally {
      await events.close();
    }
  });

  test('cron scheduler: valid pattern registers with our options, invalid pattern is rejected', async () => {
    await register({
      _id: 'sched-ok', cron: '* * * * *', type: 'generate-report', payload: { employees: 10 },
      priority: 'high', createdBy: 'user-1', name: 'Nightly',
    });
    const schedulers = await jobQueue.getJobSchedulers();
    expect(schedulers.map((s) => s.key)).toContain('sched-ok');

    const delayed = await jobQueue.getDelayed();
    const next = delayed.find((j) => j.data?._meta?.scheduleId === 'sched-ok');
    expect(next).toBeTruthy();
    expect(next.name).toBe('generate-report');
    expect(next.opts.priority).toBe(1);
    expect(next.opts.attempts).toBe(4);
    expect(next.data._meta.createdBy).toBe('user-1');

    await jobQueue.removeJobScheduler('sched-ok');
    expect((await jobQueue.getJobSchedulers()).map((s) => s.key)).not.toContain('sched-ok');

    await expect(
      register({ _id: 'sched-bad', cron: '99 99 * * *', type: 'send-email', payload: {}, priority: 'normal', createdBy: 'u', name: 'x' })
    ).rejects.toThrow();
  });

  test('crash recovery: a job held by a killed worker is finished by another worker', async () => {
    await jobQueue.add('send-email', {}, fast({ jobId: 'stalled-1' }));
    const child = fork(path.join(__dirname, 'fixtures', 'hangWorker.js'), { env: process.env });
    await new Promise((resolve, reject) => {
      child.once('message', (m) => (m === 'started' ? resolve() : reject(new Error('unexpected message'))));
      child.once('error', reject);
    });
    child.kill('SIGKILL'); // no chance to clean up, like a power cut

    let stalled = false;
    let done = false;
    const rescuer = startWorker(async () => 'rescued', { lockDuration: 1000, stalledInterval: 500 });
    rescuer.on('stalled', (id) => { if (id === 'stalled-1') stalled = true; });
    rescuer.on('completed', (job) => { if (job.id === 'stalled-1') done = true; });
    await waitFor(() => done, 15000);
    expect(stalled).toBe(true);
  }, 30000);
});
