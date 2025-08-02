const Wallet = require('../models/walletModel');

const fundUserWallet= async (req, res) => {
  try {
    const { accountNumber, amount } = req.body;

    if (!accountNumber || !amount) {
      return res.status(400).json({ message: 'accountNumber and amount are required' });
    }

    const wallet = await Wallet.findOne({ virtualAccount: accountNumber });

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found for this account number' });
    }

    wallet.balance += Number(amount);
    await wallet.save();

    res.status(200).json({
      message: 'Wallet funded successfully',
      balance: wallet.balance
    });
  } catch (error) {
    console.error('Error funding wallet:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { fundUserWallet };
