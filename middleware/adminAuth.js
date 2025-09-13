const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protectAdmin = async (req, res, next) => {
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vendplugSecret');
    
    // Check if it's an admin token (role should be 'admin' in JWT)
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Get admin from database
    const admin = await Admin.findById(decoded.id).select('-password');
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Token is valid but admin not found.'
      });
    }

    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Admin account is deactivated.'
      });
    }

    // Add admin to request object
    req.admin = admin;
    next();

  } catch (error) {
    console.error('❌ Admin auth error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

// Check specific permissions
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    console.log(`🔍 Checking permission: ${permission} for admin:`, {
      id: req.admin._id,
      role: req.admin.role,
      permissions: req.admin.permissions
    });

    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      console.log('✅ Super admin - access granted');
      return next();
    }

    // Check specific permission
    if (!req.admin.permissions[permission]) {
      console.log(`❌ Permission denied: ${permission} not found in permissions`);
      return res.status(403).json({
        success: false,
        message: `Access denied. ${permission} permission required.`
      });
    }

    console.log(`✅ Permission granted: ${permission}`);
    next();
  };
};

// Check if admin has any of the specified permissions
const checkAnyPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      return next();
    }

    // Check if admin has any of the specified permissions
    const hasPermission = permissions.some(permission => 
      req.admin.permissions[permission]
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied. One of these permissions required: ${permissions.join(', ')}`
      });
    }

    next();
  };
};

module.exports = {
  protectAdmin,
  checkPermission,
  checkAnyPermission
};
