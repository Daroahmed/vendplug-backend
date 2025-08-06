const express = require('express');
const router = express.Router();
const {
  createVendorProduct,
  getMyVendorProducts,
  getVendorProductById,
  updateVendorProduct,
  deleteVendorProduct,
} = require('../controllers/vendorProductController');
const { protectVendor } = require('../middleware/authMiddleware');

// For image upload
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Temporary local storage before Cloudinary

// ✅ Create new product (with image upload)
router.post('/', protectVendor, upload.single('productImage'), createVendorProduct);

// ✅ Get all products for current vendor
router.get('/mine', protectVendor, getMyVendorProducts);

// ✅ Get a specific product (optional for viewing/editing)
router.get('/:id', protectVendor, getVendorProductById);

// ✅ Update product
router.put('/:id', protectVendor, updateVendorProduct);

// ✅ Delete product
router.delete('/:id', protectVendor, deleteVendorProduct);

module.exports = router;
