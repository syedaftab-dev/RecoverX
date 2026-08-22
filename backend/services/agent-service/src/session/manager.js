/**
 * Session & Conversation History Manager for Agent Service.
 * Persists message threads in Redis with short TTL (1 hour).
 */

const redisClient = require('../redis/client');

const SESSION_TTL_SECONDS = 3600; // 1 hour

async function getSessionHistory(sessionId) {
  if (!sessionId) return [];
  try {
    const raw = await redisClient.get(`session:chat:${sessionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn(`Error loading session history for '${sessionId}':`, err.message);
    return [];
  }
}

async function saveSessionHistory(sessionId, messages) {
  if (!sessionId || !Array.isArray(messages)) return;
  try {
    // Keep last 20 messages to avoid token blowup
    const trimmed = messages.slice(-20);
    await redisClient.set(
      `session:chat:${sessionId}`,
      JSON.stringify(trimmed),
      'EX',
      SESSION_TTL_SECONDS
    );
  } catch (err) {
    console.warn(`Error saving session history for '${sessionId}':`, err.message);
  }
}

async function clearSessionHistory(sessionId) {
  if (!sessionId) return;
  try {
    await redisClient.del(`session:chat:${sessionId}`);
  } catch (err) {}
}

module.exports = {
  getSessionHistory,
  saveSessionHistory,
  clearSessionHistory,
};
