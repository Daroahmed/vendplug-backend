const Wallet = require('../models/walletModel');

const getVendorWallet = async (req, res) => {
  try {
    const vendorId = req.user._id;

    const wallet = await Wallet.findOne({ userId: vendorId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    res.json({
      balance: wallet.balance,
      virtualAccount: wallet.virtualAccount,
    });
  } catch (error) {
    console.error('Error getting vendor wallet:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getVendorWallet };
