//  vendorRoutes.js
const express = require("express");
const router = express.Router();
const Vendor = require("../models/vendorModel");
const asyncHandler = require('express-async-handler');
const { protectAgent, protectVendor,protectBuyer } = require("../middleware/authMiddleware");
const { registerVendor, loginVendor } = require("../controllers/vendorAuthController.js");
const { getVendorStats } = require('../controllers/vendorAuthController.js');
const { getShopView, addVendorReview, voteReviewHelpfulness, reportReview, getVendorReviews } = require('../controllers/vendorAuthController');
const { getVendorsByCategoryAndState } = require('../controllers/vendorAuthController');
const { updateVendorProfile, getCurrentVendorProfile } = require("../controllers/vendorAuthController");
const {
  getVendorById,
} = require('../controllers/vendorAuthController.js');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); 

// ✅ STATIC ROUTES FIRST
router.get('/shop-vendors', asyncHandler(async (req, res) => {
  const { state, category, search, minTransactions, page, limit } = req.query;

  const query = {};

  // Optional filters
  if (category && category.trim() !== '') {
    query.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
  }
  if (state && state.trim() !== '') {
    query.state = state.trim();
  }
  if (minTransactions && Number(minTransactions) > 0) {
    query.totalTransactions = { $gte: Number(minTransactions) };
  }
  if (search && search.trim() !== '') {
    const rx = new RegExp(search.trim(), 'i');
    query.$or = [
      { businessName: rx },
      { shopName: rx },
      { fullName: rx },
      { category: rx },
      { state: rx }
    ];
  }

  const pageNum = Number(page) > 0 ? Number(page) : 1;
  const pageSize = Number(limit) > 0 ? Number(limit) : 24;
  const skip = (pageNum - 1) * pageSize;

  const [vendors, total] = await Promise.all([
    Vendor.find(query)
      .select('-password')
      .sort({ totalTransactions: -1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    Vendor.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;
  const hasMore = pageNum < totalPages;

  res.json({ vendors, total, page: pageNum, totalPages, hasMore });
}));

router.get('/by-vendor', asyncHandler(async (req, res) => {
  const { vendor } = req.query;
  if (!vendor) return res.status(400).json({ message: 'Vendor ID missing' });

  const products = await VendorProduct.find({ vendor });
  res.json(products);
}));

router.post("/resolve-account", protectAgent, async (req, res) => {
  const { virtualAccount } = req.body;

  if (!virtualAccount) {
    return res.status(400).json({ message: "Virtual account number is required" });
  }

  const vendor = await Vendor.findOne({ virtualAccount
    : virtualAccount });
  if (!vendor) {
    return res.status(404).json({ message: "Vendor not found" });
  }

  res.json({
    _id: vendor._id,
    name: vendor.name,
    businessName: vendor.businessName
  });
});

// ✅ Get vendor transaction count
router.get('/:vendorId/transactions', asyncHandler(async (req, res) => {
  const { vendorId } = req.params;
  
  const vendor = await Vendor.findById(vendorId).select('totalTransactions shopName fullName');
  if (!vendor) {
    return res.status(404).json({ message: 'Vendor not found' });
  }
  
  res.json({
    vendorId: vendor._id,
    shopName: vendor.shopName,
    fullName: vendor.fullName,
    totalTransactions: vendor.totalTransactions || 0
  });
}));

// ✅ NOW THE DYNAMIC ONES

router.post('/register', registerVendor);
router.post("/login", loginVendor);
router.get('/stats', protectVendor, getVendorStats);


// Get vendor details only
router.get('/:vendorId', getVendorById);

// ✅ Shop view
router.get('/:vendorId', getShopView);

// ✅ Review endpoints
router.post('/:vendorId/reviews', protectBuyer, addVendorReview);
router.get('/:vendorId/reviews', getVendorReviews);
router.post('/:vendorId/reviews/:reviewId/vote', protectBuyer, voteReviewHelpfulness);
router.post('/:vendorId/reviews/:reviewId/report', protectBuyer, reportReview);

router.get('/by-category-and-state', getVendorsByCategoryAndState);

router.get("/profile", protectVendor, getCurrentVendorProfile);
router.put("/profile", protectVendor, upload.single("brandImage"), updateVendorProfile);


module.exports = router;


























