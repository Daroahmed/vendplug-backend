const express = require('express');
const router = express.Router();
const {
  transferFunds,
  requestPayout,
  getMyTransactions
} = require('../controllers/transactionController');

const {
  protectBuyer,
  protectAgent,
  protectVendor
} = require('../middleware/authMiddleware');

// Transfer (buyer or agent)
router.post('/transfer', protectBuyer, transferFunds); // Optional: use middleware that allows both buyer & agent

// Payout request (vendor only)
router.post('/payout-request', protectVendor, requestPayout);

// Get my transactions (any user)
router.get('/my-transactions', protectBuyer, getMyTransactions); // use dynamic middleware as needed

module.exports = router;
