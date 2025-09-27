require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

async function fixAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find the admin by email
    const admin = await Admin.findOne({ email: 'admin@vendplug.com' });
    
    if (!admin) {
      console.log('❌ No admin found with email admin@vendplug.com');
      process.exit(1);
    }

    console.log('📋 Found admin:', {
      id: admin._id,
      email: admin.email,
      username: admin.username,
      isActive: admin.isActive,
      role: admin.role
    });

    // Update the username field
    admin.username = 'admin';
    await admin.save();

    console.log('✅ Admin username fixed successfully!');
    console.log('📋 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing admin:', error);
    process.exit(1);
  }
}

fixAdmin();