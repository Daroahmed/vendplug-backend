const jwt = require('jsonwebtoken');
const Buyer = require('../models/Buyer');

// Verify email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    // Check if token is for verification
    if (decoded.type !== 'verification') {
      return res.status(400).json({ message: 'Invalid token type' });
    }

    // Update user's verification status
    const buyer = await Buyer.findById(decoded.id);
    if (!buyer) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (buyer.isEmailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    buyer.isEmailVerified = true;
    buyer.emailVerifiedAt = new Date();
    await buyer.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({ message: 'Error verifying email' });
  }
};

module.exports = {
  verifyEmail
};