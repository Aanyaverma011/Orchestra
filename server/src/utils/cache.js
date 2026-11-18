const redis = require('../redis');

const STATS_TTL_SECONDS = 30;

// Drop every cached stats blob (per-user and admin) so numbers never stay stale.
async function invalidateStats() {
  try {
    const keys = await redis.keys('stats:*');
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    console.error('[cache] invalidate failed:', err.message);
  }
}

module.exports = { invalidateStats, STATS_TTL_SECONDS };
