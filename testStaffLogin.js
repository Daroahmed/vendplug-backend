const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import models
const Admin = require('./models/Admin');

const testStaffLogin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vendplug-escrow');
        console.log('✅ Connected to MongoDB');

        // Test staff login
        const testEmail = 'dreamahmmedo@gmail.com';
        const testPassword = 'password';

        console.log(`\n🔐 Testing staff login for: ${testEmail}`);

        // Find staff member
        const staff = await Admin.findOne({ 
            email: testEmail.toLowerCase(),
            role: { $in: ['dispute_manager', 'dispute_specialist', 'dispute_analyst', 'moderator'] }
        });

        if (!staff) {
            console.log('❌ Staff member not found');
            return;
        }

        console.log(`✅ Staff found: ${staff.fullName} (${staff.role})`);

        // Check if staff is active
        if (!staff.isActive) {
            console.log('❌ Staff account is inactive');
            return;
        }

        console.log('✅ Staff account is active');

        // Verify password
        const isPasswordValid = await bcrypt.compare(testPassword, staff.password);
        if (!isPasswordValid) {
            console.log('❌ Invalid password');
            return;
        }

        console.log('✅ Password is valid');

        // Generate JWT token
        const token = jwt.sign(
            { 
                staffId: staff._id,
                email: staff.email,
                role: staff.role,
                permissions: staff.permissions
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        console.log('✅ JWT token generated');
        console.log(`Token: ${token.substring(0, 50)}...`);

        // Test token verification
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            console.log('✅ Token verification successful');
            console.log('Decoded token:', decoded);

            // Test staff lookup with decoded token
            const foundStaff = await Admin.findById(decoded.staffId);
            if (foundStaff) {
                console.log('✅ Staff lookup with token successful');
                console.log(`Found staff: ${foundStaff.fullName}`);
            } else {
                console.log('❌ Staff lookup with token failed');
            }

        } catch (tokenError) {
            console.log('❌ Token verification failed:', tokenError.message);
        }

        // Test API call simulation
        console.log('\n🌐 Testing API call simulation...');
        
        const testHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        console.log('Headers:', testHeaders);

        // Simulate the middleware check
        if (testHeaders.Authorization && testHeaders.Authorization.startsWith('Bearer')) {
            const extractedToken = testHeaders.Authorization.split(' ')[1];
            console.log('✅ Token extracted from header');
            
            if (extractedToken === token) {
                console.log('✅ Token matches');
            } else {
                console.log('❌ Token mismatch');
            }
        } else {
            console.log('❌ No valid authorization header');
            console.log('Available headers:', Object.keys(testHeaders));
        }

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
};

testStaffLogin();
