const express = require('express');
const router = express.Router();
const {
  requestPayout,
  processPayouts,
  getPayoutHistory,
  getPayoutDetails,
  fixStuckProcessingPayouts
} = require('../controllers/payoutController');
const { protectAgent, protectVendor } = require('../middleware/authMiddleware');

// Combined middleware for both agents and vendors
const protectAnyUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || "vendplugSecret";
    
    const decoded = jwt.verify(token, jwtSecret);
    
    // Try to find the user in both Agent and Vendor collections
    const Agent = require('../models/Agent');
    const Vendor = require('../models/vendorModel');
    
    const [agent, vendor] = await Promise.all([
      Agent.findById(decoded.id).select('-password'),
      Vendor.findById(decoded.id).select('-password')
    ]);
    
    if (agent) {
      req.user = { ...agent.toObject(), role: 'agent' };
    } else if (vendor) {
      req.user = { ...vendor.toObject(), role: 'vendor' };
    } else {
      return res.status(401).json({ message: 'User not found' });
    }
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Payout routes - both agents and vendors can request payouts
router.post('/request', protectAnyUser, requestPayout);
router.get('/history', protectAnyUser, getPayoutHistory);
router.get('/:payoutId', protectAnyUser, getPayoutDetails);

// Admin/System routes (for processing payouts)
router.post('/process', processPayouts); // This could be protected with admin middleware later
router.post('/fix-stuck-processing', fixStuckProcessingPayouts); // Fix stuck processing payouts

module.exports = router;
