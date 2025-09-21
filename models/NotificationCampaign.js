const mongoose = require('mongoose');

const notificationCampaignSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  
  // Campaign Type
  type: {
    type: String,
    enum: ['announcement', 'promotion', 'update', 'event', 'maintenance', 'celebration'],
    required: true
  },
  
  // Content
  image: {
    type: String, // URL to image (optional)
    default: ''
  },
  link: {
    type: String, // URL to redirect to (optional)
    default: ''
  },
  linkText: {
    type: String,
    default: 'Learn More'
  },
  
  // Targeting
  targetUserTypes: [{
    type: String,
    enum: ['buyer', 'agent', 'vendor', 'staff', 'admin', 'all']
  }],
  targetUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'targetUserType'
  }],
  targetUserType: {
    type: String,
    enum: ['Buyer', 'Agent', 'Vendor', 'Staff', 'Admin']
  },
  
  // Delivery Settings
  deliveryMethod: {
    type: String,
    enum: ['push', 'email', 'sms', 'in_app', 'popup'],
    default: 'in_app'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Scheduling
  scheduledFor: {
    type: Date,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed'],
    default: 'draft'
  },
  
  // Analytics
  totalRecipients: {
    type: Number,
    default: 0
  },
  sentCount: {
    type: Number,
    default: 0
  },
  deliveredCount: {
    type: Number,
    default: 0
  },
  readCount: {
    type: Number,
    default: 0
  },
  clickCount: {
    type: Number,
    default: 0
  },
  
  // Advanced Settings
  settings: {
    // For popup notifications
    popup: {
      showDelay: {
        type: Number,
        default: 2000 // milliseconds
      },
      autoClose: {
        type: Number,
        default: 0 // 0 = no auto close, >0 = close after X seconds
      },
      closeable: {
        type: Boolean,
        default: true
      },
      showOncePerUser: {
        type: Boolean,
        default: true
      }
    },
    
    // For email notifications
    email: {
      subject: String,
      template: String,
      includeUnsubscribe: {
        type: Boolean,
        default: true
      }
    },
    
    // For SMS notifications
    sms: {
      provider: {
        type: String,
        enum: ['twilio', 'africastalking', 'other'],
        default: 'twilio'
      }
    }
  },
  
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  
  // Error handling
  lastError: {
    message: String,
    timestamp: Date
  },
  
  // Retry settings
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  }
}, {
  timestamps: true
});

// Indexes for performance
notificationCampaignSchema.index({ status: 1, scheduledFor: 1 });
notificationCampaignSchema.index({ targetUserTypes: 1, isActive: 1 });
notificationCampaignSchema.index({ type: 1, priority: 1 });

// Virtual for delivery rate
notificationCampaignSchema.virtual('deliveryRate').get(function() {
  if (this.sentCount === 0) return 0;
  return ((this.deliveredCount / this.sentCount) * 100).toFixed(2);
});

// Virtual for read rate
notificationCampaignSchema.virtual('readRate').get(function() {
  if (this.deliveredCount === 0) return 0;
  return ((this.readCount / this.deliveredCount) * 100).toFixed(2);
});

// Virtual for click rate
notificationCampaignSchema.virtual('clickRate').get(function() {
  if (this.deliveredCount === 0) return 0;
  return ((this.clickCount / this.deliveredCount) * 100).toFixed(2);
});

// Method to check if campaign should be sent
notificationCampaignSchema.methods.shouldSend = function() {
  const now = new Date();
  
  if (!this.isActive || this.status !== 'scheduled') return false;
  if (now < this.scheduledFor || now > this.expiresAt) return false;
  
  return true;
};

// Method to update status
notificationCampaignSchema.methods.updateStatus = function(newStatus, error = null) {
  this.status = newStatus;
  if (error) {
    this.lastError = {
      message: error.message,
      timestamp: new Date()
    };
    this.retryCount += 1;
  }
  return this.save();
};

// Method to record delivery
notificationCampaignSchema.methods.recordDelivery = function() {
  this.deliveredCount += 1;
  return this.save();
};

// Method to record read
notificationCampaignSchema.methods.recordRead = function() {
  this.readCount += 1;
  return this.save();
};

// Method to record click
notificationCampaignSchema.methods.recordClick = function() {
  this.clickCount += 1;
  return this.save();
};

module.exports = mongoose.model('NotificationCampaign', notificationCampaignSchema);
