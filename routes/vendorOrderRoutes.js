// backend/routes/vendorOrderRoutes.js
const express = require("express");
const { protectVendor } = require("../middleware/authMiddleware");
const {
  getVendorOrders,
  acceptOrder,
  rejectOrder,
  updateOrderStatus
} = require("../controllers/vendorOrderController");

const router = express.Router();

// List vendor orders (optional ?status=pending|accepted|... )
router.get("/", protectVendor, getVendorOrders);

// Accept / Reject
router.post("/:orderId/accept", protectVendor, acceptOrder);
router.post("/:orderId/reject", protectVendor, rejectOrder);

// Status updates
router.post("/:orderId/status", protectVendor, updateOrderStatus);

module.exports = router;
