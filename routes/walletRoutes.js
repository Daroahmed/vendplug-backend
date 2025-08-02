const express = require('express');
const router = express.Router();
const { protectBuyer, protectAgent, protectVendor } = require('../middleware/authMiddleware');
const { fundUserWallet} = require('../controllers/fundUserWallet'); // controller we'll create next
const { transferFunds } = require('../controllers/walletTransferController');
const { getWallet, getTransactions, resolveWallet } = require('../controllers/walletController');
const { protectAnyUser } = require('../middleware/authMiddleware');


 // optional shortcut for buyers
router.post('/fund-buyer', fundUserWallet); // special test route


router.post('/transfer', transferFunds);

// Role-specific balance endpoints
// For Agent
router.get('/agent', protectAgent, getWallet);

// For Buyer
router.get('/buyer', protectBuyer, getWallet);

// For Vendor
router.get('/vendor', protectVendor, getWallet);

router.post('/fund', fundUserWallet);

router.get('/lookup/:accountNumber', resolveWallet);

router.get('/transactions', protectAnyUser, getTransactions);

module.exports = router;








