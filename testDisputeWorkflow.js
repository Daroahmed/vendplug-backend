// backend/testDisputeWorkflow.js
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Dispute = require('./models/Dispute');
const Order = require('./models/Order');
const Buyer = require('./models/Buyer');
const Vendor = require('./models/vendorModel');
const Agent = require('./models/Agent');
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

const testDisputeWorkflow = async () => {
  try {
    await connectDB();

    console.log('🎯 Testing Complete Dispute Workflow with Staff Assignment\n');

    // 1. Get available staff
    console.log('1️⃣ Getting available dispute resolution staff...');
    const availableStaff = await Admin.find({
      isActive: true,
      'permissions.disputeResolution': true
    }).select('_id fullName role disputeSpecialties maxConcurrentDisputes activityStats');

    console.log(`Found ${availableStaff.length} available staff members:`);
    availableStaff.forEach(staff => {
      const currentWorkload = staff.activityStats.currentDisputes.length;
      console.log(`  - ${staff.fullName} (${staff.role}) - Current workload: ${currentWorkload}/${staff.maxConcurrentDisputes}`);
    });

    // 2. Get a dispute to assign
    console.log('\n2️⃣ Getting disputes that need assignment...');
    const unassignedDisputes = await Dispute.find({
      status: 'open',
      'assignment.assignedTo': { $exists: false }
    }).populate('order', 'orderId').limit(3);

    if (unassignedDisputes.length === 0) {
      console.log('No unassigned disputes found. Creating a test dispute...');
      
      // Find an existing order to create a dispute for
      const testOrder = await Order.findOne().populate('buyer vendor');
      if (!testOrder) {
        console.log('❌ No orders found to create test dispute');
        return;
      }

      const testDispute = new Dispute({
        order: testOrder._id,
        orderId: testOrder._id,
        orderType: 'Order',
        disputeId: `DSP-${Date.now()}`,
        title: 'Test Dispute - Product Not Received',
        description: 'Customer claims they did not receive the product',
        category: 'product_not_received',
        priority: 'medium',
        status: 'open',
        raisedBy: testOrder.buyer._id,
        raisedByType: 'Buyer',
        complainant: {
          userId: testOrder.buyer._id,
          userType: 'Buyer'
        },
        respondent: {
          userId: testOrder.vendor._id,
          userType: 'Vendor'
        }
      });

      await testDispute.save();
      unassignedDisputes.push(testDispute);
      console.log(`✅ Created test dispute: ${testDispute.disputeId}`);
    }

    console.log(`Found ${unassignedDisputes.length} unassigned disputes:`);
    unassignedDisputes.forEach(dispute => {
      console.log(`  - ${dispute.disputeId}: ${dispute.title} (${dispute.category})`);
    });

    // 3. Assign disputes to staff
    console.log('\n3️⃣ Assigning disputes to staff...');
    
    for (let i = 0; i < Math.min(unassignedDisputes.length, availableStaff.length); i++) {
      const dispute = unassignedDisputes[i];
      const staff = availableStaff[i];

      // Check if staff can handle this dispute category
      const canHandle = staff.disputeSpecialties.includes(dispute.category) || 
                       staff.disputeSpecialties.includes('other');

      if (!canHandle) {
        console.log(`⚠️  ${staff.fullName} cannot handle ${dispute.category} disputes`);
        continue;
      }

      // Check workload
      const currentWorkload = staff.activityStats.currentDisputes.length;
      if (currentWorkload >= staff.maxConcurrentDisputes) {
        console.log(`⚠️  ${staff.fullName} is at maximum capacity (${currentWorkload}/${staff.maxConcurrentDisputes})`);
        continue;
      }

      // Assign dispute
      dispute.assignment = {
        assignedTo: staff._id,
        assignedAt: new Date(),
        assignedBy: availableStaff[0]._id, // First staff member assigns
        notes: `Assigned to ${staff.fullName} based on specialty and workload`
      };

      dispute.status = 'assigned';
      await dispute.save();

      // Update staff activity stats
      staff.activityStats.currentDisputes.push(dispute._id);
      staff.activityStats.disputesAssigned += 1;
      staff.activityStats.lastActivity = new Date();
      await staff.save();

      console.log(`✅ Assigned ${dispute.disputeId} to ${staff.fullName}`);
    }

    // 4. Show current staff workload
    console.log('\n4️⃣ Current staff workload after assignment:');
    const updatedStaff = await Admin.find({
      isActive: true,
      'permissions.disputeResolution': true
    }).select('fullName role activityStats').populate('activityStats.currentDisputes', 'disputeId title status');

    updatedStaff.forEach(staff => {
      const currentWorkload = staff.activityStats.currentDisputes.length;
      console.log(`\n${staff.fullName} (${staff.role}):`);
      console.log(`  Total Assigned: ${staff.activityStats.disputesAssigned}`);
      console.log(`  Current Workload: ${currentWorkload}`);
      console.log(`  Recent Disputes:`);
      
      staff.activityStats.currentDisputes.slice(0, 3).forEach(dispute => {
        console.log(`    - ${dispute.disputeId}: ${dispute.title} (${dispute.status})`);
      });
    });

    // 5. Show dispute status summary
    console.log('\n5️⃣ Dispute Status Summary:');
    const disputeStats = await Dispute.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    disputeStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} disputes`);
    });

    console.log('\n🎉 Dispute workflow test completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Staff can now log in and view their assigned disputes');
    console.log('2. Staff can resolve disputes through the admin panel');
    console.log('3. Monitor staff activity and performance');
    console.log('4. Escalate complex disputes to managers');

  } catch (error) {
    console.error('❌ Error testing dispute workflow:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the script
testDisputeWorkflow();
