const asyncHandler = require('express-async-handler');
const SupportTicket = require('../models/SupportTicket');
const Chat = require('../models/Chat');
const Staff = require('../models/Staff');
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

  // Validate required fields
  if (!category || !subject || !description) {
    return res.status(400).json({
      success: false,
      message: 'Category, subject, and description are required'
    });
  }

  // Create support ticket
  const ticket = await SupportTicket.create({
    requester: currentUser.id,
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
      user: currentUser.id,
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
  await autoAssignTicket(ticket._id);

  // Send notification to staff
  try {
    const io = req.app.get('io');
    const { sendNotification } = require('../utils/notificationHelper');
    
    await sendNotification(io, {
      recipientType: 'Staff',
      notificationType: 'NEW_SUPPORT_TICKET',
      title: 'New Support Ticket',
      message: `New ${priority} priority ticket: ${subject}`,
      metadata: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        category: category,
        priority: priority
      }
    });
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
  
  const skip = (page - 1) * limit;
  let query = {
    requester: currentUser.id,
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
  const currentUser = req.user;

  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    requester: currentUser.id,
    requesterType: currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
  })
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

  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    requester: currentUser.id,
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

  if (!score || score < 1 || score > 5) {
    return res.status(400).json({
      success: false,
      message: 'Score must be between 1 and 5'
    });
  }

  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    requester: currentUser.id,
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
  const currentUser = req.user;

  // Check if user is staff
  if (currentUser.role !== 'staff') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff only.'
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
  const currentUser = req.user;

  // Check if user is staff
  if (currentUser.role !== 'staff') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff only.'
    });
  }

  const { page = 1, limit = 20, status, priority } = req.query;
  const skip = (page - 1) * limit;
  
  let query = { assignedTo: currentUser.id };
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
  const currentUser = req.user;

  // Check if user is staff
  if (currentUser.role !== 'staff') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff only.'
    });
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found'
    });
  }

  const staff = await Staff.findById(staffId);
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
  const currentUser = req.user;

  // Check if user is staff
  if (currentUser.role !== 'staff') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff only.'
    });
  }

  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    assignedTo: currentUser.id
  });

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found or not assigned to you'
    });
  }

  await ticket.updateStatus(status, currentUser.id);

  // Add internal note if provided
  if (internalNote) {
    await ticket.addInternalNote(currentUser.id, internalNote);
  }

  res.json({
    success: true,
    message: 'Ticket status updated successfully'
  });
});

// Helper function to auto-assign tickets
const autoAssignTicket = async (ticketId) => {
  try {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) return;

    // Find available staff with matching specialties
    const availableStaff = await Staff.find({
      isActive: true,
      isAvailable: true,
      supportSpecialties: { $in: [ticket.category] },
      $expr: { $lt: [{ $size: '$supportTickets' }, '$maxTickets'] }
    }).sort({ 'activityStats.lastActivity': 1 });

    if (availableStaff.length > 0) {
      const staff = availableStaff[0];
      await ticket.assignToStaff(staff._id);
      
      // Add ticket to staff's list
      staff.supportTickets.push(ticketId);
      staff.activityStats.lastActivity = new Date();
      await staff.save();
    }
  } catch (error) {
    console.error('Auto-assignment error:', error);
  }
};

module.exports = {
  createSupportTicket,
  getUserTickets,
  getSupportTicket,
  updateTicketStatus,
  rateTicket,
  getSupportStats,
  getStaffTickets,
  assignTicket,
  updateTicketStatusStaff
};
