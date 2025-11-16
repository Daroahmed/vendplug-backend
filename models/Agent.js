const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ✅ Agent Review Schema
const agentReviewSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer',
      required: true,
    },
    buyerName: {
      type: String,
      required: false, // Make optional for backward compatibility
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: { 
      type: String, 
      trim: true,
      maxlength: 1000
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentOrder',
      required: false, // Optional - for verified purchases
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    helpfulVotes: {
      type: Number,
      default: 0,
    },
    notHelpfulVotes: {
      type: Number,
      default: 0,
    },
    isReported: {
      type: Boolean,
      default: false,
    },
    reportReason: {
      type: String,
      enum: ['spam', 'inappropriate', 'fake', 'offensive', 'other'],
    },
    isModerated: {
      type: Boolean,
      default: false,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    moderatedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// ✅ Agent Schema
const agentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    businessName: { type: String, required: true }, // Changed from shopName to businessName
    phoneNumber: { type: String, required: true },
    businessAddress: { type: String },
    cacNumber: { type: String },
    state: { type: String },
    role: { type: String, default: 'agent' },

    // Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },

    virtualAccount: { type: String, unique: true },
    walletBalance: { type: Number, default: 0 },

    category: { type: [String], required: true },
    otherCategory: {
      type: String,
      required: function () {
        return this.category && this.category.includes("Other");
      }
    },
    
    businessDescription: { type: String }, // Changed from shopDescription to businessDescription

    totalTransactions: { type: Number, default: 0 },
    brandImage: { type: String },

    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AgentProduct' }], // Changed from Product to AgentProduct

    reviews: [agentReviewSchema],

    averageRating: { type: Number, default: 0 },

    password: { type: String, required: true },
    
    // PIN for payout security
    payoutPin: { 
      type: String, 
      required: false, // Optional - user can set it later
      minlength: 4,
      maxlength: 255 // Allow space for bcrypt hash (60+ chars)
    },
    payoutPinSetAt: { 
      type: Date, 
      default: null 
    },
    pinResetCode: {
      type: String,
      default: null
    },
    pinResetCodeExpiry: {
      type: Date,
      default: null
    },
    
    // Onboarding progress tracking
    onboardingProgress: {
      hasBrandImage: { type: Boolean, default: false },
      hasFirstProduct: { type: Boolean, default: false },
      hasBusinessDescription: { type: Boolean, default: false },
      hasBankAccount: { type: Boolean, default: false },
      onboardingCompleted: { type: Boolean, default: false },
      onboardingDismissed: { type: Boolean, default: false }
    },
  },
  { timestamps: true }
);

// 🔍 Performance indexes for hot queries
agentSchema.index({ state: 1 });
agentSchema.index({ category: 1 });
agentSchema.index({ createdAt: -1 });
agentSchema.index({ totalTransactions: -1 });
agentSchema.index({ state: 1, category: 1, totalTransactions: -1 });

// ✅ Password Hash Middleware (MUST run before other save hooks)
agentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ✅ PIN Hash Middleware
agentSchema.pre('save', async function (next) {
  if (!this.isModified('payoutPin')) return next();

  try {
    if (this.payoutPin) {
      const salt = await bcrypt.genSalt(10);
      this.payoutPin = await bcrypt.hash(this.payoutPin, salt);
      this.payoutPinSetAt = new Date();
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ✅ Auto-calculate average rating
agentSchema.pre('save', function (next) {
  if (this.reviews && this.reviews.length > 0) {
    this.averageRating =
      this.reviews.reduce((acc, item) => acc + item.rating, 0) /
      this.reviews.length;
  } else {
    this.averageRating = 0;
  }
  next();
});

// ✅ Compare password
agentSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ✅ Compare PIN
agentSchema.methods.matchPayoutPin = async function (enteredPin) {
  if (!this.payoutPin) return false;
  return await bcrypt.compare(enteredPin, this.payoutPin);
};

module.exports = mongoose.model('Agent', agentSchema);
