const express = require('express');
const router = express.Router();
const { getCommissionAnalytics, getOrderCommission } = require('../controllers/commissionController');
const { protectAdmin } = require('../middleware/adminAuth');

// Get commission analytics (admin only)
router.get('/analytics', protectAdmin, getCommissionAnalytics);

// Get commission details for specific order (admin only)
router.get('/order/:orderId', protectAdmin, getOrderCommission);

module.exports = router;
