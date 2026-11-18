const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./models/User');
const Job = require('./models/Job');

const ADMIN = { name: 'Admin', email: 'admin@orchestra.dev', password: 'Admin@123', role: 'admin' };
const DEMO = { name: 'Aanya Verma', email: 'demo@orchestra.dev', password: 'Demo@1234', role: 'user' };

async function ensureUser({ name, email, password, role }) {
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10), role });
  return user;
}

const NAMES = {
  'send-email': ['Payment confirmation', 'Welcome email', 'Invoice reminder', 'Password reset', 'Shipment update'],
  'generate-report': ['Monthly sales report', 'Attendance report', 'Payroll summary', 'Inventory audit'],
  'process-csv': ['Customer import', 'Product catalogue sync', 'Employee roster import'],
};

// Historical records so a fresh install has a populated dashboard for screenshots.
async function seedDemoJobs(userId) {
  if (await Job.countDocuments()) return;
  const types = Object.keys(NAMES);
  const docs = [];
  const now = Date.now();
  for (let i = 0; i < 160; i++) {
    const type = types[i % types.length];
    const minutesAgo = Math.floor(Math.random() * 28);
    const created = new Date(now - minutesAgo * 60_000 - Math.random() * 50_000);
    const dur = 800 + Math.random() * 3600;
    const roll = Math.random();
    const status = roll < 0.9 ? 'completed' : roll < 0.96 ? 'dead' : 'retrying';
    const names = NAMES[type];
    const _id = new mongoose.Types.ObjectId();
    docs.push({
      _id,
      queueJobId: String(_id),
      name: names[i % names.length],
      type,
      payload: {},
      priority: ['high', 'normal', 'normal', 'low'][i % 4],
      status,
      attempts: status === 'dead' ? 4 : status === 'retrying' ? 2 : 1,
      progress: status === 'completed' ? 100 : 0,
      error: status === 'dead' ? 'SMTP connection timed out (ETIMEDOUT)' : status === 'retrying' ? 'Upstream returned 503' : undefined,
      createdBy: userId,
      startedAt: new Date(created.getTime() + 400),
      finishedAt: status === 'retrying' ? undefined : new Date(created.getTime() + 400 + dur),
      createdAt: created,
      logs: [{ at: created, level: 'info', message: 'Job accepted and queued' }],
    });
  }
  await Job.insertMany(docs, { timestamps: false });
}

async function seed({ demoData = false } = {}) {
  const admin = await ensureUser(ADMIN);
  const demo = await ensureUser(DEMO);
  if (demoData) await seedDemoJobs(demo._id);
  return { admin, demo };
}

module.exports = { seed, ADMIN, DEMO };

if (require.main === module) {
  const config = require('./config');
  mongoose
    .connect(config.mongoUri)
    .then(() => seed({ demoData: true }))
    .then(() => {
      console.log(`Seeded.\n  admin: ${ADMIN.email} / ${ADMIN.password}\n  user:  ${DEMO.email} / ${DEMO.password}`);
      return mongoose.disconnect();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
