const Wallet = require('../models/walletModel');
const Transaction = require('../models/Transaction');
const Vendor = require('../models/vendorModel');
const Buyer = require('../models/Buyer');
const agent = require('../models/Agent');

const asyncHandler = require('express-async-handler');
// Unified wallet controller for agent, buyer, and vendor
const getWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    const wallet = await Wallet.findOne({ userId });
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

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .populate('initiatedBy', 'fullName name businessName');

    const transactionsWithName = transactions.map((txn) => {
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

