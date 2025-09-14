const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Chat', 
    required: true 
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'senderType',
    required: true 
  },
  senderType: { 
    type: String, 
    enum: ['Buyer', 'Vendor', 'Agent'],
    required: true 
  },
  content: { 
    type: String, 
    required: true,
    maxlength: 2000
  },
  messageType: { 
    type: String, 
    enum: ['text', 'image', 'file', 'system'], 
    default: 'text' 
  },
  // For file/image messages
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    cloudinaryId: String
  }],
  // Read status
  isRead: { 
    type: Boolean, 
    default: false 
  },
  readAt: { 
    type: Date 
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'readBy.userType'
    },
    userType: {
      type: String,
      enum: ['Buyer', 'Vendor', 'Agent']
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Message status
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  // For system messages
  systemMessage: {
    type: {
      type: String,
      enum: ['chat_started', 'user_joined', 'user_left', 'order_created', 'order_confirmed', 'dispute_created']
    },
    metadata: mongoose.Schema.Types.Mixed
  },
  // Reply to another message
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  // Message reactions
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'reactions.userType'
    },
    userType: {
      type: String,
      enum: ['Buyer', 'Vendor', 'Agent']
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'deletedByType'
  },
  deletedByType: {
    type: String,
    enum: ['Buyer', 'Vendor', 'Agent']
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Indexes for performance
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1, senderType: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ status: 1 });
messageSchema.index({ isDeleted: 1 });

// Virtual for formatted content (for display)
messageSchema.virtual('displayContent').get(function() {
  if (this.isDeleted) {
    return 'This message was deleted';
  }
  return this.content;
});

// Method to mark as read by specific user
messageSchema.methods.markAsRead = function(userId, userType) {
  const existingRead = this.readBy.find(r => 
    r.user.toString() === userId.toString() && r.userType === userType
  );
  
  if (!existingRead) {
    this.readBy.push({
      user: userId,
      userType: userType,
      readAt: new Date()
    });
    
    // Update overall read status
    if (this.readBy.length > 0) {
      this.isRead = true;
      this.readAt = new Date();
      this.status = 'read';
    }
    
    return this.save();
  }
  return Promise.resolve();
};

// Method to add reaction
messageSchema.methods.addReaction = function(userId, userType, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => 
    !(r.user.toString() === userId.toString() && r.userType === userType)
  );
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    userType: userType,
    emoji: emoji,
    createdAt: new Date()
  });
  
  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(userId, userType) {
  this.reactions = this.reactions.filter(r => 
    !(r.user.toString() === userId.toString() && r.userType === userType)
  );
  
  return this.save();
};

// Method to soft delete
messageSchema.methods.softDelete = function(userId, userType) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.deletedByType = userType;
  this.content = ''; // Clear content for privacy
  
  return this.save();
};

// Static method to get unread count for user
messageSchema.statics.getUnreadCount = function(userId, userType) {
  return this.aggregate([
    {
      $lookup: {
        from: 'chats',
        localField: 'chat',
        foreignField: '_id',
        as: 'chatInfo'
      }
    },
    {
      $unwind: '$chatInfo'
    },
    {
      $match: {
        'chatInfo.participants': {
          $elemMatch: {
            user: mongoose.Types.ObjectId(userId),
            userType: userType
          }
        },
        sender: { $ne: mongoose.Types.ObjectId(userId) },
        isDeleted: false,
        'readBy': {
          $not: {
            $elemMatch: {
              user: mongoose.Types.ObjectId(userId),
              userType: userType
            }
          }
        }
      }
    },
    {
      $count: 'unreadCount'
    }
  ]);
};

// Pre-save middleware
messageSchema.pre('save', function(next) {
  // Update chat's last message
  if (this.isNew && !this.isDeleted) {
    mongoose.model('Chat').findByIdAndUpdate(
      this.chat,
      { 
        lastMessage: this._id,
        lastMessageAt: this.createdAt || new Date()
      }
    ).exec();
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);
