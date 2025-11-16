const mongoose = require('mongoose');
const Vendor = require("../models/vendorModel");
const Token = require('../models/Token');
const Wallet = require("../models/walletModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const getJWTSecret = require('../utils/jwtSecret');
const asyncHandler = require("express-async-handler");
const { createWalletIfNotExists } = require("./walletHelper"); // <== use new helper
const Order = require('../models/vendorOrderModel');
const PayoutQueue = require('../models/payoutModel');
const Buyer = require("../models/Buyer");
const cloudinary = require('cloudinary').v2;
const fs = require('fs');


// ✅ Generate JWT token
const generateToken = require('../utils/generateToken');

// ✅ Register Vendor
const registerVendor = asyncHandler(async (req, res) => {
  try {
    const {
      fullName,
      email,
      shopName,
      phoneNumber,
      password,
      businessName,
      businessAddress,
      cacNumber,
      category,
      otherCategory,
      state,
      shopDescription
    } = req.body;

    const vendorExists = await Vendor.findOne({ email });
    if (vendorExists) {
      return res.status(400).json({ message: "Vendor already exists" });
    }

    const tempVirtualAccount = "VP" + Date.now();

    // Canonicalize name: prefer businessName; fall back to shopName
    const canonicalName = (businessName && String(businessName).trim()) || (shopName && String(shopName).trim()) || fullName;

    const vendor = new Vendor({
      fullName,
      email,
      // Maintain both fields for backward compatibility
      shopName: canonicalName,
      phoneNumber,
      password, // 👈 DO NOT manually hash it — the model handles it
      businessName: canonicalName,
      businessAddress,
      cacNumber: cacNumber || undefined, // Make CAC number optional
      category,
      otherCategory: otherCategory || undefined,
      state,
      shopDescription,
      virtualAccount: tempVirtualAccount,
    });

    const savedVendor = await vendor.save();

    const wallet = await createWalletIfNotExists(savedVendor._id, "vendor");

    savedVendor.virtualAccount = wallet.virtualAccount;
    await savedVendor.save();

    // ✅ Send verification email
    const { sendVerificationEmail } = require('../utils/emailService');
    const verificationToken = require('jsonwebtoken').sign(
      { id: savedVendor._id, type: 'verification' },
      getJWTSecret(),
      { expiresIn: '24h' }
    );
    // Save verification token so verify endpoint can find it
    try {
      await Token.create({
        userId: savedVendor._id,
        userModel: 'Vendor',
        token: verificationToken,
        type: 'verification',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    } catch (e) {
      console.error('⚠️ Failed to persist vendor verification token:', e.message);
    }
    sendVerificationEmail(email, verificationToken).catch(err => {
      console.error('❌ Verification email failed:', err?.message || err);
    });

    // Send new user registration notification to admins
    try {
      const io = req.app.get('io');
      const { sendNotification } = require('../utils/notificationHelper');
      const Admin = require('../models/Admin');
      
      const admins = await Admin.find({ isActive: true });
      for (const admin of admins) {
        await sendNotification(io, {
          recipientId: admin._id,
          recipientType: 'Admin',
          notificationType: 'NEW_USER_REGISTERED',
          args: ['Vendor', savedVendor.fullName]
        });
      }
    } catch (notificationError) {
      console.error('⚠️ New user registration notification error:', notificationError);
    }

    res.status(201).json({
      message: "Vendor registered successfully. Please check your email to verify your account.",
      vendor: {
        _id: savedVendor._id,
        fullName: savedVendor.fullName,
        email: savedVendor.email,
        shopName: savedVendor.shopName,
        businessName: savedVendor.businessName,
        phoneNumber: savedVendor.phoneNumber,
        virtualAccount: savedVendor.virtualAccount,
        category: savedVendor.category,
        state: savedVendor.state,
        isEmailVerified: savedVendor.isEmailVerified || false
      },
    });
  } catch (err) {
    console.error("❌ Vendor registration failed:", err.message);
    res.status(500).json({ message: "Vendor registration failed", error: err.message });
  }
});



// ✅ Login Vendor
const { mintRefreshToken, setRefreshCookie } = (()=>{
  const auth = require('./authController');
  return { mintRefreshToken: auth.__proto__?.mintRefreshToken || auth.mintRefreshToken, setRefreshCookie: auth.__proto__?.setRefreshCookie || auth.setRefreshCookie };
})();

const loginVendor = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const vendor = await Vendor.findOne({ email });

  if (!vendor || !(await vendor.matchPassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (!vendor.isEmailVerified) {
    return res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email to continue.',
      email: vendor.email,
      userType: 'vendor'
    });
  }

  const wallet = await Wallet.findOne({ user: vendor._id });

  try { if (mintRefreshToken && setRefreshCookie) { const raw = await mintRefreshToken(vendor._id, 'Vendor'); setRefreshCookie(res, raw);} } catch(_){ }

  // Set access token as httpOnly cookie (progressive migration)
  try {
    const { setAccessCookie } = require('../utils/tokenCookies');
    setAccessCookie(res, generateToken(vendor._id, "vendor"));
  } catch (e) { /* no-op */ }

  res.status(200).json({
    token: generateToken(vendor._id, "vendor"),
    vendor: {
      _id: vendor._id,
      fullName: vendor.fullName,
      email: vendor.email,
      shopName: vendor.shopName,
      phoneNumber: vendor.phoneNumber,
      role: vendor.role || "vendor",
      token: generateToken(vendor._id, "vendor"),
      virtualAccount: wallet?.virtualAccount || vendor.wallet?.virtualAccount || null,
      category: vendor.category,
      otherCategory: vendor.otherCategory,
      state: vendor.state,
      businessName: vendor.businessName,
      businessAddress: vendor.businessAddress,
      cacNumber: vendor.cacNumber,
      shopDescription: vendor.shopDescription,
      brandImage: vendor.brandImage
    },
  });
});

// @desc    Get vendor basic details
// @route   GET /api/vendors/:vendorId
// @access  Public
const getVendorById = asyncHandler(async (req, res) => {
  const { vendorId } = req.params;
  
  // Validate ObjectId format to prevent errors
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    res.status(400);
    throw new Error('Invalid vendor ID format');
  }
  
  const vendor = await Vendor.findById(vendorId).populate('reviews.buyer', 'fullName email');
  if (vendor) {
    res.json(vendor);
  } else {
    res.status(404);
    throw new Error('Vendor not found');
  }
});

