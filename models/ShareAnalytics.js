const mongoose = require('mongoose');

const shareAnalyticsSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['whatsapp', 'facebook', 'twitter', 'copy', 'other']
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: false // Optional for general analytics
  },
  shopUrl: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  userAgent: {
    type: String,
    required: false
  },
  ipAddress: {
    type: String,
    required: false
  },
  // Additional metadata
  referrer: {
    type: String,
    required: false
  },
  deviceType: {
    type: String,
    enum: ['mobile', 'desktop', 'tablet'],
    required: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
shareAnalyticsSchema.index({ platform: 1, timestamp: -1 });
shareAnalyticsSchema.index({ vendorId: 1, timestamp: -1 });
shareAnalyticsSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ShareAnalytics', shareAnalyticsSchema);
