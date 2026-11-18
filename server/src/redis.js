const IORedis = require('ioredis');
const config = require('./config');

// One shared client for rate limiting, idempotency markers, cache and worker heartbeats.
// BullMQ opens its own connections from the plain options in queue/producer.js.
const redis = new IORedis({
  host: config.redisHost,
  port: config.redisPort,
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => console.error('[redis]', err.message));

module.exports = redis;
