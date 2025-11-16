// agentRoutes.js
const express = require("express");
const router = express.Router();
const Agent = require("../models/Agent");
const AgentProduct = require("../models/AgentProduct");
const asyncHandler = require('express-async-handler');
const { protectAgent, protectBuyer } = require("../middleware/authMiddleware");
const { authLimiter, registrationLimiter, browsingLimiter, dashboardLimiter } = require("../middleware/rateLimiter");
const { 
  registerAgent, 
  loginAgent, 
  getAgentProfile, 
  getAgentStats,
  getAgentById,
  getAgentsByCategoryAndState,
  getAgentProfileById,
  getShopView,
  addAgentReview,
  voteAgentReviewHelpfulness,
  reportAgentReview,
  getAgentReviews,
  updateAgentProfile,
  dismissOnboarding
} = require("../controllers/agentController");
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); 

// ✅ STATIC ROUTES FIRST
// Public browsing endpoint - use lenient rate limiter for browsing/search/pagination
router.get('/shop-agents', browsingLimiter, asyncHandler(async (req, res) => {
  const { state, category, search, minTransactions, page, limit } = req.query;

  const query = {};

  if (category && category.trim() !== '') {
    query.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
  }
  if (state && state.trim() !== '') {
    query.state = state.trim();
  }
  if (minTransactions && Number(minTransactions) > 0) {
    query.totalTransactions = { $gte: Number(minTransactions) };
  }
  if (search && search.trim() !== '') {
    const rx = new RegExp(search.trim(), 'i');
    query.$or = [
      { businessName: rx },
      { fullName: rx },
      { category: rx },
      { state: rx }
    ];
  }

  const pageNum = Number(page) > 0 ? Number(page) : 1;
  const pageSize = Number(limit) > 0 ? Number(limit) : 24;
  const skip = (pageNum - 1) * pageSize;

  const [agents, total] = await Promise.all([
    Agent.find(query)
      .select('-password')
      .sort({ totalTransactions: -1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    Agent.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;
  const hasMore = pageNum < totalPages;

  res.json({ agents, total, page: pageNum, totalPages, hasMore });
}));

router.get('/by-agent', asyncHandler(async (req, res) => {
  const { agent } = req.query;
  if (!agent) return res.status(400).json({ message: 'Agent ID missing' });

  const products = await AgentProduct.find({ agent });
  res.json(products);
}));

router.post("/resolve-account", protectAgent, async (req, res) => {
  const { virtualAccount } = req.body;

  if (!virtualAccount) {
    return res.status(400).json({ message: "Virtual account number is required" });
  }

  const agent = await Agent.findOne({ virtualAccount: virtualAccount });
  if (!agent) {
    return res.status(404).json({ message: "Agent not found" });
  }

  res.json({
    _id: agent._id,
    name: agent.fullName,
    businessName: agent.businessName
  });
});

// ✅ Get agent transaction count
router.get('/:agentId/transactions', asyncHandler(async (req, res) => {
  const { agentId } = req.params;
  
  const agent = await Agent.findById(agentId).select('totalTransactions businessName fullName');
  if (!agent) {
    return res.status(404).json({ message: 'Agent not found' });
  }
  
  res.json({
    agentId: agent._id,
    businessName: agent.businessName,
    fullName: agent.fullName,
    totalTransactions: agent.totalTransactions || 0
  });
}));

// ✅ NOW THE DYNAMIC ONES

// Registration limiter with runtime kill‑switch and debug header
const registrationGuard = (req, res, next) => {
  const globalOn = String(process.env.RATE_LIMIT_ENABLED || 'true').trim().toLowerCase() !== 'false';
  const regOn = String(process.env.REGISTRATION_RATE_LIMIT_ENABLED || 'true').trim().toLowerCase() !== 'false';
  try { res.setHeader('x-app-registration-limit-enabled', String(globalOn && regOn)); } catch (_) {}
  if (!globalOn || !regOn) return next();
  return registrationLimiter(req, res, next);
};

router.post('/register', registrationGuard, registerAgent);
router.post("/login", authLimiter, loginAgent);
// Dashboard endpoints are polled frequently, so they need lenient rate limiting
router.get('/stats', dashboardLimiter, protectAgent, getAgentStats);

// ✅ Profile routes (must come BEFORE /:agentId route to avoid conflicts)
router.get("/profile", protectAgent, getAgentProfile);
router.put("/profile", protectAgent, upload.single("brandImage"), updateAgentProfile);

// ✅ Onboarding routes
router.post("/onboarding/dismiss", protectAgent, dismissOnboarding);
router.post("/onboarding/reset", protectAgent, require('../controllers/agentController').resetOnboarding);

router.get('/by-category-and-state', getAgentsByCategoryAndState);

// ✅ NOW THE DYNAMIC ROUTES (must come after static routes)
// Get agent details only (getAgentById handles shop view)
router.get('/:agentId', getAgentById);

// ✅ Review endpoints
router.post('/:agentId/reviews', protectBuyer, addAgentReview);
router.get('/:agentId/reviews', getAgentReviews);
router.post('/:agentId/reviews/:reviewId/vote', protectBuyer, voteAgentReviewHelpfulness);
router.post('/:agentId/reviews/:reviewId/report', protectBuyer, reportAgentReview);

module.exports = router;