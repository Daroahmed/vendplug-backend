// backend/models/Admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'dispute_manager', 'dispute_specialist', 'dispute_analyst', 'moderator'],
    default: 'admin'
  },
  permissions: {
    userManagement: { type: Boolean, default: true },
    orderManagement: { type: Boolean, default: true },
    payoutManagement: { type: Boolean, default: true },
    disputeManagement: { type: Boolean, default: true },
    disputeAssignment: { type: Boolean, default: false },
    disputeResolution: { type: Boolean, default: false },
    disputeEscalation: { type: Boolean, default: false },
    analytics: { type: Boolean, default: true },
    systemSettings: { type: Boolean, default: false }
  },
  
  // Dispute resolution specific fields
  disputeSpecialties: [{
    type: String,
    enum: [
      'product_not_received',
      'product_damaged', 
      'product_not_as_described',
      'wrong_product',
      'delivery_issues',
      'payment_issues',
      'communication_issues',
      'other'
    ]
  }],
  
  maxConcurrentDisputes: {
    type: Number,
    default: 10
  },
  
  // Activity tracking
  activityStats: {
    disputesAssigned: { type: Number, default: 0 },
    disputesResolved: { type: Number, default: 0 },
    averageResolutionTime: { type: Number, default: 0 }, // in hours
    lastActivity: { type: Date },
    currentDisputes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dispute' }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  }
}, {
  timestamps: true
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
adminSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to check if account is locked
adminSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to increment login attempts
adminSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
adminSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

module.exports = mongoose.model('Admin', adminSchema);
