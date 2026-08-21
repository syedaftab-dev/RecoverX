/**
 * End-to-end health and Catalog test verification script
 */
const endpoints = [
  { name: 'catalog-service', url: 'http://localhost:8080/api/catalog/health' },
  { name: 'payment-service', url: 'http://localhost:8080/api/payment/health' },
  { name: 'recovery-service', url: 'http://localhost:8080/api/recovery/health' },
  { name: 'audit-service', url: 'http://localhost:8080/api/audit/health' },
  { name: 'notification-service', url: 'http://localhost:8080/api/notification/health' },
];

async function runVerification() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 1. VERIFYING ALL MICROSERVICE HEALTH ENDPOINTS VIA GATEWAY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const ep of endpoints) {
    try {
      const response = await fetch(ep.url);
      const data = await response.json();
      console.log(`✅ [${ep.name}] (${response.status}) ->`, data);
    } catch (err) {
      console.error(`❌ [${ep.name}] Failed: ${err.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📦 2. VERIFYING CATALOG-SERVICE REAL DATA & REDIS CACHING');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let sampleProduct = null;
  let lowStockProduct = null;

  // 1. Test GET /products (First hit -> Database query)
  try {
    console.log('👉 Testing GET /api/catalog/products (Request 1 - Expecting DB query)...');
    const res1 = await fetch('http://localhost:8080/api/catalog/products');
    const data1 = await res1.json();
    console.log(`   Status: ${res1.status}, Source: ${data1.source}, Total Products: ${data1.count}`);
    
    if (data1.products && data1.products.length > 0) {
      sampleProduct = data1.products[0];
      lowStockProduct = data1.products.find(p => p.stock_quantity <= 2) || sampleProduct;
      console.log(`   Sample item: "${sampleProduct.name}" (Price: ₹${sampleProduct.price}, Stock: ${sampleProduct.stock_quantity})`);
      console.log(`   Low-stock item: "${lowStockProduct.name}" (Price: ₹${lowStockProduct.price}, Stock: ${lowStockProduct.stock_quantity})`);
    }
  } catch (err) {
    console.error('❌ GET /api/catalog/products failed:', err.message);
  }

  // 2. Test GET /products (Second hit -> Redis Cache Hit)
  try {
    console.log('\n👉 Testing GET /api/catalog/products (Request 2 - Expecting Redis Cache hit)...');
    const res2 = await fetch('http://localhost:8080/api/catalog/products');
    const data2 = await res2.json();
    console.log(`   Status: ${res2.status}, Source: ${data2.source}, Cache-Header: ${res2.headers.get('x-cache-source')}`);
    if (data2.source === 'cache') {
      console.log('   ⚡ Redis Caching Verified Successfully!');
    }
  } catch (err) {
    console.error('❌ GET /api/catalog/products cache test failed:', err.message);
  }

  // 3. Test GET /products/:id
  if (sampleProduct) {
    try {
      console.log(`\n👉 Testing GET /api/catalog/products/${sampleProduct.id}...`);
      const res3 = await fetch(`http://localhost:8080/api/catalog/products/${sampleProduct.id}`);
      const data3 = await res3.json();
      console.log(`   Status: ${res3.status}, Found: "${data3.product?.name}" (ID: ${data3.product?.id})`);
    } catch (err) {
      console.error('❌ GET /api/catalog/products/:id failed:', err.message);
    }
  }

  // 4. Test POST /stock/check (In-stock scenario)
  if (sampleProduct) {
    try {
      console.log(`\n👉 Testing POST /api/catalog/stock/check (In-stock test: qty=1)...`);
      const res4 = await fetch('http://localhost:8080/api/catalog/stock/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: sampleProduct.id, quantity: 1 }),
      });
      const data4 = await res4.json();
      console.log(`   Status: ${res4.status}, Available: ${data4.available}, Current Stock: ${data4.currentStock}`);
    } catch (err) {
      console.error('❌ POST /api/catalog/stock/check failed:', err.message);
    }
  }

  // 5. Test POST /stock/check (Excess quantity / stock-out scenario)
  if (lowStockProduct) {
    try {
      console.log(`\n👉 Testing POST /api/catalog/stock/check (Stock-out test: qty=999 on low-stock item)...`);
      const res5 = await fetch('http://localhost:8080/api/catalog/stock/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: lowStockProduct.id, quantity: 999 }),
      });
      const data5 = await res5.json();
      console.log(`   Status: ${res5.status}, Available: ${data5.available}, Current Stock: ${data5.currentStock}, isLowStock: ${data5.isLowStock}`);
    } catch (err) {
      console.error('❌ POST /api/catalog/stock/check stock-out test failed:', err.message);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

runVerification();
