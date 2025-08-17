const express = require("express");
const router = express.Router();
const {
  getPayoutQueue,
  getReadyForPayout,
  requestPayout,
  getPayoutHistory
} = require("../controllers/payoutController");
const { protectVendor } = require("../middleware/authMiddleware");

// 📌 Vendor Payout Flow
router.get("/queue", protectVendor, getPayoutQueue);
router.get("/ready", protectVendor, getReadyForPayout);
router.put("/request/:payoutId", protectVendor, requestPayout);
router.get("/history", protectVendor, getPayoutHistory);

module.exports = router;
