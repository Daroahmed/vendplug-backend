const mongoose = require('mongoose');
const Dispute = require('./models/Dispute');
require('dotenv').config();

async function checkDispute() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vendplug-escrow');
    console.log('✅ Connected to MongoDB');
    
    const dispute = await Dispute.findOne({ disputeId: 'DISP-1756981797764-2Y7P4' });
    if (dispute) {
      console.log('📋 Dispute found:');
      console.log('Status:', dispute.status);
      console.log('Priority:', dispute.priority);
      console.log('Assignment:', dispute.assignment);
      console.log('Created:', dispute.createdAt);
    } else {
      console.log('❌ Dispute not found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkDispute();
