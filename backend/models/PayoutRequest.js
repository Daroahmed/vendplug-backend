const mongoose = require('mongoose');

const payoutRequestSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid'],
    default: 'pending',
  },
  bankAccount: String, // vendor's preferred payout account
  notes: String,
}, { timestamps: true });

module.exports = mongoose.model('PayoutRequest', payoutRequestSchema);
