const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('⚡ Connected to Redis cache.');
});

redis.on('error', (err) => {
  console.warn('⚠️ Redis Cache Warning:', err.message);
});

async function getCached(key) {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.warn(`Redis get error for key "${key}":`, err.message);
    return null;
  }
}

async function setCached(key, value, ttlSeconds = 60) {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.warn(`Redis set error for key "${key}":`, err.message);
  }
}

async function invalidateCache(key) {
  try {
    await redis.del(key);
  } catch (err) {
    console.warn(`Redis del error for key "${key}":`, err.message);
  }
}

module.exports = {
  redis,
  getCached,
  setCached,
  invalidateCache,
};
