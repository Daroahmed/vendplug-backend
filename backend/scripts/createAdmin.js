// backend/scripts/createAdmin.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

// ✅ Load .env from the correct path
dotenv.config({ path: path.join(__dirname, '../.env') });

const createAdmin = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is undefined');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = new Admin({
      fullName: 'Ahmed Admin',
      email: 'admin@vendplug.com',
      password: hashedPassword
    });

    await admin.save();
    console.log('✅ Admin created successfully');
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Failed to create admin:', error.message);
  }
};

createAdmin();
