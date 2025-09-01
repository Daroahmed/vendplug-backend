const mongoose = require('mongoose');

const payoutRequestSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  userType: { 
    type: String, 
    enum: ['Vendor', 'Agent'], 
    required: true 
  },
  bankAccountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'BankAccount',
    required: true 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },
  transferFee: {
    type: Number,
    required: true,
    default: 50
  },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'reversed'],
    default: 'pending'
  },
  paystackReference: { 
    type: String 
  },
  paystackTransferCode: { 
    type: String 
  },
  failureReason: { 
    type: String 
  },
  processedAt: { 
    type: Date 
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('PayoutRequest', payoutRequestSchema);
