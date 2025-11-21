const express = require('express');
const router = express.Router();
const { protectBuyer, protectAgent, protectVendor } = require('../middleware/authMiddleware');
const { fundUserWallet} = require('../controllers/fundUserWallet'); // controller we'll create next
const { transferFunds } = require('../controllers/walletTransferController');
const { getWallet, getTransactions, resolveWallet } = require('../controllers/walletController');
const Transaction = require('../models/Transaction');
const { protectAnyUser } = require('../middleware/authMiddleware');
const { dashboardLimiter } = require('../middleware/rateLimiter');


// Deprecated dangerous test route (disabled). Use /api/paystack/fund-wallet instead.
router.post('/fund-buyer', (req, res) => {
  return res.status(410).json({ success: false, message: 'Deprecated: use /api/paystack/fund-wallet' });
});


router.post('/transfer', protectAnyUser, transferFunds);

// Role-specific balance endpoints
// Dashboard endpoints are polled frequently, so they need lenient rate limiting
// For Agent
router.get('/agent', dashboardLimiter, protectAnyUser, getWallet);

// For Buyer
router.get('/buyer', dashboardLimiter, protectAnyUser, getWallet);

// For Vendor
router.get('/vendor', dashboardLimiter, protectAnyUser, getWallet);

// Deprecated unsafe direct funding endpoint (disabled). Use /api/paystack/fund-wallet instead.
router.post('/fund', (req, res) => {
  return res.status(410).json({ success: false, message: 'Deprecated: use /api/paystack/fund-wallet' });
});

router.get('/lookup/:accountNumber', resolveWallet);

// Dashboard endpoints are polled frequently, so they need lenient rate limiting
router.get('/transactions', dashboardLimiter, protectAnyUser, getTransactions);

// Public: topup status by Paystack reference (no auth so user can poll even if token expired)
router.get('/topup/status', async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ success: false, message: 'reference is required' });
    const txn = await Transaction.findOne({ ref: reference });
    if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found' });
    return res.json({
      success: true,
      data: {
        reference: txn.ref,
        type: txn.type,
        status: txn.status,
        amount: txn.amount,
        createdAt: txn.createdAt
      }
    });
  } catch (err) {
    console.error('topup/status error:', err.message || err);
    res.status(500).json({ success: false, message: 'Failed to fetch status' });
  }
});

module.exports = router;








