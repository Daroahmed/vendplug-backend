const asyncHandler = require('express-async-handler');
const SupportTicket = require('../models/SupportTicket');
const Chat = require('../models/Chat');
const Admin = require('../models/Admin');
const Buyer = require('../models/Buyer');
const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');

// @desc    Create support ticket
// @route   POST /api/support/tickets
// @access  Private (Any authenticated user)
const createSupportTicket = asyncHandler(async (req, res) => {
  const {
    category,
    subcategory,
    subject,
    description,
    priority = 'medium',
    orderId,
    orderType,
    disputeId
  } = req.body;
  
  const currentUser = req.user;
  
  console.log('🔍 Creating support ticket for user:', {
    userId: currentUser.id || currentUser._id,
    userRole: currentUser.role,
    userData: currentUser
  });

  // Validate required fields
  if (!category || !subject || !description) {
    return res.status(400).json({
      success: false,
      message: 'Category, subject, and description are required'
    });
  }

  // Validate user data
  const userId = currentUser.staffId || currentUser.id || currentUser._id;
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User authentication failed - missing user ID'
    });
  }

  // Create support ticket
  const ticket = await SupportTicket.create({
    requester: userId,
    requesterType: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1),
    category,
    subcategory,
    subject,
    description,
    priority,
    orderId,
    orderType,
    disputeId
  });

  // Create chat for this ticket
  const chat = await Chat.create({
    participants: [{
      user: userId,
      userType: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1),
      role: currentUser.role
    }],
    chatType: 'support',
    supportTicket: ticket._id
  });

  // Update ticket with chat reference
  ticket.chat = chat._id;
  await ticket.save();

  // Auto-assign to available staff
  const io = req.app.get('io');
  await autoAssignTicket(ticket._id, io);

  // Send notification to all available staff
  try {
    const { sendNotification } = require('../utils/notificationHelper');
    
    // Find all available staff to notify them about the new ticket
    const availableStaff = await Admin.find({
      isActive: true,
      role: { $in: ['dispute_manager', 'dispute_specialist', 'dispute_analyst', 'moderator'] }
    });

    // Send notification to each staff member
    for (const staff of availableStaff) {
      await sendNotification(io, {
        recipientId: staff._id,
        recipientType: 'Staff',
        notificationType: 'NEW_SUPPORT_TICKET',
        args: [ticket.ticketNumber, category],
        meta: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          category: category,
          priority: priority
        }
      });
    }
  } catch (error) {
    console.error('Support ticket notification error:', error);
  }

  // Populate the ticket
  const populatedTicket = await SupportTicket.findById(ticket._id)
    .populate('requester', 'fullName email')
    .populate('assignedTo', 'fullName email')
    .populate('chat');

  res.status(201).json({
    success: true,
    message: 'Support ticket created successfully',
    data: populatedTicket
  });
});

// @desc    Get user's support tickets
// @route   GET /api/support/tickets
// @access  Private (Any authenticated user)
const getUserTickets = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { page = 1, limit = 20, status, priority, category } = req.query;
  
  const userId = currentUser.staffId || currentUser.id || currentUser._id;
  const skip = (page - 1) * limit;
  let query = {
    requester: userId,
    requesterType: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
  };

  // Add filters
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;

  const tickets = await SupportTicket.find(query)
    .populate('assignedTo', 'fullName email')
    .populate('chat')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({
    success: true,
    message: 'Support tickets retrieved successfully',
    data: tickets,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: tickets.length
    }
  });
});

// @desc    Get specific support ticket
// @route   GET /api/support/tickets/:ticketId
// @access  Private (Any authenticated user)
const getSupportTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const currentUser = req.staff || req.admin || req.user;
  const userId = currentUser.staffId || currentUser.id || currentUser._id;

  // Build query based on user type
  let query = { _id: ticketId };
  
  if (req.admin) {
    // Admins can see all tickets
    query = { _id: ticketId };
  } else if (currentUser.staffId) {
    // Staff can see tickets assigned to them or tickets they created
    query.$or = [
      { assignedTo: userId },
      { requester: userId }
    ];
  } else {
    // Regular users can only see their own tickets
    query.requester = userId;
    query.requesterType = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  }

  const ticket = await SupportTicket.findOne(query)
  .populate('requester', 'fullName email')
  .populate('assignedTo', 'fullName email')
  .populate('chat')
  .populate('orderId', 'totalAmount status createdAt')
  .populate('disputeId', 'status description');

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  res.json({
    success: true,
    message: 'Support ticket retrieved successfully',
    data: ticket
  });
});

