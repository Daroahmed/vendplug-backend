const express = require('express');
const router = express.Router();
const {
  getBuyerVendorOrders,
  getBuyerOrderDetails,
  cancelOrder,
  trackOrder,
  confirmReceipt
} = require('../controllers/buyerOrderController');
const { protectBuyer } = require('../middleware/authMiddleware');

// Base: /api/buyer-orders

// Get all buyer orders
router.get('/', protectBuyer, getBuyerVendorOrders);

// Get details of one order
router.get('/:id', protectBuyer, getBuyerOrderDetails);

// Cancel order
router.put('/:id/cancel', protectBuyer, cancelOrder);

// Track order
router.get('/:id/track', protectBuyer, trackOrder);

// ✅ Confirm receipt (buyer confirms delivery)
router.put('/:orderId/confirm', protectBuyer, confirmReceipt);

module.exports = router;
