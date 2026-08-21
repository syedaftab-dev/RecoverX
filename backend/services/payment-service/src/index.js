const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4003;

app.use(cors());
app.use(express.json());

// In-memory idempotency cache for payment-service
const processedOrders = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'payment-service',
    timestamp: new Date().toISOString(),
  });
});

// Order creation endpoint (accepts idempotency key)
app.post('/orders', (req, res) => {
  const { cartItems, customerId, totalAmount, idempotencyKey } = req.body;

  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ success: false, error: 'cartItems must be a non-empty array' });
  }

  if (idempotencyKey && processedOrders.has(idempotencyKey)) {
    return res.status(200).json({
      success: true,
      idempotent: true,
      order: processedOrders.get(idempotencyKey),
    });
  }

  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const order = {
    orderId,
    customerId: customerId || 'guest',
    cartItems,
    totalAmount: totalAmount || cartItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0),
    status: 'CREATED',
    idempotencyKey,
    createdAt: new Date().toISOString(),
  };

  if (idempotencyKey) {
    processedOrders.set(idempotencyKey, order);
  }

  return res.status(201).json({
    success: true,
    idempotent: false,
    order,
  });
});

// Payment retry endpoint
app.post('/payments/retry', (req, res) => {
  const { paymentId, method } = req.body;
  if (!paymentId) {
    return res.status(400).json({ success: false, error: 'Missing paymentId' });
  }

  return res.status(200).json({
    success: true,
    paymentId,
    method: method || 'CARD',
    retryStatus: 'INITIATED',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`💳 payment-service running on port ${PORT}`);
});
