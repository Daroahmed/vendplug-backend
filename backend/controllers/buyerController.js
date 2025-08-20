const asyncHandler = require("express-async-handler");
const Buyer = require("../models/Buyer");
const generateToken = require("../utils/generateToken");
const bcrypt = require("bcryptjs");
const { createWalletIfNotExists } = require("../controllers/walletHelper");
const Order = require("../models/Order");

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

  const hashedPassword = await bcrypt.hash(password, 10);

  const tempVirtualAccount = "BP" + Date.now(); // temporary value

  const newBuyer = new Buyer({
    fullName,
    email,
    password: hashedPassword,
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
  

const updatedBuyer = await Buyer.findById(savedBuyer._id).select("-password");

  res.status(201).json({
    message: "Buyer registered successfully",
    buyer: updatedBuyer,
  });
});
const loginBuyer = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const buyer = await Buyer.findOne({ email });

  if (buyer && (await bcrypt.compare(password, buyer.password))) {
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
    res.status(401);
    throw new Error("Invalid email or password");
  }
});

// ✅ Reset Password
const resetBuyerPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const buyer = await Buyer.findOne({ email });
    if (!buyer) return res.status(404).json({ message: "Buyer not found" });

    buyer.password = await bcrypt.hash(newPassword, 10);
    await buyer.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("❌ Reset Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

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

// @desc    Get order stats for buyer
// @route   GET /api/buyers/order-stats
// @access  Private
const getBuyerOrderStats = asyncHandler(async (req, res) => {
  const buyerId = req.buyer._id;

  const totalOrders = await Order.countDocuments({ buyer: buyerId });
  const completedOrders = await Order.countDocuments({
    buyer: buyerId,
    status: "completed",
  });
  const pendingOrders = await Order.countDocuments({
    buyer: buyerId,
    status: "pending",
  });

  res.status(200).json({
    totalOrders,
    completedOrders,
    pendingOrders,
  });
});

module.exports = {
  registerBuyer,
  loginBuyer,
  resetBuyerPassword,
  getBuyerProfile,
  getBuyerOrderStats,
};
