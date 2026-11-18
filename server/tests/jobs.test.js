jest.mock('../src/redis', () => require('./mocks').redisFactory());
jest.mock('../src/queue/producer', () => require('./mocks').producerFactory());

const request = require('supertest');
const { app, startDb, stopDb, clearDb, registerUser, makeAdmin } = require('./helpers');
const { enqueue } = require('../src/queue/producer');
const Job = require('../src/models/Job');
const redis = require('../src/redis');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  await redis.flushall();
  enqueue.mockClear();
});

const emailJob = { type: 'send-email', name: 'Welcome', payload: { to: 'a@b.com', subject: 'Hi' } };
const post = (token, body = emailJob, headers = {}) =>
  request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).set(headers).send(body);

describe('POST /api/jobs', () => {
  test('returns 202, stores status queued and enqueues with the Mongo id', async () => {
    const { token } = await registerUser();
    const res = await post(token);
    expect(res.status).toBe(202);
    expect(res.body.status).toBe('queued');

    const doc = await Job.findById(res.body.id);
    expect(doc.status).toBe('queued');
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ jobId: res.body.id, type: 'send-email' }));
  });

  test('a delayed job is stored as scheduled', async () => {
    const { token } = await registerUser();
    const res = await post(token, { ...emailJob, delayMs: 60_000 });
    expect(res.status).toBe(202);
    expect(res.body.status).toBe('scheduled');
  });

  test('the same Idempotency-Key twice creates only one job', async () => {
    const { token } = await registerUser();
    const a = await post(token, emailJob, { 'Idempotency-Key': 'double-click-1' });
    const b = await post(token, emailJob, { 'Idempotency-Key': 'double-click-1' });
    expect(a.status).toBe(202);
    expect(b.status).toBe(200);
    expect(b.body.id).toBe(a.body.id);
    expect(await Job.countDocuments()).toBe(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  test('the 21st request in a minute returns 429', async () => {
    const { token } = await registerUser();
    let last;
    for (let i = 0; i < 21; i++) last = await post(token);
    expect(last.status).toBe(429);
    expect(await Job.countDocuments()).toBe(20);
  });

  test('rejects an unknown job type', async () => {
    const { token } = await registerUser();
    expect((await post(token, { type: 'mine-bitcoin' })).status).toBe(400);
  });
});

describe('job visibility and cancel', () => {
  test('users see only their own jobs; admins see all', async () => {
    const a = await registerUser('Ann', 'ann@example.com');
    const b = await registerUser('Bob', 'bob@example.com');
    const admin = await makeAdmin();
    const jobA = (await post(a.token)).body;
    await post(b.token);

    const listA = await request(app).get('/api/jobs').set('Authorization', `Bearer ${a.token}`);
    expect(listA.body.total).toBe(1);

    const peek = await request(app).get(`/api/jobs/${jobA.id}`).set('Authorization', `Bearer ${b.token}`);
    expect(peek.status).toBe(404);

    const listAdmin = await request(app).get('/api/jobs').set('Authorization', `Bearer ${admin.token}`);
    expect(listAdmin.body.total).toBe(2);
  });

  test('a queued job can be cancelled, a finished one cannot', async () => {
    const { token } = await registerUser();
    const job = (await post(token)).body;
    const ok = await request(app).post(`/api/jobs/${job.id}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('cancelled');

    await Job.updateOne({ _id: job.id }, { status: 'completed' });
    const no = await request(app).post(`/api/jobs/${job.id}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(no.status).toBe(409);
  });
});

describe('dead-letter retry', () => {
  test('admin can re-queue a dead job', async () => {
    const { token } = await registerUser();
    const admin = await makeAdmin();
    const job = (await post(token)).body;
    await Job.updateOne({ _id: job.id }, { status: 'dead', attempts: 4, error: 'SMTP down' });
    enqueue.mockClear();

    const res = await request(app)
      .post(`/api/admin/dead-letter/${job.id}/retry`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('queued');
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ jobId: job.id }));
  });
});

describe('idempotency marker in Redis', () => {
  test('the key is remembered in Redis for 24 hours', async () => {
    const { token, user } = await registerUser();
    const res = await post(token, emailJob, { 'Idempotency-Key': 'k-redis' });
    expect(await redis.get(`idem:${user.id}:k-redis`)).toBe(res.body.id);
    const ttl = await redis.ttl(`idem:${user.id}:k-redis`);
    expect(ttl).toBeGreaterThan(86000);
  });

  test('five simultaneous requests with one key create exactly one job', async () => {
    const { token } = await registerUser();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => post(token, emailJob, { 'Idempotency-Key': 'race-1' }))
    );
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(results.filter((r) => r.status === 202)).toHaveLength(1);
    expect(results.filter((r) => r.status === 200)).toHaveLength(4);
    expect(await Job.countDocuments()).toBe(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  test('a failed create releases the key so the client can retry', async () => {
    const { token, user } = await registerUser();
    const spy = jest.spyOn(Job, 'create').mockRejectedValueOnce(new Error('db down'));
    const first = await post(token, emailJob, { 'Idempotency-Key': 'retry-after-fail' });
    spy.mockRestore();
    expect(first.status).toBe(500);
    expect(await redis.get(`idem:${user.id}:retry-after-fail`)).toBeNull();
    const second = await post(token, emailJob, { 'Idempotency-Key': 'retry-after-fail' });
    expect(second.status).toBe(202);
  });

  test('a key longer than 200 characters is rejected', async () => {
    const { token } = await registerUser();
    const res = await post(token, emailJob, { 'Idempotency-Key': 'x'.repeat(201) });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/jobs/:id/explain', () => {
  const explain = (token, id) => request(app).post(`/api/jobs/${id}/explain`).set('Authorization', `Bearer ${token}`);

  test('explains a dead job with the built-in rules and caches the answer', async () => {
    const { token } = await registerUser();
    const job = (await post(token)).body;
    await Job.updateOne({ _id: job.id }, { status: 'dead', error: 'Invalid recipient address: "x"' });

    const res = await explain(token, job.id);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('rules');
    expect(res.body.summary).toMatch(/not valid/);

    const detail = await request(app).get(`/api/jobs/${job.id}`).set('Authorization', `Bearer ${token}`);
    expect(detail.body.explanation.summary).toBe(res.body.summary);
  });

  test('returns 409 for a job that has not failed', async () => {
    const { token } = await registerUser();
    const job = (await post(token)).body;
    expect((await explain(token, job.id)).status).toBe(409);
  });

  test("returns 404 for someone else's job", async () => {
    const a = await registerUser('Ann', 'ann@example.com');
    const b = await registerUser('Bob', 'bob@example.com');
    const job = (await post(a.token)).body;
    await Job.updateOne({ _id: job.id }, { status: 'dead', error: 'boom' });
    expect((await explain(b.token, job.id)).status).toBe(404);
  });
});

describe('GET /api/stats', () => {
  test('is cached: first call MISS, second call HIT', async () => {
    const { token } = await registerUser();
    await post(token);
    const first = await request(app).get('/api/stats').set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.headers['x-cache']).toBe('MISS');
    expect(first.body.total).toBe(1);
    const second = await request(app).get('/api/stats').set('Authorization', `Bearer ${token}`);
    expect(second.headers['x-cache']).toBe('HIT');
  });
});
