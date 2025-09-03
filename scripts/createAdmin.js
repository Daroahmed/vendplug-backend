// backend/scripts/createAdmin.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const Admin = require('../models/Admin');

// Load environment variables from the correct path
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function listExistingAdmins() {
    try {
        const admins = await Admin.find({}).select('-password');
        console.log('📋 Existing admin users:');
        if (admins.length === 0) {
            console.log('   No admin users found');
        } else {
            admins.forEach((admin, index) => {
                console.log(`   ${index + 1}. Username: ${admin.username}`);
                console.log(`      Email: ${admin.email}`);
                console.log(`      Role: ${admin.role}`);
                console.log(`      Status: ${admin.isActive ? 'Active' : 'Inactive'}`);
                console.log(`      Created: ${admin.createdAt}`);
                console.log('');
            });
        }
    } catch (error) {
        console.error('❌ Error listing admins:', error);
    }
}

async function createDefaultAdmin() {
    try {
        // Check if MONGO_URI exists
        if (!process.env.MONGO_URI) {
            console.error('❌ MONGO_URI not found in environment variables');
            console.log('📁 Current working directory:', process.cwd());
            console.log('🔍 Looking for .env file at:', path.join(__dirname, '../.env'));
            process.exit(1);
        }

        console.log('🔗 Connecting to MongoDB...');
        console.log('📡 MONGO_URI:', process.env.MONGO_URI.substring(0, 20) + '...');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // First, list existing admins
        await listExistingAdmins();

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ username: 'admin' });
        if (existingAdmin) {
            console.log('⚠️ Admin user already exists');
            console.log('✅ You can now login to the admin dashboard with:');
            console.log('   Username: admin');
            console.log('   Password: admin123');
            process.exit(0);
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // Create default admin user
        const admin = new Admin({
            username: 'admin',
            email: 'admin@vendplug.com',
            password: hashedPassword,
            fullName: 'Vendplug Administrator',
            role: 'super_admin',
            permissions: {
                userManagement: true,
                orderManagement: true,
                payoutManagement: true,
                disputeManagement: true,
                analytics: true,
                systemSettings: true
            },
            isActive: true
        });

        await admin.save();
        console.log('✅ Default admin user created successfully!');
        console.log('📋 Login credentials:');
        console.log('   Username: admin');
        console.log('   Password: admin123');
        console.log('⚠️  Please change the password after first login!');

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    }
}

createDefaultAdmin();
