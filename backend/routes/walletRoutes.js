const express = require('express');
const router = express.Router();
const { protectBuyer, protectAgent, protectVendor } = require('../middleware/authMiddleware');
const { fundBuyerWallet } = require('../controllers/fundBuyerWallet'); // controller we'll create next
const { lookupUserByAccountNumber } = require('../controllers/walletLookupController');
const { transferFunds } = require('../controllers/walletTransferController');
const { getBuyerWallet } = require('../controllers/walletController');
const { getAgentWallet } = require('../controllers/walletController');
const { getVendorWallet } = require('../controllers/walletController');


 // optional shortcut for buyers
router.post('/fund-buyer', fundBuyerWallet); // special test route
router.get('/lookup/:accountNumber', lookupUserByAccountNumber);
router.post('/transfer', transferFunds);
router.get('/balance', protectBuyer, getBuyerWallet);
router.get('/balance', protectAgent, getAgentWallet);
router.get('/balance', protectVendor, getVendorWallet);



module.exports = router;
