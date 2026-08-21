/**
 * Tool: retry_payment
 * Manages bounded payment retries with Redis counters (max 2 attempts per payment ID).
 * Fails closed if counter infrastructure fails, guaranteeing retries can never run unbounded.
 */

const { BOUNDS, isRetryWithinBounds } = require('../bounds/limits');
const redisClient = require('../redis/client');

const DEFAULT_PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:4003';

async function retryPayment(paymentId, method = 'CARD', options = {}) {
  if (!paymentId) {
    return {
      success: false,
      error: 'Missing required parameter: paymentId',
    };
  }

  const cacheKey = `payment:retry:${paymentId}`;

  // 1. Check current retry counter in Redis (Fail-closed on infrastructure failure)
  let currentAttempts = 0;
  try {
    const rawCount = await redisClient.get(cacheKey);
    currentAttempts = rawCount ? parseInt(rawCount, 10) : 0;
  } catch (err) {
    // Safety fail-closed: If we cannot verify the attempt count, reject to prevent unbounded retries
    return {
      success: false,
      status: 'REJECTED',
      failClosed: true,
      paymentId,
      error: 'Retry counter store unreachable. Payment retry rejected to prevent duplicate charges or unbounded attempts.',
    };
  }

  // 2. Reject outright if cap already reached (DO NOT increment)
  if (!isRetryWithinBounds(currentAttempts)) {
    return {
      success: false,
      status: 'REJECTED',
      bounded: true,
      paymentId,
      attemptsMade: currentAttempts,
      maxAllowedAttempts: BOUNDS.MAX_PAYMENT_RETRIES,
      reason: `Maximum payment retry limit of ${BOUNDS.MAX_PAYMENT_RETRIES} attempts reached for payment '${paymentId}'. Action rejected to prevent runaway loops or duplicate charges.`,
    };
  }

  // 3. Increment counter only on an actual approved retry attempt
  let newAttemptNumber;
  try {
    newAttemptNumber = await redisClient.incr(cacheKey);
    // Set 1-hour TTL on retry key
    await redisClient.set(cacheKey, String(newAttemptNumber), 'EX', 3600);
  } catch (err) {
    return {
      success: false,
      status: 'REJECTED',
      failClosed: true,
      paymentId,
      error: 'Could not record retry counter increment. Retry aborted for safety.',
    };
  }

  const baseUrl = options.baseUrl || DEFAULT_PAYMENT_URL;

  try {
    const res = await fetch(`${baseUrl}/payments/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, method, attemptNumber: newAttemptNumber }),
    });

    const data = await res.json();
    return {
      success: true,
      status: 'RETRY_INITIATED',
      bounded: true,
      paymentId,
      method,
      attemptNumber: newAttemptNumber,
      maxAllowedAttempts: BOUNDS.MAX_PAYMENT_RETRIES,
      remainingAttempts: Math.max(0, BOUNDS.MAX_PAYMENT_RETRIES - newAttemptNumber),
      response: data,
      explanation: `Initiated payment retry attempt ${newAttemptNumber} of ${BOUNDS.MAX_PAYMENT_RETRIES} using ${method}.`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to dispatch retry to payment-service: ${err.message}`,
      attemptNumber: newAttemptNumber,
    };
  }
}

module.exports = { retryPayment };
