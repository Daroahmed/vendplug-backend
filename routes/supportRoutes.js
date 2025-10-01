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
const { protectSupportStaff } = require('../middleware/supportAuth');
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
router.get('/stats', protectSupportStaff, getSupportStats);
router.get('/staff/tickets', protectSupportStaff, getStaffTickets);
router.get('/staff/tickets/my', protectSupportStaff, getMySupportTickets);
router.get('/staff/tickets/available', protectSupportStaff, getAvailableSupportTickets);
router.get('/staff/tickets/:ticketId', protectSupportStaff, getSupportTicket);
router.get('/staff/tickets/:ticketId/messages', protectSupportStaff, getSupportTicketMessagesStaff);
router.put('/staff/tickets/:ticketId/assign', protectSupportStaff, assignTicket);
router.put('/staff/tickets/:ticketId/status', protectSupportStaff, updateTicketStatusStaff);
router.post('/staff/tickets/:ticketId/message', protectSupportStaff, sendSupportTicketMessage);

module.exports = router;
