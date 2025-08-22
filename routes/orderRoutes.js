// backend/routes/orderRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAgentOrders,
  getAgentOrderHistory,
  createOrder,
  updateOrderStatus
} = require('../controllers/agentOrderController');

const { protectAgent, } = require('../middleware/authMiddleware');

// ✅ AGENT Routes
router.get('/agent', protectAgent, getAgentOrders);
router.get('/agent/history', protectAgent, getAgentOrderHistory);
router.put('/:orderId/status', protectAgent, updateOrderStatus);

module.exports = router;
