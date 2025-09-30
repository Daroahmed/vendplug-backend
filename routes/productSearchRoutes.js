const express = require('express');
const router = express.Router();
const {
  searchProducts,
  getProductDetails,
  getProductCategories,
  getProductsByCategory,
  getTrendingProducts
} = require('../controllers/productSearchController');

// Search products across all vendors and agents
router.get('/search', searchProducts);

// Get single product details
router.get('/:id', getProductDetails);

// Get all product categories
router.get('/categories/list', getProductCategories);

// Get products by category
router.get('/category/:category', getProductsByCategory);

// Get trending/popular products
router.get('/trending/list', getTrendingProducts);

module.exports = router;
