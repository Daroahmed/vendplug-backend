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
  console.log("👤 Received userId:", userId);
  if (!userId || !role) throw new Error("Missing userId or role");

  const normalizedRole = role.toLowerCase(); // ✅ ensure it's lowercase
  let wallet = await Wallet.findOne({ 
    user: userId,
    role: normalizedRole 
  });
  if (wallet) return wallet;

  let userModel;
  switch (normalizedRole) {
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

  const virtualAccount = generateVirtualAccount(normalizedRole);

  // Update user wallet fields
  user.virtualAccount = virtualAccount;
  user.walletBalance = 0;
  await user.save();

  wallet = new Wallet({
    user: userId,
    role: normalizedRole, // ✅ Fix here
    virtualAccount,
    balance: 0,
  });

  await wallet.save();
  return wallet;
};

// Sync wallet balance between user model and Wallet collection
const syncWalletBalance = async (userId, role, newBalance) => {
  try {
    const normalizedRole = role.toLowerCase();
    let userModel;
    
    switch (normalizedRole) {
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

    // Update user's walletBalance field
    await userModel.findByIdAndUpdate(userId, {
      walletBalance: newBalance
    });

    // Update Wallet collection balance
    await Wallet.findOneAndUpdate(
      { user: userId, role: normalizedRole },
      { balance: newBalance }
    );

    console.log(`✅ Synced wallet balance for ${normalizedRole} ${userId}: ₦${newBalance}`);
  } catch (error) {
    console.error('❌ Error syncing wallet balance:', error);
  }
};

module.exports = { createWalletIfNotExists, syncWalletBalance };
