const Wallet = require('../models/walletModel');

exports.createWalletIfNotExists = async (user, userType) => {
  try {
    if (!user || !userType) {
      console.error("❌ Missing user or userType:", { user, userType });
      return;
    }

    const existingWallet = await Wallet.findOne({ user, userType });
    if (existingWallet) return;

    const newWallet = await Wallet.create({ user, userType });
    console.log("✅ Wallet created:", newWallet);
  } catch (error) {
    console.error("❌ Wallet creation error:", error.message);
  }
};

// Reusable fetch function for any role
const getWalletForRole = (role) => async (req, res) => {
  try {
    const userId = req.user._id;

    const wallet = await Wallet.findOne({ userId, userType: role });
    if (!wallet) {
      return res.status(404).json({ message: `${role} wallet not found` });
    }

    res.json({
      virtualAccount: wallet.virtualAccount,
    });
  } catch (error) {
    console.error(`Error getting ${role} wallet:`, error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getBuyerWallet: getWalletForRole('buyer'),
  getAgentWallet: getWalletForRole('agent'),
  getVendorWallet: getWalletForRole('vendor'),
};

