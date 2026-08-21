/**
 * Tool: apply_discount
 * Enforces strict code-level guardrail for discounts (≤15% auto-approves, >15% requires human gating).
 * When threshold is crossed, automatically records a pending approval in the merchant queue.
 */

const { BOUNDS, isDiscountWithinBounds } = require('../bounds/limits');
const { escalateToHuman } = require('./escalateToHuman');

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
    // Automatically persist to merchant pending approval queue
    const escalation = await escalateToHuman(
      `Out-of-bounds discount request: ${pct}% on order value ₹${value} (reason: ${reason})`,
      {
        actionType: 'APPLY_DISCOUNT',
        orderValue: value,
        requestedDiscountPct: pct,
        maxAllowedAutoPct: BOUNDS.MAX_AUTO_DISCOUNT_PERCENT,
        reason,
      }
    );

    return {
      success: true,
      status: 'REQUIRES_GATE',
      bounded: false,
      gated: true,
      approvalId: escalation.approvalId,
      requestedDiscountPct: pct,
      maxAllowedAutoPct: BOUNDS.MAX_AUTO_DISCOUNT_PERCENT,
      orderValue: value,
      finalAmount: value, // Untouched!
      discountAmount: 0,
      reason,
      explanation: `Requested discount of ${pct}% exceeds the automatic approval ceiling of ${BOUNDS.MAX_AUTO_DISCOUNT_PERCENT}%. Action paused and queued for merchant approval (Approval ID: ${escalation.approvalId}).`,
    };
  }

  // Calculate approved bounded discount
  const discountAmount = Number(((value * pct) / 100).toFixed(2));
  const finalAmount = Number((value - discountAmount).toFixed(2));

  return {
    success: true,
    status: 'APPROVED',
    bounded: true,
    gated: false,
    discountPct: pct,
    discountAmount,
    originalOrderValue: value,
    finalAmount,
    reason,
    explanation: `Applied ${pct}% recovery discount (saved ₹${discountAmount}) within automatic limit (≤${BOUNDS.MAX_AUTO_DISCOUNT_PERCENT}%).`,
  };
}

module.exports = { applyDiscount };
