const express = require('express');
const router = express.Router();
const { protectBuyer, protectAgent, protectVendor } = require('../middleware/authMiddleware');
const { fundUserWallet} = require('../controllers/fundUserWallet'); // controller we'll create next
const { transferFunds } = require('../controllers/walletTransferController');
const { getWallet, getTransactions, resolveWallet } = require('../controllers/walletController');
const { protectAnyUser } = require('../middleware/authMiddleware');
const { dashboardLimiter } = require('../middleware/rateLimiter');


 // optional shortcut for buyers
router.post('/fund-buyer', fundUserWallet); // special test route


router.post('/transfer', protectAnyUser, transferFunds);

// Role-specific balance endpoints
// Dashboard endpoints are polled frequently, so they need lenient rate limiting
// For Agent
router.get('/agent', dashboardLimiter, protectAnyUser, getWallet);

// For Buyer
router.get('/buyer', dashboardLimiter, protectAnyUser, getWallet);

// For Vendor
router.get('/vendor', dashboardLimiter, protectAnyUser, getWallet);

router.post('/fund', fundUserWallet);

router.get('/lookup/:accountNumber', resolveWallet);

// Dashboard endpoints are polled frequently, so they need lenient rate limiting
router.get('/transactions', dashboardLimiter, protectAnyUser, getTransactions);

module.exports = router;








