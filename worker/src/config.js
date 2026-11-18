require('dotenv').config();

module.exports = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/orchestra',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: Number(process.env.REDIS_PORT || 6379),
  concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  dataDir: process.env.DATA_DIR || './data',
  queueName: process.env.QUEUE_NAME || 'orchestra-jobs',
  // json  = no network, emails are rendered locally (default, demo-safe)
  // ethereal = real fake-SMTP inbox with a preview link per email
  mailMode: process.env.MAIL_MODE || 'json',
  // Adds a pause inside processors so status changes are visible in a demo.
  simulateWorkMs: Number(process.env.SIMULATE_WORK_MS || 1500),
};
