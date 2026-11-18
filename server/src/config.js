require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/orchestra',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: Number(process.env.REDIS_PORT || 6379),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  dataDir: process.env.DATA_DIR || './data',
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN || 20),
  seedOnStart: process.env.SEED_ON_START === 'true',
  seedDemoData: process.env.SEED_DEMO_DATA === 'true',
  queueName: process.env.QUEUE_NAME || 'orchestra-jobs',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
};
