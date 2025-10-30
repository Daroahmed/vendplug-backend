const express = require('express');
const router = express.Router();
const Agent = require("../models/Agent");
const AgentProduct = require('../models/AgentProduct');
const {
  createAgentProduct,
  getMyAgentProducts,
  getAgentProductById,
  updateAgentProduct,
  deleteAgentProduct,
  getAgentsForBuyer,
  getAgentProductsByAgentId,
  getAgentProductsForBuyers,
  getAgentShop
  
} = require('../controllers/agentProductController');
const { protectAgent } = require('../middleware/authMiddleware');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Temp storage before Cloudinary



// Get a single product (public)
router.get('/public/:id', async (req, res) => {
  try {
    const product = await AgentProduct.findById(req.params.id)
      .populate({
        path: 'agent',
        select: 'fullName phoneNumber businessAddress state virtualAccount totalTransactions reviews',
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

    if (product.agent && product.agent.reviews) {
      totalReviews = product.agent.reviews.length; // ✅ store total count
      recentReviews = product.agent.reviews
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    }

    res.json({
      ...product.toObject(),
      agent: {
        ...product.agent.toObject(),
        totalReviews, // ✅ total review count
        reviews: recentReviews // ✅ only latest 5 reviews
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all reviews for an agent
router.get('/:id/reviews', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id)
      .populate({
        path: 'reviews.buyer',
        select: 'fullName'
      });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const sortedReviews = agent.reviews.sort(
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

router.get('/shop/:id', getAgentShop);

router.get('/agent/:agentId/', getAgentProductsForBuyers);

router.post('/update/:id', protectAgent, upload.array('productImages', 5), updateAgentProduct);

// ✅ Create a new product
router.post('/', protectAgent, upload.array('productImages', 5), createAgentProduct);

// ✅ Get all products for current agent
router.get('/mine', protectAgent, getMyAgentProducts);

// ✅ Get a specific product
router.get('/:id', protectAgent, getAgentProductById);

// ✅ Delete product
router.delete('/:id', protectAgent, deleteAgentProduct);

// ✅ /api/agent-products/shop?state=Lagos&category=Electronics
router.get('/shop', getAgentsForBuyer);

// Get products by agent ID for public display
router.get('/by-agent', getAgentProductsByAgentId);



module.exports = router;
