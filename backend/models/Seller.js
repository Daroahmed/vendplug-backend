// backend/models/Seller.js

const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    default: 'seller',
    enum: ['seller']
  }
}, { timestamps: true });

module.exports = mongoose.model('Seller', sellerSchema);
