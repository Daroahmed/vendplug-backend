const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { sendNotification } = require('../utils/notificationHelper');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|mp3|wav/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, documents, and media files are allowed.'));
    }
  }
});

// @desc    Send message
// @route   POST /api/chats/:chatId/messages
// @access  Private (Any authenticated user)
const sendMessage = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { content, messageType = 'text', replyTo } = req.body;
  const currentUser = req.user;

  // Validate chat exists and user is participant
  const userId = currentUser._id || currentUser.id;
  const userType = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  
  console.log('=== MESSAGE SENDING DEBUG ===');
  console.log('Current user sending message:', currentUser);
  console.log('User ID:', userId);
  console.log('User type:', userType);
  console.log('Message content:', content);
  console.log('Chat ID:', chatId);
  
  let chat = await Chat.findOne({
    _id: chatId,
    'participants.user': userId,
    'participants.userType': userType,
    isActive: true
  });

  // For support ticket chats, allow staff members to send messages even if not participants
  if (!chat && (currentUser.role === 'staff' || currentUser.staffId)) {
    chat = await Chat.findById(chatId);
    if (chat && chat.chatType === 'support' && chat.supportTicket) {
      // Check if staff is assigned to this support ticket
      const SupportTicket = require('../models/SupportTicket');
      const ticket = await SupportTicket.findById(chat.supportTicket);
      if (ticket) {
        const staffId = currentUser.staffId || currentUser._id || currentUser.id;
        const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === staffId.toString();
        if (!isAssigned) {
          chat = null; // Not assigned to this ticket
        }
      } else {
        chat = null; // No support ticket found
      }
    } else {
      chat = null; // Not a support chat or no support ticket
    }
  }

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found or you are not a participant'
    });
  }

  // Validate content
  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required'
    });
  }

  // Validate replyTo if provided
  if (replyTo) {
    const replyMessage = await Message.findOne({
      _id: replyTo,
      chat: chatId
    });

    if (!replyMessage) {
      return res.status(400).json({
        success: false,
        message: 'Reply message not found'
      });
    }
  }

  // Handle file uploads
  let attachments = [];
  if (req.files && req.files.length > 0) {
    try {
      for (const file of req.files) {
        console.log('📤 Uploading file:', {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size
        });

        // Try Cloudinary upload first
        let cloudinaryResult = null;
        try {
          cloudinaryResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              {
                resource_type: 'auto',
                folder: 'vendplug/messages'
              },
              (error, result) => {
                if (error) {
                  console.error('❌ Cloudinary upload error:', error);
                  reject(error);
                } else {
                  console.log('✅ Cloudinary upload success:', {
                    public_id: result.public_id,
                    secure_url: result.secure_url
                  });
                  resolve(result);
                }
              }
            ).end(file.buffer);
          });
        } catch (cloudinaryError) {
          console.error('❌ Cloudinary upload failed, using local storage:', cloudinaryError.message);
        }

        // Create attachment object
        const attachment = {
          filename: cloudinaryResult ? cloudinaryResult.public_id : `local_${Date.now()}_${file.originalname}`,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          uploadedBy: userId,
          uploadedByType: userType,
          uploadedAt: new Date()
        };

        // Add URL based on upload method
        if (cloudinaryResult) {
          attachment.url = cloudinaryResult.secure_url;
          attachment.cloudinaryId = cloudinaryResult.public_id;
        } else {
          // Store file locally and create a local URL
          const fs = require('fs');
          const path = require('path');
          const uploadDir = path.join(__dirname, '../uploads/messages');
          
          // Create directory if it doesn't exist
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          
          const fileName = `local_${Date.now()}_${file.originalname}`;
          const filePath = path.join(uploadDir, fileName);
          
          fs.writeFileSync(filePath, file.buffer);
          attachment.url = `/uploads/messages/${fileName}`;
          attachment.localPath = filePath;
        }

        attachments.push(attachment);
        console.log('📎 Attachment created:', attachment);
      }
    } catch (error) {
      console.error('❌ File upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: error.message
      });
    }
  }

  // Create message
  console.log('Creating message with:', {
    chat: chatId,
    sender: userId,
    senderType: userType,
    content: content.trim()
  });
  
  const message = await Message.create({
    chat: chatId,
    sender: userId,
    senderType: userType,
    content: content.trim(),
    messageType: attachments.length > 0 ? 'file' : messageType,
    attachments: attachments,
    replyTo: replyTo || undefined
  });
  
  console.log('Message created with ID:', message._id);

  // Populate the message
  const populatedMessage = await Message.findById(message._id)
    .populate('sender', 'fullName email profilePicture')
    .populate('replyTo', 'content sender');

  // Send notifications to other participants
  const io = req.app.get('io');
  if (io) {
    // Emit to all participants in the chat
    chat.participants.forEach(participant => {
      // Skip the sender
      if (participant.user.toString() !== userId.toString()) {
        // Emit real-time message
        io.to(`user:${participant.user}`).emit('new_message', {
          chatId: chatId,
          message: populatedMessage
        });
        
        // Send notification
        sendNotification(io, {
          recipientId: participant.user,
          recipientType: participant.userType,
          notificationType: 'NEW_MESSAGE',
          args: [currentUser.fullName, content.substring(0, 50) + (content.length > 50 ? '...' : '')],
          chatId: chatId
        });
      }
    });
  }

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: populatedMessage
  });
});

