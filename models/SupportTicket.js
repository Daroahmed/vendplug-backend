const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: { 
    type: String, 
    unique: true
  },
  requester: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'requesterType',
    required: true 
  },
  requesterType: { 
    type: String, 
    enum: ['Buyer', 'Vendor', 'Agent'],
    required: true 
  },
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Staff' 
  },
  status: { 
    type: String, 
    enum: ['open', 'in_progress', 'resolved', 'closed'], 
    default: 'open' 
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'], 
    default: 'medium' 
  },
  category: { 
    type: String, 
    enum: ['technical', 'billing', 'order', 'dispute', 'account', 'payment', 'other'], 
    required: true 
  },
  subcategory: {
    type: String,
    enum: ['login_issue', 'payment_failed', 'order_delayed', 'refund_request', 'account_suspension', 'feature_request', 'bug_report', 'general_inquiry']
  },
  subject: { 
    type: String, 
    required: true,
    maxlength: 200
  },
  description: { 
    type: String, 
    required: true,
    maxlength: 2000
  },
  // Related entities
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'orderType'
  },
  orderType: {
    type: String,
    enum: ['VendorOrder', 'AgentOrder']
  },
  disputeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dispute'
  },
  // Chat integration
  chat: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Chat' 
  },
  // Timestamps
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  resolvedAt: { 
    type: Date 
  },
  closedAt: { 
    type: Date 
  },
  // SLA tracking
  firstResponseAt: {
    type: Date
  },
  resolutionDeadline: {
    type: Date
  },
  // Internal notes
  internalNotes: [{
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
    },
    note: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Escalation
  escalatedAt: {
    type: Date
  },
  escalatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  escalationReason: String,
  // Satisfaction rating
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: {
      type: Date
    }
  },
  // Tags for categorization
  tags: [String],
  // Attachments
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    cloudinaryId: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'attachments.uploadedByType'
    },
    uploadedByType: {
      type: String,
      enum: ['Buyer', 'Vendor', 'Agent', 'Staff']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for performance
supportTicketSchema.index({ ticketNumber: 1 });
supportTicketSchema.index({ requester: 1, requesterType: 1 });
supportTicketSchema.index({ assignedTo: 1 });
supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ priority: 1 });
supportTicketSchema.index({ category: 1 });
supportTicketSchema.index({ createdAt: -1 });
supportTicketSchema.index({ resolutionDeadline: 1 });

// Pre-save middleware to generate ticket number
supportTicketSchema.pre('save', function(next) {
  if (this.isNew && !this.ticketNumber) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.ticketNumber = `TKT-${timestamp}-${random}`;
  }
  
  // Set resolution deadline based on priority
  if (this.isNew || this.isModified('priority')) {
    const now = new Date();
    switch (this.priority) {
      case 'urgent':
        this.resolutionDeadline = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
        break;
      case 'high':
        this.resolutionDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
        break;
      case 'medium':
        this.resolutionDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours
        break;
      case 'low':
        this.resolutionDeadline = new Date(now.getTime() + 168 * 60 * 60 * 1000); // 7 days
        break;
    }
  }
  
  this.updatedAt = new Date();
  next();
});

// Method to assign to staff
supportTicketSchema.methods.assignToStaff = function(staffId) {
  this.assignedTo = staffId;
  this.status = 'in_progress';
  this.updatedAt = new Date();
  return this.save();
};

// Method to update status
supportTicketSchema.methods.updateStatus = function(newStatus, staffId) {
  this.status = newStatus;
  this.updatedAt = new Date();
  
  if (newStatus === 'resolved') {
    this.resolvedAt = new Date();
  } else if (newStatus === 'closed') {
    this.closedAt = new Date();
  }
  
  return this.save();
};

// Method to add internal note
supportTicketSchema.methods.addInternalNote = function(staffId, note) {
  this.internalNotes.push({
    staff: staffId,
    note: note,
    createdAt: new Date()
  });
  return this.save();
};

// Method to escalate
supportTicketSchema.methods.escalate = function(staffId, reason) {
  this.escalatedAt = new Date();
  this.escalatedTo = staffId;
  this.escalationReason = reason;
  this.priority = this.priority === 'urgent' ? 'urgent' : 'high';
  return this.save();
};

// Method to rate
supportTicketSchema.methods.rate = function(score, feedback) {
  this.rating = {
    score: score,
    feedback: feedback,
    ratedAt: new Date()
  };
  return this.save();
};

// Static method to get ticket statistics
supportTicketSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgResolutionTime: {
          $avg: {
            $cond: [
              { $ne: ['$resolvedAt', null] },
              { $subtract: ['$resolvedAt', '$createdAt'] },
              null
            ]
          }
        }
      }
    }
  ]);
};

// Static method to get overdue tickets
supportTicketSchema.statics.getOverdueTickets = function() {
  return this.find({
    status: { $in: ['open', 'in_progress'] },
    resolutionDeadline: { $lt: new Date() }
  }).populate('assignedTo', 'name email').populate('requester', 'name email');
};

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
