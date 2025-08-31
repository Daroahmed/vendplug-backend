const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  userType: { 
    type: String, 
    enum: ['Vendor', 'Agent'], 
    required: true 
  },
  bankName: { 
    type: String, 
    required: true 
  },
  bankCode: { 
    type: String, 
    required: true 
  },
  accountNumber: { 
    type: String, 
    required: true 
  },
  accountName: { 
    type: String, 
    required: true 
  },
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  isDefault: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

// Ensure only one default account per user
bankAccountSchema.index({ userId: 1, userType: 1, isDefault: 1 });

module.exports = mongoose.model('BankAccount', bankAccountSchema);
