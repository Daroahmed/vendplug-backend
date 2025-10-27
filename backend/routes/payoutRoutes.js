const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const {
  requestPayout,
  processPayouts,
  getPayoutHistory,
  getPayoutDetails
} = payoutController;
const { protectAgent, protectVendor, protectAdmin } = require('../middleware/authMiddleware');

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
// Fix stuck processing payouts - define function inline to avoid circular dependency
router.post('/fix-stuck-processing', protectAdmin, async (req, res) => {
  try {
       const Payout = require('../models/payoutModel');
    const Transaction = require('../models/Transaction');
    const PaystackService = require('../services/paystackService');
    
    // Find payouts stuck in processing for more than 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const stuckPayouts = await Payout.find({
      status: 'processing',
      createdAt: { $lt: thirtyMinutesAgo }
    });

    if (stuckPayouts.length === 0) {
      return res.json({
        success: true,
        message: 'No stuck processing payouts found',
        fixed: 0
      });
    }

    let fixedCount = 0;
    const paystackService = new PaystackService();

    for (const payout of stuckPayouts) {
      try {
        // Check Paystack transfer status
        const transferDetails = await paystackService.getTransfer(payout.paystackTransferCode);
        
        if (transferDetails.status === 'success') {
          // Update payout status to completed
          await Payout.findByIdAndUpdate(payout._id, {
            status: 'completed',
            completedAt: new Date(),
            paystackResponse: transferDetails
          });

          // Create transaction record
          await Transaction.create({
            type: 'withdrawal',
            amount: payout.amount,
            status: 'completed',
            initiatedBy: payout.vendorId,
            initiatorType: 'Vendor',
            description: `Payout completed - ${payout.paystackTransferCode}`,
            reference: payout.paystackTransferCode
          });

          fixedCount++;
        } else if (transferDetails.status === 'failed') {
          // Update payout status to failed
          await Payout.findByIdAndUpdate(payout._id, {
            status: 'failed',
            failedAt: new Date(),
            paystackResponse: transferDetails
          });

          // Refund the amount back to vendor's wallet
          await Transaction.create({
            type: 'refund',
            amount: payout.amount,
            status: 'completed',
            initiatedBy: payout.vendorId,
            initiatorType: 'Vendor',
            description: `Payout failed - refunded to wallet - ${payout.paystackTransferCode}`,
            reference: payout.paystackTransferCode
          });

          fixedCount++;
        }
      } catch (error) {
        console.error(`Error checking payout ${payout._id}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Fixed ${fixedCount} stuck processing payouts`,
      fixed: fixedCount,
      total: stuckPayouts.length
    });

  } catch (error) {
    console.error('Error fixing stuck processing payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fixing stuck processing payouts',
      error: error.message
    });
  }
});

module.exports = router;
