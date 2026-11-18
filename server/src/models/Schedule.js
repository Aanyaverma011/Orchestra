const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['send-email', 'generate-report', 'process-csv'], required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    priority: { type: String, enum: ['high', 'normal', 'low'], default: 'normal' },
    cron: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    active: { type: Boolean, default: true },
    lastRunAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);