// ✅ GET /api/vendors/stats
const getVendorStats = async (req, res) => {
  try {
    const vendorId = req.vendor._id;

    // Import required models
    const VendorOrder = require('../models/vendorOrderModel');
    const Payout = require('../models/payoutModel');

    const [fulfilledOrders, pendingOrders, successfulPayouts, queuedPayouts] = await Promise.all([
      VendorOrder.countDocuments({ vendor: vendorId, status: 'fulfilled' }),
      VendorOrder.countDocuments({ vendor: vendorId, status: { $in: ['pending', 'accepted', 'preparing', 'out_for_delivery'] } }),
      Payout.find({ vendor: vendorId, status: 'paid' }),
      Payout.find({ vendor: vendorId, status: { $in: ['ready_for_payout', 'requested'] } }),
    ]);

    const totalEarnings = successfulPayouts.reduce((sum, p) => sum + p.amount, 0);
    const queuedPayout = queuedPayouts.reduce((sum, p) => sum + p.amount, 0);
    const successfulPayout = totalEarnings;

    res.json({
      fulfilledOrders,
      pendingOrders,
      totalEarnings,
      queuedPayout,
      successfulPayout
    });
  } catch (err) {
    console.error('❌ Vendor stats error:', err.message);
    res.status(500).json({ message: 'Server error fetching stats' });
  }
};

