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
const getTransactions = asyncHandler(async (req, res) => {
  const accountNumber = req.user.virtualAccount?.trim();
  console.log('Fetching transactions for', accountNumber);
  console.log('👤 User in request:', req.user);
if (!accountNumber) {
  return res.status(400).json({ message: 'Account number missing' });
}

const wallet = await Wallet.findOne({ accountNumber: { $regex: new RegExp(`^${accountNumber}$`, 'i') } });
if (!wallet) {
  return res.status(404).json({ message: 'Wallet not found for ' + accountNumber });
}

  // Optional date filter support
  const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

  let dateFilter = {};
  if (startDate && endDate) {
    dateFilter.createdAt = { $gte: startDate, $lte: endDate };
  }

  const transactions = await Transaction.find({
    $or: [{ from: accountNumber }, { to: accountNumber }],
    ...dateFilter,
  })
    .sort({ createdAt: -1 })
    .populate('initiatedBy', 'name');

  console.log('✅ Returning transactions:', transactions.length);

  res.status(200).json({
    accountNumber,
    balance: wallet.balance,
    transactions,
  });
  
});

// @desc    Resolve user by virtual account number
// @route   GET /api/wallet/lookup/:accountNumber
// @access  Public

const resolveWallet = asyncHandler(async (req, res) => {
  const { accountNumber } = req.params;

  if (!accountNumber) {
    return res.status(400).json({ message: 'Account number is required' });
  }

  // Check if it's a vendor
  let user = await Vendor.findOne({ virtualAccount: accountNumber }).select('name email');
  if (user) {
    return res.status(200).json({ userType: 'vendor', user });
  }

  // Check if it's a buyer
  user = await Buyer.findOne({ virtualAccount: accountNumber }).select('name email');
  if (user) {
    return res.status(200).json({ userType: 'buyer', user });
  }

  // If no match
  return res.status(404).json({ message: 'User not found' });
});



module.exports = { getWallet, getTransactions, resolveWallet };

