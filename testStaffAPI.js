const axios = require('axios');

const testStaffAPI = async () => {
    try {
        console.log('🧪 Testing Staff API End-to-End...\n');

        // Test 1: Staff Login
        console.log('1️⃣ Testing staff login...');
        const loginResponse = await axios.post('http://localhost:5000/api/staff/login', {
            email: 'dreamahmmedo@gmail.com',
            password: 'password'
        });

        const loginData = loginResponse.data;
        console.log('Login response:', loginData);

        if (!loginData.success) {
            console.log('❌ Login failed');
            return;
        }

        const token = loginData.data.token;
        console.log('✅ Login successful, token received');

        // Test 2: Staff Profile
        console.log('\n2️⃣ Testing staff profile...');
        const profileResponse = await axios.get('http://localhost:5000/api/staff/profile', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const profileData = profileResponse.data;
        console.log('Profile response:', profileData);

        if (profileData.success) {
            console.log('✅ Profile loaded successfully');
            console.log(`Staff: ${profileData.data.staff.fullName} (${profileData.data.staff.role})`);
        } else {
            console.log('❌ Profile failed:', profileData.message);
        }

        // Test 3: Staff Disputes
        console.log('\n3️⃣ Testing staff disputes...');
        const disputesResponse = await axios.get('http://localhost:5000/api/staff/disputes/assigned', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const disputesData = disputesResponse.data;
        console.log('Disputes response:', disputesData);

        if (disputesData.success) {
            console.log('✅ Disputes loaded successfully');
            console.log(`Found ${disputesData.data.disputes.length} assigned disputes`);
        } else {
            console.log('❌ Disputes failed:', disputesData.message);
        }

    } catch (error) {
        console.error('❌ Test error:', error);
    }
};

testStaffAPI();
