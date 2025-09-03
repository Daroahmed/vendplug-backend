const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

// Import Admin model
const Admin = require('./models/Admin');

const resetAdminPassword = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find the admin user
    const admin = await Admin.findOne({ email: 'admin@vendplug.com' });
    
    if (!admin) {
      console.log('❌ Admin not found');
      return;
    }

    console.log('🔍 Found admin:', {
      username: admin.username,
      email: admin.email,
      isActive: admin.isActive,
      loginAttempts: admin.loginAttempts,
      lockUntil: admin.lockUntil
    });

    // Set password as plain text - the pre('save') middleware will hash it
    admin.password = 'admin123';
    admin.loginAttempts = 0;
    admin.lockUntil = undefined;
    
    await admin.save();
    
    console.log('✅ Admin password reset successfully');
    console.log('📝 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    
  } catch (error) {
    console.error('❌ Error resetting admin password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

resetAdminPassword();
