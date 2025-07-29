const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  ref: {
    type: String,
    unique: true,
    required: true,
  },
  type: {
    type: String,
    enum: ['fund', 'transfer', 'withdrawal', 'refund'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'successful', 'failed'],
    default: 'successful',
  },
  amount: {
    type: Number,
    required: true,
  },
  from: {
    type: String, // virtual account number
  },
  to: {
    type: String, // virtual account number
  },
  description: String,
  balanceBefore: Number,
  balanceAfter: Number,
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'initiatorType',
  },
  initiatorType: {
    type: String,
    enum: ['buyer', 'agent', 'vendor'],
  },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);


