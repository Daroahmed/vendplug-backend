// agentController.js

const Agent = require("../models/Agent");
const Token = require('../models/Token');
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const Wallet = require("../models/walletModel");
const { createWalletIfNotExists } = require("../controllers/walletHelper");
const AgentOrder = require("../models/AgentOrder");
const AgentPayout = require("../models/AgentPayout");
const Buyer = require("../models/Buyer");
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// ✅ Register Agent
const registerAgent = async (req, res) => {
  try {
    const {
      fullName,
      email,
      businessName,
      phoneNumber,
      password,
      businessAddress,
      category,
      state,
    } = req.body;

    const agentExists = await Agent.findOne({ email });
    if (agentExists) {
      return res.status(400).json({ message: "Agent already exists" });
    }

    const tempVirtualAccount = "AP" + Date.now();

    const agent = new Agent({
      fullName,
      email,
      businessName,
      phoneNumber,
      password, // 👈 DO NOT manually hash it — the model handles it
      businessAddress,
      category,
      state,
      virtualAccount: tempVirtualAccount,
    });

    const savedAgent = await agent.save();

    const wallet = await createWalletIfNotExists(savedAgent._id, "agent");

    savedAgent.virtualAccount = wallet.virtualAccount;
    await savedAgent.save();

    // ✅ Send verification email
    const { sendVerificationEmail } = require('../utils/emailService');
    const verificationToken = require('jsonwebtoken').sign(
      { id: savedAgent._id, type: 'verification' },
      process.env.JWT_SECRET || 'vendplugSecret',
      { expiresIn: '24h' }
    );
    // Save verification token so verify endpoint can find it
    try {
      await Token.create({
        userId: savedAgent._id,
        userModel: 'Agent',
        token: verificationToken,
        type: 'verification',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    } catch (e) {
      console.error('⚠️ Failed to persist agent verification token:', e.message);
    }

    await sendVerificationEmail(email, verificationToken);

    // Send new user registration notification to admins
    try {
      const io = req.app.get('io');
      const { sendNotification } = require('../utils/notificationHelper');
      const Admin = require('../models/Admin');
      
      const admins = await Admin.find({ isActive: true });
      for (const admin of admins) {
        await sendNotification(io, {
          recipientId: admin._id,
          recipientType: 'Admin',
          notificationType: 'NEW_USER_REGISTERED',
          args: ['Agent', savedAgent.fullName]
        });
      }
    } catch (notificationError) {
      console.error('⚠️ New user registration notification error:', notificationError);
    }

    res.status(201).json({
      message: "Agent registered successfully. Please check your email to verify your account.",
      agent: {
        _id: savedAgent._id,
        fullName: savedAgent.fullName,
        email: savedAgent.email,
        businessName: savedAgent.businessName,
        phoneNumber: savedAgent.phoneNumber,
        virtualAccount: savedAgent.virtualAccount,
        category: savedAgent.category,
        state: savedAgent.state,
        isEmailVerified: savedAgent.isEmailVerified || false
      },
    });
  } catch (err) {
    console.error("❌ Agent registration failed:", err.message);
    res.status(500).json({ message: "Agent registration failed", error: err.message });
  }
};


// ✅ Login Agent 
const { mintRefreshToken, setRefreshCookie } = (()=>{
  const auth = require('./authController');
  return { mintRefreshToken: auth.__proto__?.mintRefreshToken || auth.mintRefreshToken, setRefreshCookie: auth.__proto__?.setRefreshCookie || auth.setRefreshCookie };
})();

const loginAgent = async (req, res) => {
  try {
    const { email, password } = req.body;

    const agent = await Agent.findOne({ email });

    if (!agent || !(await agent.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!agent.isEmailVerified) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email to continue.',
        email: agent.email,
        userType: 'agent'
      });
    }

    const wallet = await Wallet.findOne({ user: agent._id });

  try { if (mintRefreshToken && setRefreshCookie) { const raw = await mintRefreshToken(agent._id, 'Agent'); setRefreshCookie(res, raw);} } catch(_){ }

  res.status(200).json({
      token: generateToken(agent._id, "agent"),
      agent: {
        _id: agent._id,
        fullName: agent.fullName,
        email: agent.email,
        businessName: agent.businessName,
        phoneNumber: agent.phoneNumber,
        role: agent.role || "agent",
        virtualAccount: wallet?.virtualAccount || agent.wallet?.virtualAccount || null,
        category: agent.category,
        state: agent.state
      },
    });
  } catch (error) {
    console.error("Agent login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ✅ Get Agent Profile
const getAgentProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    res.status(200).json(req.user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ GET /api/agents/stats
const getAgentStats = async (req, res) => {
  try {
    const agentId = req.agent._id;

    const [fulfilledOrders, pendingOrders, successfulPayouts, queuedPayouts] = await Promise.all([
      AgentOrder.countDocuments({ agent: agentId, status: 'fulfilled' }),
      AgentOrder.countDocuments({ agent: agentId, status: { $in: ['pending', 'accepted', 'preparing', 'out_for_delivery'] } }),
      AgentPayout.find({ agent: agentId, status: 'paid' }),
      AgentPayout.find({ agent: agentId, status: { $in: ['ready_for_payout', 'requested'] } }),
    ]);

    const totalEarnings = successfulPayouts.reduce((sum, p) => sum + p.amount, 0);
    const queuedPayout = queuedPayouts.reduce((sum, p) => sum + p.amount, 0);
    const successfulPayout = totalEarnings;

    res.json({
      fulfilledOrders,
      pendingOrders,
      totalEarnings,
      queuedPayout,
      successfulPayout
    });
  } catch (err) {
    console.error('❌ Agent stats error:', err.message);
    res.status(500).json({ message: 'Server error fetching stats' });
  }
};

// @desc    Get agent basic details
// @route   GET /api/agents/:agentId
// @access  Public
const getAgentById = async (req, res) => {
  const agent = await Agent.findById(req.params.agentId);
  if (agent) {
    res.json(agent);
  } else {
    res.status(404);
    throw new Error('Agent not found');
  }
};

const getAgentsByCategoryAndState = async (req, res) => {
  const { state, category } = req.query;

  if (!state || !category) {
    return res.status(400).json({ message: 'Missing state or category' });
  }

  const stateRegex = new RegExp(`^${state.trim()}$`, 'i'); // exact state match, case-insensitive
  const categoryRegex = new RegExp(category.trim(), 'i'); // partial category match

  const agents = await Agent.find({
    state: { $regex: stateRegex },
    $or: [
      { category: { $regex: categoryRegex } }, // if stored as string
      { category: { $in: [categoryRegex] } }   // if stored as array
    ]
  }).select('businessName brandImage totalTransactions _id');

  res.json(agents);
};

const getAgentProfileById = async (req, res) => {
  const agent = await Agent.findById(req.params.agentId).select('-password');

  if (!agent) {
    res.status(404).json({ message: 'Agent not found' });
    return;
  }

  res.json(agent);
};

// =========================
// Get Agent Shop View
// =========================
const getShopView = async (req, res) => {
  try {
    const agentId = req.params.agentId;

    const agent = await Agent.findById(agentId)
      .select('-password')
      .populate('products');

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json({
      _id: agent._id,
      fullName: agent.fullName,
      businessName: agent.businessName,
      phoneNumber: agent.phoneNumber,
      businessAddress: agent.businessAddress,
      state: agent.state,
      category: agent.category,
      businessDescription: agent.businessDescription,
      rating: agent.averageRating, // ✅ Average rating
      reviews: agent.reviews,      // ✅ All reviews
      brandImage: agent.brandImage,
      products: agent.products
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// =========================
// Add Agent Review
// =========================
const addAgentReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const agentId = req.params.agentId;
    const buyerId = req.user._id; // Comes from protectBuyer middleware

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Optional: Prevent duplicate review from same buyer
    const alreadyReviewed = agent.reviews.find(
      (r) => r.buyer.toString() === buyerId.toString()
    );
    if (alreadyReviewed) {
      return res.status(400).json({ message: 'You have already reviewed this agent' });
    }

    // Add review
    agent.reviews.push({
      buyer: buyerId,
      rating,
      comment
    });

    await agent.save(); // Average rating is auto-calculated in model

    res.status(201).json({
      message: 'Review added successfully',
      reviews: agent.reviews,
      averageRating: agent.averageRating
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Update Agent Profile with Cloudinary Image Upload
const updateAgentProfile = async (req, res) => {
  try {
    const agentId = req.agent._id;
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // 📷 Upload brand image if provided
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "vendplug/agent-brand", // store brand images in separate folder
      });
      agent.brandImage = result.secure_url;

      // Clean up local temp file
      fs.unlinkSync(req.file.path);
    }

    // 📝 Update optional fields
    if (req.body.businessDescription !== undefined) {
      agent.businessDescription = req.body.businessDescription;
    }
    if (req.body.businessAddress !== undefined) {
      agent.businessAddress = req.body.businessAddress;
    }

    await agent.save();

    res.status(200).json({
      message: "Agent profile updated successfully",
      agent: {
        _id: agent._id,
        fullName: agent.fullName,
        businessName: agent.businessName,
        brandImage: agent.brandImage,
        businessDescription: agent.businessDescription,
        businessAddress: agent.businessAddress,
        averageRating: agent.averageRating,
        totalTransactions: agent.totalTransactions,
      },
    });
  } catch (error) {
    console.error("❌ Error updating agent profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  registerAgent,
  loginAgent,
  getAgentProfile,
  getAgentStats,
  getAgentById,
  getAgentsByCategoryAndState,
  getAgentProfileById,
  getShopView,
  addAgentReview,
  updateAgentProfile
};
