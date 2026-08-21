/**
 * Tool: create_order
 * Validates order ceiling (≤₹5,000 auto-approves, >₹5,000 requires human gating),
 * generates idempotency key, and calls payment-service.
 * When threshold is crossed, automatically records a pending approval in the merchant queue.
 */

const crypto = require('crypto');
const { BOUNDS, isOrderValueWithinBounds } = require('../bounds/limits');
const { escalateToHuman } = require('./escalateToHuman');

const DEFAULT_PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:4003';

async function createOrder(cartItems, customerId = 'guest', options = {}) {
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return {
      success: false,
      error: 'cartItems must be a non-empty array of items with price and quantity.',
    };
  }

  // Calculate total order amount
  const totalAmount = Number(
    cartItems
      .reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0)
      .toFixed(2)
  );

  if (isNaN(totalAmount) || totalAmount <= 0) {
    return {
      success: false,
      error: 'Calculated order value is invalid or non-positive.',
    };
  }

  // --- HARD NUMERIC SAFETY CHECK (₹5000 Limit) ---
  if (!isOrderValueWithinBounds(totalAmount)) {
    // Automatically persist to merchant pending approval queue
    const escalation = await escalateToHuman(
      `High-value order requires merchant approval: ₹${totalAmount} (Threshold: ₹${BOUNDS.MAX_AUTO_ORDER_VALUE})`,
      {
        actionType: 'CREATE_ORDER',
        totalAmount,
        maxAllowedAutoValue: BOUNDS.MAX_AUTO_ORDER_VALUE,
        cartItems,
        customerId,
      }
    );

    return {
      success: true,
      status: 'REQUIRES_GATE',
      bounded: false,
      gated: true,
      approvalId: escalation.approvalId,
      totalAmount,
      maxAllowedAutoValue: BOUNDS.MAX_AUTO_ORDER_VALUE,
      cartItems,
      customerId,
      reason: `Order value ₹${totalAmount} exceeds the automatic creation ceiling of ₹${BOUNDS.MAX_AUTO_ORDER_VALUE}. Gated and queued for merchant approval (Approval ID: ${escalation.approvalId}).`,
    };
  }

  // Generate UUID / unique Idempotency Key
  const idempotencyKey = options.idempotencyKey || `idemp_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const baseUrl = options.baseUrl || DEFAULT_PAYMENT_URL;

  try {
    const res = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cartItems,
        customerId,
        totalAmount,
        idempotencyKey,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || `Payment service returned HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      status: 'APPROVED',
      bounded: true,
      gated: false,
      idempotencyKey,
      totalAmount,
      order: data.order,
      explanation: `Order created successfully within automatic limit (≤₹${BOUNDS.MAX_AUTO_ORDER_VALUE}).`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to connect to payment-service: ${err.message}`,
    };
  }
}

module.exports = { createOrder };
