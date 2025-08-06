const asyncHandler = require('express-async-handler');
const VendorProduct = require('../models/vendorProductModel');
const Vendor = require('../models/vendorModel');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

const createVendorProduct = asyncHandler(async (req, res) => {
  try {
    const vendorId = req.vendor._id; // ✅ Corrected here

    // 🔍 Get vendor from DB to access their category
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const { name, price, description, stock } = req.body;

    if (!name || !price) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    // 📷 Upload product image if provided
    let imageUrl = '';
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'vendplug/vendor-products',
      });
      imageUrl = result.secure_url;

      // Clean up local temp file
      fs.unlinkSync(req.file.path);
    }

    const product = await VendorProduct.create({
      vendor: vendorId,
      name,
      price,
      description,
      stock,
      category: vendor.category, // ✅ Use vendor's category
      image: imageUrl || null,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('❌ Error creating vendor product:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



// ✅ Get all products by current vendor
const getMyVendorProducts = asyncHandler(async (req, res) => {
  const products = await VendorProduct.find({ vendor: req.vendor._id }).sort({ createdAt: -1 });
  res.json(products);
});

// ✅ Get a single vendor product by ID
const getVendorProductById = asyncHandler(async (req, res) => {
  const product = await VendorProduct.findOne({
    _id: req.params.id,
    vendor: req.vendor._id,
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  res.json(product);
});

// ✅ Update a vendor product
const updateVendorProduct = asyncHandler(async (req, res) => {
  const { name, price, description, stock } = req.body;

  const product = await VendorProduct.findOne({
    _id: req.params.id,
    vendor: req.vendor._id,
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  product.name = name || product.name;
  product.price = price || product.price;
  product.description = description || product.description;
  product.stock = stock || product.stock;

  const updated = await product.save();
  res.json(updated);
});

// ✅ Delete a vendor product
const deleteVendorProduct = asyncHandler(async (req, res) => {
  const product = await VendorProduct.findOne({
    _id: req.params.id,
    vendor: req.vendor._id,
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  await product.deleteOne();
  res.json({ message: 'Product deleted successfully' });
});

module.exports = {
  createVendorProduct,
  getMyVendorProducts,
  getVendorProductById,
  updateVendorProduct,
  deleteVendorProduct,
};
