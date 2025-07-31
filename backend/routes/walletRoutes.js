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
// For Agent
router.get('/agent', protectAgent, getWallet);

// For Buyer
router.get('/buyer', protectBuyer, getWallet);

// For Vendor
router.get('/vendor', protectVendor, getWallet);

router.post('/fund', fundUserWallet);


module.exports = router;
