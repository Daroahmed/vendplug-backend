const asyncHandler = require("express-async-handler");
const Buyer = require("../models/Buyer");
const VendorOrder = require('../models/vendorOrderModel');
const AgentOrder = require('../models/AgentOrder');
const generateToken = require("../utils/generateToken");
const { mintRefreshToken, setRefreshCookie } = (()=>{
  // Import from authController without creating circular HTTP deps
  const auth = require('./authController');
  return { mintRefreshToken: auth.__proto__?.mintRefreshToken || auth.mintRefreshToken, setRefreshCookie: auth.__proto__?.setRefreshCookie || auth.setRefreshCookie };
})();
const bcrypt = require("bcryptjs");
const { createWalletIfNotExists } = require("../controllers/walletHelper");
const { notifyUser, handleError } = require('../utils/orderHelpers');
const { sendVerificationEmail } = require('../utils/emailService');
const Token = require('../models/Token');

// @desc    Register new buyer
// @desc    Register new buyer
// @route   POST /api/buyers/register
// @access  Public
const registerBuyer = asyncHandler(async (req, res) => {
  const { fullName, email, password, phoneNumber, address } = req.body;

  const buyerExists = await Buyer.findOne({ email });
  if (buyerExists) {
    res.status(400);
    throw new Error("Buyer already exists");
  }

 

  const tempVirtualAccount = "BP" + Date.now(); // temporary value

  const newBuyer = new Buyer({
    fullName,
    email,
    password,
    phoneNumber,
    address,
    virtualAccount: tempVirtualAccount, // ⛑️ prevent null insert
  });
  
  const savedBuyer = await newBuyer.save();
  console.log("🔍 Saved Buyer ID:", savedBuyer._id);
  
  console.log("📦 Creating wallet...");
  const wallet = await createWalletIfNotExists(savedBuyer._id, "buyer");
  
  savedBuyer.virtualAccount = wallet.virtualAccount;
  await savedBuyer.save();

  // Note: Verification email is sent by the frontend after registration
  // This matches the vendor/agent flow pattern

  const updatedBuyer = await Buyer.findById(savedBuyer._id).select("-password");

  res.status(201).json({
    message: "Registration successful! Please check your email to verify your account.",
    buyer: updatedBuyer,
  });
});
const loginBuyer = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const buyer = await Buyer.findOne({ email });

  if (buyer && (await bcrypt.compare(password, buyer.password))) {
    if (!buyer.isEmailVerified) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email to continue.',
        email: buyer.email,
        userType: 'buyer'
      });
    }
    // Issue refresh cookie (rolling session)
    try {
      if (mintRefreshToken && setRefreshCookie) {
        const raw = await mintRefreshToken(buyer._id, 'Buyer');
        setRefreshCookie(res, raw);
      }
    } catch(_){}

    res.status(200).json({
      _id: buyer._id,
      fullName: buyer.fullName,
      email: buyer.email,
      phoneNumber: buyer.phoneNumber,
      virtualAccount: buyer.virtualAccount,
      role: buyer.role || "buyer",
      token: generateToken(buyer._id, "buyer"),

    });
  } else {
    return res.status(401).json({ message: "Invalid email or password" });
  }
});



// @desc    Get buyer profile
// @route   GET /api/buyers/profile
// @access  Private
const getBuyerProfile = asyncHandler(async (req, res) => {
  const buyer = await Buyer.findById(req.buyer._id).select("-password");
  if (buyer) {
    res.status(200).json(buyer);
  } else {
    res.status(404);
    throw new Error("Buyer not found");
  }
});

// @desc    Get order stats for buyer (combines Vendor and Agent orders)
// @route   GET /api/buyers/order-stats
// @access  Private
const getBuyerOrderStats = asyncHandler(async (req, res) => {
  const buyerId = req.buyer._id;

  const [
    vendorTotal, agentTotal,
    vendorCompleted, agentCompleted,
    vendorPending, agentPending
  ] = await Promise.all([
    VendorOrder.countDocuments({ buyer: buyerId }),
    AgentOrder.countDocuments({ buyer: buyerId }),

    VendorOrder.countDocuments({ buyer: buyerId, status: 'completed' }),
    AgentOrder.countDocuments({ buyer: buyerId, status: 'completed' }),

    VendorOrder.countDocuments({ buyer: buyerId, status: 'pending' }),
    AgentOrder.countDocuments({ buyer: buyerId, status: 'pending' })
  ]);

  res.status(200).json({
    totalOrders: vendorTotal + agentTotal,
    completedOrders: vendorCompleted + agentCompleted,
    pendingOrders: vendorPending + agentPending
  });
});

module.exports = {
  registerBuyer,
  loginBuyer,
  getBuyerProfile,
  getBuyerOrderStats,
  notifyUser, handleError
};