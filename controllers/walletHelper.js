const Wallet = require("../models/walletModel");
const Buyer = require("../models/Buyer");
const Agent = require("../models/Agent");
const Vendor = require("../models/vendorModel");

// Prefix generator
const generateVirtualAccount = (role) => {
  const prefixMap = {
    buyer: 'BP',
    agent: 'AP',
    vendor: 'VP',
  };
  const prefix = prefixMap[role.toLowerCase()] || 'XX';
  const randomNum = Math.floor(1000000000 + Math.random() * 9000000000);
  return `${prefix}${randomNum}`;
};

// Create wallet and assign to user
const createWalletIfNotExists = async (userId, role) => {
  if (!userId || !role) throw new Error("Missing userId or role");

  let wallet = await Wallet.findOne({ user: userId });
  if (wallet) return wallet;

  let userModel;
  switch (role.toLowerCase()) {
    case "buyer":
      userModel = Buyer;
      break;
    case "agent":
      userModel = Agent;
      break;
    case "vendor":
      userModel = Vendor;
      break;
    default:
      throw new Error("Invalid user type");
  }

  const user = await userModel.findById(userId);
  if (!user) throw new Error("User not found");

  const virtualAccount = generateVirtualAccount(role);

  // Update user wallet field
  user.wallet = {
    ...user.wallet,
    virtualAccount,
    balance: 0,
    bankName: "VendPlug Microfinance Bank",
    accountName: user.fullName,
  };
  await user.save();

  wallet = new Wallet({
    user: userId,
    role: userType,
    userId,
    virtualAccount,
    balance: 0,
  });

  await wallet.save();
  return wallet;
};

module.exports = { createWalletIfNotExists };
