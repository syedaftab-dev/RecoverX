const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { publishEvent } = require('./events/eventBus');

const app = express();
const PORT = process.env.PORT || 4003;

app.use(cors());
app.use(express.json());

// In-memory idempotency & transaction cache
const processedOrders = new Map();
const paymentTransactions = new Map();

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

// Payment processing endpoint with Simulated Razorpay Decline Triggers
app.post('/payments/process', async (req, res) => {
  const {
    orderId,
    amount,
    customerId = 'guest',
    paymentMethod = 'CARD',
    cardNumber,
    simulateDecline = false,
    declineCode,
    declineReason,
  } = req.body;

  if (!orderId || !amount) {
    return res.status(400).json({ success: false, error: 'Missing required fields: orderId, amount' });
  }

  const paymentId = `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // Check if simulated decline is requested or card ends in standard test decline suffix (e.g. 0002)
  const isDeclined = simulateDecline || (cardNumber && cardNumber.endsWith('0002'));

  if (isDeclined) {
    const code = declineCode || 'TRANSIENT_NETWORK_TIMEOUT';
    const reason = declineReason || (
      code === 'INSUFFICIENT_FUNDS'
        ? 'Customer account has insufficient funds to complete transaction'
        : (code === 'FRAUD_SUSPECTED'
          ? 'Card flagged by issuer risk engine as potential fraud'
          : 'Issuer bank timed out during 3D-Secure authentication (transient failure)')
    );

    const failurePayload = {
      paymentId,
      orderId,
      amount: Number(amount),
      customerId,
      paymentMethod,
      declineCode: code,
      declineReason: reason,
      status: 'FAILED',
    };

    paymentTransactions.set(paymentId, failurePayload);

    // Publish payment.failed event to Redis Event Bus
    const eventEnvelope = await publishEvent('payment.failed', failurePayload, {
      source: 'payment-service',
      action: 'PROCESS_PAYMENT',
      description: `Payment ${paymentId} failed: ${code} - ${reason}`,
    });

    console.log(`❌ [payment-service] Payment ${paymentId} DECLINED (${code}). Event published: ${eventEnvelope.eventId}`);

    return res.status(402).json({
      success: false,
      status: 'FAILED',
      paymentId,
      orderId,
      amount,
      declineCode: code,
      declineReason: reason,
      eventId: eventEnvelope.eventId,
      timestamp: eventEnvelope.timestamp,
    });
  }

  // Happy Path: Payment Success
  const successPayload = {
    paymentId,
    orderId,
    amount: Number(amount),
    customerId,
    paymentMethod,
    status: 'CAPTURED',
  };

  paymentTransactions.set(paymentId, successPayload);

  const eventEnvelope = await publishEvent('payment.success', successPayload, {
    source: 'payment-service',
    action: 'PROCESS_PAYMENT',
    description: `Payment ${paymentId} captured successfully for order ${orderId}`,
  });

  return res.status(200).json({
    success: true,
    status: 'CAPTURED',
    paymentId,
    orderId,
    amount,
    eventId: eventEnvelope.eventId,
    timestamp: eventEnvelope.timestamp,
  });
});

// Payment retry endpoint
app.post('/payments/retry', async (req, res) => {
  const { paymentId, method = 'CARD', attemptNumber = 1 } = req.body;
  if (!paymentId) {
    return res.status(400).json({ success: false, error: 'Missing paymentId' });
  }

  const newPaymentId = `${paymentId}_retry_${attemptNumber}`;
  const retryResult = {
    originalPaymentId: paymentId,
    retryPaymentId: newPaymentId,
    method,
    attemptNumber,
    status: 'RETRY_CAPTURED',
    message: `Payment successfully captured on retry attempt #${attemptNumber} via ${method}`,
    timestamp: new Date().toISOString(),
  };

  await publishEvent('payment.retry_executed', retryResult, {
    source: 'payment-service',
    action: 'RETRY_PAYMENT',
    description: `Retried payment ${paymentId} using ${method} (attempt #${attemptNumber})`,
  });

  return res.status(200).json({
    success: true,
    ...retryResult,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`💳 payment-service running on port ${PORT}`);
});
