const express = require('express');
const router = express.Router();
const Vendor = require("../models/vendorModel");
const VendorProduct = require('../models/vendorProductModel');
const {
  createVendorProduct,
  getMyVendorProducts,
  getVendorProductById,
  updateVendorProduct,
  deleteVendorProduct,
  getVendorsForBuyer,
  getVendorProductsByVendorId,
  getVendorProductsForBuyers,
  getVendorShop
  
} = require('../controllers/vendorProductController');
const { protectVendor } = require('../middleware/authMiddleware');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Temp storage before Cloudinary



// Get a single product (public)
router.get('/public/:id', async (req, res) => {
  try {
    const product = await VendorProduct.findById(req.params.id)
      .populate({
        path: 'vendor',
        select: 'fullName phoneNumber businessAddress state virtualAccount totalSales reviews',
        populate: {
          path: 'reviews.buyer',
          select: 'fullName'
        }
      });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let totalReviews = 0;
    let recentReviews = [];

    if (product.vendor && product.vendor.reviews) {
      totalReviews = product.vendor.reviews.length; // ✅ store total count
      recentReviews = product.vendor.reviews
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    }

    res.json({
      ...product.toObject(),
      vendor: {
        ...product.vendor.toObject(),
        totalReviews, // ✅ total review count
        reviews: recentReviews // ✅ only latest 5 reviews
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all reviews for a vendor
router.get('/:id/reviews', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
      .populate({
        path: 'reviews.buyer',
        select: 'fullName'
      });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const sortedReviews = vendor.reviews.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({
      totalReviews: sortedReviews.length,
      reviews: sortedReviews
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});




// ✅ Update product

router.get('/shop/:id', getVendorShop);

router.get('/vendor/:vendorId/', getVendorProductsForBuyers);

router.post('/update/:id', protectVendor, upload.single('productImage'), updateVendorProduct);

// ✅ Create a new product
router.post('/', protectVendor, upload.single('productImage'), createVendorProduct);

// ✅ Get all products for current vendor
router.get('/mine', protectVendor, getMyVendorProducts);

// ✅ Get a specific product
router.get('/:id', protectVendor, getVendorProductById);

// ✅ Delete product
router.delete('/:id', protectVendor, deleteVendorProduct);

// ✅ /api/vendor-products/shop?state=Lagos&category=Electronics
router.get('/shop', getVendorsForBuyer);

// Get products by vendor ID for public display
router.get('/by-vendor', getVendorProductsByVendorId);



module.exports = router;