const getVendorsByCategoryAndState = asyncHandler(async (req, res) => {
  const { state, category } = req.query;

  if (!state || !category) {
    return res.status(400).json({ message: 'Missing state or category' });
  }

  const stateRegex = new RegExp(`^${state.trim()}$`, 'i'); // exact state match, case-insensitive
  const categoryRegex = new RegExp(category.trim(), 'i'); // partial category match

  const vendors = await Vendor.find({
    state: { $regex: stateRegex },
    $or: [
      { category: { $regex: categoryRegex } }, // if stored as string
      { category: { $in: [categoryRegex] } }   // if stored as array
    ]
  }).select('businessName brandImage totalTransactions _id');

  res.json(vendors);
});

const getVendorProfile = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.vendorId).select('-password');

  if (!vendor) {
    res.status(404).json({ message: 'Vendor not found' });
    return;
  }

  res.json(vendor);
});

const getCurrentVendorProfile = asyncHandler(async (req, res) => {
  const rid = req.requestId || Math.random().toString(16).slice(2);
  const t0 = Date.now();
  console.log(`[vendorProfile][${rid}] start GET /api/vendors/profile`);

  const vendor = await Vendor.findById(req.user._id).select('-password');
  console.log(`[vendorProfile][${rid}] fetched vendor doc in ${Date.now() - t0}ms`);

  if (!vendor) {
    res.status(404).json({ message: 'Vendor not found' });
    return;
  }

  const force = (req.query && (req.query.force === '1' || req.query.force === 'true'));
  if (force) {
    const t1 = Date.now();
    await updateOnboardingProgress(vendor._id);
    console.log(`[vendorProfile][${rid}] onboarding update (force) in ${Date.now() - t1}ms`);
    const updated = await Vendor.findById(req.user._id).select('-password');
    res.json({ vendor: updated });
    return;
  } else {
    // Trigger onboarding progress update in the background (non-blocking)
    setImmediate(async () => {
      const t1 = Date.now();
      try {
        await updateOnboardingProgress(vendor._id);
        const took = Date.now() - t1;
        console.log(`[vendorProfile][${rid}] onboarding update (bg) completed in ${took}ms`);
        if (took > 500) {
          console.warn(`[vendorProfile][${rid}] onboarding update exceeded budget: ${took}ms`);
        }
      } catch (e) {
        console.error(`[vendorProfile][${rid}] onboarding update (bg) error:`, e.message);
      }
    });

    // Return current vendor snapshot immediately
    res.json({ vendor });
  }
});


