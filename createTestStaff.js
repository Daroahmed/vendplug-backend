const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
require('dotenv').config({ path: './.env' });

async function createTestStaff() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vendplug-escrow');
    console.log('✅ Connected to MongoDB');

    // Create test staff member
    const hashedPassword = await bcrypt.hash('staff123', 12);
    
    const testStaff = new Admin({
      username: 'staff_resolver',
      fullName: 'John Dispute Resolver',
      email: 'staff@vendplug.com',
      password: hashedPassword,
      role: 'dispute_specialist',
      permissions: {
        canViewDisputes: true,
        canResolveDisputes: true,
        canAssignDisputes: false,
        canManageStaff: false,
        canViewAnalytics: true
      },
      isActive: true,
      activityStats: {
        assignedDisputes: 0,
        resolvedDisputes: 0,
        disputesUnderReview: 0,
        averageResolutionTime: 0
      }
    });

    // Check if staff already exists
    const existingStaff = await Admin.findOne({ email: 'staff@vendplug.com' });
    if (existingStaff) {
      console.log('⚠️ Staff member already exists');
      console.log('Email: staff@vendplug.com');
      console.log('Password: staff123');
      return;
    }

    await testStaff.save();
    console.log('✅ Test staff member created successfully!');
    console.log('Email: staff@vendplug.com');
    console.log('Password: staff123');
    console.log('Role: dispute_resolver');

  } catch (error) {
    console.error('❌ Error creating test staff:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

createTestStaff();
