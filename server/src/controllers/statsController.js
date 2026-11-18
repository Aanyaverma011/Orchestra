const mongoose = require('mongoose');
const Job = require('../models/Job');
const redis = require('../redis');
const { jobQueue } = require('../queue/producer');
const { STATS_TTL_SECONDS } = require('../utils/cache');

const WINDOW_MINUTES = 30;

async function listWorkers() {
  const keys = await redis.keys('worker:*');
  if (!keys.length) return [];
  const values = await redis.mget(keys);
  return values
    .map((v) => {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function computeStats(match) {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  since.setSeconds(0, 0);

  const [byStatusRows, byTypeRows, avgRows, createdRows, doneRows, counts, workers] = await Promise.all([
    Job.aggregate([{ $match: match }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Job.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$type',
          n: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          dead: { $sum: { $cond: [{ $eq: ['$status', 'dead'] }, 1, 0] } },
        },
      },
    ]),
    Job.aggregate([
      { $match: { ...match, status: 'completed', startedAt: { $ne: null }, finishedAt: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: { $subtract: ['$finishedAt', '$startedAt'] } } } },
    ]),
    Job.aggregate([
      { $match: { ...match, createdAt: { $gte: since } } },
      { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'minute' } }, n: { $sum: 1 } } },
    ]),
    Job.aggregate([
      { $match: { ...match, finishedAt: { $gte: since }, status: { $in: ['completed', 'dead'] } } },
      {
        $group: {
          _id: { t: { $dateTrunc: { date: '$finishedAt', unit: 'minute' } }, s: '$status' },
          n: { $sum: 1 },
        },
      },
    ]),
    jobQueue.getJobCounts('waiting', 'active', 'delayed'),
    listWorkers(),
  ]);

  const byStatus = Object.fromEntries(byStatusRows.map((r) => [r._id, r.n]));
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const completed = byStatus.completed || 0;
  const dead = byStatus.dead || 0;
  const finished = completed + dead;

  // Fill every minute so the chart has no gaps.
  const created = new Map(createdRows.map((r) => [new Date(r._id).getTime(), r.n]));
  const done = new Map();
  doneRows.forEach((r) => done.set(`${new Date(r._id.t).getTime()}:${r._id.s}`, r.n));
  const series = [];
  for (let i = 0; i < WINDOW_MINUTES; i++) {
    const t = since.getTime() + i * 60_000;
    series.push({
      t,
      submitted: created.get(t) || 0,
      completed: done.get(`${t}:completed`) || 0,
      failed: done.get(`${t}:dead`) || 0,
    });
  }

  return {
    total,
    byStatus,
    byType: byTypeRows.map((r) => ({ type: r._id, total: r.n, completed: r.completed, dead: r.dead })),
    inFlight: (byStatus.queued || 0) + (byStatus.processing || 0) + (byStatus.retrying || 0) + (byStatus.scheduled || 0),
    successRate: finished ? Math.round((completed / finished) * 1000) / 10 : null,
    avgMs: avgRows[0] ? Math.round(avgRows[0].avg) : null,
    failedOrDead: dead,
    queue: { waiting: counts.waiting || 0, active: counts.active || 0, delayed: counts.delayed || 0 },
    workers: workers.length,
    series,
    generatedAt: new Date().toISOString(),
  };
}

// Cache-aside: Redis first, MongoDB on a miss, store with a short TTL.
async function getStats(req, res) {
  const admin = req.user.role === 'admin';
  const key = `stats:${admin ? 'admin' : req.user.id}`;

  const cached = await redis.get(key);
  if (cached) return res.set('X-Cache', 'HIT').json(JSON.parse(cached));

  const match = admin ? {} : { createdBy: new mongoose.Types.ObjectId(req.user.id) };
  const stats = await computeStats(match);
  await redis.set(key, JSON.stringify(stats), 'EX', STATS_TTL_SECONDS);
  res.set('X-Cache', 'MISS').json(stats);
}

module.exports = { getStats, listWorkers };
