// Mirror of server/src/models/Job.js. Both processes share the same MongoDB collection.
const mongoose = require('mongoose');

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
    type: { type: String, enum: ['send-email', 'generate-report', 'process-csv'], required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['scheduled', 'queued', 'processing', 'completed', 'retrying', 'dead', 'cancelled'],
      default: 'queued',
      index: true,
    },
    priority: { type: String, enum: ['high', 'normal', 'low'], default: 'normal' },
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
    emailSentAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.models.Job || mongoose.model('Job', jobSchema);
