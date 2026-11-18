const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');

let mongod;

async function startDb() {
  if (process.env.TEST_MONGO_STANDIN) {
    // Stand-ins for MongoDB (for example FerretDB) cannot build partial indexes. Real MongoDB can,
    // so only set this variable when you are not using the real thing.
    const Job = require('../src/models/Job');
    Job.schema._indexes = Job.schema._indexes.filter(([, opts]) => !opts.partialFilterExpression);
  }
  if (process.env.TEST_MONGO_URI) {
    // Use an existing MongoDB (CI service container, or a local one) instead of downloading a binary.
    await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: `orchestra_test_${process.pid}` });
  } else {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  }
  // Make sure unique/partial indexes exist before the first test runs.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

async function stopDb() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

const app = createApp();

async function registerUser(name = 'Test User', email = 'test@example.com', password = 'Password123') {
  const res = await request(app).post('/api/auth/register').send({ name, email, password });
  return { token: res.body.token, user: res.body.user, res };
}

async function makeAdmin(email = 'admin@example.com') {
  const bcrypt = require('bcryptjs');
  const User = require('../src/models/User');
  const { signToken } = require('../src/middleware/auth');
  const admin = await User.create({
    name: 'Admin',
    email,
    passwordHash: await bcrypt.hash('Password123', 4),
    role: 'admin',
  });
  return { token: signToken(admin), user: admin };
}

module.exports = { app, startDb, stopDb, clearDb, registerUser, makeAdmin };
