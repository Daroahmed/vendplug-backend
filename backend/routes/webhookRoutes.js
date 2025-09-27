const express = require('express');
const router = express.Router();
const { processTransferWebhook, processPayoutsManually } = require('../controllers/paystackWebhookController');

// Paystack webhook endpoint (no auth required - Paystack calls this)
router.post('/paystack/transfer', processTransferWebhook);

// Manual payout processing (admin only)
router.post('/payouts/process', processPayoutsManually);

module.exports = router;
