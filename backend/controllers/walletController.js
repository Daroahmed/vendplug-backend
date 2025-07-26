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


exports.getWalletBalance = async (req, res) => {
  try {
    const user = req.user._id;
    const wallet = await Wallet.findOne({ user });
    if (!wallet) return res.status(404).json({ message: "Wallet not found" });
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch wallet" });
  }
};
