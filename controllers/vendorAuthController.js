const Vendor = require("../models/vendorModel");
const Wallet = require("../models/walletModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const { createWalletIfNotExists } = require("../controllers/walletHelper"); // <== use new helper
const Order = require('../models/Order');
const PayoutQueue = require('../models/payoutQueueModel');


// ✅ Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "vendplugSecret", {
    expiresIn: "30d",
  });
};

// ✅ Register Vendor
const registerVendor = asyncHandler(async (req, res) => {
  try {
    const {
      fullName,
      email,
      shopName,
      phoneNumber,
      password,
      businessName,
      businessAddress,
      cacNumber,
      category,
      location,
    } = req.body;

    const vendorExists = await Vendor.findOne({ email });
    if (vendorExists) {
      return res.status(400).json({ message: "Vendor already exists" });
    }

    const tempVirtualAccount = "VP" + Date.now();

    const vendor = new Vendor({
      fullName,
      email,
      shopName,
      phoneNumber,
      password, // 👈 DO NOT manually hash it — the model handles it
      businessName,
      businessAddress,
      cacNumber,
      category,
      location,
      virtualAccount: tempVirtualAccount,
    });

    const savedVendor = await vendor.save();

    const wallet = await createWalletIfNotExists(savedVendor._id, "vendor");

    savedVendor.virtualAccount = wallet.virtualAccount;
    await savedVendor.save();

    res.status(201).json({
      token: generateToken(savedVendor._id),
      vendor: {
        _id: savedVendor._id,
        fullName: savedVendor.fullName,
        email: savedVendor.email,
        shopName: savedVendor.shopName,
        phoneNumber: savedVendor.phoneNumber,
        virtualAccount: savedVendor.virtualAccount,
        category: savedVendor.category
      },
    });
  } catch (err) {
    console.error("❌ Vendor registration failed:", err.message);
    res.status(500).json({ message: "Vendor registration failed", error: err.message });
  }
});



// ✅ Login Vendor
const loginVendor = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const vendor = await Vendor.findOne({ email });

  if (!vendor || !(await vendor.matchPassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const wallet = await Wallet.findOne({ user: vendor._id });

  res.status(200).json({
    token: generateToken(vendor._id),
    vendor: {
      _id: vendor._id,
      fullName: vendor.fullName,
      email: vendor.email,
      shopName: vendor.shopName,
      phoneNumber: vendor.phoneNumber,
      role: vendor.role || "vendor",
      token: generateToken(vendor._id, "vendor"),
      virtualAccount: wallet?.virtualAccount || vendor.wallet?.virtualAccount || null,
      category: vendor.category
    },
  });
});

const getVendorsByCategory = async (req, res) => {
  try {
    const { category, state } = req.query;
    const query = {};

    if (category) query.category = category;
    if (state) query.location = state;

    const vendors = await Vendor.find(query);
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



// ✅ GET /api/vendors/stats
const getVendorStats = async (req, res) => {
  try {
    const vendorId = req.user._id;

    const [fulfilledOrders, pendingOrders, successfulPayouts, queuedPayouts] = await Promise.all([
      Order.countDocuments({ vendor: vendorId, status: 'fulfilled' }),
      Order.countDocuments({ vendor: vendorId, status: { $in: ['pending', 'in-progress'] } }),
      PayoutQueue.find({ vendor: vendorId, status: 'success' }),
      PayoutQueue.find({ vendor: vendorId, status: 'pending' }),
    ]);

    const totalEarnings = successfulPayouts.reduce((sum, p) => sum + p.amount, 0);
    const queuedPayout = queuedPayouts.reduce((sum, p) => sum + p.amount, 0);
    const successfulPayout = totalEarnings;

    res.json({
      fulfilledOrders,
      pendingOrders,
      totalEarnings,
      queuedPayout,
      successfulPayout
    });
  } catch (err) {
    console.error('❌ Vendor stats error:', err.message);
    res.status(500).json({ message: 'Server error fetching stats' });
  }
};



module.exports = {
  registerVendor,
  loginVendor,
  getVendorsByCategory,
  getVendorById,
  getVendorStats
};
