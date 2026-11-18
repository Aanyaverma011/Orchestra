const config = require('../src/config');
const { explainFailure, explainWithRules } = require('../src/services/explain');

const job = (error, extra = {}) => ({
  type: 'send-email',
  status: 'dead',
  attempts: 4,
  maxAttempts: 4,
  error,
  logs: [{ level: 'error', message: `Attempt 4 failed: ${error}` }],
  payload: { to: 'secret.person@example.com' },
  ...extra,
});

describe('built-in failure rules', () => {
  test.each([
    ['Invalid recipient address: "x"', /not valid/, /Retrying will fail again/],
    ['SMTP connection timed out (ETIMEDOUT)', /could not be reached/, /temporary/],
    ['Upstream returned 503', /depends on/, /recover/],
    ['CSV has no header row', /missing or has no header/, /Upload the file again/],
    ['job stalled more than allowable limit', /stopped responding/, /worker logs/],
    ['Something nobody has seen before', /does not recognise/, /execution log/],
  ])('%s', (error, cause, fix) => {
    const { summary, source } = explainWithRules(job(error));
    expect(source).toBe('rules');
    expect(summary).toMatch(cause);
    expect(summary).toMatch(fix);
  });
});

describe('explainFailure', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    config.groqApiKey = '';
  });

  test('uses built-in rules when no Groq key is configured and never calls the network', async () => {
    global.fetch = jest.fn();
    const out = await explainFailure(job('SMTP connection timed out'));
    expect(out.source).toBe('rules');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('uses Groq when a key is set, and never sends the job payload', async () => {
    config.groqApiKey = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'The mail server was down. Retrying should work.' } }] }),
    });
    const out = await explainFailure(job('SMTP connection timed out'));
    expect(out).toEqual({ summary: 'The mail server was down. Retrying should work.', source: 'groq' });

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toMatch(/api\.groq\.com/);
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(init.body).not.toContain('secret.person@example.com');
    expect(init.body).toContain('SMTP connection timed out');
  });

  test.each([
    ['an HTTP error', () => Promise.resolve({ ok: false, status: 429 })],
    ['a network failure', () => Promise.reject(new Error('socket hang up'))],
    ['an empty answer', () => Promise.resolve({ ok: true, json: async () => ({ choices: [] }) })],
  ])('falls back to built-in rules on %s', async (_name, impl) => {
    config.groqApiKey = 'test-key';
    global.fetch = jest.fn(impl);
    const out = await explainFailure(job('Invalid recipient address: "x"'));
    expect(out.source).toBe('rules');
    expect(out.summary).toMatch(/not valid/);
  });
});
