/**
 * Per-Session Tool Call Rate Limiter.
 * Enforces a strict ceiling of 10 tool calls per minute per session to prevent runaway agent loops.
 */

const redisClient = require('../redis/client');

const MAX_TOOL_CALLS_PER_MINUTE = 10;
const WINDOW_SECONDS = 60;

async function checkSessionRateLimit(sessionId) {
  if (!sessionId) return { allowed: true };

  const key = `ratelimit:tools:${sessionId}`;

  try {
    const current = await redisClient.incr(key);
    if (current === 1) {
      await redisClient.set(key, '1', 'EX', WINDOW_SECONDS);
    }

    if (current > MAX_TOOL_CALLS_PER_MINUTE) {
      return {
        allowed: false,
        current,
        limit: MAX_TOOL_CALLS_PER_MINUTE,
        error: `Rate limit exceeded: Maximum ${MAX_TOOL_CALLS_PER_MINUTE} tool executions per minute reached for session '${sessionId}'.`,
      };
    }

    return {
      allowed: true,
      current,
      remaining: MAX_TOOL_CALLS_PER_MINUTE - current,
      limit: MAX_TOOL_CALLS_PER_MINUTE,
    };
  } catch (err) {
    // If rate limiter storage fails, allow for resilience but log warning
    console.warn('Rate limiter warning:', err.message);
    return { allowed: true };
  }
}

module.exports = {
  checkSessionRateLimit,
  MAX_TOOL_CALLS_PER_MINUTE,
};
