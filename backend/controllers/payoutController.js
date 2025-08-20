const Payout = require("../models/payoutModel");
const Order = require("../models/vendorOrderModel");

// Helper: standard population for orders
const orderPopulate = [
  { path: "buyer", select: "name email phoneNumber" },
  { path: "items.product", select: "name image price" }
];


// 📌 Get Payout Queue (pending receipts)
const getPayoutQueue = async (req, res) => {
  try {
    const payouts = await Payout.find({
      vendor: req.vendor._id,
      status: "pending_receipt"
    })
      .populate({
        path: "order",
        populate: [
          { path: "buyer", select: "fullName email phoneNumber" },
          { path: "items.product", select: "name image price" }
        ]
      })
      .sort({ createdAt: -1 });

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
    }).populate({
      path: "order",
      populate: orderPopulate
    });

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
    }).populate({
      path: "order",
      populate: orderPopulate
    });

    res.json(payouts);
  } catch (error) {
    console.error("Error fetching payout history:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 📌 Get payout summary (totals per status)
const getPayoutSummary = async (req, res) => {
  try {
    const vendorId = req.vendor._id;

    const [pending, ready, paid] = await Promise.all([
      Payout.aggregate([
        { $match: { vendor: vendorId, status: "pending_receipt" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Payout.aggregate([
        { $match: { vendor: vendorId, status: "ready_for_payout" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Payout.aggregate([
        { $match: { vendor: vendorId, status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    res.json({
      pending: pending[0]?.total || 0,
      ready: ready[0]?.total || 0,
      paid: paid[0]?.total || 0
    });
  } catch (err) {
    console.error("Error fetching payout summary:", err);
    res.status(500).json({ message: "Error fetching payout summary" });
  }
};

module.exports = {
  getPayoutQueue,
  getReadyForPayout,
  requestPayout,
  getPayoutHistory,
  getPayoutSummary
};
