const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

// In-memory fallback map for standalone unit tests or disconnected environments
const inMemoryStore = new Map();

let redis = null;
let isConnected = false;

try {
  let Redis;
  try {
    Redis = require('ioredis');
  } catch (e) {
    // ioredis not available in local host node_modules, fallback to in-memory store
  }

  if (Redis) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
      lazyConnect: true,
    });

    redis.connect().then(() => {
      isConnected = true;
    }).catch((err) => {});

    redis.on('connect', () => { isConnected = true; });
    redis.on('error', (err) => { isConnected = false; });
  }
} catch (e) {}

module.exports = {
  get: async (key) => {
    if (isConnected && redis) {
      try {
        return await redis.get(key);
      } catch (e) {
        return inMemoryStore.get(key) || null;
      }
    }
    return inMemoryStore.get(key) || null;
  },

  set: async (key, val, mode, ttl) => {
    if (isConnected && redis) {
      try {
        if (mode && ttl) {
          return await redis.set(key, val, mode, ttl);
        }
        return await redis.set(key, val);
      } catch (e) {
        inMemoryStore.set(key, val);
      }
    }
    inMemoryStore.set(key, val);
    return 'OK';
  },

  incr: async (key) => {
    if (isConnected && redis) {
      try {
        return await redis.incr(key);
      } catch (e) {
        const current = parseInt(inMemoryStore.get(key) || '0', 10);
        const next = current + 1;
        inMemoryStore.set(key, String(next));
        return next;
      }
    }
    const current = parseInt(inMemoryStore.get(key) || '0', 10);
    const next = current + 1;
    inMemoryStore.set(key, String(next));
    return next;
  },

  rpush: async (key, val) => {
    if (isConnected && redis) {
      try {
        return await redis.rpush(key, val);
      } catch (e) {
        const list = inMemoryStore.get(key) || [];
        list.push(val);
        inMemoryStore.set(key, list);
        return list.length;
      }
    }
    const list = inMemoryStore.get(key) || [];
    list.push(val);
    inMemoryStore.set(key, list);
    return list.length;
  },

  del: async (key) => {
    if (isConnected && redis) {
      try {
        await redis.del(key);
      } catch (e) {}
    }
    inMemoryStore.delete(key);
    return 1;
  },

  clearMemoryStore: () => {
    inMemoryStore.clear();
  },
};
