const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  ref: {
    type: String,
    unique: true,
    required: true,
  },
  type: {
    type: String,
    enum: ['fund', 'transfer', 'withdrawal', 'refund', 'credit', 'commission'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'successful', 'failed'],
    default: 'successful',
  },
  amount: {
    type: Number,
    required: true,
  },

  from: {
    type: String,
    required: function () {
      return this.type === 'transfer';
    },
  },
  to: {
    type: String,
    required: function () {
      return this.type === 'transfer';
    },
  },
 
  description: String,
  initiatedBy: {
    type: mongoose.Schema.Types.Mixed,
    refPath: 'initiatorType',
  },
  initiatorType: {
    type: String,
    enum: ['Buyer', 'Agent', 'Vendor', 'Admin', 'System'],
    validate: {
      validator: function(v) {
        // If initiatorType is 'System', initiatedBy should be 'system' string
        if (v === 'System') {
          return this.initiatedBy === 'system';
        }
        // For other types, initiatedBy should be an ObjectId
        return mongoose.Types.ObjectId.isValid(this.initiatedBy);
      },
      message: 'Invalid initiator type and initiatedBy combination'
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);


