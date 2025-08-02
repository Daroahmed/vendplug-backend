const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  createProduct,
  uploadProduct,
  deleteProduct,
  updateProduct
} = require('../controllers/productController');
const { protectAgent } = require('../middleware/authMiddleware');
const Product = require('../models/Product'); // Needed for the /:id GET route

// ✅ Public: Get all products
router.get('/', getAllProducts);

// ✅ Public: Get single product by ID (if needed for edit)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Fetch failed" });
  }
});

// ✅ Protected: Upload a product
router.post('/upload', protectAgent, uploadProduct);

// ✅ Protected: Create a product (optional)
router.post('/create', protectAgent, createProduct);

// ✅ Protected: Update product
router.put('/:id', protectAgent, updateProduct);

// ✅ Protected: Delete product
router.delete('/:id', protectAgent, deleteProduct);

module.exports = router;
