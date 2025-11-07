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

    // 📷 Upload product images if provided
    let primaryImage = '';
    const additionalImages = [];
    
    if (req.files && req.files.length > 0) {
      // Upload first image as primary
      const firstImage = req.files[0];
      const firstResult = await cloudinary.uploader.upload(firstImage.path, {
        folder: 'vendplug/vendor-products',
      });
      primaryImage = firstResult.secure_url;
      fs.unlinkSync(firstImage.path);

      // Upload remaining images
      for (let i = 1; i < req.files.length; i++) {
        try {
          const result = await cloudinary.uploader.upload(req.files[i].path, {
            folder: 'vendplug/vendor-products',
          });
          additionalImages.push(result.secure_url);
          fs.unlinkSync(req.files[i].path);
        } catch (error) {
          console.error(`Error uploading image ${i}:`, error);
          fs.unlinkSync(req.files[i].path); // Clean up even on error
        }
      }
    } else if (req.file) {
      // Backward compatibility: handle single file upload
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'vendplug/vendor-products',
      });
      primaryImage = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const product = await VendorProduct.create({
      vendor: vendorId,
      name,
      price,
      description,
      stock,
      category: vendor.category, // ✅ Use vendor's category
      image: primaryImage || null,
      images: additionalImages,
    });

    // Update onboarding progress (mark first product as complete)
    const { updateOnboardingProgress } = require('./vendorAuthController');
    await updateOnboardingProgress(vendorId);

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

  // 📷 Update images if new ones are uploaded
  if (req.files && req.files.length > 0) {
    // Upload first image as primary
    const firstImage = req.files[0];
    const firstResult = await cloudinary.uploader.upload(firstImage.path, {
      folder: 'vendplug/vendor-products',
    });
    product.image = firstResult.secure_url;
    fs.unlinkSync(firstImage.path);

    // Upload remaining images
    const additionalImages = [];
    for (let i = 1; i < req.files.length; i++) {
      try {
        const result = await cloudinary.uploader.upload(req.files[i].path, {
          folder: 'vendplug/vendor-products',
        });
        additionalImages.push(result.secure_url);
        fs.unlinkSync(req.files[i].path);
      } catch (error) {
        console.error(`Error uploading image ${i}:`, error);
        fs.unlinkSync(req.files[i].path);
      }
    }
    
    // Merge with existing images if any, or replace if clearImages flag is set
    if (req.body.clearImages === 'true') {
      product.images = additionalImages;
    } else {
      product.images = [...(product.images || []), ...additionalImages];
    }
  } else if (req.file) {
    // Backward compatibility: handle single file upload
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'vendplug/vendor-products',
    });
    product.image = result.secure_url;
    fs.unlinkSync(req.file.path);
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

  const products = await VendorProduct.find({ vendor: vendorId }).populate(
    "vendor",
    "shopName fullName brandImage category"
  );

  // Always return array
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
