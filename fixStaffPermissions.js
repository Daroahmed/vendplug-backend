// backend/fixStaffPermissions.js
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
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

const fixStaffPermissions = async () => {
  try {
    await connectDB();

    console.log('🔧 Fixing staff permissions...\n');

    // Find all dispute resolution staff
    const staffMembers = await Admin.find({
      role: { $in: ['dispute_manager', 'dispute_specialist', 'dispute_analyst'] }
    });

    console.log(`Found ${staffMembers.length} staff members to update:`);

    for (const staff of staffMembers) {
      console.log(`\n👤 Updating ${staff.fullName} (${staff.role}):`);
      
      // Set permissions based on role
      let permissions = {};
      
      switch (staff.role) {
        case 'dispute_manager':
          permissions = {
            disputeResolution: true,
            disputeAssignment: true,
            userManagement: true,
            analytics: true,
            orderManagement: true,
            payoutManagement: true
          };
          break;
        case 'dispute_specialist':
          permissions = {
            disputeResolution: true,
            disputeAssignment: false,
            userManagement: false,
            analytics: true,
            orderManagement: true,
            payoutManagement: false
          };
          break;
        case 'dispute_analyst':
          permissions = {
            disputeResolution: true,
            disputeAssignment: false,
            userManagement: false,
            analytics: true,
            orderManagement: false,
            payoutManagement: false
          };
          break;
      }

      // Update staff permissions
      staff.permissions = permissions;
      staff.isActive = true;
      
      // Initialize activity stats if not present
      if (!staff.activityStats) {
        staff.activityStats = {
          currentDisputes: [],
          disputesAssigned: 0,
          disputesResolved: 0,
          averageResolutionTime: 0,
          lastActivity: new Date()
        };
      }

      await staff.save();
      
      console.log(`  ✅ Updated permissions:`, Object.keys(permissions).filter(key => permissions[key]));
      console.log(`  ✅ Set active: ${staff.isActive}`);
      console.log(`  ✅ Activity stats initialized`);
    }

    console.log('\n🎉 Staff permissions updated successfully!');
    
    // Verify the updates
    console.log('\n📋 Verification - Available dispute resolution staff:');
    const availableStaff = await Admin.find({
      isActive: true,
      'permissions.disputeResolution': true
    }).select('fullName role permissions disputeSpecialties maxConcurrentDisputes');

    console.log(`Found ${availableStaff.length} available staff members:`);
    availableStaff.forEach(staff => {
      console.log(`\n${staff.fullName} (${staff.role}):`);
      console.log(`  Permissions: ${Object.keys(staff.permissions).filter(key => staff.permissions[key]).join(', ')}`);
      console.log(`  Specialties: ${staff.disputeSpecialties.join(', ')}`);
      console.log(`  Max Disputes: ${staff.maxConcurrentDisputes}`);
    });

  } catch (error) {
    console.error('❌ Error fixing staff permissions:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the script
fixStaffPermissions();
