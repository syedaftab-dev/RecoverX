/**
 * Tool: apply_discount
 * Enforces strict code-level guardrail for discounts (≤15% auto-approves, >15% requires human gating).
 */

const { BOUNDS, isDiscountWithinBounds } = require('../bounds/limits');

async function applyDiscount(orderValue, discountPct, reason = 'Customer recovery discount') {
  const value = Number(orderValue);
  const pct = Number(discountPct);

  if (isNaN(value) || value <= 0) {
    return {
      success: false,
      error: 'Invalid order value. Must be a positive number.',
    };
  }

  if (isNaN(pct) || pct < 0) {
    return {
      success: false,
      error: 'Invalid discount percentage. Must be non-negative.',
    };
  }

  // --- HARD NUMERIC SAFETY CHECK ---
  if (!isDiscountWithinBounds(pct)) {
    return {
      success: true,
      status: 'REQUIRES_GATE',
      bounded: false,
      requestedDiscountPct: pct,
      maxAllowedAutoPct: BOUNDS.MAX_AUTO_DISCOUNT_PERCENT,
      orderValue: value,
      finalAmount: value, // Untouched!
      discountAmount: 0,
      reason,
      explanation: `Requested discount of ${pct}% exceeds the automatic approval ceiling of ${BOUNDS.MAX_AUTO_DISCOUNT_PERCENT}%. Action paused for human merchant approval.`,
    };
  }

  // Calculate approved bounded discount
  const discountAmount = Number(((value * pct) / 100).toFixed(2));
  const finalAmount = Number((value - discountAmount).toFixed(2));

  return {
    success: true,
    status: 'APPROVED',
    bounded: true,
    discountPct: pct,
    discountAmount,
    originalOrderValue: value,
    finalAmount,
    reason,
    explanation: `Applied ${pct}% recovery discount (saved ₹${discountAmount}) within automatic limit (≤${BOUNDS.MAX_AUTO_DISCOUNT_PERCENT}%).`,
  };
}

module.exports = { applyDiscount };
