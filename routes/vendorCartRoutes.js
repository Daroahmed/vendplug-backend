// backend/routes/vendorCartRoutes.js
const express = require("express");
const { protectBuyer } = require("../middleware/authMiddleware");
const { getCart, addToCart, updateCartItem, removeFromCart } = require("../controllers/vendorCartController");

const router = express.Router();

router.get("/", protectBuyer, getCart);
router.post("/", protectBuyer, addToCart);
router.put("/", protectBuyer, updateCartItem);
router.delete("/:productId", protectBuyer, removeFromCart);

module.exports = router;
