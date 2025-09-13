// backend/routes/agentCheckoutRoutes.js
const express = require("express");
const { protectBuyer } = require("../middleware/authMiddleware");
const { checkoutCart } = require("../controllers/agentCheckoutController");

const router = express.Router();

router.post("/", protectBuyer, checkoutCart);

module.exports = router;
