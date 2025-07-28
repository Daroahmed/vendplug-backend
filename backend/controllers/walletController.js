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

const Vendor = require('../models/vendorModel');
const Buyer = require('../models/Buyer');
const Agent = require('../models/Agent');

exports.getWalletBalance = async (req, res) => {
  try {
    let user;
    if (req.agent) {
      user = await Agent.findById(req.agent._id).populate('wallet');
    } else if (req.buyer) {
      user = await Buyer.findById(req.buyer._id).populate('wallet');
    } else if (req.vendor) {
      user = await Vendor.findById(req.vendor._id).populate('wallet');
    } else {
      return res.status(401).json({ message: "User type not detected" });
    }

    if (!user || !user.wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const { balance, virtualAccount } = user.wallet;

    res.json({ balance, virtualAccount }); // ✅ return both
  } catch (err) {
    console.error("⚠️ Wallet fetch error:", err);
    res.status(500).json({ message: "Failed to fetch wallet" });
  }
};
