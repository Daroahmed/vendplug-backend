// backend/routes/vendorOrderRoutes.js
const express = require("express");
const { protectVendor } = require("../middleware/authMiddleware");
const {
  getVendorOrders,
  acceptOrder,
  rejectOrder,
  updateOrderStatus
} = require("../controllers/vendorOrderController");
const { dashboardLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// List vendor orders (optional ?status=pending|accepted|... )
// Dashboard endpoints are polled frequently, so they need lenient rate limiting
router.get("/", dashboardLimiter, protectVendor, getVendorOrders);

// Accept / Reject
router.post("/:orderId/accept", protectVendor, acceptOrder);
router.post("/:orderId/reject", protectVendor, rejectOrder);

// Status updates
router.post("/:orderId/status", protectVendor, updateOrderStatus);

module.exports = router;
