// agentController.js

const Agent = require("../models/Agent");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Wallet = require("../models/walletModel");
const { createWalletIfNotExists } = require("../controllers/walletHelper");

const Order = require("../models/order");

// ✅ Register Agent
const registerAgent = async (req, res) => {
  try {
    const { fullName, email, phoneNumber, password } = req.body;

    // Check if agent already exists
    const existingAgent = await Agent.findOne({ email });
    if (existingAgent) {
      return res.status(400).json({ message: "Agent already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate virtual account number
    const virtualAccount
    = "AP" + Date.now();

    // Create new agent
    const newAgent = new Agent({
      fullName,
      email,
      phoneNumber,
      password: hashedPassword,
      virtualAccount
,
    });

    const savedAgent = await newAgent.save();

    res.status(201).json({ message: "Agent registered successfully" });
  } catch (error) {
    console.error("❌ Agent Register Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Login Agent + Create Wallet if missing
const loginAgent = async (req, res) => {
  try {
    const { email, password } = req.body;

    const agent = await Agent.findOne({ email });
    if (!agent) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, agent.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    // ✅ Create wallet if it doesn't exist
    await createWalletIfNotExists(agent._id, "Agent");

    // Generate JWT token
    const token = jwt.sign(
      { id: agent._id, role: "agent" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      agent: {
        _id: agent._id,
        fullName: agent.fullName,
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        virtualAccount: agent.virtualAccount
,
      },
    });
  } catch (error) {
    console.error("❌ Agent Login Error:", error.message);
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

// ✅ Get Agent Stats
const getAgentStats = async (req, res) => {
  try {
    const agentId = req.user._id;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const ordersToday = await Order.countDocuments({
      agent: agentId,
      createdAt: { $gte: start, $lte: end }
    });

    const pendingPickups = await Order.countDocuments({
      agent: agentId,
      status: 'pending'
    });

    const earnings = await Order.aggregate([
      { $match: { agent: agentId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalEarnings = earnings[0]?.total || 0;

    res.json({
      ordersToday,
      pendingPickups,
      earnings: totalEarnings
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
  }
};

// ✅ Get Agent Orders
const getAgentOrders = async (req, res) => {
  try {
    const agentId = req.user._id;
    const orders = await Order.find({ agent: agentId })
      .populate('buyer', 'fullName email')
      .populate('agent', 'fullName');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

module.exports = {
  registerAgent,
  loginAgent,
  getAgentProfile,
  getAgentStats,
  getAgentOrders,
};