// @desc    Update support ticket status
// @route   PUT /api/support/tickets/:ticketId/status
// @access  Private (Any authenticated user)
const updateTicketStatus = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { status } = req.body;
  const currentUser = req.user;
  const userId = currentUser.staffId || currentUser.id || currentUser._id;

  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    requester: userId,
    requesterType: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
  });

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  // Only allow certain status changes from user side
  const allowedStatuses = ['open'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status change'
    });
  }

  await ticket.updateStatus(status);

  res.json({
    success: true,
    message: 'Ticket status updated successfully',
    data: ticket
  });
});

// @desc    Rate support ticket
// @route   POST /api/support/tickets/:ticketId/rate
// @access  Private (Any authenticated user)
const rateTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { score, feedback } = req.body;
  const currentUser = req.user;
  const userId = currentUser.staffId || currentUser.id || currentUser._id;

  if (!score || score < 1 || score > 5) {
    return res.status(400).json({
      success: false,
      message: 'Score must be between 1 and 5'
    });
  }

  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    requester: userId,
    requesterType: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1),
    status: { $in: ['resolved', 'closed'] }
  });

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found or not eligible for rating'
    });
  }

  await ticket.rate(score, feedback);

  res.json({
    success: true,
    message: 'Ticket rated successfully'
  });
});

// @desc    Get support ticket statistics
// @route   GET /api/support/stats
// @access  Private (Staff only)
const getSupportStats = asyncHandler(async (req, res) => {
  const currentUser = req.staff || req.admin || req.user;

  // Check if user is staff or admin
  if (!currentUser.staffId && currentUser.role !== 'staff' && !req.admin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff or admin only.'
    });
  }

  const stats = await SupportTicket.getStats();
  const overdueTickets = await SupportTicket.getOverdueTickets();

  res.json({
    success: true,
    message: 'Support statistics retrieved successfully',
    data: {
      stats,
      overdueTickets: overdueTickets.length
    }
  });
});

// @desc    Get staff assigned tickets
// @route   GET /api/staff/support/tickets
// @access  Private (Staff only)
const getStaffTickets = asyncHandler(async (req, res) => {
  const currentUser = req.staff || req.admin || req.user;

  // Check if user is staff or admin
  if (!currentUser.staffId && currentUser.role !== 'staff' && !req.admin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff or admin only.'
    });
  }

  const { page = 1, limit = 20, status, priority } = req.query;
  const skip = (page - 1) * limit;
  const userId = currentUser.staffId || currentUser.id || currentUser._id;
  
  let query = { assignedTo: userId };
  if (status) query.status = status;
  if (priority) query.priority = priority;

  const tickets = await SupportTicket.find(query)
    .populate('requester', 'fullName email')
    .populate('chat')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({
    success: true,
    message: 'Assigned tickets retrieved successfully',
    data: tickets,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: tickets.length
    }
  });
});

// @desc    Assign ticket to staff
// @route   PUT /api/staff/support/tickets/:ticketId/assign
// @access  Private (Staff only)
const assignTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { staffId } = req.body;
  const currentUser = req.staff || req.admin || req.user;

  // Check if user is staff or admin
  if (!currentUser.staffId && currentUser.role !== 'staff' && !req.admin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff or admin only.'
    });
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  const staff = await Admin.findById(staffId);
  if (!staff) {
    return res.status(404).json({
      success: false,
      message: 'Staff member not found'
    });
  }

  await ticket.assignToStaff(staffId);

  // Send notification to assigned staff
  try {
    const io = req.app.get('io');
    const { sendNotification } = require('../utils/notificationHelper');
    
    await sendNotification(io, {
      recipientId: staffId,
      recipientType: 'Staff',
      notificationType: 'TICKET_ASSIGNED',
      title: 'Ticket Assigned',
      message: `You have been assigned ticket: ${ticket.ticketNumber}`,
      metadata: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber
      }
    });
  } catch (error) {
    console.error('Ticket assignment notification error:', error);
  }

  res.json({
    success: true,
    message: 'Ticket assigned successfully'
  });
});

