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
  
  console.log('createOrGetChat called with:', { participantId, participantType });
  console.log('Current user:', currentUser);
  
  // Validate participant type
  const validTypes = ['Buyer', 'Vendor', 'Agent'];
  if (!validTypes.includes(participantType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid participant type'
    });
  }

  // Don't allow users to chat with themselves
  if (participantId === currentUser._id || participantId === currentUser.id) {
    return res.status(400).json({
      success: false,
      message: 'Cannot create chat with yourself'
    });
  }

  // Check if participant exists
  let participant;
  const participantRole = participantType.toLowerCase();
  
  console.log('Looking up participant:', { participantId, participantType });
  
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

  console.log('Participant lookup result:', participant ? 'found' : 'not found');

  if (!participant) {
    console.log('Participant not found, returning 404');
    return res.status(404).json({
      success: false,
      message: 'Participant not found'
    });
  }

  // Check if chat already exists
  const currentUserType = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  const chatQuery = {
    chatType: 'direct',
    participants: {
      $all: [
        { user: currentUser._id || currentUser.id, userType: currentUserType },
        { user: participantId, userType: participantType }
      ]
    }
  };
  
  console.log('Looking for existing chat with query:', JSON.stringify(chatQuery, null, 2));
  
  let chat = await Chat.findOne(chatQuery).populate('participants.user', 'fullName email profilePicture')
    .populate('lastMessage');
    
  console.log('Existing chat found:', chat ? 'yes' : 'no');

  if (chat) {
    return res.json({
      success: true,
      message: 'Chat retrieved successfully',
      data: chat
    });
  }

  // Create new chat
  console.log('Creating new chat...');
  const chatData = {
    participants: [
      {
        user: currentUser._id || currentUser.id,
        userType: currentUserType,
        role: currentUser.role
      },
      {
        user: participantId,
        userType: participantType,
        role: participantRole
      }
    ],
    chatType: 'direct'
  };
  
  console.log('Chat data to create:', JSON.stringify(chatData, null, 2));
  
  chat = await Chat.create(chatData);
  console.log('Chat created with ID:', chat._id);

  // Populate the created chat
  chat = await Chat.findById(chat._id)
    .populate('participants.user', 'fullName email profilePicture')
    .populate('lastMessage');
    
  console.log('Chat populated successfully, sending response...');

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
  const userId = currentUser._id || currentUser.id;
  const userType = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  
  console.log('Getting chats for user:', { userId, userType });
  
  const chats = await Chat.find({
    'participants.user': userId,
    'participants.userType': userType,
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
        sender: { $ne: userId },
        isDeleted: false,
        'readBy': {
          $not: {
            $elemMatch: {
              user: userId,
              userType: userType
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

  console.log('Found chats:', chatsWithUnreadCount.length);
  console.log('First chat participants:', chatsWithUnreadCount[0]?.participants);
  console.log('Chats data:', chatsWithUnreadCount);

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
  const userId = currentUser._id || currentUser.id;
  const userType = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);

  const chat = await Chat.findOne({
    _id: chatId,
    'participants.user': userId,
    'participants.userType': userType
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
      sender: { $ne: userId },
      isDeleted: false
    },
    {
      $addToSet: {
        readBy: {
          user: userId,
          userType: userType,
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
  await chat.updateLastSeen(userId, userType);

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

// @desc    Get unread message count for user
// @route   GET /api/chats/unread-count
// @access  Private (Any authenticated user)
const getUnreadCount = asyncHandler(async (req, res) => {
  const currentUser = req.user;

  try {
    // Get all chats for the user
    const chats = await Chat.find({
      'participants.user': currentUser.id,
      'participants.userType': currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1),
      isActive: true
    });

    let totalUnread = 0;

    // Count unread messages for each chat
    for (const chat of chats) {
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

      totalUnread += unreadCount;
    }

    res.json({
      success: true,
      message: 'Unread count retrieved successfully',
      data: {
        count: totalUnread
      }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving unread count'
    });
  }
});

// @desc    Get chat messages
// @route   GET /api/chats/:chatId/messages
// @access  Private (Any authenticated user)
const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is participant in this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    const currentUserId = req.user._id || req.user.id;
    const isParticipant = chat.participants.some(
      p => (p.user.toString() === currentUserId.toString())
    );

    // For support ticket chats, allow staff members to access even if not participants
    let hasAccess = isParticipant;
    
    if (!hasAccess && chat.chatType === 'support' && chat.supportTicket) {
      // Check if user is staff and has access to this support ticket
      if (req.user.role === 'staff' || req.user.staffId) {
        // Import SupportTicket model
        const SupportTicket = require('../models/SupportTicket');
        
        // Check if staff is assigned to this support ticket
        const ticket = await SupportTicket.findById(chat.supportTicket);
        if (ticket) {
          const staffId = req.user.staffId || req.user._id || req.user.id;
          hasAccess = ticket.assignedTo && ticket.assignedTo.toString() === staffId.toString();
        }
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get messages with pagination
    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'fullName email profilePicture')
      .populate('attachments')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      success: true,
      data: messages.reverse() // Reverse to show oldest first
    });

  } catch (error) {
    console.error('Error getting chat messages:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  createOrGetChat,
  getUserChats,
  getChat,
  getChatMessages,
  markChatAsRead,
  getChatParticipants,
  archiveChat,
  unarchiveChat,
  getUnreadCount
};
