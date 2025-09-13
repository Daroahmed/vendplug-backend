// Temporary Staff model for debugging
// This points to the same collection as Admin to help identify where "Staff" references are coming from
const mongoose = require('mongoose');

// Create a schema that matches the Admin schema
const staffSchema = new mongoose.Schema({
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
    enum: ['product_issues', 'delivery_issues', 'payment_issues', 'communication_issues', 'technical_issues', 'policy_violations']
  }],
  
  // Workload management
  maxConcurrentDisputes: {
    type: Number,
    default: 10
  },
  
  // Activity tracking
  activityStats: {
    currentDisputes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dispute'
    }],
    disputesResolved: {
      type: Number,
      default: 0
    },
    disputesAssigned: {
      type: Number,
      default: 0
    },
    averageResolutionTime: {
      type: Number,
      default: 0 // in hours
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Profile information
  profilePicture: String,
  phoneNumber: String,
  department: String,
  
  // Timestamps
  lastLogin: Date,
  passwordChangedAt: Date
}, {
  timestamps: true,
  // Point to the same collection as Admin
  collection: 'admins'
});

// Add methods if needed
staffSchema.methods.toJSON = function() {
  const staff = this.toObject();
  delete staff.password;
  return staff;
};

module.exports = mongoose.model('Staff', staffSchema);
