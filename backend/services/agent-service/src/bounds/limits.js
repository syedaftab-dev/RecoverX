/**
 * Hardcoded Safety Bounds & Thresholds for Agent Actions.
 * These limits live strictly in code, not in LLM prompts.
 */

const BOUNDS = {
  // Hard ceiling on automatic discounts without merchant approval (15%)
  MAX_AUTO_DISCOUNT_PERCENT: 15,

  // Hard ceiling on order value created without merchant gating (₹5,000)
  MAX_AUTO_ORDER_VALUE: 5000,

  // Maximum payment retries allowed before requiring manual intervention
  MAX_PAYMENT_RETRIES: 2,
};

function isDiscountWithinBounds(discountPct) {
  const pct = Number(discountPct);
  return !isNaN(pct) && pct >= 0 && pct <= BOUNDS.MAX_AUTO_DISCOUNT_PERCENT;
}

function isOrderValueWithinBounds(orderValue) {
  const val = Number(orderValue);
  return !isNaN(val) && val >= 0 && val <= BOUNDS.MAX_AUTO_ORDER_VALUE;
}

function isRetryWithinBounds(attemptsMade) {
  const attempts = Number(attemptsMade);
  return !isNaN(attempts) && attempts < BOUNDS.MAX_PAYMENT_RETRIES;
}

module.exports = {
  BOUNDS,
  isDiscountWithinBounds,
  isOrderValueWithinBounds,
  isRetryWithinBounds,
};
