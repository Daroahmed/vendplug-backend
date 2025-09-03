// backend/fixExistingDisputes.js
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Dispute = require('./models/Dispute');
const Order = require('./models/Order');
const Buyer = require('./models/Buyer');
const Vendor = require('./models/vendorModel');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vendplug-escrow');
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const fixExistingDisputes = async () => {
  try {
    await connectDB();

    console.log('🔧 Fixing existing disputes...\n');

    // Find all disputes that need fixing
    const disputes = await Dispute.find({});
    console.log(`Found ${disputes.length} disputes to check:`);

    for (const dispute of disputes) {
      console.log(`\n📋 Checking dispute: ${dispute.disputeId}`);
      
      let needsUpdate = false;
      const updates = {};

      // Fix missing order field
      if (!dispute.order && dispute.orderId) {
        updates.order = dispute.orderId;
        needsUpdate = true;
        console.log(`  ✅ Added order field: ${dispute.orderId}`);
      }

      // Fix missing raisedBy and raisedByType
      if (!dispute.raisedBy || !dispute.raisedByType) {
        // Try to find the complainant
        if (dispute.complainant && dispute.complainant.userId) {
          updates.raisedBy = dispute.complainant.userId;
          updates.raisedByType = dispute.complainant.userType;
          needsUpdate = true;
          console.log(`  ✅ Added raisedBy: ${dispute.complainant.userId} (${dispute.complainant.userType})`);
        } else {
          // Create a default buyer if none exists
          const defaultBuyer = await Buyer.findOne();
          if (defaultBuyer) {
            updates.raisedBy = defaultBuyer._id;
            updates.raisedByType = 'Buyer';
            needsUpdate = true;
            console.log(`  ✅ Added default raisedBy: ${defaultBuyer._id} (Buyer)`);
          }
        }
      }

      // Fix missing complainant/respondent if needed
      if (!dispute.complainant || !dispute.respondent) {
        if (dispute.order) {
          const order = await Order.findById(dispute.order).populate('buyer vendor');
          if (order) {
            if (!dispute.complainant) {
              updates.complainant = {
                userId: order.buyer._id,
                userType: 'Buyer'
              };
              needsUpdate = true;
              console.log(`  ✅ Added complainant: ${order.buyer._id} (Buyer)`);
            }
            if (!dispute.respondent) {
              updates.respondent = {
                userId: order.vendor._id,
                userType: 'Vendor'
              };
              needsUpdate = true;
              console.log(`  ✅ Added respondent: ${order.vendor._id} (Vendor)`);
            }
          }
        }
      }

      // Apply updates if needed
      if (needsUpdate) {
        Object.assign(dispute, updates);
        await dispute.save();
        console.log(`  🎉 Updated dispute: ${dispute.disputeId}`);
      } else {
        console.log(`  ✅ Dispute already properly configured`);
      }
    }

    console.log('\n🎉 All disputes fixed successfully!');
    
    // Show summary
    const disputeStats = await Dispute.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📊 Dispute Status Summary:');
    disputeStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} disputes`);
    });

  } catch (error) {
    console.error('❌ Error fixing disputes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the script
fixExistingDisputes();
