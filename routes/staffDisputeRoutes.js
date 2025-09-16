const express = require('express');
const router = express.Router();
const { 
  getStaffDisputeStats, 
  getMyDisputes, 
  getAvailableDisputes,
  getDisputeDetails, 
  startReview, 
  resolveDispute, 
  addMessage,
  escalateDispute,
  requestInfo,
  updatePriority,
  addInternalNote,
  getInternalNotes,
  contactParties
} = require('../controllers/staffDisputeController');
const { protectStaff } = require('../middleware/staffAuth');

// All routes are protected
router.use(protectStaff);

// Dispute statistics
router.get('/disputes/stats', getStaffDisputeStats);

// Get staff's assigned disputes
router.get('/disputes/my', getMyDisputes);

// Get available disputes (unassigned)
router.get('/disputes/available', getAvailableDisputes);

// Get specific dispute details
router.get('/disputes/:disputeId', getDisputeDetails);

// Start reviewing a dispute
router.put('/disputes/:disputeId/start-review', startReview);

// Resolve a dispute
router.put('/disputes/:disputeId/resolve', resolveDispute);

// Add message to dispute
router.post('/disputes/:disputeId/message', addMessage);

// Escalate dispute
router.post('/disputes/:disputeId/escalate', escalateDispute);

// Request additional information
router.post('/disputes/:disputeId/request-info', requestInfo);

// Update priority
router.put('/disputes/:disputeId/priority', updatePriority);

// Internal notes
router.get('/disputes/:disputeId/internal-notes', getInternalNotes);
router.post('/disputes/:disputeId/internal-notes', addInternalNote);

// Contact parties
router.post('/disputes/:disputeId/contact', contactParties);

module.exports = router;