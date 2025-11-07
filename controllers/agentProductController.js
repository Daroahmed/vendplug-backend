const asyncHandler = require('express-async-handler');
const AgentProduct = require('../models/AgentProduct');
const Agent = require('../models/Agent');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

const createAgentProduct = asyncHandler(async (req, res) => {
  try {
    const agentId = req.agent._id; // ✅ Corrected here

    // 🔍 Get agent from DB to access their category
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
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
        folder: 'vendplug/agent-products',
      });
      primaryImage = firstResult.secure_url;
      fs.unlinkSync(firstImage.path);

      // Upload remaining images
      for (let i = 1; i < req.files.length; i++) {
        try {
          const result = await cloudinary.uploader.upload(req.files[i].path, {
            folder: 'vendplug/agent-products',
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
        folder: 'vendplug/agent-products',
      });
      primaryImage = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const product = await AgentProduct.create({
      agent: agentId,
      name,
      price,
      description,
      stock,
      category: agent.category, // ✅ Use agent's category
      image: primaryImage || null,
      images: additionalImages,
    });

    // Update onboarding progress (mark first product as complete)
    const { updateOnboardingProgress } = require('./agentController');
    await updateOnboardingProgress(agentId);

    res.status(201).json(product);
  } catch (error) {
    console.error('❌ Error creating agent product:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



// ✅ Get all products by current agent
const getMyAgentProducts = asyncHandler(async (req, res) => {
  const products = await AgentProduct.find({ agent: req.agent._id }).sort({ createdAt: -1 });
  res.json(products);
});

// ✅ Get a single agent product by ID
const getAgentProductById = asyncHandler(async (req, res) => {
  const product = await AgentProduct.findOne({
    _id: req.params.id,
    agent: req.agent._id,
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  res.json(product);
});

// ✅ Update an agent product
const updateAgentProduct = asyncHandler(async (req, res) => {
  const agentId = req.agent._id;
  const productId = req.params.id;

  const product = await AgentProduct.findById(productId);

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  // 🛡️ Ensure agent owns the product
  if (product.agent.toString() !== agentId.toString()) {
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
      folder: 'vendplug/agent-products',
    });
    product.image = firstResult.secure_url;
    fs.unlinkSync(firstImage.path);

    // Upload remaining images
    const additionalImages = [];
    for (let i = 1; i < req.files.length; i++) {
      try {
        const result = await cloudinary.uploader.upload(req.files[i].path, {
          folder: 'vendplug/agent-products',
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
      folder: 'vendplug/agent-products',
    });
    product.image = result.secure_url;
    fs.unlinkSync(req.file.path);
  }

  await product.save();

  console.log('✅ Updated Product:', product);

  res.status(200).json(product);
});




// ✅ Delete an agent product
const deleteAgentProduct = asyncHandler(async (req, res) => {
  const product = await AgentProduct.findOne({
    _id: req.params.id,
    agent: req.agent._id,
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  await product.deleteOne();
  res.json({ message: 'Product deleted successfully' });
});

const getAgentsForBuyer = asyncHandler(async (req, res) => {
  console.log('Headers:', req.headers); // 🔍 debug

  const { state, category } = req.query;

  const products = await AgentProduct.find({
    state: { $regex: new RegExp(`^${state}$`, 'i') },
    category: { $regex: new RegExp(`^${category}$`, 'i') }
  });

  res.json(products);
});

const getAgentProductsByAgentId = asyncHandler(async (req, res) => {
  const { agentId } = req.query;

  if (!agentId) {
    return res.status(400).json({ message: 'Agent ID is required' });
  }

  const products = await AgentProduct.find({ agent: agentId });
  res.json(products);
});

//This is use for view-shop

const getAgentProductsForBuyers = asyncHandler(async (req, res) => {
  const agentId = req.params.agentId;

  const products = await AgentProduct.find({ agent: agentId }).populate(
    "agent",
    "businessName fullName brandImage category"
  );

  // Always return array
  res.json(products);
});

// @desc    Public route to get agent shop info by ID
// @route   GET /api/agents/shop/:id
// @access  Public
const getAgentShop = asyncHandler(async (req, res) => {
  const agent = await Agent.findById(req.params.id);
  if (!agent) {
    res.status(404);
    throw new Error("Agent not found");
  }

  res.json({
    _id: agent._id,
    businessName: agent.businessName,
    categories: agent.categories,
    state: agent.state,
    image: agent.image,
  });
});




module.exports = {
  createAgentProduct,
  getMyAgentProducts,
  getAgentProductById,
  updateAgentProduct,
  deleteAgentProduct,
  getAgentsForBuyer,
  getAgentProductsByAgentId,
  getAgentProductsForBuyers,
  getAgentShop
  
};
