// backend/createDisputeStaff.js
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

const createDisputeStaff = async () => {
  try {
    await connectDB();

    // Sample dispute resolution staff
    const staffMembers = [
      {
        username: 'dispute_manager_1',
        email: 'manager1@vendplug.com',
        password: 'DisputeManager123!',
        fullName: 'Sarah Johnson',
        role: 'dispute_manager',
        disputeSpecialties: ['product_not_received', 'product_damaged', 'delivery_issues'],
        maxConcurrentDisputes: 15
      },
      {
        username: 'dispute_specialist_1',
        email: 'specialist1@vendplug.com',
        password: 'DisputeSpecialist123!',
        fullName: 'Michael Chen',
        role: 'dispute_specialist',
        disputeSpecialties: ['product_not_as_described', 'wrong_product'],
        maxConcurrentDisputes: 12
      },
      {
        username: 'dispute_specialist_2',
        email: 'specialist2@vendplug.com',
        password: 'DisputeSpecialist123!',
        fullName: 'Emily Rodriguez',
        role: 'dispute_specialist',
        disputeSpecialties: ['payment_issues', 'communication_issues'],
        maxConcurrentDisputes: 10
      },
      {
        username: 'dispute_analyst_1',
        email: 'analyst1@vendplug.com',
        password: 'DisputeAnalyst123!',
        fullName: 'David Kim',
        role: 'dispute_analyst',
        disputeSpecialties: ['other'],
        maxConcurrentDisputes: 8
      },
      {
        username: 'dispute_analyst_2',
        email: 'analyst2@vendplug.com',
        password: 'DisputeAnalyst123!',
        fullName: 'Lisa Thompson',
        role: 'dispute_analyst',
        disputeSpecialties: ['product_not_received', 'delivery_issues'],
        maxConcurrentDisputes: 8
      }
    ];

    console.log('🚀 Creating dispute resolution staff...\n');

    for (const staffData of staffMembers) {
      try {
        // Check if staff already exists
        const existingStaff = await Admin.findOne({
          $or: [{ email: staffData.email }, { username: staffData.username }]
        });

        if (existingStaff) {
          console.log(`⚠️  Staff member ${staffData.fullName} already exists`);
          continue;
        }

        // Create staff member
        const staff = new Admin(staffData);
        await staff.save();

        console.log(`✅ Created ${staffData.role}: ${staffData.fullName}`);
        console.log(`   Email: ${staffData.email}`);
        console.log(`   Username: ${staffData.username}`);
        console.log(`   Specialties: ${staffData.disputeSpecialties.join(', ')}`);
        console.log(`   Max Disputes: ${staffData.maxConcurrentDisputes}\n`);

      } catch (error) {
        console.error(`❌ Error creating ${staffData.fullName}:`, error.message);
      }
    }

    console.log('🎉 Dispute resolution staff creation completed!');
    console.log('\n📋 Staff Summary:');
    console.log('================');
    
    const allStaff = await Admin.find({ 
      role: { $in: ['dispute_manager', 'dispute_specialist', 'dispute_analyst'] } 
    }).select('fullName role email disputeSpecialties maxConcurrentDisputes');

    allStaff.forEach(staff => {
      console.log(`${staff.fullName} (${staff.role})`);
      console.log(`  Email: ${staff.email}`);
      console.log(`  Specialties: ${staff.disputeSpecialties.join(', ')}`);
      console.log(`  Max Disputes: ${staff.maxConcurrentDisputes}\n`);
    });

  } catch (error) {
    console.error('❌ Error creating dispute staff:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run the script
createDisputeStaff();