// =========================
// Get Vendor Shop View
// =========================
const getShopView = async (req, res) => {
  try {
    const vendorId = req.params.vendorId;

    const vendor = await Vendor.findById(vendorId)
      .select('-password')
      .populate('products');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json({
      _id: vendor._id,
      fullName: vendor.fullName,
      shopName: vendor.shopName,
      phoneNumber: vendor.phoneNumber,
      businessName: vendor.businessName,
      businessAddress: vendor.businessAddress,
      state: vendor.state,
      category: vendor.category,
      shopDescription: vendor.shopDescription,
      rating: vendor.averageRating, // ✅ Average rating
      reviews: vendor.reviews,      // ✅ All reviews
      brandImage: vendor.brandImage,
      products: vendor.products
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// =========================
// Add Vendor Review
// =========================

// =========================
// @desc    Add a review to a vendor
// @route   POST /api/vendors/:vendorId/reviews
// @access  Private (Buyer only)
// =========================
const addVendorReview = async (req, res) => {
  try {
    const { rating, comment, orderId } = req.body;
    const vendorId = req.params.vendorId;
    const buyerId = req.user._id; // Comes from protectBuyer middleware

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Check if buyer exists and get their name
    const Buyer = require('../models/Buyer');
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) {
      return res.status(404).json({ message: 'Buyer not found' });
    }

    const buyerName = buyer.fullName || buyer.name || 'Anonymous';

    // Determine if this is a verified purchase
    let isVerifiedPurchase = false;
    if (orderId) {
      const VendorOrder = require('../models/vendorOrderModel');
      const order = await VendorOrder.findOne({
        _id: orderId,
        buyer: buyerId,
        vendor: vendorId,
        status: 'delivered'
      });
      isVerifiedPurchase = !!order;
    }

    // Add review (no duplicate restriction - buyers can leave multiple reviews)
    const newReview = {
      buyer: buyerId,
      buyerName: buyerName,
      rating,
      comment,
      orderId: orderId || null,
      isVerifiedPurchase,
      helpfulVotes: 0,
      notHelpfulVotes: 0,
      isReported: false,
      isModerated: false
    };

    vendor.reviews.push(newReview);
    await vendor.save(); // Average rating is auto-calculated in model

    res.status(201).json({
      message: 'Review added successfully',
      review: newReview,
      totalReviews: vendor.reviews.length,
      averageRating: vendor.averageRating
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =========================
// Vote on Review Helpfulness
// =========================
const voteReviewHelpfulness = async (req, res) => {
  try {
    const { vendorId, reviewId } = req.params;
    const { voteType } = req.body; // 'helpful' or 'not_helpful'
    const buyerId = req.user._id;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const review = vendor.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user already voted (you could implement this with a separate votes collection)
    // For now, we'll allow multiple votes but you might want to restrict this

    if (voteType === 'helpful') {
      review.helpfulVotes += 1;
    } else if (voteType === 'not_helpful') {
      review.notHelpfulVotes += 1;
    } else {
      return res.status(400).json({ message: 'Invalid vote type' });
    }

    await vendor.save();

    res.json({
      message: 'Vote recorded successfully',
      helpfulVotes: review.helpfulVotes,
      notHelpfulVotes: review.notHelpfulVotes
    });
  } catch (error) {
    console.error('Error voting on review:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =========================
// Report Review
// =========================
const reportReview = async (req, res) => {
  try {
    const { vendorId, reviewId } = req.params;
    const { reason } = req.body;
    const buyerId = req.user._id;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const review = vendor.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user already reported this review
    if (review.isReported) {
      return res.status(400).json({ message: 'Review already reported' });
    }

    review.isReported = true;
    review.reportReason = reason;

    await vendor.save();

    res.json({ message: 'Review reported successfully' });
  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =========================
// Get Reviews with Sorting and Filtering
// =========================
const getVendorReviews = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { 
      sort = 'newest', 
      filter = 'all', 
      rating = 'all',
      page = 1, 
      limit = 10 
    } = req.query;

    const vendor = await Vendor.findById(vendorId).populate('reviews.buyer', 'fullName email');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    let reviews = [...vendor.reviews];

    // Filter by rating
    if (rating !== 'all') {
      reviews = reviews.filter(review => review.rating === parseInt(rating));
    }

    // Filter by verification status
    if (filter === 'verified') {
      reviews = reviews.filter(review => review.isVerifiedPurchase);
    } else if (filter === 'unverified') {
      reviews = reviews.filter(review => !review.isVerifiedPurchase);
    }

    // Sort reviews
    switch (sort) {
      case 'newest':
        reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'oldest':
        reviews.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'highest_rating':
        reviews.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest_rating':
        reviews.sort((a, b) => a.rating - b.rating);
        break;
      case 'most_helpful':
        reviews.sort((a, b) => (b.helpfulVotes - b.notHelpfulVotes) - (a.helpfulVotes - a.notHelpfulVotes));
        break;
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedReviews = reviews.slice(startIndex, endIndex);

    res.json({
      reviews: paginatedReviews,
      totalReviews: reviews.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(reviews.length / limit),
      averageRating: vendor.averageRating
    });
  } catch (error) {
    console.error('Error getting reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Helper function to update onboarding progress
async function updateOnboardingProgress(vendorId) {
  try {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return;

    const VendorProduct = require('../models/vendorProductModel');
    const BankAccount = require('../models/BankAccount');

    // Initialize onboardingProgress if it doesn't exist
    if (!vendor.onboardingProgress) {
      vendor.onboardingProgress = {
        hasBrandImage: false,
        hasFirstProduct: false,
        hasShopDescription: false,
        hasBankAccount: false,
        onboardingCompleted: false,
        onboardingDismissed: false
      };
    }

    // Check each onboarding step
    const hasBrandImage = !!(vendor.brandImage);
    const hasShopDescription = !!(vendor.shopDescription && vendor.shopDescription.trim().length > 0);
    
    // Check if vendor has at least one product
    const productCount = await VendorProduct.countDocuments({ vendor: vendorId });
    const hasFirstProduct = productCount > 0;

    // Check if vendor has at least one verified bank account
    const bankAccountCount = await BankAccount.countDocuments({ 
      userId: vendorId, 
      userType: 'Vendor',
      isVerified: true 
    });
    const hasBankAccount = bankAccountCount > 0;

    // Update onboarding progress (preserve dismissed status)
    vendor.onboardingProgress = {
      hasBrandImage,
      hasFirstProduct,
      hasShopDescription,
      hasBankAccount,
      onboardingCompleted: hasBrandImage && hasFirstProduct && hasShopDescription && hasBankAccount,
      onboardingDismissed: vendor.onboardingProgress.onboardingDismissed || false
    };

    await vendor.save();
    console.log(`✅ Updated onboarding progress for vendor ${vendorId}:`, vendor.onboardingProgress);
  } catch (error) {
    console.error('Error updating onboarding progress:', error);
  }
}

// ✅ Update Vendor Profile with Cloudinary Image Upload
const updateVendorProfile = asyncHandler(async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    // 📷 Upload brand image if provided
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "vendplug/vendor-brand", // store brand images in separate folder
      });
      vendor.brandImage = result.secure_url;

      // Clean up local temp file
      fs.unlinkSync(req.file.path);
    }

    // 📝 Update optional fields
    if (req.body.shopDescription !== undefined) {
      vendor.shopDescription = req.body.shopDescription;
    }
    if (req.body.businessAddress !== undefined) {
      vendor.businessAddress = req.body.businessAddress;
    }

    // 🏷️ Update categories (if provided)
    if (typeof req.body.category !== 'undefined') {
      try {
        const parsed = Array.isArray(req.body.category)
          ? req.body.category
          : JSON.parse(req.body.category || '[]');
        if (Array.isArray(parsed)) {
          vendor.category = parsed.filter(c => typeof c === 'string' && c.trim() !== '');
        }
      } catch (_) {}
    }
    if (typeof req.body.otherCategory !== 'undefined') {
      const val = String(req.body.otherCategory || '').trim();
      vendor.otherCategory = val || undefined;
    }

    await vendor.save();

    // Update onboarding progress
    await updateOnboardingProgress(vendorId);

    res.status(200).json({
      message: "Vendor profile updated successfully",
      vendor: {
        _id: vendor._id,
        fullName: vendor.fullName,
        shopName: vendor.shopName,
        brandImage: vendor.brandImage,
        shopDescription: vendor.shopDescription,
        businessAddress: vendor.businessAddress,
        averageRating: vendor.averageRating,
        totalTransactions: vendor.totalTransactions,
      },
    });
  } catch (error) {
    console.error("❌ Error updating vendor profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// ✅ Dismiss onboarding guide
const dismissOnboarding = asyncHandler(async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    vendor.onboardingProgress = vendor.onboardingProgress || {};
    vendor.onboardingProgress.onboardingDismissed = true;
    await vendor.save();

    res.json({ message: 'Onboarding guide dismissed', vendor });
  } catch (error) {
    console.error('Error dismissing onboarding:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Reset onboarding guide (allow it to show again)
const resetOnboarding = asyncHandler(async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    vendor.onboardingProgress = vendor.onboardingProgress || {};
    vendor.onboardingProgress.onboardingDismissed = false;
    await vendor.save();

    res.json({ message: 'Onboarding guide reset', vendor });
  } catch (error) {
    console.error('Error resetting onboarding:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = {
  registerVendor,
  loginVendor,
  getVendorById,
  getVendorStats,
  getVendorsByCategoryAndState,
  getVendorProfile,
  getCurrentVendorProfile,
  getShopView,
  addVendorReview,
  voteReviewHelpfulness,
  reportReview,
  getVendorReviews,
  updateVendorProfile,
  dismissOnboarding,
  resetOnboarding,
  updateOnboardingProgress
};




