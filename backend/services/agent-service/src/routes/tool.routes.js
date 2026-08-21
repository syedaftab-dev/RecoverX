const express = require('express');
const router = express.Router();
const tools = require('../tools');

// Direct execution endpoints for the 7 tools
router.get('/tools/get_product/:id', async (req, res) => {
  const result = await tools.getProduct(req.params.id);
  res.status(result.success ? 200 : (result.notFound ? 404 : 400)).json(result);
});

router.post('/tools/check_stock', async (req, res) => {
  const { productId, quantity } = req.body;
  const result = await tools.checkStock(productId, quantity);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/tools/apply_discount', async (req, res) => {
  const { orderValue, discountPct, reason } = req.body;
  const result = await tools.applyDiscount(orderValue, discountPct, reason);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/tools/create_order', async (req, res) => {
  const { cartItems, customerId } = req.body;
  const result = await tools.createOrder(cartItems, customerId);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/tools/retry_payment', async (req, res) => {
  const { paymentId, method } = req.body;
  const result = await tools.retryPayment(paymentId, method);
  res.status(result.success ? 200 : (result.status === 'REJECTED' ? 429 : 400)).json(result);
});

router.get('/tools/suggest_alternative/:id', async (req, res) => {
  const result = await tools.suggestAlternative(req.params.id);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/tools/escalate_to_human', async (req, res) => {
  const { reason, orderContext } = req.body;
  const result = await tools.escalateToHuman(reason, orderContext);
  res.status(200).json(result);
});

module.exports = router;
