const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const getJWTSecret = require('../utils/jwtSecret');
const Buyer = require('../models/Buyer');
const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');
const Admin = require('../models/Admin');
const Token = require('../models/Token');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');
const crypto = require('crypto');

// Verify email
const verifyEmail = async (req, res) => {
  try {
    // Get token from request body (POST) or query params (GET)
    const token = req.body.token || req.query.token;
    
    const userAgent = req.get && req.get('user-agent');
    if (userAgent) console.log('🔍 User-Agent:', userAgent);

    console.log('🔍 Request method:', req.method);
    console.log('🔍 Token from body:', req.body.token);
    console.log('🔍 Token from query:', req.query.token);
    console.log('🔍 Final token to verify:', token);

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    console.log('🔍 Verifying token:', token);

    // First, find the token in the database
    console.log('🔍 Looking for token in database:', token);
    const tokenDoc = await Token.findOne({ 
      token, 
      type: 'verification',
      expires: { $gt: new Date() }
    });
    
    console.log('🔍 Token lookup result:', tokenDoc ? {
      id: tokenDoc._id,
      userId: tokenDoc.userId,
      userModel: tokenDoc.userModel,
      type: tokenDoc.type,
      expires: tokenDoc.expires,
      isExpired: tokenDoc.expires < new Date()
    } : 'Token not found');

    if (!tokenDoc) {
      console.log('❌ Token not found in database or expired');
      console.log('🔍 Searching for token:', token);
      console.log('🔍 Current time:', new Date());
      
      // Check if token exists but is expired
      const expiredToken = await Token.findOne({ 
        token, 
        type: 'verification'
      });
      
      // If the token has already been used and deleted by a scanner or previous click,
      // try to decode it (WITHOUT trusting it) just to see if the user is already verified.
      // We will NOT verify a user from a missing tokenDoc; this is only for idempotent UX.
      try {
        const softDecoded = jwt.decode(token);
        if (softDecoded && softDecoded.id) {
          let u = await Buyer.findById(softDecoded.id) ||
                  await Vendor.findById(softDecoded.id) ||
                  await Agent.findById(softDecoded.id);
          if (u && u.isEmailVerified) {
            console.log('⚠️ Token missing but user already verified. Returning idempotent success.');
            return res.status(200).json({ message: 'Email already verified', code: 'ALREADY_VERIFIED' });
          }
        }
      } catch (_) {
        // no-op
      }

      if (expiredToken) {
        console.log('🔍 Found expired token:', {
          id: expiredToken._id,
          expires: expiredToken.expires,
          isExpired: expiredToken.expires < new Date()
        });
        return res.status(400).json({ 
          message: 'Verification token has expired. Please request a new verification email.',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(400).json({ 
        message: 'Invalid verification token. Please check your email for the correct link.',
        code: 'TOKEN_INVALID'
      });
    }

    console.log('✅ Token found in database:', tokenDoc._id);

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, getJWTSecret());
      console.log('✅ JWT decoded:', { id: decoded.id, type: decoded.type });
    } catch (err) {
      console.log('❌ JWT verification failed:', err.message);
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    // Check if token is for verification
    if (decoded.type !== 'verification') {
      console.log('❌ Wrong token type:', decoded.type);
      return res.status(400).json({ message: 'Invalid token type' });
    }

    // Find user by ID across all user types
    let user = await Buyer.findById(decoded.id);
    let userType = 'Buyer';
    
    if (!user) {
      user = await Vendor.findById(decoded.id);
      userType = 'Vendor';
    }
    
    if (!user) {
      user = await Agent.findById(decoded.id);
      userType = 'Agent';
    }
    
    if (!user) {
      console.log('❌ User not found for ID:', decoded.id);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('✅ User found:', { id: user._id, email: user.email, userType });

    if (user.isEmailVerified) {
      console.log('⚠️ User already verified');
      // Clean up token if it still exists to prevent confusion on repeated clicks
      try {
        if (tokenDoc?._id) {
          await Token.findByIdAndDelete(tokenDoc._id);
          console.log('🧹 Deleted redundant verification token for already-verified user');
        }
      } catch (_) { /* no-op */ }
      return res.status(200).json({ message: 'Email already verified', code: 'ALREADY_VERIFIED' });
    }

    // Update user verification status
    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    console.log('✅ User verification updated');

    // Delete the used token
    await Token.findByIdAndDelete(tokenDoc._id);
    console.log('✅ Token deleted');

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({ message: 'Error verifying email' });
  }
};

// Send verification email
const sendVerification = async (req, res) => {
  try {
    const { email, userType } = req.body;

    if (!email || !userType) {
      return res.status(400).json({ message: 'Email and user type are required' });
    }

    // Find user based on type
    let user;
    let model;
    
    switch (userType.toLowerCase()) {
      case 'buyer':
        model = Buyer;
        break;
      case 'vendor':
        model = Vendor;
        break;
      case 'agent':
        model = Agent;
        break;
      default:
        return res.status(400).json({ message: 'Invalid user type' });
    }

    user = await model.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Generate verification token
    const token = jwt.sign(
      { id: user._id, type: 'verification' },
      getJWTSecret(),
      { expiresIn: '24h' }
    );

    // Save token to database
    const tokenDoc = await Token.create({
      userId: user._id,
      userModel: userType.charAt(0).toUpperCase() + userType.slice(1), // Capitalize first letter
      token,
      type: 'verification',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    
    console.log('✅ Token saved to database:', {
      id: tokenDoc._id,
      userId: tokenDoc.userId,
      userModel: tokenDoc.userModel,
      type: tokenDoc.type,
      expires: tokenDoc.expires
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(email, token);
    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    res.json({ message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('❌ Send verification error:', error);
    res.status(500).json({ message: 'Error sending verification email' });
  }
};

// Request password reset
const requestPasswordReset = async (req, res) => {
  try {
    const { email, userType } = req.body;

    if (!email || !userType) {
      return res.status(400).json({ message: 'Email and user type are required' });
    }

    // Find user based on type
    let user;
    let model;
    
    switch (userType.toLowerCase()) {
      case 'buyer':
        model = Buyer;
        break;
      case 'vendor':
        model = Vendor;
        break;
      case 'agent':
        model = Agent;
        break;
      default:
        return res.status(400).json({ message: 'Invalid user type' });
    }

    user = await model.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const token = jwt.sign(
      { id: user._id, type: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Save token to database
    const tokenDoc = await Token.create({
      userId: user._id,
      userModel: userType.charAt(0).toUpperCase() + userType.slice(1), // Capitalize first letter
      token,
      type: 'reset',
      expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    });
    
    console.log('✅ Reset token saved to database:', {
      id: tokenDoc._id,
      userId: tokenDoc.userId,
      userModel: tokenDoc.userModel,
      type: tokenDoc.type,
      expires: tokenDoc.expires
    });

    // Send reset email
    const emailSent = await sendPasswordResetEmail(email, token);
    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send reset email' });
    }

    res.json({ message: 'Password reset email sent successfully' });
  } catch (error) {
    console.error('❌ Request reset error:', error);
    res.status(500).json({ message: 'Error sending reset email' });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Check if token is for reset
    if (decoded.type !== 'reset') {
      return res.status(400).json({ message: 'Invalid token type' });
    }

    // Find token in database
    const tokenDoc = await Token.findOne({ 
      token, 
      type: 'reset',
      expires: { $gt: new Date() }
    });

    if (!tokenDoc) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Find user and update password using the token's userModel
    let user;
    let userModel;
    
    // First try to find by the userModel stored in the token
    if (tokenDoc.userModel === 'Buyer') {
      user = await Buyer.findById(decoded.id);
      userModel = 'Buyer';
    } else if (tokenDoc.userModel === 'Vendor') {
      user = await Vendor.findById(decoded.id);
      userModel = 'Vendor';
    } else if (tokenDoc.userModel === 'Agent') {
      user = await Agent.findById(decoded.id);
      userModel = 'Agent';
    }
    
    // If not found by userModel, fallback to searching all models
    if (!user) {
      console.log('⚠️ User not found by userModel, searching all models...');
      user = await Buyer.findById(decoded.id);
      if (user) userModel = 'Buyer';
      
      if (!user) {
        user = await Vendor.findById(decoded.id);
        if (user) userModel = 'Vendor';
      }
      
      if (!user) {
        user = await Agent.findById(decoded.id);
        if (user) userModel = 'Agent';
      }
    }
    
    if (!user) {
      console.log('❌ User not found in any model for ID:', decoded.id);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('✅ Found user for password reset:', { id: user._id, email: user.email, userModel });

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    console.log('🔐 Hashing new password for user:', user.email);
    
    // Set password directly and save WITHOUT triggering pre-save middleware
    user.password = hashedPassword;
    user.markModified('password'); // Mark as modified to ensure save
    
    // Use updateOne to bypass pre-save hooks completely
    await user.constructor.updateOne(
      { _id: user._id },
      { 
        password: hashedPassword,
        $unset: { __v: 1 } // Remove version key to prevent conflicts
      }
    );
    
    console.log('✅ Password updated successfully for user:', user.email);
    console.log('🔍 New password hash:', hashedPassword.substring(0, 20) + '...');

    // Delete used token
    await Token.findByIdAndDelete(tokenDoc._id);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
};

// Test endpoint to debug tokens
const testToken = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    console.log('🔍 Testing token:', token);

    // Check if token exists in database
    const tokenDoc = await Token.findOne({ token });
    if (tokenDoc) {
      console.log('✅ Token found in database:', {
        id: tokenDoc._id,
        userId: tokenDoc.userId,
        userModel: tokenDoc.userModel,
        type: tokenDoc.type,
        expires: tokenDoc.expires,
        isExpired: tokenDoc.expires < new Date()
      });
    } else {
      console.log('❌ Token not found in database');
    }

    // Try to decode JWT
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ JWT decoded:', decoded);
      
      // Check if user exists
      let user;
      if (tokenDoc && tokenDoc.userModel === 'Buyer') {
        user = await Buyer.findById(decoded.id);
      } else if (tokenDoc && tokenDoc.userModel === 'Vendor') {
        user = await Vendor.findById(decoded.id);
      } else if (tokenDoc && tokenDoc.userModel === 'Agent') {
        user = await Agent.findById(decoded.id);
      }
      
      if (user) {
        console.log('✅ User found:', { id: user._id, email: user.email });
      } else {
        console.log('❌ User not found for ID:', decoded.id);
      }
      
      res.json({ 
        message: 'Token analysis complete',
        tokenExists: !!tokenDoc,
        tokenDetails: tokenDoc,
        jwtDecoded: decoded,
        userFound: !!user,
        user: user ? { id: user._id, email: user.email } : null
      });
    } catch (err) {
      console.log('❌ JWT verification failed:', err.message);
      res.json({ 
        message: 'JWT verification failed',
        error: err.message,
        tokenExists: !!tokenDoc,
        tokenDetails: tokenDoc
      });
    }
  } catch (error) {
    console.error('❌ Test token error:', error);
    res.status(500).json({ message: 'Error testing token' });
  }
};

// Debug endpoint to check all tokens
const debugTokens = async (req, res) => {
  try {
    const tokens = await Token.find().sort({ createdAt: -1 }).limit(10);
    
    const tokenDetails = await Promise.all(tokens.map(async (token) => {
      let user;
      if (token.userModel === 'Buyer') {
        user = await Buyer.findById(token.userId);
      } else if (token.userModel === 'Vendor') {
        user = await Vendor.findById(token.userId);
      } else if (token.userModel === 'Agent') {
        user = await Agent.findById(token.userId);
      }
      
      return {
        id: token._id,
        userId: token.userId,
        userModel: token.userModel,
        type: token.type,
        expires: token.expires,
        isExpired: token.expires < new Date(),
        user: user ? { id: user._id, email: user.email } : null
      };
    }));
    
    res.json({ tokens: tokenDetails });
  } catch (error) {
    console.error('❌ Debug tokens error:', error);
    res.status(500).json({ message: 'Error debugging tokens' });
  }
};

module.exports = {
  sendVerification,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  testToken,
  debugTokens
};

// ===== Refresh Token (Rolling cookies) =====
/**
 * Issue a new refresh token (rotating) and set HttpOnly cookie
 */
function setRefreshCookie(res, token) {
  const isProd = (process.env.NODE_ENV || 'production') === 'production';

  // Derive a public cookie domain if provided, so cookies work on both apex and www
  // e.g., COOKIE_DOMAIN=.vendplug.com.ng or from FRONTEND_URL/PUBLIC_URL
  let domain = process.env.COOKIE_DOMAIN || '';
  if (!domain) {
    const url =
      process.env.PUBLIC_URL ||
      process.env.FRONTEND_URL ||
      process.env.WEB_URL ||
      process.env.SERVER_URL ||
      process.env.BACKEND_URL ||
      '';
    try {
      if (url) {
        const host = new URL(url).hostname;
        domain = host ? (host.startsWith('.') ? host : `.${host}`) : '';
      }
    } catch (_) { /* no-op */ }
  }

  // If we explicitly set a domain, prefer SameSite=None for maximum compatibility across subdomains
  // Requires Secure=true which we already enable in production
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: domain ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
    ...(domain ? { domain } : {}),
  };

  res.cookie('vp_refresh', token, cookieOptions);
}

async function mintRefreshToken(userId, userModel) {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenDoc = await Token.create({
    userId,
    userModel,
    token: crypto.createHash('sha256').update(raw).digest('hex'),
    type: 'refresh',
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });
  return raw;
}

async function rotateRefreshToken(oldRaw, userId, userModel) {
  const oldHash = crypto.createHash('sha256').update(oldRaw).digest('hex');
  await Token.deleteOne({ token: oldHash, type: 'refresh' });
  return mintRefreshToken(userId, userModel);
}

// POST /api/auth/refresh
async function refreshSession(req, res) {
  try {
    const raw = req.cookies?.vp_refresh;
    if (!raw) return res.status(401).json({ message: 'No refresh cookie' });
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const doc = await Token.findOne({ token: hash, type: 'refresh', expires: { $gt: new Date() } });
    if (!doc) return res.status(401).json({ message: 'Refresh invalid' });

    // Find user and role
    let user = await Buyer.findById(doc.userId);
    let role = 'buyer';
    if (!user) { user = await Vendor.findById(doc.userId); role = user ? 'vendor' : role; }
    if (!user) { user = await Agent.findById(doc.userId); role = user ? 'agent' : role; }
    if (!user) { user = await Admin.findById(doc.userId); role = user ? 'admin' : role; }
    if (!user) return res.status(401).json({ message: 'User not found' });

    // Rotate refresh
    const newRaw = await rotateRefreshToken(raw, doc.userId, doc.userModel);
    setRefreshCookie(res, newRaw);

    // Issue short access token
    const accessToken = jwt.sign({ id: user._id, role }, getJWTSecret(), { expiresIn: '20m' });
    res.json({ token: accessToken, role });
  } catch (e) {
    console.error('refreshSession error:', e);
    res.status(500).json({ message: 'Refresh failed' });
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  try {
    const raw = req.cookies?.vp_refresh;
    if (raw) {
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      await Token.deleteOne({ token: hash, type: 'refresh' });
    }
    res.clearCookie('vp_refresh', { path: '/' });
    res.json({ success: true });
  } catch (e) {
    res.clearCookie('vp_refresh', { path: '/' });
    res.json({ success: true });
  }
}

module.exports.refreshSession = refreshSession;
module.exports.logout = logout;
module.exports.setRefreshCookie = setRefreshCookie;
module.exports.mintRefreshToken = mintRefreshToken;