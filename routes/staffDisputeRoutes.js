// backend/routes/staffDisputeRoutes.js
const express = require('express');
const router = express.Router();
const staffDisputeController = require('../controllers/staffDisputeController');
const { protectAdmin, checkPermission } = require('../middleware/adminAuth');

// All routes require admin authentication
router.use(protectAdmin);

// Staff dispute management routes
router.get('/my-disputes', checkPermission('disputeResolution'), staffDisputeController.getStaffDisputes);
router.get('/dispute/:disputeId', checkPermission('disputeResolution'), staffDisputeController.getDisputeDetails);
router.post('/dispute/:disputeId/message', checkPermission('disputeResolution'), staffDisputeController.addDisputeMessage);
router.put('/dispute/:disputeId/status', checkPermission('disputeResolution'), staffDisputeController.updateDisputeStatus);
router.post('/dispute/:disputeId/resolve', checkPermission('disputeResolution'), staffDisputeController.resolveDispute);

// Staff analytics
router.get('/analytics', checkPermission('analytics'), staffDisputeController.getStaffAnalytics);

// Manager-only routes (dispute assignment)
router.get('/available-disputes', checkPermission('disputeAssignment'), staffDisputeController.getAvailableDisputes);
router.post('/dispute/:disputeId/assign', checkPermission('disputeAssignment'), staffDisputeController.assignDispute);

module.exports = router;
