const express = require('express');
const router = express.Router();
const { trackShare, getVendorShareStats, getPlatformStats } = require('../controllers/analyticsController');
const { getUserTransactionCount, resetUserTransactionCount } = require('../utils/transactionHelper');

// Track shop sharing
router.post('/share', trackShare);

// Get share statistics for a specific vendor
router.get('/vendor/:vendorId/shares', getVendorShareStats);

// Get overall platform sharing statistics
router.get('/platforms', getPlatformStats);

// ✅ Test endpoint to verify transaction counts
router.get('/test-transactions/:userId/:userType', async (req, res) => {
  try {
    const { userId, userType } = req.params;
    const count = await getUserTransactionCount(userId, userType);
    
    res.json({
      success: true,
      userId,
      userType,
      totalTransactions: count,
      message: `Transaction count for ${userType} ${userId}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ Reset transaction count (for testing/corrections)
router.post('/reset-transactions/:userId/:userType', async (req, res) => {
  try {
    const { userId, userType } = req.params;
    const { newCount = 0 } = req.body;
    
    await resetUserTransactionCount(userId, userType, newCount);
    res.json({ 
      success: true,
      message: 'Transaction count reset successfully',
      userId, 
      userType, 
      newCount 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ Debug endpoint to check all transaction counts
router.get('/debug-transactions', async (req, res) => {
  try {
    const Vendor = require('../models/vendorModel');
    const Agent = require('../models/Agent');
    
    const vendors = await Vendor.find({}, 'fullName totalTransactions');
    const agents = await Agent.find({}, 'fullName totalTransactions');
    
    res.json({
      success: true,
      vendors: vendors.map(v => ({ id: v._id, name: v.fullName, count: v.totalTransactions })),
      agents: agents.map(a => ({ id: a._id, name: a.fullName, count: a.totalTransactions }))
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;
