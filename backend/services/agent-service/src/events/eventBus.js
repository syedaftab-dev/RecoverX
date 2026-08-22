/**
 * RecoverX Event Bus Module for agent-service (Redis Streams + PubSub)
 */

const crypto = require('crypto');

let Redis;
try {
  Redis = require('ioredis');
} catch (e) {}

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
let redisPublisher = null;
let isConnected = false;

if (Redis) {
  try {
    redisPublisher = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
      lazyConnect: true,
    });

    redisPublisher.connect().then(() => {
      isConnected = true;
    }).catch(() => {});
  } catch (e) {}
}

const inMemoryEventStore = [];

/**
 * Publish an immutable event to the Redis Stream and PubSub channel.
 */
async function publishEvent(eventType, payload = {}, reasoningTrail = []) {
  const eventId = `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const timestamp = new Date().toISOString();

  const eventEnvelope = {
    eventId,
    eventType,
    payload,
    reasoningTrail: Array.isArray(reasoningTrail) ? reasoningTrail : [reasoningTrail],
    timestamp,
  };

  if (redisPublisher && isConnected) {
    try {
      const serialized = JSON.stringify(eventEnvelope);
      // 1. Append to Redis Stream for persistent audit consumption
      await redisPublisher.xadd('recoverx:stream', '*', 'event', serialized);
      // 2. Publish to PubSub for real-time subscribers
      await redisPublisher.publish(`recoverx:events:${eventType}`, serialized);
      await redisPublisher.publish('recoverx:events:all', serialized);
    } catch (err) {
      console.warn('⚠️ EventBus Redis publish warning:', err.message);
    }
  }

  inMemoryEventStore.push(eventEnvelope);
  if (inMemoryEventStore.length > 500) inMemoryEventStore.shift();

  return eventEnvelope;
}

function getRecentEvents() {
  return [...inMemoryEventStore];
}

module.exports = {
  publishEvent,
  getRecentEvents,
};
