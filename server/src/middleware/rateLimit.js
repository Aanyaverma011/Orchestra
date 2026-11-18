const redis = require('../redis');
const config = require('../config');

// Fixed-window counter: one Redis key per user per minute.
async function rateLimit(req, res, next) {
  try {
    const key = `rate:${req.user.id}:${Math.floor(Date.now() / 60000)}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    const limit = config.rateLimitPerMin;
    res.set('X-RateLimit-Limit', String(limit));
    res.set('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
    if (count > limit) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = rateLimit;
