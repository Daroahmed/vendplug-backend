const express = require('express');
const router = express.Router();
const { sendVerification, verifyEmail, requestPasswordReset, resetPassword, testToken, refreshSession, logout } = require('../controllers/authController');
const { testConnection } = require('../utils/emailService');
const { authLimiter, refreshLimiter } = require('../middleware/rateLimiter');

// Email verification routes
router.post('/send-verification', sendVerification);
router.post('/verify-email', verifyEmail);
router.get('/verify-email', verifyEmail); // Add GET route for email verification links

// Password reset routes
router.post('/request-reset', authLimiter, requestPasswordReset);
router.post('/reset-password', authLimiter, resetPassword);

// Refresh-session and logout
// Refresh token endpoint needs lenient rate limiting (called frequently for session management)
router.post('/refresh', refreshLimiter, refreshSession);
router.post('/logout', logout);

// Test email connection (for debugging)
router.get('/test-email', async (req, res) => {
  try {
    const isConnected = await testConnection();
    if (isConnected) {
      res.json({ success: true, message: 'Email connection successful' });
    } else {
      res.status(500).json({ success: false, message: 'Email connection failed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Email test error', error: error.message });
  }
});

// Test token endpoint (for debugging)
router.post('/test-token', testToken);

// Debug endpoint to check all tokens in database
router.get('/debug-tokens', async (req, res) => {
  try {
    const Token = require('../models/Token');
    const tokens = await Token.find({}).sort({ createdAt: -1 }).limit(10);
    
    res.json({
      message: 'Recent tokens in database',
      count: tokens.length,
      tokens: tokens.map(t => ({
        id: t._id,
        userId: t.userId,
        userModel: t.userModel,
        type: t.type,
        expires: t.expires,
        isExpired: t.expires < new Date(),
        createdAt: t.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tokens', error: error.message });
  }
});

// Test verification endpoint with token in query
router.get('/test-verify', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ 
        message: 'Token is required',
        query: req.query,
        url: req.url
      });
    }
    
    res.json({ 
      message: 'Token received successfully',
      token: token.substring(0, 20) + '...',
      query: req.query,
      url: req.url
    });
  } catch (error) {
    res.status(500).json({ message: 'Error testing verification', error: error.message });
  }
});

// Test verification with actual token validation
router.get('/test-verify-real', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ 
        message: 'Token is required',
        query: req.query,
        url: req.url
      });
    }
    
    // Test the actual verification logic
    const Token = require('../models/Token');
    const tokenDoc = await Token.findOne({ 
      token, 
      type: 'verification',
      expires: { $gt: new Date() }
    });
    
    if (!tokenDoc) {
      return res.status(400).json({ 
        message: 'Token not found or expired',
        token: token.substring(0, 20) + '...',
        currentTime: new Date(),
        query: req.query
      });
    }
    
    res.json({ 
      message: 'Token is valid',
      token: token.substring(0, 20) + '...',
      tokenDoc: {
        id: tokenDoc._id,
        userId: tokenDoc.userId,
        userModel: tokenDoc.userModel,
        type: tokenDoc.type,
        expires: tokenDoc.expires,
        isExpired: tokenDoc.expires < new Date()
      },
      query: req.query
    });
  } catch (error) {
    res.status(500).json({ message: 'Error testing verification', error: error.message });
  }
});

module.exports = router;