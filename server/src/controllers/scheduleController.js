const mongoose = require('mongoose');
const { z } = require('zod');
const Schedule = require('../models/Schedule');
const { jobQueue, jobOptions } = require('../queue/producer');

const scheduleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['send-email', 'generate-report', 'process-csv']),
  payload: z.record(z.any()).default({}),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  // 5-field cron expression, e.g. "0 9 * * *"
  cron: z.string().trim().regex(/^(\S+\s+){4}\S+$/, 'Use a 5-field cron expression, e.g. 0 9 * * *'),
});

const toggleSchema = z.object({ active: z.boolean() });

async function register(s) {
  await jobQueue.upsertJobScheduler(
    String(s._id),
    { pattern: s.cron },
    {
      name: s.type,
      data: { ...s.payload, _meta: { createdBy: String(s.createdBy), scheduleId: String(s._id), name: s.name, priority: s.priority } },
      opts: (({ jobId, delay, ...rest }) => rest)(jobOptions({ priority: s.priority })),
    }
  );
}

const scope = (req) => (req.user.role === 'admin' ? {} : { createdBy: req.user.id });

async function create(req, res) {
  const s = await Schedule.create({ ...req.body, createdBy: req.user.id });
  try {
    await register(s);
  } catch (err) {
    await s.deleteOne();
    return res.status(400).json({ error: `Invalid cron expression: ${err.message}` });
  }
  res.status(201).json(s);
}

async function list(req, res) {
  res.json({ items: await Schedule.find(scope(req)).sort({ createdAt: -1 }) });
}

async function toggle(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Schedule not found' });
  const s = await Schedule.findOne({ _id: req.params.id, ...scope(req) });
  if (!s) return res.status(404).json({ error: 'Schedule not found' });
  s.active = req.body.active;
  await s.save();
  if (s.active) await register(s);
  else await jobQueue.removeJobScheduler(String(s._id));
  res.json(s);
}

async function remove(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Schedule not found' });
  const s = await Schedule.findOne({ _id: req.params.id, ...scope(req) });
  if (!s) return res.status(404).json({ error: 'Schedule not found' });
  await jobQueue.removeJobScheduler(String(s._id));
  await s.deleteOne();
  res.status(204).end();
}

module.exports = { create, list, toggle, remove, register, scheduleSchema, toggleSchema };
