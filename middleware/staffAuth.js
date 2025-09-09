const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protectStaff = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Check if staff still exists and is active
    const staff = await Admin.findById(decoded.staffId);
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
