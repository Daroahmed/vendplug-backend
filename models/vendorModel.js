const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ✅ Vendor Review Schema
const vendorReviewSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: { type: String, trim: true },
  },
  { timestamps: true }
);

// ✅ Vendor Schema
const vendorSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    shopName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    businessName: { type: String },
    businessAddress: { type: String },
    state: { type: String },
    role: { type: String, default: 'vendor' },

    virtualAccount: { type: String, unique: true },
    category: { type: String },
    shopDescription: { type: String },

    totalTransactions: { type: Number, default: 0 },
    brandImage: { type: String },

    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

    reviews: [vendorReviewSchema],

    averageRating: { type: Number, default: 0 },

    password: { type: String, required: true },
  },
  { timestamps: true }
);

// ✅ Password Hash Middleware (MUST run before other save hooks)
vendorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ✅ Auto-calculate average rating
vendorSchema.pre('save', function (next) {
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
vendorSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Vendor', vendorSchema);
