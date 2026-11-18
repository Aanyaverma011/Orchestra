const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.SIMULATE_WORK_MS = '0';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-'));

jest.mock('../src/models/Job', () => ({
  updateOne: jest.fn().mockResolvedValue({}),
  findOne: jest.fn().mockResolvedValue(null),
}));

const Job = require('../src/models/Job');
const { nextStatusAfterFailure } = require('../src/lib');
const { sendEmail } = require('../src/processors/email');
const { generateReport } = require('../src/processors/report');
const { processCsv } = require('../src/processors/csv');

const fakeJob = (data, extra = {}) => ({
  id: 'job1',
  data,
  updateProgress: jest.fn().mockResolvedValue(),
  ...extra,
});

describe('failure handling', () => {
  test('retrying while attempts remain, dead once they are used up', () => {
    expect(nextStatusAfterFailure({ attemptsMade: 1, opts: { attempts: 4 } })).toBe('retrying');
    expect(nextStatusAfterFailure({ attemptsMade: 3, opts: { attempts: 4 } })).toBe('retrying');
    expect(nextStatusAfterFailure({ attemptsMade: 4, opts: { attempts: 4 } })).toBe('dead');
  });
});

describe('send-email processor', () => {
  test('delivers to a valid address', async () => {
    const res = await sendEmail(fakeJob({ to: 'a@b.com', subject: 'Hi' }));
    expect(res.to).toBe('a@b.com');
    expect(res.messageId).toBeTruthy();
  });

  test('throws on a bad address so the queue retries it', async () => {
    await expect(sendEmail(fakeJob({ to: 'not-an-email' }))).rejects.toThrow(/Invalid recipient/);
  });

  test('forceFail simulates an outage', async () => {
    await expect(sendEmail(fakeJob({ to: 'a@b.com', forceFail: true }))).rejects.toThrow(/SMTP/);
  });

  test('is idempotent: does not resend if emailSentAt is already set', async () => {
    Job.findOne.mockResolvedValueOnce({ emailSentAt: new Date(), result: { messageId: 'old' } });
    const res = await sendEmail(fakeJob({ to: 'a@b.com' }));
    expect(res).toEqual({ messageId: 'old' });
  });
});

describe('generate-report processor', () => {
  test('writes a PDF to disk', async () => {
    const res = await generateReport(fakeJob({ title: 'Test', employees: 60, format: 'pdf' }, { id: 'pdf1' }));
    expect(res.rows).toBe(60);
    const file = path.join(process.env.DATA_DIR, res.file);
    expect(fs.readFileSync(file).subarray(0, 4).toString()).toBe('%PDF');
  });

  test('writes a CSV with one line per employee plus header', async () => {
    const res = await generateReport(fakeJob({ employees: 25, format: 'csv' }, { id: 'csv1' }));
    const lines = fs.readFileSync(path.join(process.env.DATA_DIR, res.file), 'utf8').split('\n');
    expect(lines).toHaveLength(26);
  });
});

describe('process-csv processor', () => {
  test('counts rows and flags rows with empty cells', async () => {
    const dir = path.join(process.env.DATA_DIR, 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 't.csv'), 'name,email\nAnn,a@x.com\nBob,\nCy,c@x.com\n');
    const res = await processCsv(fakeJob({ file: 'uploads/t.csv', originalName: 't.csv' }));
    expect(res).toMatchObject({ rows: 3, rowsWithEmptyCells: 1, validRows: 2, columns: ['name', 'email'] });
  });

  test('rejects path traversal', async () => {
    await expect(processCsv(fakeJob({ file: '../../etc/passwd' }))).rejects.toThrow(/Invalid file path/);
  });
});
