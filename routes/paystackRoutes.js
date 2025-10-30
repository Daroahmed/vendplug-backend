const express = require('express');
const router = express.Router();
const getJWTSecret = require('../utils/jwtSecret');
const { protectBuyer, protectVendor, protectAgent } = require('../middleware/authMiddleware');
const { paymentLimiter } = require('../middleware/rateLimiter');
const paystackController = require('../controllers/paystackController');

// Wallet funding - available to all authenticated users
// We'll use a single route that can handle multiple user types
router.post('/fund-wallet', paymentLimiter, async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Import JWT to verify token
    const jwt = require('jsonwebtoken');
    
    // Use secure JWT secret helper
    const jwtSecret = getJWTSecret();
    
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
  
  // Prioritize environment variable for frontend URL
  let frontendUrl = process.env.FRONTEND_URL;
  
  // If no environment variable, try to detect from request
  if (!frontendUrl) {
    const origin = req.get('origin');
    const host = req.get('host');
    const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    
    if (origin) {
      frontendUrl = origin;
    } else if (host) {
      frontendUrl = `${protocol}://${host}`;
    } else {
      frontendUrl = 'http://localhost:5000'; // fallback
    }
  }
  
  console.log('🔄 Redirecting callback URL to frontend:', `${frontendUrl}/payment-success.html?reference=${reference}`);
  res.redirect(`${frontendUrl}/payment-success.html?reference=${reference}`);
});

// API endpoint for payment verification (for frontend calls)
router.get('/verify-payment-api', paymentLimiter, async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Import JWT to verify token
    const jwt = require('jsonwebtoken');
    
    // Use secure JWT secret helper
    const jwtSecret = getJWTSecret();
    
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
    
    // Use secure JWT secret helper
    const jwtSecret = getJWTSecret();
    
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
    
    // Use secure JWT secret helper
    const jwtSecret = getJWTSecret();
    
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