// @desc    Get chat messages
// @route   GET /api/chats/:chatId/messages
// @access  Private (Any authenticated user)
const getChatMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { page = 1, limit = 50, before } = req.query;
  const currentUser = req.user;

  // Validate chat exists and user is participant
  const chat = await Chat.findOne({
    _id: chatId,
    'participants.user': currentUser.id,
    'participants.userType': currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found or you are not a participant'
    });
  }

  const skip = (page - 1) * limit;
  let query = {
    chat: chatId,
    isDeleted: false
  };

  // If before parameter is provided, get messages before that message
  if (before) {
    const beforeMessage = await Message.findById(before);
    if (beforeMessage) {
      query.createdAt = { $lt: beforeMessage.createdAt };
    }
  }

  const messages = await Message.find(query)
    .populate('sender', 'fullName email profilePicture')
    .populate('replyTo', 'content sender')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Mark messages as read
  await Message.updateMany(
    {
      chat: chatId,
      sender: { $ne: currentUser.id },
      isDeleted: false,
      'readBy': {
        $not: {
          $elemMatch: {
            user: currentUser.id,
            userType: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
          }
        }
      }
    },
    {
      $addToSet: {
        readBy: {
          user: currentUser.id,
          userType: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1),
          readAt: new Date()
        }
      },
      $set: {
        isRead: true,
        readAt: new Date(),
        status: 'read'
      }
    }
  );

  res.json({
    success: true,
    message: 'Messages retrieved successfully',
    data: messages.reverse(), // Reverse to get chronological order
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: messages.length === parseInt(limit)
    }
  });
});

// @desc    Mark message as read
// @route   PUT /api/messages/:messageId/read
// @access  Private (Any authenticated user)
const markMessageAsRead = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const currentUser = req.user;

  const message = await Message.findOne({
    _id: messageId,
    sender: { $ne: currentUser.id }
  });

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }

  await message.markAsRead(currentUser.id, currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1));

  res.json({
    success: true,
    message: 'Message marked as read'
  });
});

// @desc    Add reaction to message
// @route   POST /api/messages/:messageId/reactions
// @access  Private (Any authenticated user)
const addReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const currentUser = req.user;

  if (!emoji) {
    return res.status(400).json({
      success: false,
      message: 'Emoji is required'
    });
  }

  const message = await Message.findOne({
    _id: messageId,
    isDeleted: false
  });

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }

  await message.addReaction(currentUser.id, currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1), emoji);

  // Emit real-time event
  const io = req.app.get('io');
  if (io) {
    const chat = await Chat.findById(message.chat);
    chat.participants.forEach(participant => {
      io.to(`user_${participant.user}`).emit('message_reaction', {
        messageId: messageId,
        chatId: message.chat,
        reaction: {
          user: currentUser.id,
          userType: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1),
          emoji: emoji
        }
      });
    });
  }

  res.json({
    success: true,
    message: 'Reaction added successfully'
  });
});

// @desc    Remove reaction from message
// @route   DELETE /api/messages/:messageId/reactions
// @access  Private (Any authenticated user)
const removeReaction = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const currentUser = req.user;

  const message = await Message.findOne({
    _id: messageId,
    isDeleted: false
  });

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }

  await message.removeReaction(currentUser.id, currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1));

  // Emit real-time event
  const io = req.app.get('io');
  if (io) {
    const chat = await Chat.findById(message.chat);
    chat.participants.forEach(participant => {
      io.to(`user_${participant.user}`).emit('message_reaction_removed', {
        messageId: messageId,
        chatId: message.chat,
        userId: currentUser.id
      });
    });
  }

  res.json({
    success: true,
    message: 'Reaction removed successfully'
  });
});

// @desc    Delete message
// @route   DELETE /api/messages/:messageId
// @access  Private (Any authenticated user)
const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const currentUser = req.user;

  const message = await Message.findOne({
    _id: messageId,
    sender: currentUser.id
  });

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found or you are not the sender'
    });
  }

  await message.softDelete(currentUser.id, currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1));

  // Emit real-time event
  const io = req.app.get('io');
  if (io) {
    const chat = await Chat.findById(message.chat);
    chat.participants.forEach(participant => {
      io.to(`user_${participant.user}`).emit('message_deleted', {
        messageId: messageId,
        chatId: message.chat
      });
    });
  }

  res.json({
    success: true,
    message: 'Message deleted successfully'
  });
});

// @desc    Search messages
// @route   GET /api/chats/:chatId/messages/search
// @access  Private (Any authenticated user)
const searchMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { q, page = 1, limit = 20 } = req.query;
  const currentUser = req.user;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  // Validate chat exists and user is participant
  const chat = await Chat.findOne({
    _id: chatId,
    'participants.user': currentUser.id,
    'participants.userType': currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found or you are not a participant'
    });
  }

  const skip = (page - 1) * limit;

  const messages = await Message.find({
    chat: chatId,
    content: { $regex: q, $options: 'i' },
    isDeleted: false
  })
  .populate('sender', 'fullName email profilePicture')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(parseInt(limit));

  res.json({
    success: true,
    message: 'Search results retrieved successfully',
    data: messages,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: messages.length
    }
  });
});

module.exports = {
  sendMessage,
  getChatMessages,
  markMessageAsRead,
  addReaction,
  removeReaction,
  deleteMessage,
  searchMessages,
  upload
};
