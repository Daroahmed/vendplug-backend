const asyncHandler = require('express-async-handler');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Buyer = require('../models/Buyer');
const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');

// @desc    Create or get existing chat between users
// @route   POST /api/chats
// @access  Private (Any authenticated user)
const createOrGetChat = asyncHandler(async (req, res) => {
  const { participantId, participantType } = req.body;
  const currentUser = req.user;
  
  // Validate participant type
  const validTypes = ['Buyer', 'Vendor', 'Agent'];
  if (!validTypes.includes(participantType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid participant type'
    });
  }

  // Don't allow users to chat with themselves
  if (participantId === currentUser.id) {
    return res.status(400).json({
      success: false,
      message: 'Cannot create chat with yourself'
    });
  }

  // Check if participant exists
  let participant;
  const participantRole = participantType.toLowerCase();
  
  switch (participantType) {
    case 'Buyer':
      participant = await Buyer.findById(participantId);
      break;
    case 'Vendor':
      participant = await Vendor.findById(participantId);
      break;
    case 'Agent':
      participant = await Agent.findById(participantId);
      break;
  }

  if (!participant) {
    return res.status(404).json({
      success: false,
      message: 'Participant not found'
    });
  }

  // Check if chat already exists
  let chat = await Chat.findOne({
    chatType: 'direct',
    participants: {
      $all: [
        { user: currentUser.id, userType: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) },
        { user: participantId, userType: participantType }
      ]
    }
  }).populate('participants.user', 'fullName email profilePicture')
    .populate('lastMessage');

  if (chat) {
    return res.json({
      success: true,
      message: 'Chat retrieved successfully',
      data: chat
    });
  }

  // Create new chat
  chat = await Chat.create({
    participants: [
      {
        user: currentUser.id,
        userType: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1),
        role: currentUser.role
      },
      {
        user: participantId,
        userType: participantType,
        role: participantRole
      }
    ],
    chatType: 'direct'
  });

  // Populate the created chat
  chat = await Chat.findById(chat._id)
    .populate('participants.user', 'fullName email profilePicture')
    .populate('lastMessage');

  res.status(201).json({
    success: true,
    message: 'Chat created successfully',
    data: chat
  });
});

// @desc    Get user's chats
// @route   GET /api/chats
// @access  Private (Any authenticated user)
const getUserChats = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { page = 1, limit = 20 } = req.query;
  
  const skip = (page - 1) * limit;
  
  const chats = await Chat.find({
    'participants.user': currentUser.id,
    'participants.userType': currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1),
    isActive: true
  })
  .populate('participants.user', 'fullName email profilePicture')
  .populate('lastMessage')
  .sort({ lastMessageAt: -1 })
  .skip(skip)
  .limit(parseInt(limit));

  // Get unread counts for each chat
  const chatsWithUnreadCount = await Promise.all(
    chats.map(async (chat) => {
      const unreadCount = await Message.countDocuments({
        chat: chat._id,
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
      });

      return {
        ...chat.toObject(),
        unreadCount
      };
    })
  );

  res.json({
    success: true,
    message: 'Chats retrieved successfully',
    data: chatsWithUnreadCount,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: chatsWithUnreadCount.length
    }
  });
});

// @desc    Get specific chat
// @route   GET /api/chats/:chatId
// @access  Private (Any authenticated user)
const getChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const currentUser = req.user;

  const chat = await Chat.findOne({
    _id: chatId,
    'participants.user': currentUser.id,
    'participants.userType': currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
  })
  .populate('participants.user', 'fullName email profilePicture')
  .populate('lastMessage');

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

  // Update last seen
  await chat.updateLastSeen(currentUser.id, currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1));

  res.json({
    success: true,
    message: 'Chat retrieved successfully',
    data: chat
  });
});

// @desc    Mark chat as read
// @route   PUT /api/chats/:chatId/read
// @access  Private (Any authenticated user)
const markChatAsRead = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const currentUser = req.user;

  const chat = await Chat.findOne({
    _id: chatId,
    'participants.user': currentUser.id,
    'participants.userType': currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

  // Mark all messages in this chat as read
  await Message.updateMany(
    {
      chat: chatId,
      sender: { $ne: currentUser.id },
      isDeleted: false
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

  // Update last seen
  await chat.updateLastSeen(currentUser.id, currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1));

  res.json({
    success: true,
    message: 'Chat marked as read'
  });
});

// @desc    Get chat participants
// @route   GET /api/chats/:chatId/participants
// @access  Private (Any authenticated user)
const getChatParticipants = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const currentUser = req.user;

  const chat = await Chat.findOne({
    _id: chatId,
    'participants.user': currentUser.id,
    'participants.userType': currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
  }).populate('participants.user', 'fullName email profilePicture');

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

  res.json({
    success: true,
    message: 'Participants retrieved successfully',
    data: chat.participants
  });
});

// @desc    Archive chat
// @route   PUT /api/chats/:chatId/archive
// @access  Private (Any authenticated user)
const archiveChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const currentUser = req.user;

  const chat = await Chat.findOne({
    _id: chatId,
    'participants.user': currentUser.id,
    'participants.userType': currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

  chat.isActive = false;
  await chat.save();

  res.json({
    success: true,
    message: 'Chat archived successfully'
  });
});

// @desc    Unarchive chat
// @route   PUT /api/chats/:chatId/unarchive
// @access  Private (Any authenticated user)
const unarchiveChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const currentUser = req.user;

  const chat = await Chat.findOne({
    _id: chatId,
    'participants.user': currentUser.id,
    'participants.userType': currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
  });

  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found'
    });
  }

  chat.isActive = true;
  await chat.save();

  res.json({
    success: true,
    message: 'Chat unarchived successfully'
  });
});

module.exports = {
  createOrGetChat,
  getUserChats,
  getChat,
  markChatAsRead,
  getChatParticipants,
  archiveChat,
  unarchiveChat
};
