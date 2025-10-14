const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Buyer', 'Vendor', 'Agent', 'Admin'] // Reference to different user types
  },
  token: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['verification', 'reset', 'refresh']
  },
  expires: {
    type: Date,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Index for quick lookups and automatic deletion
tokenSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Token', tokenSchema);