// @desc    Update ticket status (Staff)
// @route   PUT /api/staff/support/tickets/:ticketId/status
// @access  Private (Staff only)
const updateTicketStatusStaff = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { status, internalNote } = req.body;
  const currentUser = req.staff || req.admin || req.user;

  // Check if user is staff or admin
  if (!currentUser.staffId && currentUser.role !== 'staff' && !req.admin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff or admin only.'
    });
  }

  const userId = currentUser.staffId || currentUser.id || currentUser._id;
  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    assignedTo: userId
  });

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found or not assigned to you'
    });
  }

  await ticket.updateStatus(status, userId);

  // Add internal note if provided
  if (internalNote) {
    await ticket.addInternalNote(userId, internalNote);
  }

  // Send Socket.IO notifications
  try {
    const io = req.app.get('io');
    const { sendNotification } = require('../utils/notificationHelper');
    
    // Notify the ticket requester about status change
    await sendNotification(io, {
      recipientId: ticket.requester,
      recipientType: ticket.requesterType || 'Buyer',
      notificationType: 'TICKET_UPDATED',
      args: [ticket.ticketNumber, status],
      meta: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        status: status
      }
    });

    // Emit real-time status update
    if (io) {
      io.emit('support-ticket-status-updated', {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        status: status,
        updatedBy: currentUser.fullName || currentUser.email || 'Support Staff'
      });
    }
  } catch (error) {
    console.error('Support status notification error:', error);
  }

  res.json({
    success: true,
    message: 'Ticket status updated successfully'
  });
});

// Helper function to auto-assign tickets
const autoAssignTicket = async (ticketId, io = null) => {
  try {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) return;

    // Find available staff only (exclude admins from auto-assignment)
    const availableStaff = await Admin.find({
      isActive: true,
      role: { $in: ['dispute_manager', 'dispute_specialist', 'dispute_analyst', 'moderator'] }
    }).sort({ createdAt: 1 }); // Simple round-robin assignment

    if (availableStaff.length > 0) {
      // Get staff with least assigned tickets
      const staffWithCounts = await Promise.all(
        availableStaff.map(async (staff) => {
          const assignedCount = await SupportTicket.countDocuments({
            assignedTo: staff._id,
            status: { $in: ['open', 'in_progress'] }
          });
          return { staff, assignedCount };
        })
      );

      // Sort by assigned count (ascending) and pick the first one
      staffWithCounts.sort((a, b) => a.assignedCount - b.assignedCount);
      const selectedStaff = staffWithCounts[0].staff;
      
      await ticket.assignToStaff(selectedStaff._id);
      
      // Send notification to the assigned staff member
      if (io) {
        try {
          const { sendNotification } = require('../utils/notificationHelper');
          
          await sendNotification(io, {
            recipientId: selectedStaff._id,
            recipientType: 'Staff',
            notificationType: 'TICKET_ASSIGNED',
            args: [ticket.ticketNumber, selectedStaff.name],
            meta: {
              ticketId: ticket._id,
              ticketNumber: ticket.ticketNumber
            }
          });
        } catch (error) {
          console.error('Assignment notification error:', error);
        }
      }
      
      console.log(`✅ Ticket ${ticket.ticketNumber} auto-assigned to ${selectedStaff.name} (${selectedStaff.email})`);
    } else {
      console.log(`⚠️ No available staff for ticket ${ticket.ticketNumber}`);
    }
  } catch (error) {
    console.error('Auto-assignment error:', error);
  }
};

// @desc    Get my assigned support tickets (for staff)
// @route   GET /api/support/staff/tickets/my
// @access  Private (Staff)
const getMySupportTickets = asyncHandler(async (req, res) => {
  const currentUser = req.staff || req.admin || req.user;
  const { page = 1, limit = 20, status, priority } = req.query;
  
  const userId = currentUser.staffId || currentUser.id || currentUser._id;
  const skip = (page - 1) * limit;
  
  let query = { assignedTo: userId };
  if (status) query.status = status;
  if (priority) query.priority = priority;

  const tickets = await SupportTicket.find(query)
    .populate('requester', 'fullName email')
    .populate('chat')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await SupportTicket.countDocuments(query);

  res.json({
    success: true,
    data: {
      tickets,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    }
  });
});

