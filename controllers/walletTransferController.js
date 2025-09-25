const Wallet = require('../models/walletModel');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');

const transferFunds = async (req, res) => {
  const userId = req.user?._id;
  const userRole = (req.user?.role || '').toLowerCase();

  const { fromAccountNumber, toAccountNumber, amount, orderId } = req.body;

  if (!['buyer', 'agent', 'vendor'].includes(userRole)) {
    console.error('❌ Invalid user role:', userRole);
    return res.status(400).json({ message: 'Invalid user role' });
  }

  try {
    const fromWallet = await Wallet.findOne({ virtualAccount: fromAccountNumber });
    const toWallet = await Wallet.findOne({ virtualAccount: toAccountNumber });

    if (!fromWallet || !toWallet) {
      return res.status(404).json({ message: 'One or both wallets not found' });
    }

    if (fromWallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }

    // Process transfer
    fromWallet.balance -= amount;
    toWallet.balance += amount;

    await fromWallet.save();
    await toWallet.save();

    const ref = `TX-${uuidv4()}`;
    const description = `Transfer from ${fromAccountNumber} to ${toAccountNumber}${orderId ? ` for Order ${orderId}` : ''}`;

const txn = await Transaction.create({
  type: 'transfer',
  from: fromAccountNumber,
  to: toAccountNumber,
  amount,
  description,
  ref,
  initiatorType: req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1), // Buyer/Agent/Vendor
  initiatedBy: userId,
});

    // Populate and attach readable initiator name
    await txn.populate('initiatedBy', 'fullName name businessName');

    const initiatorName =
      txn.initiatedBy?.fullName ||
      txn.initiatedBy?.name ||
      txn.initiatedBy?.businessName ||
      'Unknown';

    res.status(200).json({
      message: 'Transfer successful',
      ref,
      initiatorName,
      newBalance: fromWallet.balance,
    });

  } catch (error) {
    console.error('🔥 Transfer error stack:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error.message,
      stack: error.stack,
    });
  }
};

module.exports = { transferFunds };
