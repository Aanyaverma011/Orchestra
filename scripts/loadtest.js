#!/usr/bin/env node
/**
 * Orchestra load test (guide section 15.2).
 * Submits N jobs through the real API and measures how long until every one has finished.
 * Needs Node 18+ (built-in fetch). No dependencies.
 *
 *   node scripts/loadtest.js --jobs 500
 *   node scripts/loadtest.js --jobs 500 --url http://localhost:5000 --type generate-report
 *
 * Before running, start the stack with a high rate limit and a short simulated delay:
 *   RATE_LIMIT_PER_MIN=100000 SIMULATE_WORK_MS=200 docker compose up -d --build --scale worker=1
 * Then repeat with --scale worker=3 and compare.
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
    return acc;
  }, [])
);

if (args.help) {
  console.log('Usage: node scripts/loadtest.js [--jobs 500] [--url http://localhost:5000] [--type send-email|generate-report] [--concurrency 20] [--timeout 600] [--work-ms 200] [--workers 3]');
  process.exit(0);
}

const N = Number(args.jobs || 500);
const BASE = (args.url || 'http://localhost:5000').replace(/\/$/, '');
const TYPE = args.type || 'send-email';
const SUBMIT_CONCURRENCY = Number(args.concurrency || 20);
const TIMEOUT_S = Number(args.timeout || 600);
const WORK_MS = args['work-ms']; // informational only, printed in the summary line

if (!Number.isInteger(N) || N < 1) fail('--jobs must be a positive whole number');
if (!['send-email', 'generate-report'].includes(TYPE)) fail('--type must be send-email or generate-report');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

function fail(msg) {
  console.error(`\nError: ${msg}\n`);
  process.exit(1);
}

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  // A brand-new user keeps the numbers isolated from any existing jobs.
  const email = `loadtest-${Date.now()}@example.com`;
  let reg;
  try {
    reg = await call('/auth/register', { method: 'POST', body: { name: 'Load Test', email, password: 'LoadTest123' } });
  } catch {
    fail(`Cannot reach the API at ${BASE}. Is the stack running? Try: docker compose up -d`);
  }
  if (reg.status !== 201) fail(`Could not create a test user (${reg.status}): ${reg.data.error || 'unknown error'}`);
  const token = reg.data.token;

  const stats0 = await call('/stats', { token });
  // The API reports live worker heartbeats. --workers overrides it if you know better.
  const workers = args.workers !== undefined ? Number(args.workers) : stats0.data.workers ?? '?';
  console.log(`\nOrchestra load test: ${N} ${TYPE} jobs, ${workers} worker(s) online, API ${BASE}`);
  if (workers === 0) fail('No workers are online, so jobs would never finish. Start one: docker compose up -d worker');

  const makeBody = (i) =>
    TYPE === 'send-email'
      ? { type: 'send-email', name: `Load ${i}`, priority: 'normal', payload: { to: 'load@example.com', subject: `Load test ${i}` } }
      : { type: 'generate-report', name: `Load ${i}`, priority: 'normal', payload: { title: `Load report ${i}`, employees: 200, format: 'csv' } };

  // Phase 1: submit. Each request should return in milliseconds even though the job itself is slow.
  const latencies = [];
  let next = 0;
  let rateLimited = false;
  const t0 = Date.now();
  async function submitter() {
    while (next < N && !rateLimited) {
      const i = next++;
      const s = Date.now();
      const res = await call('/jobs', { method: 'POST', token, body: makeBody(i) });
      latencies.push(Date.now() - s);
      if (res.status === 429) rateLimited = true;
      else if (res.status !== 202) fail(`Submit failed with ${res.status}: ${res.data.error || ''}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(SUBMIT_CONCURRENCY, N) }, submitter));
  if (rateLimited) {
    fail('The API rate limit (429) stopped the test. Restart the stack with RATE_LIMIT_PER_MIN=100000 so a single user can submit this many jobs.');
  }
  const submitMs = Date.now() - t0;
  const sorted = [...latencies].sort((a, b) => a - b);
  console.log(`Submitted ${N} jobs in ${(submitMs / 1000).toFixed(2)} s. API response time: p50 ${pct(sorted, 50)} ms, p95 ${pct(sorted, 95)} ms`);

  // Phase 2: wait until every job is completed or dead.
  process.stdout.write('Waiting for workers');
  const deadline = Date.now() + TIMEOUT_S * 1000;
  let completed = 0;
  let dead = 0;
  let lastShown = 0;
  while (Date.now() < deadline) {
    const [c, d] = await Promise.all([
      call('/jobs?status=completed&limit=1', { token }),
      call('/jobs?status=dead&limit=1', { token }),
    ]);
    completed = c.data.total || 0;
    dead = d.data.total || 0;
    if (Date.now() - lastShown > 2000) {
      process.stdout.write(` ${completed + dead}/${N}`);
      lastShown = Date.now();
    }
    if (completed + dead >= N) break;
    await sleep(400);
  }
  const totalMs = Date.now() - t0;
  console.log('');

  if (completed + dead < N) {
    fail(`Timed out after ${TIMEOUT_S}s with ${completed + dead} of ${N} finished. Check: docker compose logs worker`);
  }

  const seconds = totalMs / 1000;
  console.log('\nResult');
  console.log(`  Jobs finished     ${completed + dead} (${completed} completed, ${dead} dead)`);
  console.log(`  Total time        ${seconds.toFixed(1)} s (submit start to last job finished)`);
  console.log(`  Throughput        ${(N / seconds).toFixed(1)} jobs per second`);
  console.log(`  Workers           ${workers}`);
  console.log('\nResume line (only if you ran this yourself):');
  console.log(
    `  "Processed ${N} jobs with ${workers} worker${workers === 1 ? '' : 's'} in ${seconds.toFixed(0)} seconds (measured with a custom load-test script${WORK_MS ? `, ${WORK_MS} ms simulated work per job` : ''})."`
  );
  console.log('');
})().catch((e) => fail(e.message));
