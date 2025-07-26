const express = require('express');
const router = express.Router();
const { getWalletBalance } = require('../controllers/walletController');
const { protectBuyer, protectAgent, protectVendor } = require('../middleware/authMiddleware');
const { fundBuyerWallet } = require('../controllers/fundBuyerWallet'); // controller we'll create next
const { lookupUserByAccountNumber } = require('../controllers/walletLookupController');

router.get('/buyer', protectBuyer, getWalletBalance);
router.get('/agent', protectAgent, getWalletBalance);
router.get('/vendor', protectVendor, getWalletBalance);
router.get('/balance', protectBuyer, getWalletBalance);  // optional shortcut for buyers
router.post('/fund-buyer', fundBuyerWallet); // special test route
router.get('/lookup/:accountNumber', lookupUserByAccountNumber);


module.exports = router;
