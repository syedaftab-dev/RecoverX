const express = require('express');
const router = express.Router();
const { handlePaymentDecline } = require('../recovery/declineRecovery');

// POST /recovery/payment-decline - Triggers autonomous revenue recovery flow for a failed payment
router.post('/recovery/payment-decline', async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: paymentId',
      });
    }

    const recoveryOutcome = await handlePaymentDecline(req.body);
    return res.status(200).json(recoveryOutcome);
  } catch (err) {
    console.error('Error in /recovery/payment-decline:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Payment decline recovery processing error.',
    });
  }
});

module.exports = router;
