const express = require('express');
const router = express.Router();
const { processChatMessage } = require('../agent');

// POST /chat - Main entry point for conversational agent & recovery interactions
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId, customerId, options } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: message (must be a string).',
      });
    }

    const response = await processChatMessage({
      message,
      sessionId: sessionId || `sess_${Date.now()}`,
      customerId: customerId || 'guest',
      options: options || {},
    });

    return res.status(200).json(response);
  } catch (err) {
    console.error('Error in POST /chat:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal agent processing error.',
    });
  }
});

module.exports = router;
