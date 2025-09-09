const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  // Basic Information
  disputeId: {
    type: String,
    unique: true,
    required: true
  },
  
  // Related Entities
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'orderType',
    required: true
  },
  orderType: {
    type: String,
    enum: ['Order', 'VendorOrder'],
    required: true
  },
  
  // Parties Involved
  complainant: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'complainant.userType',
      required: true
    },
    userType: {
      type: String,
      enum: ['Buyer', 'Vendor', 'Agent'],
      required: true
    }
  },
  
  respondent: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'respondent.userType',
      required: true
    },
    userType: {
      type: String,
      enum: ['Buyer', 'Vendor', 'Agent'],
      required: true
    }
  },
  
  // Dispute Details
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // Who raised the dispute
  raisedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'raisedByType',
    required: true
  },
  raisedByType: {
    type: String,
    enum: ['Buyer', 'Vendor', 'Agent'],
    required: true
  },
  category: {
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
    ],
    required: true
  },
  
  // Status and Resolution
  status: {
    type: String,
    enum: ['open', 'assigned', 'under_review', 'resolved', 'closed', 'escalated'],
    default: 'open'
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Evidence and Communication
  evidence: [{
    type: {
      type: String,
      enum: ['image', 'document', 'message', 'other'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    description: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'evidence.uploadedByType',
      required: true
    },
    uploadedByType: {
      type: String,
      enum: ['Buyer', 'Vendor', 'Agent', 'Admin'],
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Communication Thread
  messages: [{
    sender: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'messages.sender.userType',
        required: true
      },
      userType: {
        type: String,
        enum: ['Buyer', 'Vendor', 'Agent', 'Admin'],
        required: true
      }
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    isInternal: {
      type: Boolean,
      default: false // Admin-only messages
    },
    attachments: [{
      type: String,
      url: String,
      description: String
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Resolution Details
  resolution: {
    decision: {
      type: String,
      enum: ['favor_complainant', 'favor_respondent', 'partial_refund', 'full_refund', 'no_action', 'escalated']
    },
    reason: String,
    refundAmount: {
      type: Number,
      min: 0
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    resolvedAt: Date,
    notes: String
  },
  
  // Assignment Details
  assignment: {
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    assignedAt: {
      type: Date
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    notes: String
  },
  
  // Escalation Details
  escalation: {
    reason: {
      type: String,
      enum: ['complex_case', 'high_value', 'repeat_offender', 'policy_violation', 'system_issue', 'customer_complaint', 'legal_issue', 'other']
    },
    notes: String,
    escalatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    escalatedAt: Date
  },
  
  // Internal Notes (staff only)
  internalNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  lastActivity: {
    type: Date,
    default: Date.now
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for better performance
disputeSchema.index({ disputeId: 1 });
disputeSchema.index({ orderId: 1, orderType: 1 });
disputeSchema.index({ 'complainant.userId': 1, 'complainant.userType': 1 });
disputeSchema.index({ 'respondent.userId': 1, 'respondent.userType': 1 });
disputeSchema.index({ status: 1 });
disputeSchema.index({ assignedTo: 1 });
disputeSchema.index({ createdAt: -1 });

// Pre-save middleware to generate dispute ID
disputeSchema.pre('save', function(next) {
  if (this.isNew && !this.disputeId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.disputeId = `DISP-${timestamp}-${random}`;
  }
  next();
});

// Method to add a message to the dispute
disputeSchema.methods.addMessage = function(senderId, senderType, message, isInternal = false, attachments = []) {
  this.messages.push({
    sender: {
      userId: senderId,
      userType: senderType
    },
    message,
    isInternal,
    attachments
  });
  this.lastActivity = new Date();
  return this.save();
};

// Method to add evidence
disputeSchema.methods.addEvidence = function(type, url, description, uploadedBy, uploadedByType) {
  this.evidence.push({
    type,
    url,
    description,
    uploadedBy,
    uploadedByType
  });
  this.lastActivity = new Date();
  return this.save();
};

// Method to resolve dispute
disputeSchema.methods.resolve = function(decision, reason, refundAmount, resolvedBy, notes) {
  this.status = 'resolved';
  this.resolution = {
    decision,
    reason,
    refundAmount: refundAmount || 0,
    resolvedBy,
    resolvedAt: new Date(),
    notes
  };
  this.lastActivity = new Date();
  return this.save();
};

module.exports = mongoose.model('Dispute', disputeSchema);
