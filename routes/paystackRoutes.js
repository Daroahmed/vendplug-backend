const express = require('express');
const router = express.Router();
const { protectBuyer, protectVendor, protectAgent } = require('../middleware/authMiddleware');
const paystackController = require('../controllers/paystackController');

// Wallet funding - available to all authenticated users
// We'll use a single route that can handle multiple user types
router.post('/fund-wallet', async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Import JWT to verify token
    const jwt = require('jsonwebtoken');
    
    // Use the same JWT_SECRET logic as other controllers
    const jwtSecret = process.env.JWT_SECRET || "vendplugSecret";
    
    console.log('🔑 JWT_SECRET available:', jwtSecret ? 'Yes' : 'No');
    console.log('🔑 JWT_SECRET length:', jwtSecret ? jwtSecret.length : 0);
    console.log('🔑 JWT_SECRET starts with:', jwtSecret ? jwtSecret.substring(0, 10) + '...' : 'No');
    
    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret);
    
    console.log('🔐 Token verified:', { userId: decoded.id, role: decoded.role, token: token.substring(0, 20) + '...' });
    
    // Set user info in req for the controller
    req.user = {
      id: decoded.id,
      role: decoded.role || 'buyer', // Use role from token if available
      userType: decoded.role || 'buyer' // Use role from token if available
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token format' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    } else if (error.name === 'NotBeforeError') {
      return res.status(401).json({ success: false, message: 'Token not active yet' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}, paystackController.initializeWalletFunding);

// Payment verification (public endpoint for Paystack callbacks)
router.get('/verify-payment', (req, res) => {
  const { reference } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || req.get('origin') || 'http://localhost:5000';
  console.log('🔄 Redirecting old callback URL to frontend:', `${frontendUrl}/payment-success.html?reference=${reference}`);
  res.redirect(`${frontendUrl}/payment-success.html?reference=${reference}`);
});

// API endpoint for payment verification (for frontend calls)
router.get('/verify-payment-api', async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Import JWT to verify token
    const jwt = require('jsonwebtoken');
    
    // Use the same JWT_SECRET logic as other controllers
    const jwtSecret = process.env.JWT_SECRET || "vendplugSecret";
    
    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret);
    
    console.log('🔐 Token verified for verification:', { userId: decoded.id, role: decoded.role, token: token.substring(0, 20) + '...' });
    
    // Set user info in req for the controller
    req.user = {
      id: decoded.id,
      role: decoded.role || 'buyer',
      userType: decoded.role || 'buyer'
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}, paystackController.verifyPayment);

// Bank-related endpoints
router.get('/banks', paystackController.getBanks);
router.post('/verify-account', paystackController.verifyBankAccount);

// Transfer recipient and payout endpoints (for vendors/agents)
router.post('/create-recipient', async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Import JWT to verify token
    const jwt = require('jsonwebtoken');
    
    // Use the same JWT_SECRET logic as other controllers
    const jwtSecret = process.env.JWT_SECRET || "vendplugSecret";
    
    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret);
    
    console.log('🔐 Token verified for recipient:', { userId: decoded.id, role: decoded.role, token: token.substring(0, 20) + '...' });
    
    // Set user info in req for the controller
    req.user = {
      id: decoded.id,
      role: decoded.role || 'vendor', // Use role from token if available
      userType: decoded.role || 'vendor' // Use role from token if available
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}, paystackController.createTransferRecipient);

router.post('/initiate-payout', async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Import JWT to verify token
    const jwt = require('jsonwebtoken');
    
    // Use the same JWT_SECRET logic as other controllers
    const jwtSecret = process.env.JWT_SECRET || "vendplugSecret";
    
    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret);
    
    console.log('🔐 Token verified for payout:', { userId: decoded.id, role: decoded.role, token: token.substring(0, 20) + '...' });
    
    // Set user info in req for the controller
    req.user = {
      id: decoded.id,
      role: decoded.role || 'vendor', // Use role from token if available
      userType: decoded.role || 'vendor' // Use role from token if available
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}, paystackController.initiatePayout);

// Webhook endpoint for Paystack events
router.post('/webhook', paystackController.handleWebhook);

module.exports = router;
