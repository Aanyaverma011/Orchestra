const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const config = require('../config');
const { auth, requireRole } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const authCtl = require('../controllers/authController');
const jobCtl = require('../controllers/jobController');
const statsCtl = require('../controllers/statsController');
const adminCtl = require('../controllers/adminController');
const schedCtl = require('../controllers/scheduleController');
const Job = require('../models/Job');
const { enqueue } = require('../queue/producer');
const { invalidateStats } = require('../utils/cache');
const { toJobDto } = require('../utils/dto');
const redis = require('../redis');

// Express 4 does not catch rejected promises on its own.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const uploadDir = path.resolve(config.dataDir, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /\.csv$/i.test(file.originalname) ? cb(null, true) : cb(new Error('Only .csv files are allowed')),
});

const router = express.Router();

router.get(
  '/health',
  wrap(async (req, res) => {
    const redisOk = (await redis.ping()) === 'PONG';
    const mongoOk = mongoose.connection.readyState === 1;
    res.status(redisOk && mongoOk ? 200 : 503).json({ ok: redisOk && mongoOk, redis: redisOk, mongo: mongoOk });
  })
);

// Auth
router.post('/auth/register', validate(authCtl.registerSchema), wrap(authCtl.register));
router.post('/auth/login', validate(authCtl.loginSchema), wrap(authCtl.login));
router.get('/auth/me', auth, wrap(authCtl.me));

// Jobs
router.post('/jobs', auth, rateLimit, validate(jobCtl.createJobSchema), wrap(jobCtl.createJob));
router.get('/jobs', auth, wrap(jobCtl.listJobs));
router.get('/jobs/:id', auth, wrap(jobCtl.getJob));
router.post('/jobs/:id/cancel', auth, wrap(jobCtl.cancelJob));
router.get('/jobs/:id/download', auth, wrap(jobCtl.downloadResult));
router.post('/jobs/:id/explain', auth, rateLimit, wrap(jobCtl.explainJob));

// CSV upload -> creates a process-csv job
router.post(
  '/uploads/csv',
  auth,
  rateLimit,
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Attach a .csv file in the "file" field' });
    const _id = new mongoose.Types.ObjectId();
    const priority = ['high', 'normal', 'low'].includes(req.body.priority) ? req.body.priority : 'normal';
    const doc = await Job.create({
      _id,
      queueJobId: String(_id),
      name: req.body.name || `Import ${req.file.originalname}`,
      type: 'process-csv',
      payload: { file: path.relative(path.resolve(config.dataDir), req.file.path), originalName: req.file.originalname },
      priority,
      status: 'queued',
      createdBy: req.user.id,
      logs: [{ level: 'info', message: `Uploaded ${req.file.originalname} (${req.file.size} bytes)` }],
    });
    try {
      await enqueue({ type: doc.type, payload: doc.payload, priority, delayMs: 0, jobId: String(_id) });
    } catch (err) {
      console.error('[uploads] enqueue failed, sweeper will retry:', err.message);
    }
    await invalidateStats();
    req.app.get('io')?.emitCreated(doc);
    res.status(202).json(toJobDto(doc));
  })
);

// Stats
router.get('/stats', auth, wrap(statsCtl.getStats));

// Schedules
router.post('/schedules', auth, validate(schedCtl.scheduleSchema), wrap(schedCtl.create));
router.get('/schedules', auth, wrap(schedCtl.list));
router.patch('/schedules/:id', auth, validate(schedCtl.toggleSchema), wrap(schedCtl.toggle));
router.delete('/schedules/:id', auth, wrap(schedCtl.remove));

// Admin
router.get('/admin/dead-letter', auth, requireRole('admin'), wrap(adminCtl.listDead));
router.post('/admin/dead-letter/:id/retry', auth, requireRole('admin'), wrap(adminCtl.retryDead));
router.get('/admin/workers', auth, requireRole('admin'), wrap(adminCtl.workers));
router.get('/admin/online-users', auth, requireRole('admin'), wrap(adminCtl.onlineUsers));

module.exports = router;
