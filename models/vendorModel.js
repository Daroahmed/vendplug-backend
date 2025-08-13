const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const vendorReviewSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String
    }
    
  },
  { timestamps: true }
);

const vendorSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    shopName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    businessName: { type: String },
    businessAddress: { type: String },
    state: { type: String },
    category: { type: String },
    shopDescription: { type: String },
    brandImage: { type: String },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      }
    ],
    reviews: [vendorReviewSchema],
    averageRating: {
      type: Number,
      default: 0
    },
    password: { type: String, required: true }
  },
  { timestamps: true }
);

// ✅ Auto-calculate average rating before save
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

module.exports = mongoose.model('Vendor', vendorSchema);

