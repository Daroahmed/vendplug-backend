//  vendorRoutes.js
const express = require("express");
const router = express.Router();
const Vendor = require("../models/vendorModel");
const asyncHandler = require('express-async-handler');
const { protectAgent, protectVendor,protectBuyer } = require("../middleware/authMiddleware");
const { registerVendor, loginVendor } = require("../controllers/vendorAuthController.js");
const { getVendorStats } = require('../controllers/vendorAuthController.js');
const { getShopView, addVendorReview } = require('../controllers/vendorAuthController');
const { getVendorsByCategoryAndState } = require('../controllers/vendorAuthController');
const { updateVendorProfile } = require("../controllers/vendorAuthController");
const {
  getVendorById,
} = require('../controllers/vendorAuthController.js');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); 

// ✅ STATIC ROUTES FIRST
router.get('/shop-vendors', asyncHandler(async (req, res) => {
  const { state, category } = req.query;
  if (!state || !category) {
    return res.status(400).json({ message: 'Missing state or category' });
  }

  const vendors = await Vendor.find({
    state,
    category: { $regex: new RegExp(`^${category}$`, 'i') }
  }).select('-password');

  res.json(vendors);
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

// ✅ Add review (buyer only)
router.post('/:vendorId/reviews', protectBuyer, addVendorReview);

router.get('/by-category-and-state', getVendorsByCategoryAndState);

router.put("/profile", protectVendor, upload.single("brandImage"), updateVendorProfile);


module.exports = router;


























