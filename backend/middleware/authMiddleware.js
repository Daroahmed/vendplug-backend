const jwt = require('jsonwebtoken');
const Buyer = require('../models/Buyer');
const Agent = require('../models/Agent');
const Product = require('../models/Product');
const asyncHandler = require('express-async-handler');
const Vendor = require('../models/vendorModel');

// Helper to extract token from headers
const extractToken = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

// 🔐 Protect Buyer Routes (✅ FIXED)
const protectBuyer = async (req, res, next) => {
  let token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const buyer = await Buyer.findById(decoded.id).select('-password'); // ✅ Fetch the buyer

    if (!buyer) {
      return res.status(401).json({ message: 'Buyer not found' });
    }

    req.user = {
      ...buyer.toObject(),
      role: "buyer"
    };
    
    next();
  } catch (err) {
    console.error('❌ Buyer token verification failed:', err.message);
    res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};

// 🔐 Protect Agent Routes
const protectAgent = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    console.warn("🚫 No token found in headers");
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🧾 Decoded token:", decoded);

    const agent = await Agent.findById(decoded.id).select('-password');

    if (!agent) {
      console.error("❌ No agent found for ID:", decoded.id);
      return res.status(401).json({ message: 'Agent not found' });
    }

    req.user = {
      ...agent.toObject(),
      role: "agent"
    };
    
    console.log("✅ Agent authenticated:", agent.fullName);
    next();
  } catch (err) {
    console.error('❌ Agent token error:', err.message);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// 🔐 Protect Vendor Routes
// backend/middleware/authMiddleware.js

const protectVendor = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const vendor = await Vendor.findById(decoded.id);
    if (!vendor) return res.status(401).json({ message: "Vendor not found" });

    req.user = vendor;
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized", error: error.message });
  }
};


// 🗑️ Delete Product by Agent
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const agent = req.user;
    console.log(`🗑️ Agent ${agent.fullName} (${agent._id}) is deleting: ${product.name}`);

    await product.deleteOne();

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('❌ Delete error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Export all
module.exports = {
  protectBuyer,
  protectAgent,
  deleteProduct,
  protectVendor
};
