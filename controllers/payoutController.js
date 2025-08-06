const PayoutQueue = require("../models/payoutQueueModel");
const Wallet = require("../models/walletModel");
const { v4: uuidv4 } = require("uuid");

exports.requestPayout = async (req, res) => {
  try {
    const vendor = req.user;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid payout amount." });
    }

    const wallet = await Wallet.findOne({ user: vendor._id });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance." });
    }

    const reference = "PAYOUT-" + uuidv4().slice(0, 8).toUpperCase();

    const payout = await PayoutQueue.create({
      vendorId: vendor._id,
      accountNumber: wallet.accountNumber,
      amount,
      reference,
    });

    return res.status(201).json({
      message: "Payout request created",
      payout,
    });
  } catch (err) {
    console.error("Payout request error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getVendorPayouts = async (req, res) => {
  try {
    const vendor = req.user;
    const payouts = await PayoutQueue.find({ vendorId: vendor._id }).sort({ createdAt: -1 });
    res.json({ payouts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to retrieve payouts" });
  }
};
