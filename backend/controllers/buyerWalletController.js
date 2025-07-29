const Wallet = require('../models/walletModel');

const getBuyerWallet = async (req, res) => {
  try {
    const buyerId = req.user._id; // from protectBuyer middleware

    const wallet = await Wallet.findOne({ userId: buyerId });
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

module.exports = { getBuyerWallet };
