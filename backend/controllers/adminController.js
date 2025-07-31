const Admin = require('../models/Admin');
const Buyer = require('../models/Buyer');
const jwt = require('jsonwebtoken');

const bcrypt = require('bcryptjs');

// ✅ Admin Login
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin || !(await admin.matchPassword(password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.status(200).json({
      message: 'Admin login successful',
      token,
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Get all users
const getAllUsers = async (req, res) => {
  try {
    const buyers = await Buyer.find().select('-password');
    const sellers = await Seller.find().select('-password');
    res.status(200).json({ buyers, sellers });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Get all escrows
const getAllEscrows = async (req, res) => {
  try {
    const escrows = await Escrow.find()
      .populate('buyer', 'fullName email')
      .populate('seller', 'fullName email');
    res.status(200).json({ escrows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  loginAdmin,
  getAllUsers,
  getAllEscrows
};
