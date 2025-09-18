const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Ad Type
  type: {
    type: String,
    enum: ['banner', 'popup', 'inline', 'carousel'],
    required: true
  },
  
  // Content
  image: {
    type: String, // URL to image
    required: true
  },
  imageAlt: {
    type: String,
    default: ''
  },
  
  // Link/Action
  link: {
    type: String, // URL to redirect to
    default: ''
  },
  linkText: {
    type: String,
    default: 'Learn More'
  },
  
  // Display Settings
  position: {
    type: String,
    enum: ['hero', 'top', 'middle', 'bottom', 'sidebar', 'popup'],
    required: true
  },
  priority: {
    type: Number,
    default: 1, // Higher number = higher priority
    min: 1,
    max: 10
  },
  
  // Targeting
  targetPages: [{
    type: String,
    enum: ['home', 'buyer-home', 'agent-home', 'vendor-home', 'shop', 'category', 'product', 'search', 'all']
  }],
  targetUserTypes: [{
    type: String,
    enum: ['buyer', 'agent', 'vendor', 'all']
  }],
  
  // Scheduling
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  impressions: {
    type: Number,
    default: 0
  },
  
  // Carousel Settings (for carousel type)
  carouselSettings: {
    autoPlay: {
      type: Boolean,
      default: true
    },
    autoPlayInterval: {
      type: Number,
      default: 5000 // milliseconds
    },
    showDots: {
      type: Boolean,
      default: true
    },
    showArrows: {
      type: Boolean,
      default: true
    }
  },
  
  // Popup Settings (for popup type)
  popupSettings: {
    showOnFirstVisit: {
      type: Boolean,
      default: false
    },
    showOnLogin: {
      type: Boolean,
      default: false
    },
    showDelay: {
      type: Number,
      default: 2000 // milliseconds
    },
    closeable: {
      type: Boolean,
      default: true
    },
    showOncePerSession: {
      type: Boolean,
      default: true
    }
  },
  
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'expired', 'archived'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// Indexes for performance
adSchema.index({ type: 1, isActive: 1, startDate: 1, endDate: 1 });
adSchema.index({ targetPages: 1, targetUserTypes: 1 });
adSchema.index({ position: 1, priority: -1 });

// Virtual for click-through rate
adSchema.virtual('ctr').get(function() {
  if (this.impressions === 0) return 0;
  return ((this.clicks / this.impressions) * 100).toFixed(2);
});

// Method to check if ad should be shown
adSchema.methods.shouldShow = function(userType, currentPage) {
  const now = new Date();
  
  // Check if ad is active and within date range
  if (!this.isActive || this.status !== 'active') return false;
  if (now < this.startDate || now > this.endDate) return false;
  
  // Check user type targeting
  if (!this.targetUserTypes.includes('all') && !this.targetUserTypes.includes(userType)) {
    return false;
  }
  
  // Check page targeting
  if (!this.targetPages.includes('all') && !this.targetPages.includes(currentPage)) {
    return false;
  }
  
  return true;
};

// Method to record view
adSchema.methods.recordView = function() {
  this.views += 1;
  this.impressions += 1;
  return this.save();
};

// Method to record click
adSchema.methods.recordClick = function() {
  this.clicks += 1;
  return this.save();
};

module.exports = mongoose.model('Ad', adSchema);
