const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './.env' });

// Import models
const Order = require('./models/Order');
const VendorOrder = require('./models/vendorOrderModel');

async function getOrderIds() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get recent orders
    const orders = await Order.find().sort({ createdAt: -1 }).limit(10);
    const vendorOrders = await VendorOrder.find().sort({ createdAt: -1 }).limit(10);

    console.log('\n📦 Recent Orders:');
    if (orders.length > 0) {
      orders.forEach((order, index) => {
        console.log(`${index + 1}. Order ID: ${order._id}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Created: ${order.createdAt}`);
        console.log(`   Buyer: ${order.buyerId}`);
        console.log('   ---');
      });
    } else {
      console.log('   No orders found');
    }

    console.log('\n🏪 Recent Vendor Orders:');
    if (vendorOrders.length > 0) {
      vendorOrders.forEach((order, index) => {
        console.log(`${index + 1}. VendorOrder ID: ${order._id}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Created: ${order.createdAt}`);
        console.log(`   Vendor: ${order.vendorId}`);
        console.log('   ---');
      });
    } else {
      console.log('   No vendor orders found');
    }

    // Get pending orders specifically
    const pendingOrders = await Order.find({ status: 'pending_receipt' });
    const pendingVendorOrders = await VendorOrder.find({ status: 'pending_receipt' });

    console.log('\n⏳ Pending Orders (for disputes):');
    if (pendingOrders.length > 0) {
      pendingOrders.forEach((order, index) => {
        console.log(`${index + 1}. Order ID: ${order._id} (Status: ${order.status})`);
      });
    }
    
    if (pendingVendorOrders.length > 0) {
      pendingVendorOrders.forEach((order, index) => {
        console.log(`${index + 1}. VendorOrder ID: ${order._id} (Status: ${order.status})`);
      });
    }

    if (pendingOrders.length === 0 && pendingVendorOrders.length === 0) {
      console.log('   No pending orders found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

getOrderIds();
