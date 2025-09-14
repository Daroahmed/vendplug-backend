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
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

async function checkWallets() {
  try {
    console.log('🔍 Checking wallets...');

    // Check wallets collection
    const wallets = await Wallet.find({});
    console.log(`\n📊 Found ${wallets.length} wallets in wallets collection:`);
    
    for (const wallet of wallets) {
      console.log(`- ${wallet.role}: ${wallet.user} - Balance: ₦${wallet.balance}`);
    }

    // Check buyers
    const buyers = await Buyer.find({});
    console.log(`\n👥 Found ${buyers.length} buyers:`);
    
    for (const buyer of buyers) {
      console.log(`- ${buyer.fullName} (${buyer._id}) - walletBalance: ${buyer.walletBalance || 'NOT SET'}, virtualAccount: ${buyer.virtualAccount || 'NOT SET'}`);
    }

    // Check agents
    const agents = await Agent.find({});
    console.log(`\n🤖 Found ${agents.length} agents:`);
    
    for (const agent of agents) {
      console.log(`- ${agent.fullName} (${agent._id}) - walletBalance: ${agent.walletBalance || 'NOT SET'}, virtualAccount: ${agent.virtualAccount || 'NOT SET'}`);
    }

    // Check vendors
    const vendors = await Vendor.find({});
    console.log(`\n🏪 Found ${vendors.length} vendors:`);
    
    for (const vendor of vendors) {
      console.log(`- ${vendor.fullName} (${vendor._id}) - walletBalance: ${vendor.walletBalance || 'NOT SET'}, virtualAccount: ${vendor.virtualAccount || 'NOT SET'}`);
    }

    console.log('\n✅ Check completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
}

checkWallets();
