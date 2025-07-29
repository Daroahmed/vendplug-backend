const Wallet = require('../models/walletModel');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');

// POST /api/wallet/transfer
const transferFunds = async (req, res) => {
  const { fromAccountNumber, toAccountNumber, amount, orderId } = req.body;

  try {
    const fromWallet = await Wallet.findOne({ virtualAccount: fromAccountNumber });
    const toWallet = await Wallet.findOne({ virtualAccount: toAccountNumber });

    if (!fromWallet || !toWallet) {
      return res.status(404).json({ message: 'One or both wallets not found' });
    }

    if (fromWallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }

    const fromBefore = fromWallet.balance;
    const toBefore = toWallet.balance;

    // Adjust balances
    fromWallet.balance -= amount;
    toWallet.balance += amount;

    await fromWallet.save();
    await toWallet.save();

    const ref = `TX-${uuidv4()}`;

    // Debit transaction for buyer (fromWallet)
    await Transaction.create({
      type: 'transfer',
      from: fromAccountNumber,
      to: toAccountNumber,
      amount,
      balanceBefore: fromBefore,
      balanceAfter: fromWallet.balance,
      description: `Payment for Order ${orderId || ''}`,
      ref,
      initiatorType: 'buyer',
    });

    // Credit transaction for agent (toWallet)
    await Transaction.create({
      type: 'transfer',
      from: fromAccountNumber,
      to: toAccountNumber,
      amount,
      balanceBefore: toBefore,
      balanceAfter: toWallet.balance,
      description: `Received payment for Order ${orderId || ''}`,
      ref: `TX-${uuidv4()}`,
      initiatorType: 'agent',
    });

    res.status(200).json({
      message: 'Transfer successful',
      ref,
      newBalance: fromWallet.balance,
    });

  } catch (error) {
    console.error('🔥 Transfer error stack:', error); // Full stack trace
    res.status(500).json({
      message: 'Internal server error',
      error: error.message,
      stack: error.stack,
    });
  }
}



module.exports = { transferFunds };



