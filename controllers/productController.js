// backend/controllers/productController.js

const Product = require('../models/Product');
const Agent = require('../models/Agent');

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
    const { name, description, price, category, image } = req.body;

    const newProduct = new Product({
      name,
      description,
      price,
      category,
      image,
      addedBy: req.user.id
    });

    await newProduct.save();
    res.status(201).json({ message: 'Product created successfully', product: newProduct });
  } catch (error) {
    res.status(500).json({ message: 'Product creation failed', error: error.message });
  }
};


const uploadProduct = async (req, res) => {
  try {
    const { name, description, price, category, imageUrl } = req.body;
    const agentId = req.user.id;

    console.log("➡️ Uploading Product with data:", {
      name, description, price, category, imageUrl, agentId
    });

    if (!name || !price || !imageUrl) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const product = new Product({
      name,
      description,
      price,
      category,
      imageUrl,
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
  
      const agent = await Agent.findById(req.user.id);
      console.log(`🗑️ Product "${product.name}" deleted by agent: ${agent?.fullName || 'Unknown Agent'} (${agent?._id})`);
  
      await Product.deleteOne({ _id: product._id });
  
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

    // Optional: Log who is updating
    const agent = await Agent.findById(req.user.id);
    console.log(`📝 Product "${product.name}" edited by agent: ${agent?.fullName || 'Unknown'} (${agent?._id})`);

    const { name, description, price, category, imageUrl } = req.body;

    product.name = name || product.name;
    product.description = description || product.description;
    product.price = price || product.price;
    product.category = category || product.category;
    product.imageUrl = imageUrl || product.imageUrl;

    await product.save();

    res.status(200).json({ message: "Product updated successfully", product });
  } catch (err) {
    console.error("Edit error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

  

module.exports = {
  getAllProducts,
  createProduct,
  uploadProduct,
  deleteProduct,
  updateProduct
};







