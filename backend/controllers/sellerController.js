// backend/controllers/sellerController.js

const Seller = require('../models/Seller');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ✅ Register Seller
const registerSeller = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.status(400).json({ message: 'Seller already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newSeller = new Seller({
      fullName,
      email,
      password: hashedPassword,
      role: 'seller'
    });

    await newSeller.save();
    res.status(201).json({ message: 'Seller registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ Login Seller
const loginSeller = async (req, res) => {
  try {
    const { email, password } = req.body;

    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const isMatch = await bcrypt.compare(password, seller.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: seller._id, role: seller.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: seller._id,
        fullName: seller.fullName,
        email: seller.email,
        phoneNumber: seller.phoneNumber,
        role: seller.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ Reset Seller Password
const resetSellerPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const seller = await Seller.findOne({ email });
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    seller.password = hashed;
    await seller.save();

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ Export all
module.exports = {
  registerSeller,
  loginSeller,
  resetSellerPassword
};
