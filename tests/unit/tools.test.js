/**
 * Day 3 Agent Tool Functions Unit Test Suite
 * Tests threshold boundaries, edge cases, and happy paths for all 7 tools.
 */

const assert = require('assert');
const { BOUNDS } = require('../../backend/services/agent-service/src/bounds/limits');
const redisClient = require('../../backend/services/agent-service/src/redis/client');
const {
  getProduct,
  checkStock,
  applyDiscount,
  createOrder,
  retryPayment,
  suggestAlternative,
  escalateToHuman,
} = require('../../backend/services/agent-service/src/tools');

async function runUnitTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧠 RUNNING AGENT TOOLS UNIT TEST SUITE (DAY 3)');
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

  // Clear memory store before testing
  redisClient.clearMemoryStore();

  // =========================================================================
  // 1. apply_discount() Boundary Tests (15% vs 16%)
  // =========================================================================
  console.log('--- 1. Testing apply_discount (≤15% auto-approves vs >15% gates) ---');

  // Test 1.1: 15% discount (exact threshold) -> APPROVED
  try {
    const res = await applyDiscount(1000, 15, 'Recovery retention offer');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'APPROVED');
    assert.strictEqual(res.bounded, true);
    assert.strictEqual(res.discountAmount, 150);
    assert.strictEqual(res.finalAmount, 850);
    testPass('apply_discount(1000, 15%) [ON THRESHOLD]', 'status=APPROVED, saved ₹150, final=₹850');
  } catch (e) {
    testFail('apply_discount(1000, 15%)', e);
  }

  // Test 1.2: 16% discount (above threshold) -> REQUIRES_GATE
  try {
    const res = await applyDiscount(1000, 16, 'High retention offer');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'REQUIRES_GATE');
    assert.strictEqual(res.bounded, false);
    assert.strictEqual(res.finalAmount, 1000, 'Original amount must remain untouched');
    assert.strictEqual(res.discountAmount, 0);
    testPass('apply_discount(1000, 16%) [ABOVE THRESHOLD]', 'status=REQUIRES_GATE, order untouched');
  } catch (e) {
    testFail('apply_discount(1000, 16%)', e);
  }

  // Test 1.3: 5% discount (well within bounds) -> APPROVED
  try {
    const res = await applyDiscount(2000, 5, 'Welcome discount');
    assert.strictEqual(res.status, 'APPROVED');
    assert.strictEqual(res.discountAmount, 100);
    assert.strictEqual(res.finalAmount, 1900);
    testPass('apply_discount(2000, 5%) [WITHIN BOUNDS]', 'status=APPROVED, final=₹1900');
  } catch (e) {
    testFail('apply_discount(2000, 5%)', e);
  }

  // =========================================================================
  // 2. create_order() Boundary Tests (₹5000 vs ₹5001)
  // =========================================================================
  console.log('\n--- 2. Testing create_order (≤₹5000 auto-approves vs >₹5000 gates) ---');

  // Test 2.1: Exactly ₹5000 order -> APPROVED
  try {
    const cart5000 = [{ id: 'p1', name: 'Smartwatch', price: 2500, quantity: 2 }];
    const res = await createOrder(cart5000, 'cust_123', { baseUrl: 'http://localhost:8080/api/payment' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'APPROVED');
    assert.strictEqual(res.bounded, true);
    assert(res.idempotencyKey, 'Must generate idempotency key');
    assert.strictEqual(res.totalAmount, 5000);
    testPass('create_order(₹5000) [ON THRESHOLD]', `status=APPROVED, idemp=${res.idempotencyKey}`);
  } catch (e) {
    testFail('create_order(₹5000)', e);
  }

  // Test 2.2: ₹5001 order -> REQUIRES_GATE
  try {
    const cart5001 = [{ id: 'p2', name: 'ANC Headphones', price: 5001, quantity: 1 }];
    const res = await createOrder(cart5001, 'cust_123');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'REQUIRES_GATE');
    assert.strictEqual(res.bounded, false);
    assert.strictEqual(res.totalAmount, 5001);
    assert.strictEqual(res.maxAllowedAutoValue, 5000);
    testPass('create_order(₹5001) [ABOVE THRESHOLD]', 'status=REQUIRES_GATE, blocked auto-charge');
  } catch (e) {
    testFail('create_order(₹5001)', e);
  }

  // =========================================================================
  // 3. retry_payment() Boundary Tests (1st, 2nd attempt vs 3rd attempt)
  // =========================================================================
  console.log('\n--- 3. Testing retry_payment (Max 2 attempts, rejects 3rd) ---');

  const testPaymentId = `pay_test_${Date.now()}`;

  // Test 3.1: Attempt 1 -> RETRY_INITIATED (attemptNumber = 1)
  try {
    const res1 = await retryPayment(testPaymentId, 'UPI', { baseUrl: 'http://localhost:8080/api/payment' });
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.status, 'RETRY_INITIATED');
    assert.strictEqual(res1.attemptNumber, 1);
    assert.strictEqual(res1.remainingAttempts, 1);
    testPass('retry_payment (1st Attempt)', 'status=RETRY_INITIATED, attempt=1/2, remaining=1');
  } catch (e) {
    testFail('retry_payment (1st Attempt)', e);
  }

  // Test 3.2: Attempt 2 -> RETRY_INITIATED (attemptNumber = 2)
  try {
    const res2 = await retryPayment(testPaymentId, 'CARD', { baseUrl: 'http://localhost:8080/api/payment' });
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.status, 'RETRY_INITIATED');
    assert.strictEqual(res2.attemptNumber, 2);
    assert.strictEqual(res2.remainingAttempts, 0);
    testPass('retry_payment (2nd Attempt) [ON CEILING]', 'status=RETRY_INITIATED, attempt=2/2, remaining=0');
  } catch (e) {
    testFail('retry_payment (2nd Attempt)', e);
  }

  // Test 3.3: Attempt 3 -> REJECTED (Cap of 2 exceeded)
  try {
    const res3 = await retryPayment(testPaymentId, 'NETBANKING', { baseUrl: 'http://localhost:8080/api/payment' });
    assert.strictEqual(res3.success, false);
    assert.strictEqual(res3.status, 'REJECTED');
    assert.strictEqual(res3.attemptsMade, 2);
    assert.strictEqual(res3.maxAllowedAttempts, 2);
    testPass('retry_payment (3rd Attempt) [OVER CEILING]', 'status=REJECTED, capped attempts at 2');
  } catch (e) {
    testFail('retry_payment (3rd Attempt)', e);
  }

  // =========================================================================
  // 4. get_product() Tests (Happy Path & Not Found)
  // =========================================================================
  console.log('\n--- 4. Testing get_product (Catalog integration) ---');

  let sampleProductId = null;
  try {
    // Fetch products list from gateway to get a real ID
    const catRes = await fetch('http://localhost:8080/api/catalog/products');
    const catData = await catRes.json();
    if (catData.products && catData.products.length > 0) {
      sampleProductId = catData.products[0].id;
    }
  } catch (e) {}

  if (sampleProductId) {
    try {
      const res = await getProduct(sampleProductId, { baseUrl: 'http://localhost:8080/api/catalog' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.product.id, sampleProductId);
      testPass('get_product(valid_id)', `Found product: "${res.product.name}"`);
    } catch (e) {
      testFail('get_product(valid_id)', e);
    }
  }

  try {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await getProduct(fakeId, { baseUrl: 'http://localhost:8080/api/catalog' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.notFound, true);
    testPass('get_product(non_existent_id)', 'Clean not-found handling');
  } catch (e) {
    testFail('get_product(non_existent_id)', e);
  }

  // =========================================================================
  // 5. check_stock() Tests
  // =========================================================================
  console.log('\n--- 5. Testing check_stock ---');

  if (sampleProductId) {
    try {
      const res = await checkStock(sampleProductId, 1, { baseUrl: 'http://localhost:8080/api/catalog' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(typeof res.available, 'boolean');
      testPass('check_stock(valid_id, 1)', `Available: ${res.available}, Stock: ${res.currentStock}`);
    } catch (e) {
      testFail('check_stock', e);
    }
  }

  // =========================================================================
  // 6. suggest_alternative() Tests
  // =========================================================================
  console.log('\n--- 6. Testing suggest_alternative ---');

  if (sampleProductId) {
    try {
      const res = await suggestAlternative(sampleProductId, { baseUrl: 'http://localhost:8080/api/catalog' });
      assert.strictEqual(res.success, true);
      assert(Array.isArray(res.alternatives), 'alternatives must be an array');
      assert(res.alternatives.length <= 3, 'Must return at most 3 alternatives');
      assert(res.alternatives.every(a => a.id !== sampleProductId), 'Must exclude source product');
      testPass('suggest_alternative(productId)', `Returned ${res.alternatives.length} alternatives in '${res.category}'`);
    } catch (e) {
      testFail('suggest_alternative', e);
    }
  }

  // =========================================================================
  // 7. escalate_to_human() Unblockable Test
  // =========================================================================
  console.log('\n--- 7. Testing escalate_to_human (Unblockable Gating) ---');

  try {
    const res = await escalateToHuman('Customer disputed payment decline recovery discount', {
      orderId: 'ord_9876',
      orderValue: 12000,
      customerId: 'cust_vip',
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'ESCALATED');
    assert.strictEqual(res.unblockable, true);
    assert(res.approvalId, 'Must generate approvalId');
    assert(res.timestamp, 'Must include timestamp');
    testPass('escalate_to_human(reason, context)', `status=ESCALATED, approvalId=${res.approvalId}`);
  } catch (e) {
    testFail('escalate_to_human', e);
  }

  // =========================================================================
  // Test Summary
  // =========================================================================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`📊 AGENT TOOLS TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runUnitTests();
