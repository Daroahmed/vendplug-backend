// controllers/buyerOrderController.js
const asyncHandler = require("express-async-handler");
const VendorOrder = require('../models/vendorOrderModel');
const Payout = require('../models/payoutModel');
const Notification = require('../models/Notification');
const { notifyUser, handleError } = require('../utils/orderHelpers');

// Fetch all orders for the logged-in buyer
const getBuyerVendorOrders = async (req, res) => {
  try {
    const buyerId = req.user._id;

    const orders = await VendorOrder.find({ buyer: buyerId })
      .populate("vendor", "shopName")
      .populate("items.product", "name price") 
      .sort({ createdAt: -1 });

    if (!orders.length) {
      return res.json([]);
    }

    const formatted = orders.map(order => ({
      _id: order._id,
      vendor: order.vendor?.shopName || "Unknown Vendor",
      status: order.status,
      createdAt: order.createdAt,
      deliveryLocation: order.deliveryLocation,
      totalAmount: order.totalAmount,
      products: order.items.map(i => ({
        name: i.product?.name || "Unknown Product",
        price: i.price || i.product?.price || 0,
        quantity: i.quantity
      }))
    }));

    res.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching buyer vendor orders:", error);
    res.status(500).json({ message: "Error fetching vendor orders" });
  }
};

// Get single buyer vendor order by ID
const getBuyerOrderDetails = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const orderId = req.params.id;

    const order = await VendorOrder.findOne({
      _id: orderId,
      buyer: buyerId
    })
      .populate("vendor", "shopName")
      .populate("items.product", "name price description image");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const formatted = {
      _id: order._id,
      vendor: order.vendor?.shopName || "Unknown Vendor",
      status: order.status,
      createdAt: order.createdAt,
      deliveryLocation: order.deliveryLocation,
      totalAmount: order.totalAmount,
      products: order.items.map(i => ({
        name: i.product?.name || "Unknown Product",
        description: i.product?.description || "",
        image: i.product?.image || null,
        price: i.price || i.product?.price || 0,
        quantity: i.quantity
      }))
    };

    res.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching buyer vendor order details:", error);
    res.status(500).json({ message: "Error fetching order details" });
  }
};

// Cancel an order (only if pending)
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const buyerId = req.user._id;
    const order = await VendorOrder.findOne({ _id: id, buyer: buyerId });

    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!['pending', 'accepted'].includes(order.status)) {
      return res.status(400).json({ message: 'Only pending or accepted orders can be cancelled' });
    }

    order.status = 'cancelled';
    await order.save();

    const io = req.app.get('io');

    // Notify agents/vendors
    if (order.agent) {
      await notifyUser(io, order.agent, 'Agent', `❌ Order Cancelled`, `Buyer cancelled order #${order._id}`, order._id);
    }
    if (order.vendor) {
      await notifyUser(io, order.vendor, 'Vendor', `❌ Order Cancelled`, `Buyer cancelled order #${order._id}`, order._id);
    }

    await notifyUser(io, buyerId, 'Buyer', `🛑 Order Cancelled`, `You cancelled order #${order._id}`, order._id);

    res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    handleError(res, error, 'Error cancelling order');
  }
};

// Track order status
const trackOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const buyerId = req.user._id;
    const order = await VendorOrder.findOne({ _id: id, buyer: buyerId });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    res.json({ orderId: order._id, status: order.status });
  } catch (error) {
    handleError(res, error, 'Error tracking order');
  }
};

// ✅ Confirm receipt & release escrow
const confirmReceipt = asyncHandler(async (req, res) => {
  const buyerId = req.user._id; // ✅ fixed
  const { orderId } = req.params;

  const order = await VendorOrder.findById(orderId).populate("vendor");

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // ✅ Make sure buyer owns this order
  if (order.buyer.toString() !== buyerId.toString()) {
    res.status(403);
    throw new Error("Not authorized to confirm this order");
  }

  // ✅ Ensure status is correct
  if (order.status !== "delivered") {
    res.status(400);
    throw new Error("Order cannot be confirmed yet");
  }

  // ✅ Update order status
  order.status = "delivered";
  order.deliveredAt = Date.now();
  await order.save();

    
    // ✅ Check if payout already exists
let payout = await Payout.findOne({ order: order._id });

if (!payout) {
  payout = await Payout.create({
    vendor: order.vendor._id,
    order: order._id,
    buyer: order.buyer,
    amount: order.totalAmount,
    status: "ready_for_payout"   // 🔥 move directly to payout stage
  });
} else {
  // 🔥 If payout already exists, update it
  payout.status = "ready_for_payout";
  await payout.save();
}
  

  // ✅ Notify vendor
  const io = req.app.get('io');
  await notifyUser(
    io,
    order.vendor._id,
    'Vendor',
    'Order Payment Released',
    `Buyer confirmed delivery for order #${order._id}. ₦${order.totalAmount} is now available for payout.`,
    order._id
  );

  res.json({
    success: true,
    message: "Delivery confirmed. Funds moved to vendor payout queue.",
    order,
    payout
  });
});

const getBuyerOrderHistory = async (req, res) => {
  try {
    const buyerId = req.user._id;

    // Fetch only completed/closed orders
    const orders = await VendorOrder.find({
      buyer: buyerId,
      status: { $in: ["delivered", "cancelled", "rejected"] },
    })
      .populate("vendor", "shopName")
      .populate("items.product", "name price")
      .populate([
        { path: "order", select: "totalAmount createdAt status buyer" },
        { path: "vendor", select: "shopName email" }
      ])
      .sort({ createdAt: -1 });

    const formatted = orders.map(order => ({
      _id: order._id,
      vendor: order.vendor?.shopName || "Unknown Vendor",
      status: order.status,
      createdAt: order.createdAt,
      deliveredAt: order.deliveredAt || null,
      totalAmount: order.totalAmount,
      deliveryLocation: order.deliveryLocation,
      products: order.items.map(i => ({
        name: i.product?.name || "Unknown Product",
        price: i.price || i.product?.price || 0,
        quantity: i.quantity,
      })),
    }));

    res.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching buyer order history:", error);
    res.status(500).json({ message: "Error fetching order history" });
  }
};



module.exports = {
  getBuyerVendorOrders,
  getBuyerOrderDetails,
  cancelOrder,
  trackOrder,
  confirmReceipt,
  getBuyerOrderHistory
  
};
