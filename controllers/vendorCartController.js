// backend/controllers/vendorCartController.js
const Cart = require("../models/vendorCartModel");
const Product = require("../models/vendorProductModel");

// Helper: standard populate
const cartPopulateOptions = [
  { path: "items.product", model: "VendorProduct" },
  { path: "items.vendor", model: "Vendor", select: "shopName email phone" },
];

// ✅ Normalizer for consistent vendor response
const normalizeCartItems = (items) =>
  items.map((item) => ({
    _id: item._id,
    product: item.product,
    vendor: item.vendor
      ? {
          _id: item.vendor._id,
          name: item.vendor.shopName, // normalize
          email: item.vendor.email,
          phone: item.vendor.phone,
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
      { path: "items.product", model: "VendorProduct" },
      { path: "items.vendor", select: "fullName shopName", model: "Vendor" },
    ]);

    res.json({
      items: cart.items.map(item => ({
        ...item.toObject(),
        vendorName: item.vendor ? item.vendor.shopName || item.vendor.fullName : "Unknown Vendor",
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

    const product = await Product.findById(productId).populate("vendor");
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
        vendor: product.vendor._id, // ✅ always store vendor
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
