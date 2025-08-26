// backend/controllers/productController.js
const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const Agent = require('../models/Agent');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// ✅ Get all products
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).populate("agent", "fullName");
    console.log("🔍 Products from DB:", products); // ✅ See what’s returned
    res.status(200).json({ products });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
};


// ✅ Create product (for agent or admin)
const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, } = req.body;

    // 📷 Upload product image if provided
    let imageUrl = '';
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'vendplug/products',
      });
      imageUrl = result.secure_url;

      // Clean up local temp file
      fs.unlinkSync(req.file.path);
    }

    const newProduct = new Product({
      name,
      description,
      price,
      category,
      image: imageUrl || null,
      addedBy: req.agent.id
    });

    await newProduct.save();
    res.status(201).json({ message: 'Product created successfully', product: newProduct });
  } catch (error) {
    res.status(500).json({ message: 'Product creation failed', error: error.message });
  }
};


const uploadProduct = async (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    const agentId =   req.agent._id;
  

    let imageUrl = '';
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'vendplug/products',
      });
      imageUrl = result.secure_url;

      // Clean up local file
      fs.unlinkSync(req.file.path);
    }

    console.log("➡️ Uploading Product with data:", {
      name, description, price, category, image: imageUrl, agentId
    });

    if (!name || !price || !imageUrl) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const product = new Product({
      name,
      description,
      price,
      category,
      image: imageUrl,
      agent: agentId
    });

    await product.save();

    res.status(201).json({ message: 'Product uploaded successfully', product });
  } catch (error) {
    console.error("❌ Upload Error Stack:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



  // backend/controllers/productController.js

  const deleteProduct = async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });
  
      // Optional: log which agent deleted
      const agent = await Agent.findById(req.agent.id);
      console.log(`🗑️ Product "${product.name}" deleted by agent: ${agent?.fullName || 'Unknown Agent'} (${agent?._id})`);
  
      // If you want to also remove from Cloudinary:
      if (product.image) {
        const publicId = product.image.split('/').pop().split('.')[0]; 
        try {
          await cloudinary.uploader.destroy(`vendplug/products/${publicId}`);
          console.log(`🗑️ Cloudinary image deleted: ${product.image}`);
        } catch (err) {
          console.warn("⚠️ Cloudinary delete failed:", err.message);
        }
      }
  
      await product.deleteOne();
  
      res.json({ message: "Product deleted successfully" });
    } catch (err) {
      console.error("Delete error:", err.message);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  };
  
  

  // ✅ Update Product
  const updateProduct = async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });
  
      const agent = await Agent.findById(req.agent.id);
      console.log(`📝 Product "${product.name}" edited by agent: ${agent?.fullName || 'Unknown'} (${agent?._id})`);
  
      const { name, description, price, category } = req.body;
  
      // Update fields if provided
      if (name) product.name = name;
      if (description) product.description = description;
      if (price) product.price = price;
      if (category) product.category = category;
  
      // 📷 Handle new image upload
      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'vendplug/products',
        });
        product.image = result.secure_url;
        fs.unlinkSync(req.file.path);
      }
  
      await product.save();
  
      res.status(200).json({ message: "Product updated successfully", product });
    } catch (err) {
      console.error("Edit error:", err.message);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  };
  
  


module.exports = {
  getAllProducts,
  createProduct,
  uploadProduct,
  deleteProduct,
  updateProduct,
};