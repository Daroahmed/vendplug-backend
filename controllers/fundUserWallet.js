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

    // ✅ ATOMIC: Use atomic increment to prevent race conditions
    const updatedWallet = await Wallet.findByIdAndUpdate(
      wallet._id,
      { $inc: { balance: Number(amount) } },
      { new: true }
    );

    if (!updatedWallet) {
      return res.status(500).json({ message: 'Failed to update wallet' });
    }

    res.status(200).json({
      message: 'Wallet funded successfully',
      balance: updatedWallet.balance
    });
  } catch (error) {
    console.error('Error funding wallet:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { fundUserWallet };
