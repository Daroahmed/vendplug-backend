const express = require('express');
const router = express.Router();
const { protectAnyUser } = require('../middleware/authMiddleware');
const {
  initializePayment,
  verifyPayment,
  handleWebhook
} = require('../controllers/paystackController');

// Initialize payment
router.post('/initialize', protectAnyUser, initializePayment);

// Verify payment
router.get('/verify', protectAnyUser, verifyPayment);

// Webhook endpoint (no auth middleware needed)
router.post('/webhook', handleWebhook);

module.exports = router;
