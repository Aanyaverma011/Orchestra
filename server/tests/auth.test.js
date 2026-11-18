jest.mock('../src/redis', () => require('./mocks').redisFactory());
jest.mock('../src/queue/producer', () => require('./mocks').producerFactory());

const request = require('supertest');
const { app, startDb, stopDb, clearDb, registerUser, makeAdmin } = require('./helpers');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

describe('auth', () => {
  test('register returns a JWT and never grants admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password: 'Password123', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('user');
  });

  test('login returns a token; wrong password returns 401', async () => {
    await registerUser('Ann', 'ann@example.com', 'Password123');
    const ok = await request(app).post('/api/auth/login').send({ email: 'ann@example.com', password: 'Password123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const bad = await request(app).post('/api/auth/login').send({ email: 'ann@example.com', password: 'nope' });
    expect(bad.status).toBe(401);
  });

  test('protected routes reject missing or bad tokens', async () => {
    expect((await request(app).get('/api/jobs')).status).toBe(401);
    expect((await request(app).get('/api/jobs').set('Authorization', 'Bearer junk')).status).toBe(401);
  });

  test('validation rejects a weak payload with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'not-an-email', password: '1' });
    expect(res.status).toBe(400);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });
});

describe('role based access', () => {
  test('a normal user gets 403 on admin routes, an admin gets 200', async () => {
    const { token } = await registerUser();
    const { token: adminToken } = await makeAdmin();
    expect((await request(app).get('/api/admin/dead-letter').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(app).get('/api/admin/dead-letter').set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
  });
});
