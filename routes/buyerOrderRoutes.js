// routes/buyerOrderRoutes.js
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

// Mount under /api/buyer-orders
router.get('/', protectBuyer, getBuyerVendorOrders);
router.get('/:id', protectBuyer, getBuyerOrderDetails);
router.put('/:id/cancel', protectBuyer, cancelOrder);
router.get('/:id/track', protectBuyer, trackOrder);
router.put('/:orderId/confirm', protectBuyer, confirmReceipt);

// ✅ Extra alias so frontend /api/orders/:id still works
router.get('/api/orders/:id', protectBuyer, getBuyerOrderDetails);
router.put('/api/orders/:orderId/confirm', protectBuyer, confirmReceipt);

module.exports = router;
