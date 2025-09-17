const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protectStaff = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    console.log('🔍 Staff auth - Token found:', !!token);
    console.log('🔍 Staff auth - Authorization header:', req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vendplugSecret');
    console.log('🔍 Staff auth - Decoded token:', decoded);

    // Check if staff still exists and is active
    const staff = await Admin.findById(decoded.id);
    console.log('🔍 Staff auth - Staff found:', !!staff);
    console.log('🔍 Staff auth - Staff ID from token:', decoded.id);
    
    if (!staff) {
      return res.status(401).json({
        success: false,
        message: 'Token is no longer valid. Staff member not found.'
      });
    }

    if (!staff.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Check if staff has dispute resolution role
    if (!['dispute_manager', 'dispute_specialist', 'dispute_analyst', 'moderator'].includes(staff.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    // Add staff info to request
    req.staff = {
      staffId: staff._id,
      email: staff.email,
      role: staff.role,
      permissions: staff.permissions
    };

    console.log('🔍 Staff auth - req.staff set:', req.staff);
    next();

  } catch (error) {
    console.error('❌ Staff auth error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = { protectStaff };
