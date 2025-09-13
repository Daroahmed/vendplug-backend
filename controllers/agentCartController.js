// backend/controllers/agentCartController.js
const Cart = require("../models/AgentCart");
const Product = require("../models/AgentProduct");

// Helper: standard populate
const cartPopulateOptions = [
  { path: "items.product", model: "AgentProduct" },
  { path: "items.agent", model: "Agent", select: "businessName email phone" },
];

// ✅ Normalizer for consistent agent response
const normalizeCartItems = (items) =>
  items.map((item) => ({
    _id: item._id,
    product: item.product,
    agent: item.agent
      ? {
          _id: item.agent._id,
          name: item.agent.businessName, // normalize
          email: item.agent.email,
          phone: item.agent.phone,
        }
      : null,
    quantity: item.quantity,
    price: item.price,
  }));

// ========================
// GET CART
// ========================
const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ buyer: req.buyer._id });
    if (!cart) {
      return res.json({ items: [] });
    }

    await cart.populate([
      { path: "items.product", model: "AgentProduct" },
      { path: "items.agent", select: "fullName businessName", model: "Agent" },
    ]);

    res.json({
      items: cart.items.map(item => ({
        ...item.toObject(),
        agentName: item.agent ? item.agent.businessName || item.agent.fullName : "Unknown Agent",
      })),
      updatedAt: cart.updatedAt,
    });
  } catch (error) {
    console.error("❌ getCart error:", error);
    res.status(500).json({ message: error.message });
  }
};


// ========================
// ADD TO CART
// ========================
const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId).populate("agent");
    if (!product) return res.status(404).json({ message: "Product not found" });

    let cart = await Cart.findOne({ buyer: req.buyer._id });
    if (!cart) {
      cart = new Cart({ buyer: req.buyer._id, items: [] });
    }

    const existingItem = cart.items.find(
      (i) => i.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        product: product._id,
        agent: product.agent._id, // ✅ always store agent
        quantity,
        price: product.price, // snapshot
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    await cart.populate(cartPopulateOptions);

    res.json({
      items: normalizeCartItems(cart.items),
      updatedAt: cart.updatedAt,
    });
  } catch (error) {
    console.error("❌ addToCart error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ========================
// UPDATE ITEM QUANTITY
// ========================
const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    const cart = await Cart.findOne({ buyer: req.buyer._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.find((i) => i.product.toString() === productId);
    if (!item) return res.status(404).json({ message: "Item not found in cart" });

    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => i.product.toString() !== productId);
    } else {
      item.quantity = quantity;
    }

    cart.updatedAt = Date.now();
    await cart.save();

    await cart.populate(cartPopulateOptions);

    res.json({
      items: normalizeCartItems(cart.items),
      updatedAt: cart.updatedAt,
    });
  } catch (error) {
    console.error("❌ updateCartItem error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ========================
// REMOVE FROM CART
// ========================
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ buyer: req.buyer._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.items = cart.items.filter((i) => i.product.toString() !== productId);

    cart.updatedAt = Date.now();
    await cart.save();

    await cart.populate(cartPopulateOptions);

    res.json({
      items: normalizeCartItems(cart.items),
      updatedAt: cart.updatedAt,
    });
  } catch (error) {
    console.error("❌ removeFromCart error:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
};
