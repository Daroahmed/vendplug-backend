const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protectAdmin, checkPermission, checkAnyPermission } = require('../middleware/adminAuth');
const upload = require('../middleware/uploadMiddleware');

// Public admin routes (no authentication required)
router.post('/login', adminController.adminLogin);

// Protected admin routes (authentication required)
router.use(protectAdmin);

// Dashboard overview
router.get('/dashboard', checkPermission('analytics'), adminController.getDashboardOverview);

// User management
router.get('/users', checkPermission('userManagement'), adminController.getAllUsers);
router.put('/users/status', checkPermission('userManagement'), adminController.updateUserStatus);

// Order management
router.get('/orders', checkPermission('orderManagement'), adminController.getAllOrders);

// Payout management
router.get('/payouts', checkPermission('payoutManagement'), adminController.getPayoutManagement);
router.put('/payouts/status', checkPermission('payoutManagement'), adminController.updatePayoutStatus);

// Dispute management
router.get('/disputes', checkPermission('disputeManagement'), adminController.getDisputeManagement);
router.put('/disputes/:disputeId/assign', checkPermission('disputeManagement'), adminController.assignDispute);
router.put('/disputes/:disputeId/resolve', checkPermission('disputeManagement'), adminController.resolveDispute);

// Staff management
router.get('/staff', checkPermission('userManagement'), adminController.getAllStaff);
router.post('/staff', checkPermission('userManagement'), adminController.createStaff);
router.put('/staff/:staffId', checkPermission('userManagement'), adminController.updateStaff);
router.get('/staff/:staffId/activity', checkPermission('analytics'), adminController.getStaffActivity);
router.get('/staff/available', checkPermission('disputeAssignment'), adminController.getAvailableStaff);
router.post('/staff/bulk-import', checkPermission('userManagement'), upload.single('csvFile'), adminController.bulkImportStaff);

// Auto assignment management
router.get('/assignment/stats', checkPermission('analytics'), adminController.getAssignmentStats);
router.post('/disputes/:disputeId/auto-assign', checkPermission('disputeAssignment'), adminController.autoAssignDispute);
router.post('/assignment/rebalance', checkPermission('disputeAssignment'), adminController.rebalanceAssignments);
router.post('/assignment/toggle', checkPermission('disputeAssignment'), adminController.toggleAutoAssignment);

module.exports = router;
