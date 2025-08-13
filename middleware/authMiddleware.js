const jwt = require ('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const Buyer = require('../models/Buyer');
const Agent = require('../models/Agent');
const Product = require('../models/Product');
const Vendor = require('../models/vendorModel');

// 🔍 Helper: Extract token from Authorization header
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

// 🔐 Protect Buyer Routes
const protectBuyer = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const agent = await Agent.findById(decoded.id).select('-password');
    if (!agent) return res.status(401).json({ message: 'Agent not found' });

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

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const vendor = await Vendor.findById(decoded.id).select('-password');

      if (!vendor) {
        return res.status(401).json({ message: 'Vendor not found' });
      }

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

// 🗑️ Delete Product by Agent
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const agent = req.user;
    console.log(`🗑️ Agent ${agent.fullName} (${agent._id}) is deleting: ${product.name}`);

    await product.deleteOne();
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('❌ Delete error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


const protectAnyUser = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const buyer = await Buyer.findById(userId).select('-password');
    const agent = await Agent.findById(userId).select('-password');
    const vendor = await Vendor.findById(userId).select('-password');

    let user = null;
    let role = null;

    if (vendor) {
      user = vendor;
      role = 'vendor';
    } else if (agent) {
      user = agent;
      role = 'agent';
    } else if (buyer) {
      user = buyer;
      role = 'buyer';
    } else {
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
  deleteProduct,
  protectAnyUser,
  deleteVendorProduct
};
