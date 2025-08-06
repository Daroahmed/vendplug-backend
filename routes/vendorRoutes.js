//  vendorRoutes.js
const express = require("express");
const router = express.Router();
const Vendor = require("../models/vendorModel");
const { protectAgent, protectVendor } = require("../middleware/authMiddleware");
const { registerVendor, loginVendor } = require("../controllers/vendorAuthController");
const { getVendorStats } = require('../controllers/vendorAuthController');

// backend/routes/vendorRoutes.js
const {
  getVendorsByCategory,
  getVendorById
} = require('../controllers/vendorAuthController');

router.get('/', getVendorsByCategory); // ?category=fashion&state=Kano
router.get('/:vendorId', getVendorById);

router.post('/register', registerVendor);
router.post("/login", loginVendor);
router.get('/stats', protectVendor, getVendorStats);

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

module.exports = router;











