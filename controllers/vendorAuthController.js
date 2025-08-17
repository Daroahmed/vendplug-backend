const Vendor = require("../models/vendorModel");
const Wallet = require("../models/walletModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const { createWalletIfNotExists } = require("./walletHelper"); // <== use new helper
const Order = require('../models/vendorOrderModel');
const PayoutQueue = require('../models/payoutModel');
const Buyer = require("../models/Buyer");


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
      state,
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
      state,
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
        category: savedVendor.category,
        state: savedVendor.state
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
      category: vendor.category,
      state: vendor.state
    },
  });
});

// @desc    Get vendor basic details
// @route   GET /api/vendors/:vendorId
// @access  Public
const getVendorById = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.vendorId);
  if (vendor) {
    res.json(vendor);
  } else {
    res.status(404);
    throw new Error('Vendor not found');
  }
});

// ✅ GET /api/vendors/stats
const getVendorStats = async (req, res) => {
  try {
    const vendorId = req.vendor._id;

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

const getVendorsByCategoryAndState = asyncHandler(async (req, res) => {
  const { state, category } = req.query;

  if (!state || !category) {
    return res.status(400).json({ message: 'Missing state or category' });
  }

  const stateRegex = new RegExp(`^${state.trim()}$`, 'i'); // exact state match, case-insensitive
  const categoryRegex = new RegExp(category.trim(), 'i'); // partial category match

  const vendors = await Vendor.find({
    state: { $regex: stateRegex },
    $or: [
      { category: { $regex: categoryRegex } }, // if stored as string
      { category: { $in: [categoryRegex] } }   // if stored as array
    ]
  }).select('businessName brandImage totalTransactions _id');

  res.json(vendors);
});

const getVendorProfile = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.vendorId).select('-password');

  if (!vendor) {
    res.status(404).json({ message: 'Vendor not found' });
    return;
  }

  res.json(vendor);
});


// =========================
// Get Vendor Shop View
// =========================
const getShopView = async (req, res) => {
  try {
    const vendorId = req.params.vendorId;

    const vendor = await Vendor.findById(vendorId)
      .select('-password')
      .populate('products');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json({
      _id: vendor._id,
      fullName: vendor.fullName,
      shopName: vendor.shopName,
      phoneNumber: vendor.phoneNumber,
      businessName: vendor.businessName,
      businessAddress: vendor.businessAddress,
      state: vendor.state,
      category: vendor.category,
      shopDescription: vendor.shopDescription,
      rating: vendor.averageRating, // ✅ Average rating
      reviews: vendor.reviews,      // ✅ All reviews
      brandImage: vendor.brandImage,
      products: vendor.products
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// =========================
// Add Vendor Review
// =========================

// =========================
// @desc    Add a review to a vendor
// @route   POST /api/vendors/:vendorId/reviews
// @access  Private (Buyer only)
// =========================
const addVendorReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const vendorId = req.params.vendorId;
    const buyerId = req.user._id; // Comes from protectBuyer middleware

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Optional: Prevent duplicate review from same buyer
    const alreadyReviewed = vendor.reviews.find(
      (r) => r.buyer.toString() === buyerId.toString()
    );
    if (alreadyReviewed) {
      return res.status(400).json({ message: 'You have already reviewed this vendor' });
    }

    // Add review
    vendor.reviews.push({
      buyer: buyerId,
      rating,
      comment
    });

    await vendor.save(); // Average rating is auto-calculated in model

    res.status(201).json({
      message: 'Review added successfully',
      reviews: vendor.reviews,
      averageRating: vendor.averageRating
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


module.exports = {
  registerVendor,
  loginVendor,
  getVendorById,
  getVendorStats,
  getVendorsByCategoryAndState,
  getVendorProfile,
  getShopView,
  addVendorReview
};




