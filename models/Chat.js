const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      refPath: 'participants.userType',
      required: true 
    },
    userType: { 
      type: String, 
      enum: ['Buyer', 'Vendor', 'Agent'],
      required: true 
    },
    role: { 
      type: String, 
      enum: ['buyer', 'vendor', 'agent'],
      required: true 
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  }],
  lastMessage: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Message' 
  },
  lastMessageAt: { 
    type: Date, 
    default: Date.now 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  chatType: {
    type: String,
    enum: ['direct', 'support'],
    default: 'direct'
  },
  // For support chats
  supportTicket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportTicket'
  },
  // Metadata
  metadata: {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'metadata.orderType'
    },
    orderType: {
      type: String,
      enum: ['VendorOrder', 'AgentOrder']
    }
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Indexes for performance
chatSchema.index({ 'participants.user': 1, 'participants.userType': 1 });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ isActive: 1 });
chatSchema.index({ chatType: 1 });

// Ensure unique chat between two users
chatSchema.index({ 
  'participants.user': 1, 
  'participants.userType': 1 
}, { 
  unique: true, 
  partialFilterExpression: { 
    chatType: 'direct',
    'participants.0': { $exists: true },
    'participants.1': { $exists: true }
  }
});

// Virtual for getting other participant
chatSchema.virtual('otherParticipant').get(function() {
  return this.participants.find(p => p.user.toString() !== this.currentUser?.toString());
});

// Method to check if user is participant
chatSchema.methods.isParticipant = function(userId, userType) {
  return this.participants.some(p => 
    p.user.toString() === userId.toString() && p.userType === userType
  );
};

// Method to get participant info
chatSchema.methods.getParticipant = function(userId, userType) {
  return this.participants.find(p => 
    p.user.toString() === userId.toString() && p.userType === userType
  );
};

// Method to update last seen
chatSchema.methods.updateLastSeen = function(userId, userType) {
  const participant = this.getParticipant(userId, userType);
  if (participant) {
    participant.lastSeen = new Date();
    return this.save();
  }
  return Promise.resolve();
};

// Pre-save middleware
chatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Chat', chatSchema);
