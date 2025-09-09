const mongoose = require('mongoose');
const Admin = require('./models/Admin');
require('dotenv').config({ path: './.env' });

async function checkStaff() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vendplug-escrow');
    console.log('✅ Connected to MongoDB');

    // Find all staff members
    const staff = await Admin.find({
      role: { $in: ['dispute_manager', 'dispute_specialist', 'dispute_analyst', 'moderator'] }
    }).select('username email fullName role isActive');

    console.log('📋 Staff Members:');
    console.log('================');
    
    if (staff.length === 0) {
      console.log('No staff members found with dispute resolution roles');
    } else {
      staff.forEach((member, index) => {
        console.log(`${index + 1}. ${member.fullName}`);
        console.log(`   Email: ${member.email}`);
        console.log(`   Username: ${member.username}`);
        console.log(`   Role: ${member.role}`);
        console.log(`   Active: ${member.isActive}`);
        console.log('   ---');
      });
    }

    // Also check all admins
    const allAdmins = await Admin.find({}).select('username email fullName role isActive');
    console.log('\n📋 All Admin Users:');
    console.log('==================');
    
    allAdmins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.fullName}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Username: ${admin.username}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Active: ${admin.isActive}`);
      console.log('   ---');
    });

  } catch (error) {
    console.error('❌ Error checking staff:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

checkStaff();
