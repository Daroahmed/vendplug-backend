const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');

// Transfer between wallets
exports.transferFunds = async (req, res) => {
  try {
    const { toAccountNumber, amount } = req.body;
    const fromUserId = req.user._id;

    const senderWallet = await Wallet.findOne({ user: fromUserId });
    const receiverWallet = await Wallet.findOne({ virtualAccount: toAccountNumber });

    if (!senderWallet || !receiverWallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    if (senderWallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }

    senderWallet.balance -= amount;
    receiverWallet.balance += amount;

    await senderWallet.save();
    await receiverWallet.save();

    await Transaction.create({
      from: senderWallet.user,
      to: receiverWallet.user,
      amount,
      type: 'transfer',
      description: `Transfer to ${toAccountNumber}`
    });

    res.json({ message: 'Transfer successful' });
  } catch (err) {
    res.status(500).json({ message: 'Transfer failed', error: err.message });
  }
};

// Vendor payout request
exports.requestPayout = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id;

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    wallet.balance -= amount;
    await wallet.save();

    await Transaction.create({
      from: userId,
      to: userId,
      amount,
      type: 'payout',
      status: 'pending',
      description: 'Payout request by vendor'
    });

    res.json({ message: 'Payout request submitted' });
  } catch (err) {
    res.status(500).json({ message: 'Payout request failed', error: err.message });
  }
};

// View user transactions
exports.getMyTransactions = async (req, res) => {
  try {
    const userId = req.user._id;

    const transactions = await Transaction.find({
      $or: [{ from: userId }, { to: userId }]
    }).sort({ createdAt: -1 });

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch transactions', error: err.message });
  }
};
