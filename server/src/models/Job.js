const mongoose = require('mongoose');

const JOB_TYPES = ['send-email', 'generate-report', 'process-csv'];
const JOB_STATUSES = ['scheduled', 'queued', 'processing', 'completed', 'retrying', 'dead', 'cancelled'];
const PRIORITIES = ['high', 'normal', 'low'];

const logSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    message: String,
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    queueJobId: { type: String, index: true },
    type: { type: String, enum: JOB_TYPES, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: JOB_STATUSES, default: 'queued', index: true },
    priority: { type: String, enum: PRIORITIES, default: 'normal' },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 4 },
    progress: { type: Number, default: 0 },
    result: { type: mongoose.Schema.Types.Mixed },
    error: String,
    logs: { type: [logSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKey: String,
    scheduleId: String,
    scheduledFor: Date,
    startedAt: Date,
    finishedAt: Date,
    emailSentAt: Date, // makes the email processor safe to repeat
    // Cached plain-English failure summary. Only valid while `forError` matches the job's current error.
    explanation: { summary: String, source: String, forError: String, at: Date },
  },
  { timestamps: true }
);

jobSchema.index({ createdBy: 1, createdAt: -1 });
// One idempotency key per user. Partial so jobs without a key never collide.
jobSchema.index(
  { createdBy: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);

module.exports = Job;
module.exports.JOB_TYPES = JOB_TYPES;
module.exports.JOB_STATUSES = JOB_STATUSES;
module.exports.PRIORITIES = PRIORITIES;
