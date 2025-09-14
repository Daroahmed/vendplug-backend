const mongoose = require('mongoose');
const Wallet = require('../models/walletModel');
const Buyer = require('../models/Buyer');
const Agent = require('../models/Agent');
const Vendor = require('../models/vendorModel');

// Load environment variables
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/vendplug-escrow';
console.log('🔗 Connecting to MongoDB:', MONGO_URI);

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
});

async function syncAllWallets() {
  try {
    console.log('🔄 Starting wallet sync...');

    // Get all wallets
    const wallets = await Wallet.find({});
    console.log(`📊 Found ${wallets.length} wallets to sync`);

    for (const wallet of wallets) {
      try {
        let userModel;
        switch (wallet.role) {
          case 'buyer':
            userModel = Buyer;
            break;
          case 'agent':
            userModel = Agent;
            break;
          case 'vendor':
            userModel = Vendor;
            break;
          default:
            console.log(`⚠️ Unknown role: ${wallet.role}`);
            continue;
        }

        // Update user's walletBalance
        await userModel.findByIdAndUpdate(wallet.user, {
          walletBalance: wallet.balance,
          virtualAccount: wallet.virtualAccount
        });

        console.log(`✅ Synced ${wallet.role} wallet for user ${wallet.user}: ₦${wallet.balance}`);
      } catch (error) {
        console.error(`❌ Error syncing wallet ${wallet._id}:`, error.message);
      }
    }

    console.log('🎉 Wallet sync completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

syncAllWallets();
