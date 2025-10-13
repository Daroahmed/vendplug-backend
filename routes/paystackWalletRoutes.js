const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminAuth');
const { 
  getPaystackBalance, 
  topUpPaystackWallet, 
  getPayoutCapacity 
} = require('../controllers/paystackWalletController');

// Admin-only routes for Paystack wallet management
router.get('/balance', protectAdmin, getPaystackBalance);
router.post('/topup', protectAdmin, topUpPaystackWallet);
router.get('/payout-capacity', protectAdmin, getPayoutCapacity);

// Temporary public routes for testing (remove in production)
router.get('/balance-public', getPaystackBalance);
router.get('/payout-capacity-public', getPayoutCapacity);

module.exports = router;
