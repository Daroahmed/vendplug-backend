// backend/routes/orderRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAgentOrders,
  getAgentOrderHistory,
  getBuyerOrders,
  createOrder,
  updateOrderStatus
} = require('../controllers/orderController');

const { protectAgent, protectBuyer } = require('../middleware/authMiddleware');

// ✅ AGENT Routes
router.get('/agent', protectAgent, getAgentOrders);
router.get('/agent/history', protectAgent, getAgentOrderHistory);

// ✅ BUYER Routes
router.get('/buyer', protectBuyer, getBuyerOrders);
router.post('/', protectBuyer, createOrder);  // Submitting a new order

// ✅ AGENT Order actions
router.put('/:orderId/status', protectAgent, updateOrderStatus);

module.exports = router;
