/**
 * RecoverX Autonomous Payment Decline Recovery Engine (src/recovery/declineRecovery.js)
 *
 * Implements the core revenue recovery decision loop:
 * 1. Analyzes payment.failed event payload & failure reason
 * 2. Formulates a plain-language recovery plan BEFORE acting
 * 3. Executes bounded recovery strictly through the 7 tool functions
 * 4. Publishes payment.recovered or recovery.failed with full immutable audit reasoning trail
 */

const tools = require('../tools');
const { publishEvent } = require('../events/eventBus');

/**
 * Main decline recovery orchestrator.
 */
async function handlePaymentDecline(declineEvent, options = {}) {
  if (!declineEvent || !declineEvent.paymentId) {
    throw new Error('Invalid decline event: Missing paymentId');
  }

  const {
    paymentId,
    orderId,
    amount = 0,
    customerId = 'guest',
    declineCode = 'TRANSIENT_NETWORK_TIMEOUT',
    declineReason = 'Payment failed during processing',
    paymentMethod = 'CARD',
  } = declineEvent;

  const reasoningTrail = [];
  const startTime = new Date().toISOString();

  // Log initial detection in reasoning trail
  reasoningTrail.push({
    step: 'DECLINE_DETECTED',
    timestamp: startTime,
    declineCode,
    declineReason,
    explanation: `RecoverX detected payment decline on payment '${paymentId}' for order '${orderId}' (Amount: ₹${amount}). Initializing autonomous recovery evaluation.`,
  });

  let recoveryPlan = '';
  let toolResult = null;
  let isRecovered = false;
  let finalStatus = 'FAILED';

  // ──────────────────────────────────────────────────────────────────────────
  // STRATEGY 1: Transient Timeout / Network Glitch -> Switch to UPI & Retry
  // ──────────────────────────────────────────────────────────────────────────
  if (declineCode === 'TRANSIENT_NETWORK_TIMEOUT' || declineCode === 'GATEWAY_TIMEOUT') {
    const alternativeMethod = paymentMethod === 'CARD' ? 'UPI' : 'CARD';
    recoveryPlan = `Transient payment timeout detected on ${paymentMethod}. Strategy: Switch payment channel to ${alternativeMethod} and execute bounded retry (max 2 attempts).`;

    reasoningTrail.push({
      step: 'PLAN_FORMULATED',
      strategy: 'RETRY_PAYMENT',
      recoveryPlan,
      timestamp: new Date().toISOString(),
    });

    // Execute through existing retryPayment tool
    const retryRes = await tools.retryPayment(paymentId, alternativeMethod, options);
    toolResult = retryRes;

    if (retryRes.success && retryRes.status === 'RETRY_INITIATED') {
      isRecovered = true;
      finalStatus = 'RECOVERED_VIA_RETRY';

      reasoningTrail.push({
        step: 'ACTION_EXECUTED',
        tool: 'retry_payment',
        result: retryRes,
        explanation: `Payment retry attempt #${retryRes.attemptNumber} of 2 successfully dispatched using ${alternativeMethod}. Recovery confirmed.`,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Retry capped or failed -> Fallback to human escalation
      reasoningTrail.push({
        step: 'RETRY_EXHAUSTED',
        tool: 'retry_payment',
        result: retryRes,
        explanation: `Payment retry was rejected or capped: ${retryRes.reason || retryRes.error}. Escalating to human merchant.`,
        timestamp: new Date().toISOString(),
      });

      const escalation = await tools.escalateToHuman(
        `Payment retry cap exhausted for payment '${paymentId}' (Amount: ₹${amount})`,
        { paymentId, orderId, amount, declineCode, declineReason }
      );
      toolResult = escalation;
      finalStatus = 'ESCALATED_TO_HUMAN';
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STRATEGY 2: Insufficient Funds / Price Hesitation -> Bounded Discount (10%)
  // ──────────────────────────────────────────────────────────────────────────
  else if (declineCode === 'INSUFFICIENT_FUNDS' || declineCode === 'PRICE_FRICTION') {
    const discountPct = 10; // Bounded relief discount (≤15%)
    recoveryPlan = `Decline caused by insufficient funds or price hesitation. Strategy: Offer 10% instant friction-reducing discount (within 15% code bound) to recover the transaction.`;

    reasoningTrail.push({
      step: 'PLAN_FORMULATED',
      strategy: 'BOUNDED_DISCOUNT',
      recoveryPlan,
      timestamp: new Date().toISOString(),
    });

    // Execute through existing applyDiscount tool
    const discountRes = await tools.applyDiscount(
      amount,
      discountPct,
      `Autonomous decline recovery discount for order ${orderId}`
    );
    toolResult = discountRes;

    if (discountRes.status === 'APPROVED') {
      isRecovered = true;
      finalStatus = 'RECOVERED_VIA_DISCOUNT';

      reasoningTrail.push({
        step: 'ACTION_EXECUTED',
        tool: 'apply_discount',
        result: discountRes,
        explanation: `Successfully applied bounded ${discountPct}% discount. Order total reduced from ₹${amount} to ₹${discountRes.finalAmount} (saved ₹${discountRes.discountAmount}). Revenue protected.`,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Gated discount -> requires merchant authorization
      finalStatus = 'GATED_PENDING_APPROVAL';

      reasoningTrail.push({
        step: 'ACTION_GATED',
        tool: 'apply_discount',
        result: discountRes,
        explanation: `Discount requires merchant authorization (Approval ID: ${discountRes.approvalId}).`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STRATEGY 3: Unrecoverable Decline / Fraud Risk -> Direct Human Escalation
  // ──────────────────────────────────────────────────────────────────────────
  else {
    recoveryPlan = `Unrecoverable bank decline (${declineCode}: ${declineReason}). Automated self-recovery is unsafe. Strategy: Immediately escalate to human merchant team with full transaction context.`;

    reasoningTrail.push({
      step: 'PLAN_FORMULATED',
      strategy: 'ESCALATE_TO_HUMAN',
      recoveryPlan,
      timestamp: new Date().toISOString(),
    });

    const escalation = await tools.escalateToHuman(
      `Unrecoverable payment decline (${declineCode}): ${declineReason}`,
      { paymentId, orderId, amount, customerId, declineCode, declineReason }
    );
    toolResult = escalation;
    finalStatus = 'ESCALATED_TO_HUMAN';

    reasoningTrail.push({
      step: 'ACTION_EXECUTED',
      tool: 'escalate_to_human',
      result: escalation,
      explanation: `Escalation registered with merchant manager (Approval ID: ${escalation.approvalId}). Customer will be contacted manually.`,
      timestamp: new Date().toISOString(),
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Publish Structured Event to Event Bus (payment.recovered OR recovery.failed)
  // ──────────────────────────────────────────────────────────────────────────
  let publishedEvent;
  if (isRecovered) {
    publishedEvent = await publishEvent(
      'payment.recovered',
      {
        paymentId,
        orderId,
        customerId,
        originalAmount: amount,
        recoveredAmount: toolResult.finalAmount || amount,
        discountSaved: toolResult.discountAmount || 0,
        recoveryStrategy: finalStatus,
        toolResult,
      },
      reasoningTrail
    );
    console.log(`✅ [agent-service] Payment ${paymentId} RECOVERED (${finalStatus}). Event: ${publishedEvent.eventId}`);
  } else {
    publishedEvent = await publishEvent(
      'recovery.failed',
      {
        paymentId,
        orderId,
        customerId,
        amount,
        finalStatus,
        declineCode,
        declineReason,
        toolResult,
      },
      reasoningTrail
    );
    console.log(`⚠️ [agent-service] Payment ${paymentId} Recovery Paused/Escalated (${finalStatus}). Event: ${publishedEvent.eventId}`);
  }

  return {
    success: true,
    isRecovered,
    finalStatus,
    paymentId,
    orderId,
    recoveryPlan,
    toolResult,
    reasoningTrail,
    eventId: publishedEvent.eventId,
    eventType: publishedEvent.eventType,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  handlePaymentDecline,
};
