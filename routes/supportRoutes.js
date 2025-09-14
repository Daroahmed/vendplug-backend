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
  assignTicket,
  updateTicketStatusStaff
} = require('../controllers/supportController');
const { protectAnyUser } = require('../middleware/authMiddleware');
const { protectStaff } = require('../middleware/staffAuth');

// User support routes
router.post('/tickets', protectAnyUser, createSupportTicket);
router.get('/tickets', protectAnyUser, getUserTickets);
router.get('/tickets/:ticketId', protectAnyUser, getSupportTicket);
router.put('/tickets/:ticketId/status', protectAnyUser, updateTicketStatus);
router.post('/tickets/:ticketId/rate', protectAnyUser, rateTicket);

// Staff support routes
router.get('/stats', protectStaff, getSupportStats);
router.get('/staff/tickets', protectStaff, getStaffTickets);
router.put('/staff/tickets/:ticketId/assign', protectStaff, assignTicket);
router.put('/staff/tickets/:ticketId/status', protectStaff, updateTicketStatusStaff);

module.exports = router;
