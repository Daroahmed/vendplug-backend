// backend/routes/agentCartRoutes.js
const express = require("express");
const { protectBuyer } = require("../middleware/authMiddleware");
const { getCart, addToCart, updateCartItem, removeFromCart } = require("../controllers/agentCartController");

const router = express.Router();

router.get("/", protectBuyer, getCart);
router.post("/", protectBuyer, addToCart);
router.put("/", protectBuyer, updateCartItem);
router.delete("/:productId", protectBuyer, removeFromCart);

module.exports = router;
