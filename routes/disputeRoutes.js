const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  createDispute,
  getUserDisputes,
  getDisputeDetails,
  addMessage,
  addEvidence,
  getAllDisputes,
  assignDispute,
  resolveDispute
} = require('../controllers/disputeController');

// Import proper middleware
const { protectAnyUser } = require('../middleware/authMiddleware');
const { protectAdmin } = require('../middleware/adminAuth');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  }
});

// User routes (require user authentication)
router.post('/create', protectAnyUser, upload.array('evidence', 5), createDispute);
router.get('/my-disputes', protectAnyUser, getUserDisputes);
router.get('/:disputeId', protectAnyUser, getDisputeDetails);
router.post('/:disputeId/message', protectAnyUser, addMessage);
router.post('/:disputeId/evidence', protectAnyUser, upload.array('evidence', 5), addEvidence);

// Admin routes (require admin authentication)
router.get('/admin/all', protectAdmin, getAllDisputes);
router.get('/admin/:disputeId', protectAdmin, getDisputeDetails);
router.put('/admin/:disputeId/assign', protectAdmin, assignDispute);
router.put('/admin/:disputeId/resolve', protectAdmin, resolveDispute);

module.exports = router;
