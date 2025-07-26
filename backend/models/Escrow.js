// backend/models/Escrow.js

const mongoose = require('mongoose');

const escrowSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer'
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller'
  },
  guestBuyer: {
    fullName: String,
    email: String,
    phoneNumber: String
  },
  guestSeller: {
    fullName: String,
    email: String,
    phoneNumber: String
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'disputed', 'completed', 'cancelled', 'released'],
    default: 'pending'
  },
  funded: {
    type: Boolean,
    default: false
  },
  fundedAt: Date,
  releasedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Escrow = mongoose.model('Escrow', escrowSchema);

module.exports = Escrow;
