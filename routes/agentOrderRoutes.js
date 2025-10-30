// backend/routes/agentOrderRoutes.js
const express = require("express");
const { protectAgent } = require("../middleware/authMiddleware");
const {
  getAgentOrders,
  acceptOrder,
  rejectOrder,
  updateOrderStatus
} = require("../controllers/agentOrderController");
const { dashboardLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// List agent orders (optional ?status=pending|accepted|... )
// Dashboard endpoints are polled frequently, so they need lenient rate limiting
router.get("/", dashboardLimiter, protectAgent, getAgentOrders);

// Accept / Reject
router.post("/:orderId/accept", protectAgent, acceptOrder);
router.post("/:orderId/reject", protectAgent, rejectOrder);

// Status updates
router.post("/:orderId/status", protectAgent, updateOrderStatus);

module.exports = router;
