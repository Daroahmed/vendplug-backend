const express = require('express');
const router = express.Router();
const { protectBuyer, protectAgent, protectVendor } = require('../middleware/authMiddleware');
const { fundUserWallet} = require('../controllers/fundUserWallet'); // controller we'll create next
const { lookupUserByAccountNumber } = require('../controllers/walletLookupController');
const { transferFunds } = require('../controllers/walletTransferController');
const { getWallet } = require('../controllers/walletController');

 // optional shortcut for buyers
router.post('/fund-buyer', fundUserWallet); // special test route
router.get('/lookup/:accountNumber', lookupUserByAccountNumber);
router.post('/transfer', transferFunds);

// Role-specific balance endpoints
router.get('/agent/balance', protectAgent, getWallet);
router.get('/buyer/balance', protectBuyer, getWallet);
router.get('/vendor/balance', protectVendor, getWallet);
router.post('/fund', fundUserWallet);


module.exports = router;