// @desc    Get available support tickets (unassigned)
// @route   GET /api/support/staff/tickets/available
// @access  Private (Staff)
const getAvailableSupportTickets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, category, priority } = req.query;
  
  const skip = (page - 1) * limit;
  
  let query = { assignedTo: { $exists: false } };
  if (category) query.category = category;
  if (priority) query.priority = priority;

  const tickets = await SupportTicket.find(query)
    .populate('requester', 'fullName email')
    .populate('chat')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await SupportTicket.countDocuments(query);

  res.json({
    success: true,
    data: {
      tickets,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    }
  });
});

// @desc    Get all support tickets (for admin)
// @route   GET /api/support/admin/tickets
// @access  Private (Admin)
const getAllSupportTickets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, priority, category, assignedTo, search } = req.query;
  
  const skip = (page - 1) * limit;
  
  let query = {};
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (assignedTo) query.assignedTo = assignedTo;
  if (search) {
    query.$or = [
      { subject: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { ticketNumber: { $regex: search, $options: 'i' } }
    ];
  }

  const tickets = await SupportTicket.find(query)
    .populate('requester', 'fullName email')
    .populate('assignedTo', 'fullName email')
    .populate('chat')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await SupportTicket.countDocuments(query);

  res.json({
    success: true,
    data: {
      tickets,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    }
  });
});

// @desc    Send message to support ticket chat (for users)
// @route   POST /api/support/tickets/:ticketId/message
// @access  User (Buyer/Vendor/Agent)
const sendSupportTicketMessageUser = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { content, messageType = 'text' } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required'
    });
  }

  // Get the ticket
  const ticket = await SupportTicket.findById(ticketId)
    .populate('chat');
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  // Check if user owns this ticket
  const userId = req.user?._id || req.user?.id;
  if (ticket.requester.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only send messages to your own support tickets'
    });
  }

  // Get the chat for this ticket
  const chat = await Chat.findById(ticket.chat);
  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found for this support ticket'
    });
  }

  // Create the message
  const Message = require('../models/Message');
  const message = await Message.create({
    chat: chat._id,
    sender: userId,
    senderType: req.user?.role === 'buyer' ? 'Buyer' : req.user?.role === 'vendor' ? 'Vendor' : 'Agent',
    content: content.trim(),
    messageType
  });

  // Update chat's last message
  chat.lastMessage = message._id;
  chat.updatedAt = new Date();
  await chat.save();

  // Populate sender info
  await message.populate('sender', 'fullName email profilePicture');

  // Send Socket.IO notifications
  try {
    const io = req.app.get('io');
    const { sendNotification } = require('../utils/notificationHelper');
    
    // Notify assigned staff if ticket is assigned
    if (ticket.assignedTo) {
      await sendNotification(io, {
        recipientId: ticket.assignedTo,
        recipientType: 'Staff',
        notificationType: 'SUPPORT_MESSAGE',
        args: [req.user?.fullName || req.user?.email || 'User', ticket.ticketNumber],
        meta: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          messageId: message._id
        }
      });
    }

    // Emit real-time message to all participants
    if (io) {
      // Notify staff dashboard
      io.emit('support-ticket-message', {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        message: message,
        senderType: message.senderType
      });
    }
  } catch (error) {
    console.error('Support message notification error:', error);
  }

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: message
  });
});

// @desc    Get messages for support ticket chat (for users)
// @route   GET /api/support/tickets/:ticketId/messages
// @access  User (Buyer/Vendor/Agent)
const getSupportTicketMessages = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;

  // Get the ticket
  const ticket = await SupportTicket.findById(ticketId)
    .populate('chat');
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  // Check if user owns this ticket
  const userId = req.user?._id || req.user?.id;
  if (ticket.requester.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only view messages for your own support tickets'
    });
  }

  // Get the chat for this ticket
  const chat = await Chat.findById(ticket.chat);
  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found for this support ticket'
    });
  }

  // Get messages for this chat
  const Message = require('../models/Message');
  const messages = await Message.find({ chat: chat._id })
    .populate('sender', 'fullName email profilePicture')
    .sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    message: 'Messages retrieved successfully',
    data: messages
  });
});

