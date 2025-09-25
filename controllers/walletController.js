const Wallet = require('../models/walletModel');
const Transaction = require('../models/Transaction');
const Vendor = require('../models/vendorModel');
const Buyer = require('../models/Buyer');
const Agent = require('../models/Agent');

const asyncHandler = require('express-async-handler');
const { sendWalletNotification } = require('../utils/notificationHelper');
// Unified wallet controller for agent, buyer, and vendor
const getWallet = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const userRole = req.user.role;

    console.log('🔍 getWallet - userId:', userId);
    console.log('🔍 getWallet - userRole:', userRole);

    if (!userId) {
      return res.status(401).json({ message: 'User ID not found in request' });
    }

    // Look for wallet with both user ID and role
    const wallet = await Wallet.findOne({ 
      user: userId,
      role: userRole?.toLowerCase() || 'buyer' // Default to buyer if role not set
    });
    
    console.log('🔍 getWallet - wallet found:', !!wallet);
    console.log('🔍 getWallet - wallet balance:', wallet?.balance);
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    res.json({
      balance: wallet.balance,
      virtualAccount: wallet.virtualAccount,
    });
  } catch (error) {
    console.error('Error getting wallet:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// GET /api/wallet/transactions

const getTransactions = async (req, res) => {
  const user = req.user;
  const role = user.role;
  const accountNumber = user.virtualAccount;

  try {
    const query = {
      $or: [{ from: accountNumber }, { to: accountNumber }],
    };

    // Optional date filtering
    const { startDate, endDate } = req.query;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    console.log('🔍 Fetching transactions for account:', accountNumber);
    console.log('🔍 Query:', JSON.stringify(query));
    
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 });
    
    console.log('📊 Found transactions:', transactions.length);
    console.log('📊 Sample transaction:', transactions[0] ? {
      id: transactions[0]._id,
      initiatorType: transactions[0].initiatorType,
      initiatedBy: transactions[0].initiatedBy
    } : 'No transactions');
    
    // Try to populate, but handle errors gracefully
    let populatedTransactions = transactions;
    try {
      populatedTransactions = await Transaction.populate(transactions, {
        path: 'initiatedBy',
        select: 'fullName name businessName',
        model: function(doc) {
          // Dynamically resolve the model based on initiatorType
          const modelName = doc.initiatorType;
          console.log('🔍 Resolving model for:', modelName);
          
          switch(modelName) {
            case 'Buyer': return 'Buyer';
            case 'Agent': return 'Agent';
            case 'Vendor': return 'Vendor';
            case 'Admin': return 'Admin';
            case 'Staff': return 'Admin'; // Staff uses Admin model
            default: 
              console.log('⚠️ Unknown model type:', modelName);
              return 'Buyer'; // Default fallback
          }
        }
      });
    } catch (populateError) {
      console.log('⚠️ Populate failed, using unpopulated transactions:', populateError.message);
      // Continue with unpopulated transactions
    }

    const transactionsWithName = populatedTransactions.map((txn) => {
      const userObj = txn.initiatedBy;
      const initiatorName =
        userObj?.fullName || userObj?.name || userObj?.businessName || 'Unknown';

      return {
        ...txn.toObject(),
        initiatorName,
      };
    });

    res.json({
      accountNumber,
      transactions: transactionsWithName,
    });
  } catch (err) {
    console.error('❌ Error fetching transactions:', err.message);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
};

  // @desc    Resolve user by virtual account number
  // @route   GET /api/wallet/lookup/:accountNumber
  // @access  Public
  // /controllers/walletController.js

// controllers/walletController.js

  const resolveWallet = async (req, res) => {
    const { accountNumber } = req.params;

    try {
      const wallet = await Wallet.findOne({ virtualAccount: accountNumber }).populate('user');

      if (!wallet || !wallet.user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.status(200).json({
        user: wallet.user,
        role: wallet.role
      });
    } catch (error) {
      console.error('❌ Error resolving account:', error);
      res.status(500).json({
        message: 'Internal server error',
        error: error.message
      });
    }
  };


  module.exports = { getWallet, getTransactions, resolveWallet };

