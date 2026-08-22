/**
 * Day 4 Agent Orchestrator & Multi-Turn Conversation Integration Test Suite
 * Tests POST /api/agent/chat via Gateway:
 *  1. Product inquiry -> triggers get_product with no gate
 *  2. 20% discount request -> triggers apply_discount and returns REQUIRES_GATE with approvalId
 *  3. Multi-turn conversation chain -> get_product, check_stock, create_order
 *  4. Per-session rate limiter -> enforces 10 tool calls/min ceiling
 */

const assert = require('assert');

const BASE_URL = 'http://localhost:8080';

async function runAgentTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🤖 RUNNING AGENT CONVERSATION & TOOL LOOP INTEGRATION TESTS (DAY 4)');
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

  // 1. First fetch catalog products to get a valid product ID
  let sampleProduct = null;
  try {
    const catRes = await fetch(`${BASE_URL}/api/catalog/products`);
    const catData = await catRes.json();
    sampleProduct = catData.products[0];
  } catch (e) {}

  const testSessionId = `test_sess_${Date.now()}`;

  // =========================================================================
  // Test 1: Simple Product Inquiry (Triggers get_product, no gate)
  // =========================================================================
  console.log('--- 1. Testing Product Inquiry Conversation (get_product) ---');
  try {
    const res = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Can you show me the wireless fast charger details?',
        sessionId: testSessionId,
        options: { productId: sampleProduct ? sampleProduct.id : undefined },
      }),
    });

    assert.strictEqual(res.status, 200, 'Expected HTTP 200 from POST /chat');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.reply, 'Expected natural language reply');
    assert(Array.isArray(data.actions), 'actions must be an array');
    assert(data.actions.length > 0, 'Expected at least 1 tool action');

    const action = data.actions[0];
    assert.strictEqual(action.tool, 'get_product');
    assert.strictEqual(action.requires_gate, false, 'Product lookup must not require gate');
    assert(action.reasoning, 'Action must carry plain-language reasoning');
    assert(action.timestamp, 'Action must carry ISO timestamp');

    testPass('Conversation 1: Product Inquiry', `Tool=${action.tool}, Gate=${action.requires_gate}, Reply="${data.reply.substring(0, 50)}..."`);
  } catch (e) {
    testFail('Conversation 1: Product Inquiry', e);
  }

  // =========================================================================
  // Test 2: Out-of-Bounds Discount (20% -> REQUIRES_GATE + approvalId)
  // =========================================================================
  console.log('\n--- 2. Testing Gated Discount Request (apply_discount > 15%) ---');
  const gateSessionId = `gate_sess_${Date.now()}`;
  try {
    const res = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Could you give me a 20% discount on my ₹2000 order?',
        sessionId: gateSessionId,
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.actions.length > 0, 'Expected discount tool action');

    const action = data.actions[0];
    assert.strictEqual(action.tool, 'apply_discount');
    assert.strictEqual(action.requires_gate, true, '20% discount must trigger requires_gate: true');
    assert(action.result.approvalId, 'Gated discount must produce approvalId');
    assert.strictEqual(action.result.status, 'REQUIRES_GATE');
    assert.strictEqual(action.result.finalAmount, 2000, 'Original amount must remain unmodified');

    testPass('Conversation 2: Gated Discount', `Status=${action.result.status}, ApprovalId=${action.result.approvalId}, Gate=${action.requires_gate}`);
  } catch (e) {
    testFail('Conversation 2: Gated Discount', e);
  }

  // =========================================================================
  // Test 3: Multi-Turn Checkout Flow (get_product -> check_stock -> create_order)
  // =========================================================================
  console.log('\n--- 3. Testing Multi-Turn Checkout Flow in Same Session ---');
  const multiTurnSession = `multi_sess_${Date.now()}`;

  // Step 3.1: User asks for product
  try {
    const res1 = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Show me NovaCharge charger',
        sessionId: multiTurnSession,
        options: { productId: sampleProduct ? sampleProduct.id : undefined },
      }),
    });
    const d1 = await res1.json();
    assert.strictEqual(d1.actions[0].tool, 'get_product');
    testPass('Step 3.1: get_product turn', `Session history length: ${d1.historyLength}`);
  } catch (e) {
    testFail('Step 3.1: get_product turn', e);
  }

  // Step 3.2: User checks stock
  try {
    const res2 = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Please check stock of this charger',
        sessionId: multiTurnSession,
        options: { productId: sampleProduct ? sampleProduct.id : undefined },
      }),
    });
    const d2 = await res2.json();
    assert.strictEqual(d2.actions[0].tool, 'check_stock');
    assert.strictEqual(d2.actions[0].result.available, true);
    testPass('Step 3.2: check_stock turn', `Available: ${d2.actions[0].result.available}, Stock: ${d2.actions[0].result.currentStock}`);
  } catch (e) {
    testFail('Step 3.2: check_stock turn', e);
  }

  // Step 3.3: User checks out (within ₹5000)
  try {
    const res3 = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Proceed to checkout and create order for ₹1299',
        sessionId: multiTurnSession,
        options: {
          cartItems: [{ id: sampleProduct ? sampleProduct.id : 'p1', name: 'Charger', price: 1299, quantity: 1 }],
          baseUrl: 'http://localhost:8080/api/payment',
        },
      }),
    });
    const d3 = await res3.json();
    assert.strictEqual(d3.actions[0].tool, 'create_order');
    assert.strictEqual(d3.actions[0].result.status, 'APPROVED');
    assert.strictEqual(d3.actions[0].requires_gate, false);
    assert(d3.actions[0].result.idempotencyKey, 'Must include idempotencyKey');
    testPass('Step 3.3: create_order turn', `Order=${d3.actions[0].result.order.orderId}, Idemp=${d3.actions[0].result.idempotencyKey}`);
  } catch (e) {
    testFail('Step 3.3: create_order turn', e);
  }

  // =========================================================================
  // Test 4: Rate Limiter Ceiling Test (Cap of 10 tool calls/min per session)
  // =========================================================================
  console.log('\n--- 4. Testing Per-Session Tool Call Rate Limiter ---');
  const rateLimitSession = `rate_sess_${Date.now()}`;
  let hitRateLimit = false;

  try {
    for (let i = 1; i <= 12; i++) {
      const res = await fetch(`${BASE_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Check stock call #${i}`,
          sessionId: rateLimitSession,
          options: { productId: sampleProduct ? sampleProduct.id : undefined },
        }),
      });
      const data = await res.json();
      if (data.actions && data.actions[0] && data.actions[0].result.rateLimited) {
        hitRateLimit = true;
        testPass(`Rate Limiter Triggered on Attempt #${i}`, data.actions[0].result.error);
        break;
      }
    }
    assert.strictEqual(hitRateLimit, true, 'Rate limiter must cap at 10 tool calls per minute');
  } catch (e) {
    testFail('Rate Limiter Test', e);
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`📊 AGENT INTEGRATION TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runAgentTests();