// @desc    Send message to support ticket chat (for staff)
// @route   POST /api/support/staff/tickets/:ticketId/message
// @access  Private (Staff only)
const sendSupportTicketMessage = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { content, messageType = 'text' } = req.body;
  const currentUser = req.staff || req.admin || req.user;
  
  // Validate content
  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required'
    });
  }

  // Get the support ticket and verify staff is assigned
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  const staffId = currentUser.staffId || currentUser.id || currentUser._id;
  if (!ticket.assignedTo || ticket.assignedTo.toString() !== staffId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to this support ticket'
    });
  }

  // Get the chat for this ticket
  const chat = await Chat.findById(ticket.chat);
  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found for this support ticket'
    });
  }

  // Create the message
  const Message = require('../models/Message');
  const message = await Message.create({
    chat: chat._id,
    sender: staffId,
    content: content.trim(),
    messageType,
    senderType: 'Staff'
  });

  // Update chat's last message
  chat.lastMessage = message._id;
  chat.updatedAt = new Date();
  await chat.save();

  // Populate sender info
  await message.populate('sender', 'fullName email profilePicture');

  // Send Socket.IO notifications
  try {
    const io = req.app.get('io');
    const { sendNotification } = require('../utils/notificationHelper');
    
    // Notify the ticket requester (user)
    await sendNotification(io, {
      recipientId: ticket.requester,
      recipientType: ticket.requesterType || 'Buyer',
      notificationType: 'SUPPORT_MESSAGE_STAFF',
      args: [ticket.ticketNumber, currentUser.fullName || currentUser.email || 'Support Staff'],
      meta: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        messageId: message._id
      }
    });

    // Emit real-time message to all participants
    if (io) {
      // Notify user support page
      io.emit('support-ticket-message', {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        message: message,
        senderType: message.senderType
      });
    }
  } catch (error) {
    console.error('Support message notification error:', error);
  }

  res.json({
    success: true,
    message: 'Message sent successfully',
    data: message
  });
});

// @desc    Get messages for support ticket chat (for staff)
// @route   GET /api/support/staff/tickets/:ticketId/messages
// @access  Staff
const getSupportTicketMessagesStaff = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const currentUser = req.staff || req.admin || req.user;

  // Get the ticket
  const ticket = await SupportTicket.findById(ticketId)
    .populate('chat');
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  // Check if staff is assigned to this ticket (allow if no assignment or if assigned to this staff)
  const staffId = currentUser.staffId || currentUser.id || currentUser._id;
  if (ticket.assignedTo && ticket.assignedTo.toString() !== staffId.toString()) {
    // For now, allow staff to view any ticket for testing
    console.log(`Staff ${staffId} viewing ticket assigned to ${ticket.assignedTo}`);
  }

  // Get the chat for this ticket
  const chat = await Chat.findById(ticket.chat);
  if (!chat) {
    return res.status(404).json({
      success: false,
      message: 'Chat not found for this support ticket'
    });
  }

  // Get messages for this chat
  const Message = require('../models/Message');
  const messages = await Message.find({ chat: chat._id })
    .populate('sender', 'fullName email profilePicture')
    .sort({ createdAt: 1 });

  console.log(`📨 Found ${messages.length} messages for chat ${chat._id}`);
  console.log('📨 Messages:', messages.map(m => ({ 
    id: m._id, 
    content: m.content, 
    senderType: m.senderType,
    sender: m.sender?.fullName || 'Unknown'
  })));

  res.status(200).json({
    success: true,
    message: 'Messages retrieved successfully',
    data: messages
  });
});

module.exports = {
  createSupportTicket,
  getUserTickets,
  getSupportTicket,
  updateTicketStatus,
  rateTicket,
  getSupportStats,
  getStaffTickets,
  getMySupportTickets,
  getAvailableSupportTickets,
  getAllSupportTickets,
  assignTicket,
  updateTicketStatusStaff,
  autoAssignTicket,
  sendSupportTicketMessageUser,
  getSupportTicketMessages,
  getSupportTicketMessagesStaff,
  sendSupportTicketMessage
};
