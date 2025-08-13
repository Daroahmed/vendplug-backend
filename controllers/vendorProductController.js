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
  const vendorId = req.vendor._id;
  const productId = req.params.id;

  const product = await VendorProduct.findById(productId);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  // 🛡️ Ensure vendor owns the product
  if (product.vendor.toString() !== vendorId.toString()) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  const { name, price, description, stock } = req.body;

  if (name !== undefined) product.name = name;
  if (price !== undefined) product.price = price;
  if (description !== undefined) product.description = description;
  if (stock !== undefined) product.stock = stock;

  // 📷 Update image if new one is uploaded
  if (req.file) {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'vendplug/vendor-products',
    });
    product.image = result.secure_url;
    fs.unlinkSync(req.file.path); // clean temp file
  }

  await product.save();

  console.log('✅ Updated Product:', product);

  res.status(200).json(product);
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

const getVendorsForBuyer = asyncHandler(async (req, res) => {
  console.log('Headers:', req.headers); // 🔍 debug

  const { state, category } = req.query;

  const products = await VendorProduct.find({
    state: { $regex: new RegExp(`^${state}$`, 'i') },
    category: { $regex: new RegExp(`^${category}$`, 'i') }
  });

  res.json(products);
});

const getVendorProductsByVendorId = asyncHandler(async (req, res) => {
  const { vendorId } = req.query;

  if (!vendorId) {
    return res.status(400).json({ message: 'Vendor ID is required' });
  }

  const products = await VendorProduct.find({ vendor: vendorId });
  res.json(products);
});

//This is use for view-shop

const getVendorProductsForBuyers = asyncHandler(async (req, res) => {
  const vendorId = req.params.vendorId;

  const products = await VendorProduct.find({ vendor: vendorId });

  if (!products || products.length === 0) {
    return res.status(404).json({ message: 'No products found for this vendor' });
  }

  res.json(products);
});

// @desc    Public route to get vendor shop info by ID
// @route   GET /api/vendors/shop/:id
// @access  Public
const getVendorShop = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) {
    res.status(404);
    throw new Error("Vendor not found");
  }

  res.json({
    _id: vendor._id,
    shopName: vendor.shopName,
    categories: vendor.categories,
    state: vendor.state,
    image: vendor.image,
  });
});





module.exports = {
  createVendorProduct,
  getMyVendorProducts,
  getVendorProductById,
  updateVendorProduct,
  deleteVendorProduct,
  getVendorsForBuyer,
  getVendorProductsByVendorId,
  getVendorProductsForBuyers,
  getVendorShop
  
};
