const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    name: String,
    type: String,
    payload: mongoose.Schema.Types.Mixed,
    priority: String,
    cron: String,
    createdBy: mongoose.Schema.Types.ObjectId,
    active: Boolean,
    lastRunAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);
