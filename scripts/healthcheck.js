/**
 * Quick cross-platform healthcheck script
 */
const http = require('http');

const endpoints = [
  { name: 'payment-service', url: 'http://localhost:8080/api/payment/health' },
  { name: 'recovery-service', url: 'http://localhost:8080/api/recovery/health' },
  { name: 'audit-service', url: 'http://localhost:8080/api/audit/health' },
  { name: 'notification-service', url: 'http://localhost:8080/api/notification/health' },
];

async function checkHealth() {
  console.log('🔍 Checking RecoverX Microservices Health via Gateway (:8080)...\n');
  
  for (const ep of endpoints) {
    try {
      const response = await fetch(ep.url);
      const data = await response.json();
      console.log(`✅ [${ep.name}] Status: ${response.status} ->`, data);
    } catch (err) {
      console.error(`❌ [${ep.name}] Failed: ${err.message}`);
    }
  }
}

checkHealth();
