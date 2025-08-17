const Payout = require("../models/payoutModel");
const Order = require("../models/orderModel");

// 📌 Get vendor's payout queue (orders accepted, waiting for buyer receipt)
const getPayoutQueue = async (req, res) => {
  try {
    const payouts = await Payout.find({
      vendor: req.vendor._id,
      status: "pending_receipt"
    }).populate("order");

    res.json(payouts);
  } catch (error) {
    console.error("Error fetching payout queue:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 📌 Get payouts ready for request (buyer confirmed receipt)
const getReadyForPayout = async (req, res) => {
  try {
    const payouts = await Payout.find({
      vendor: req.vendor._id,
      status: "ready_for_payout"
    }).populate("order");

    res.json(payouts);
  } catch (error) {
    console.error("Error fetching ready payouts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 📌 Vendor requests payout
const requestPayout = async (req, res) => {
  try {
    const { payoutId } = req.params;

    const payout = await Payout.findOne({
      _id: payoutId,
      vendor: req.vendor._id,
      status: "ready_for_payout"
    });

    if (!payout) {
      return res.status(404).json({ message: "Payout not found or not ready" });
    }

    payout.status = "requested";
    payout.requestedAt = new Date();
    await payout.save();

    res.json({ message: "Payout requested successfully", payout });
  } catch (error) {
    console.error("Error requesting payout:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 📌 Get vendor payout history
const getPayoutHistory = async (req, res) => {
  try {
    const payouts = await Payout.find({
      vendor: req.vendor._id,
      status: "paid"
    }).populate("order");

    res.json(payouts);
  } catch (error) {
    console.error("Error fetching payout history:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getPayoutQueue,
  getReadyForPayout,
  requestPayout,
  getPayoutHistory
};
