const Vendor = require("../models/vendorModel");
const Wallet = require("../models/walletModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const { createWalletIfNotExists } = require("../controllers/walletHelper"); // <== use new helper

// ✅ Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "vendplugSecret", {
    expiresIn: "30d",
  });
};

// ✅ Register Vendor
const registerVendor = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    shopName,
    phoneNumber,
    password,
    businessName,
    businessAddress,
    cacNumber,
  } = req.body;

  const vendorExists = await Vendor.findOne({ email });
  if (vendorExists) {
    return res.status(400).json({ message: "Vendor already exists" });
  }

  const vendor = await Vendor.create({
    fullName,
    email,
    shopName,
    phoneNumber,
    password,
    businessName,
    businessAddress,
    cacNumber,
  });

  // ✅ Create wallet and assign virtual account using new helper
  const wallet = await createWalletIfNotExists(vendor._id, "vendor");

  res.status(201).json({
    token: generateToken(vendor._id),
    vendor: {
      _id: vendor._id,
      fullName: vendor.fullName,
      email: vendor.email,
      shopName: vendor.shopName,
      phoneNumber: vendor.phoneNumber,
      virtualAccount: wallet.virtualAccount,
    },
  });
});

// ✅ Login Vendor
const loginVendor = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const vendor = await Vendor.findOne({ email });

  if (!vendor || !(await vendor.matchPassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const wallet = await Wallet.findOne({ user: vendor._id });

  res.status(200).json({
    token: generateToken(vendor._id),
    vendor: {
      _id: vendor._id,
      fullName: vendor.fullName,
      email: vendor.email,
      shopName: vendor.shopName,
      phoneNumber: vendor.phoneNumber,
      virtualAccount: wallet?.virtualAccount || vendor.wallet?.virtualAccount || null,
    },
  });
});

module.exports = {
  registerVendor,
  loginVendor,
};
