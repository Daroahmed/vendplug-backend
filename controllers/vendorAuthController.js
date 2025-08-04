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
  try {
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

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🛠️ Temporary virtualAccount to prevent null insertion
    const tempVirtualAccount = "VP" + Date.now();

    const vendor = new Vendor({
      fullName,
      email,
      shopName,
      phoneNumber,
      password: hashedPassword,
      businessName,
      businessAddress,
      cacNumber,
      virtualAccount: tempVirtualAccount, // ✅ temp to avoid null unique error
    });

    const savedVendor = await vendor.save();

    // ✅ Create wallet and assign actual virtual account
    const wallet = await createWalletIfNotExists(savedVendor._id, "vendor");

    savedVendor.virtualAccount = wallet.virtualAccount;
    await savedVendor.save();

    res.status(201).json({
      token: generateToken(savedVendor._id),
      vendor: {
        _id: savedVendor._id,
        fullName: savedVendor.fullName,
        email: savedVendor.email,
        shopName: savedVendor.shopName,
        phoneNumber: savedVendor.phoneNumber,
        virtualAccount: savedVendor.virtualAccount,
      },
    });
  } catch (err) {
    console.error("❌ Vendor registration failed:", err.message);
    res.status(500).json({ message: "Vendor registration failed", error: err.message });
  }
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
      role: vendor.role || "vendor",
      token: generateToken(vendor._id, "vendor"),
      virtualAccount: wallet?.virtualAccount || vendor.wallet?.virtualAccount || null,
    },
  });
});

module.exports = {
  registerVendor,
  loginVendor,
};
