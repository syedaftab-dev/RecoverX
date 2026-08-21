/**
 * Comprehensive Integration & Performance Test Suite for RecoverX Day 2
 */
const assert = require('assert');

const BASE_URL = 'http://localhost:8080';

async function runTests() {
  console.log('🧪 Starting RecoverX Day 2 Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function logPass(name, detail = '') {
    console.log(`  ✅ PASS: ${name} ${detail ? `(${detail})` : ''}`);
    passed++;
  }

  function logFail(name, err) {
    console.error(`  ❌ FAIL: ${name} ->`, err.message || err);
    failed++;
  }

  // --- 1. Health Checks ---
  console.log('--- 1. Testing Gateway & Health Endpoints ---');
  const services = ['catalog', 'payment', 'recovery', 'audit', 'notification'];
  for (const s of services) {
    try {
      const res = await fetch(`${BASE_URL}/api/${s}/health`);
      assert.strictEqual(res.status, 200, `Expected 200 from ${s} health`);
      const body = await res.json();
      assert.strictEqual(body.status, 'ok');
      logPass(`${s}-service /health`, `status=${body.status}`);
    } catch (e) {
      logFail(`${s}-service /health`, e);
    }
  }

  // --- 2. Catalog Listing & Schema Validation ---
  console.log('\n--- 2. Testing Catalog Listing & Schema ---');
  let allProducts = [];
  try {
    const res = await fetch(`${BASE_URL}/api/catalog/products`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert(Array.isArray(body.products), 'products must be an array');
    assert(body.products.length >= 10, 'Expected at least 10 products');
    allProducts = body.products;

    // Check schema of first product
    const p = allProducts[0];
    assert(p.id, 'Product missing id');
    assert(p.name, 'Product missing name');
    assert(typeof p.price === 'string' || typeof p.price === 'number', 'Invalid price format');
    assert(typeof p.stock_quantity === 'number', 'Invalid stock_quantity');
    assert(p.category, 'Product missing category');
    assert(p.created_at, 'Product missing created_at');

    logPass('GET /api/catalog/products schema & count', `Returned ${allProducts.length} items with complete schema`);
  } catch (e) {
    logFail('GET /api/catalog/products', e);
  }

  // --- 3. Category Filter Test ---
  console.log('\n--- 3. Testing Category Filter ---');
  try {
    const res = await fetch(`${BASE_URL}/api/catalog/products?category=Audio`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert(body.products.every(p => p.category.toLowerCase() === 'audio'), 'All items should belong to Audio category');
    logPass('GET /api/catalog/products?category=Audio', `Returned ${body.products.length} Audio products`);
  } catch (e) {
    logFail('GET /api/catalog/products?category=Audio', e);
  }

  // --- 4. Redis Cache Latency Benchmark ---
  console.log('\n--- 4. Testing Redis Cache Hit & Latency Benchmark ---');
  try {
    const start = performance.now();
    const res = await fetch(`${BASE_URL}/api/catalog/products`);
    const duration = (performance.now() - start).toFixed(2);
    const body = await res.json();
    assert.strictEqual(body.source, 'cache', 'Expected cached response on subsequent hit');
    assert.strictEqual(res.headers.get('x-cache-source'), 'cache');
    logPass('Redis cache hit verification', `Source: cache | Latency: ${duration}ms`);
  } catch (e) {
    logFail('Redis cache verification', e);
  }

  // --- 5. Single Product Lookup (Valid & Invalid) ---
  console.log('\n--- 5. Testing Single Product Lookup ---');
  if (allProducts.length > 0) {
    const testItem = allProducts[0];
    try {
      const res = await fetch(`${BASE_URL}/api/catalog/products/${testItem.id}`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.product.id, testItem.id);
      assert.strictEqual(body.product.name, testItem.name);
      logPass(`GET /api/catalog/products/${testItem.id}`, `Fetched: ${testItem.name}`);
    } catch (e) {
      logFail(`GET /api/catalog/products/:id`, e);
    }
  }

  try {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${BASE_URL}/api/catalog/products/${fakeId}`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    logPass('GET /api/catalog/products/<non-existent-id> returns 404', 'Handled not-found gracefully');
  } catch (e) {
    logFail('404 test on invalid product ID', e);
  }

  // --- 6. Stock Check Scenarios ---
  console.log('\n--- 6. Testing Stock Check (In-Stock, Out-of-Stock, Input Validation) ---');
  const normalItem = allProducts.find(p => p.stock_quantity > 10) || allProducts[0];
  const criticalItem = allProducts.find(p => p.stock_quantity <= 2) || allProducts[0];

  // In-stock
  try {
    const res = await fetch(`${BASE_URL}/api/catalog/stock/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: normalItem.id, quantity: 2 }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.available, true);
    assert.strictEqual(body.requestedQuantity, 2);
    logPass(`POST /stock/check (In-Stock: "${normalItem.name}")`, `Available=true, Stock=${body.currentStock}`);
  } catch (e) {
    logFail('POST /stock/check (In-Stock)', e);
  }

  // Out-of-stock (exceeds inventory)
  try {
    const res = await fetch(`${BASE_URL}/api/catalog/stock/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: criticalItem.id, quantity: 50 }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.available, false);
    assert.strictEqual(body.isLowStock, true);
    logPass(`POST /stock/check (Stock-Out detection: "${criticalItem.name}")`, `Available=false, isLowStock=true, Stock=${body.currentStock}`);
  } catch (e) {
    logFail('POST /stock/check (Stock-Out)', e);
  }

  // Bad input validation
  try {
    const res = await fetch(`${BASE_URL}/api/catalog/stock/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 5 }), // Missing productId
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    logPass('POST /stock/check validation (Missing productId returns 400)', 'Validated required fields');
  } catch (e) {
    logFail('POST /stock/check validation test', e);
  }

  // --- 7. Frontend Proxy Check ---
  console.log('\n--- 7. Testing Frontend Proxy Route ---');
  try {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert(html.includes('RecoverX'), 'Frontend HTML must contain RecoverX');
    logPass('Gateway proxy to Frontend (/)', 'React SPA HTML served successfully');
  } catch (e) {
    logFail('Frontend proxy test', e);
  }

  // --- Summary ---
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runTests();
