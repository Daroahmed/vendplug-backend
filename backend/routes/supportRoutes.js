const express = require('express');
const router = express.Router();
const {
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
  sendSupportTicketMessageUser,
  getSupportTicketMessages,
  getSupportTicketMessagesStaff,
  sendSupportTicketMessage
} = require('../controllers/supportController');
const { protectAnyUser } = require('../middleware/authMiddleware');
const { protectStaff } = require('../middleware/staffAuth');
const { protectAdmin } = require('../middleware/adminAuth');

// User support routes
router.post('/tickets', protectAnyUser, createSupportTicket);
router.get('/tickets', protectAnyUser, getUserTickets);
router.get('/tickets/:ticketId', protectAnyUser, getSupportTicket);
router.put('/tickets/:ticketId/status', protectAnyUser, updateTicketStatus);
router.post('/tickets/:ticketId/rate', protectAnyUser, rateTicket);
router.get('/tickets/:ticketId/messages', protectAnyUser, getSupportTicketMessages);
router.post('/tickets/:ticketId/message', protectAnyUser, sendSupportTicketMessageUser);

// Admin support routes
router.get('/admin/tickets', protectAdmin, getAllSupportTickets);
router.get('/admin/tickets/:ticketId', protectAdmin, getSupportTicket);
router.put('/admin/tickets/:ticketId/assign', protectAdmin, assignTicket);
router.put('/admin/tickets/:ticketId/status', protectAdmin, updateTicketStatusStaff);

// Staff support routes
router.get('/stats', protectStaff, getSupportStats);
router.get('/staff/tickets', protectStaff, getStaffTickets);
router.get('/staff/tickets/my', protectStaff, getMySupportTickets);
router.get('/staff/tickets/available', protectStaff, getAvailableSupportTickets);
router.get('/staff/tickets/:ticketId', protectStaff, getSupportTicket);
router.get('/staff/tickets/:ticketId/messages', protectStaff, getSupportTicketMessagesStaff);
router.put('/staff/tickets/:ticketId/assign', protectStaff, assignTicket);
router.put('/staff/tickets/:ticketId/status', protectStaff, updateTicketStatusStaff);
router.post('/staff/tickets/:ticketId/message', protectStaff, sendSupportTicketMessage);

module.exports = router;
