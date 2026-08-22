/**
 * Day 5 Payment Decline Detection & Autonomous Recovery Flow Integration Test Suite
 * Tests:
 *  Case 1: Decline recovered via retry (TRANSIENT_NETWORK_TIMEOUT -> retry_payment -> payment.recovered)
 *  Case 2: Decline recovered via bounded discount (INSUFFICIENT_FUNDS -> apply_discount -> payment.recovered)
 *  Case 3: Unrecoverable decline escalated to human (FRAUD_SUSPECTED -> escalate_to_human -> recovery.failed)
 */

const assert = require('assert');

const BASE_URL = 'http://localhost:8080';

async function runRecoveryTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('💳 RUNNING PAYMENT DECLINE RECOVERY INTEGRATION TESTS (DAY 5)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function testPass(name, detail = '') {
    console.log(`  ✅ PASS: ${name} ${detail ? `-> ${detail}` : ''}`);
    passed++;
  }

  function testFail(name, err) {
    console.error(`  ❌ FAIL: ${name} ->`, err.message || err);
    failed++;
  }

  // =========================================================================
  // CASE 1: Decline Recovered via Retry (Transient Network Timeout)
  // =========================================================================
  console.log('--- 1. Testing Case 1: Decline Recovered via Alternate Channel Retry ---');
  try {
    // Step 1: Trigger simulated decline in payment-service
    const payRes = await fetch(`${BASE_URL}/api/payment/payments/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: `ord_transient_${Date.now()}`,
        amount: 2499,
        customerId: 'cust_amit',
        paymentMethod: 'CARD',
        simulateDecline: true,
        declineCode: 'TRANSIENT_NETWORK_TIMEOUT',
        declineReason: 'Bank 3D-Secure authentication timed out',
      }),
    });

    assert.strictEqual(payRes.status, 402, 'Expected HTTP 402 Payment Required for declined payment');
    const payData = await payRes.json();
    assert.strictEqual(payData.status, 'FAILED');
    assert.strictEqual(payData.declineCode, 'TRANSIENT_NETWORK_TIMEOUT');
    assert(payData.paymentId, 'Expected paymentId in decline response');
    assert(payData.eventId, 'Expected eventId for published payment.failed');

    // Step 2: Pass decline event to Agent Recovery Engine
    const recRes = await fetch(`${BASE_URL}/api/agent/recovery/payment-decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payData),
    });

    assert.strictEqual(recRes.status, 200);
    const recData = await recRes.json();

    assert.strictEqual(recData.success, true);
    assert.strictEqual(recData.isRecovered, true);
    assert.strictEqual(recData.finalStatus, 'RECOVERED_VIA_RETRY');
    assert.strictEqual(recData.eventType, 'payment.recovered');
    assert(Array.isArray(recData.reasoningTrail), 'Reasoning trail must be an array');
    assert(recData.reasoningTrail.length >= 3, 'Expected at least 3 reasoning steps (detection, plan, action)');
    assert.strictEqual(recData.toolResult.attemptNumber, 1);
    assert.strictEqual(recData.toolResult.method, 'UPI');

    testPass(
      'Case 1: Transient Timeout Recovery',
      `Strategy=RETRY (Switched CARD->UPI), Event=${recData.eventType}, Status=${recData.finalStatus}`
    );
  } catch (e) {
    testFail('Case 1: Transient Timeout Recovery', e);
  }

  // =========================================================================
  // CASE 2: Decline Recovered via Bounded Discount (Insufficient Funds)
  // =========================================================================
  console.log('\n--- 2. Testing Case 2: Decline Recovered via Bounded 10% Discount ---');
  try {
    // Step 1: Trigger insufficient funds decline in payment-service
    const payRes2 = await fetch(`${BASE_URL}/api/payment/payments/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: `ord_funds_${Date.now()}`,
        amount: 3000,
        customerId: 'cust_priya',
        paymentMethod: 'UPI',
        simulateDecline: true,
        declineCode: 'INSUFFICIENT_FUNDS',
        declineReason: 'Account balance insufficient for ₹3000',
      }),
    });

    assert.strictEqual(payRes2.status, 402);
    const payData2 = await payRes2.json();

    // Step 2: Pass decline event to Agent Recovery Engine
    const recRes2 = await fetch(`${BASE_URL}/api/agent/recovery/payment-decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payData2),
    });

    assert.strictEqual(recRes2.status, 200);
    const recData2 = await recRes2.json();

    assert.strictEqual(recData2.success, true);
    assert.strictEqual(recData2.isRecovered, true);
    assert.strictEqual(recData2.finalStatus, 'RECOVERED_VIA_DISCOUNT');
    assert.strictEqual(recData2.eventType, 'payment.recovered');
    assert.strictEqual(recData2.toolResult.status, 'APPROVED');
    assert.strictEqual(recData2.toolResult.discountPct, 10);
    assert.strictEqual(recData2.toolResult.discountAmount, 300);
    assert.strictEqual(recData2.toolResult.finalAmount, 2700);

    testPass(
      'Case 2: Insufficient Funds Discount Recovery',
      `Applied 10% discount (Saved ₹300, New total: ₹2700), Event=${recData2.eventType}`
    );
  } catch (e) {
    testFail('Case 2: Insufficient Funds Discount Recovery', e);
  }

  // =========================================================================
  // CASE 3: Unrecoverable Decline Escalated to Human (Fraud Risk / Severe Decline)
  // =========================================================================
  console.log('\n--- 3. Testing Case 3: Unrecoverable Decline Escalates to Human ---');
  try {
    // Step 1: Trigger fraud risk decline
    const payRes3 = await fetch(`${BASE_URL}/api/payment/payments/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: `ord_fraud_${Date.now()}`,
        amount: 15000,
        customerId: 'cust_unknown',
        paymentMethod: 'CARD',
        simulateDecline: true,
        declineCode: 'FRAUD_SUSPECTED',
        declineReason: 'Card flagged by issuing bank risk monitor',
      }),
    });

    assert.strictEqual(payRes3.status, 402);
    const payData3 = await payRes3.json();

    // Step 2: Pass decline event to Agent Recovery Engine
    const recRes3 = await fetch(`${BASE_URL}/api/agent/recovery/payment-decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payData3),
    });

    assert.strictEqual(recRes3.status, 200);
    const recData3 = await recRes3.json();

    assert.strictEqual(recData3.success, true);
    assert.strictEqual(recData3.isRecovered, false, 'Unrecoverable fraud decline must not auto-recover');
    assert.strictEqual(recData3.finalStatus, 'ESCALATED_TO_HUMAN');
    assert.strictEqual(recData3.eventType, 'recovery.failed');
    assert(recData3.toolResult.approvalId, 'Expected approvalId from escalation tool');
    assert.strictEqual(recData3.toolResult.unblockable, true);

    testPass(
      'Case 3: Fraud Decline Escalation',
      `Escalated to Human with ApprovalId=${recData3.toolResult.approvalId}, Event=${recData3.eventType}`
    );
  } catch (e) {
    testFail('Case 3: Fraud Decline Escalation', e);
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`📊 RECOVERY FLOW TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runRecoveryTests();
