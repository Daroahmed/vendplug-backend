const jwt = require ('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const getJWTSecret = require('../utils/jwtSecret');
const Buyer = require('../models/Buyer');
const Agent = require('../models/Agent');
const Vendor = require('../models/vendorModel');
const Admin = require('../models/Admin');
const VendorProduct = require('../models/vendorProductModel');

// 🔍 Helper: Extract token from Authorization header or cookies
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  // Fallback to httpOnly cookie (progressive migration)
  if (req.cookies && req.cookies.vp_access_token) {
    return req.cookies.vp_access_token;
  }
  return null;
};

// 🔐 Protect Buyer Routes
const protectBuyer = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, getJWTSecret());
    const buyer = await Buyer.findById(decoded.id).select('-password');
    if (!buyer) return res.status(401).json({ message: 'Buyer not found' });

    req.buyer = buyer; // <-- CHANGE HERE
    req.user = { ...buyer.toObject(), role: 'buyer' }; // keep if other code relies on req.user

    next();
  } catch (err) {
    console.error('❌ Buyer token verification failed:', err.message);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});


// 🔐 Protect Agent Routes
const protectAgent = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, getJWTSecret());
    const agent = await Agent.findById(decoded.id).select('-password');
    if (!agent) return res.status(401).json({ message: 'Agent not found' });

    req.agent = agent; // <-- CHANGE HERE

    req.user = { ...agent.toObject(), role: 'agent' };

    next();
  } catch (err) {
    console.error('❌ Agent token verification failed:', err.message);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// 🔐 Protect Vendor Routes (✅ FIXED)
const protectVendor = asyncHandler(async (req, res, next) => {
  let token;

  // Grab token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, getJWTSecret());
      const vendor = await Vendor.findById(decoded.id).select('-password');

      if (!vendor) {
        return res.status(401).json({ message: 'Vendor not found' });
      }

    
      req.user = { ...vendor.toObject(), role: 'vendor' }; // keep if other code relies on req.user

      req.vendor = vendor;
      next();

    } catch (error) {
      console.error('❌ Vendor Auth Error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
});

// 🔐 Protect Admin Routes
const protectAdmin = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, getJWTSecret());
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) return res.status(401).json({ message: 'Admin not found' });

    req.admin = admin;
    req.user = { ...admin.toObject(), role: 'admin' };

    next();
  } catch (err) {
    console.error('❌ Admin token verification failed:', err.message);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// (Removed legacy deleteProduct handler for old Product model)


const protectAnyUser = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  
  console.log('protectAnyUser - Token received:', token ? 'present' : 'missing');
  console.log('protectAnyUser - Authorization header:', req.headers.authorization);

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, getJWTSecret());
    const userId = decoded.id || decoded.staffId; // Handle both regular users and staff

    const buyer = await Buyer.findById(userId).select('-password');
    const agent = await Agent.findById(userId).select('-password');
    const vendor = await Vendor.findById(userId).select('-password');
    const admin = await Admin.findById(userId).select('-password');

    console.log('protectAnyUser - User lookup results:', {
      userId,
      buyer: buyer ? 'found' : 'not found',
      agent: agent ? 'found' : 'not found', 
      vendor: vendor ? 'found' : 'not found',
      admin: admin ? 'found' : 'not found'
    });

    let user = null;
    let role = null;

    if (admin) {
      user = admin;
      role = 'staff';
    } else if (vendor) {
      user = vendor;
      role = 'vendor';
    } else if (agent) {
      user = agent;
      role = 'agent';
    } else if (buyer) {
      user = buyer;
      role = 'buyer';
    } else {
      console.log('protectAnyUser - No user found for userId:', userId);
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = { ...user.toObject(), role };
    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
});

const deleteVendorProduct = asyncHandler(async (req, res) => {
  const product = await VendorProduct.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  if (product.vendor.toString() !== req.vendor._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete this product');
  }

  await product.deleteOne();
  res.status(200).json({ message: 'Product deleted successfully' });
});



// ✅ Export All
module.exports = {
  protectBuyer,
  protectAgent,
  protectVendor,
  protectAdmin,
  protectAnyUser,
  deleteVendorProduct
};
