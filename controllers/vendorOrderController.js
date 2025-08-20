// controllers/vendorOrderController.js
const Order = require("../models/vendorOrderModel");
const Payout = require("../models/payoutModel"); // ✅ Import Payout model
const {
  handleError,
  notifyUser,
  processRefund,
  applyVendorOrderStatus
} = require("../utils/orderHelpers");

// Helper to send buyer + vendor notifications
const sendOrderNotifications = async (req, order, buyerMsg, vendorMsg) => {
  try {
    const io = req.app.get("io");
    if (buyerMsg) {
      await notifyUser(io, order.buyer, "Buyer", buyerMsg.title, buyerMsg.body, order._id);
    }
    if (vendorMsg) {
      await notifyUser(io, order.vendor, "Vendor", vendorMsg.title, vendorMsg.body, order._id);
    }
  } catch (err) {
    console.error("❌ Notification error:", err.message);
  }
};

// ===============================
// Get all vendor orders
// ===============================
const getVendorOrders = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    const query = { vendor: req.vendor._id };

    if (status) {
      query.status = status;
    } else {
      // Default filter for incoming orders
      query.status = { $in: ["pending", "accepted", "preparing", "out_for_delivery"] };
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const orders = await Order.find(query)
      .populate("buyer", "fullName phoneNumber email")
      .populate("items.product", "name image price")
      .sort({ createdAt: -1 });

    const formatted = orders.map(order => ({
      _id: order._id,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      buyer: order.buyer
        ? {
            fullName: order.buyer.fullName,
            phoneNumber: order.buyer.phoneNumber,
            email: order.buyer.email,
          }
        : null,
      deliveryAddress: order.deliveryAddress || "No address provided",
      items: order.items.map(i => ({
        name: i.product?.name || "Unknown",
        image: i.product?.image || null,
        price: i.product?.price || 0,
        quantity: i.quantity,
      })),
    }));

    res.json(formatted);
  } catch (error) {
    handleError(res, error, "Error fetching vendor orders");
  }
};

// ===============================
// Accept Order
// ===============================
const acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ _id: orderId, vendor: req.vendor._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "pending") {
      return res.status(400).json({ message: "Only pending orders can be accepted" });
    }

    applyVendorOrderStatus(order, "accepted", "vendor");
    await order.save();

    // ✅ Create payout record
    await Payout.create({
      vendor: order.vendor,
      order: order._id,
      amount: order.totalAmount,
      status: "pending_receipt"
    });

    await sendOrderNotifications(
      req,
      order,
      { title: "✅ Order Accepted", body: `Your order #${order._id} has been accepted.` },
      { title: "📦 Order Accepted", body: `You accepted order #${order._id}.` }
    );

    res.json({ message: "Order accepted", order });
  } catch (error) {
    handleError(res, error, "Error accepting order");
  }
};

// ===============================
// Reject Order
// ===============================
const rejectOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ _id: orderId, vendor: req.vendor._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "pending") {
      return res.status(400).json({ message: "Only pending orders can be rejected" });
    }

    // Refund buyer
    await processRefund(order.buyer, order.totalAmount, order._id);

    applyVendorOrderStatus(order, "rejected", "vendor", { escrow: false });
    await order.save();

    await sendOrderNotifications(
      req,
      order,
      { title: "❌ Order Rejected", body: `Your order #${order._id} was rejected. Refund issued.` },
      { title: "🛑 Order Rejected", body: `You rejected order #${order._id}.` }
    );

    res.json({ message: "Order rejected and refunded", order });
  } catch (error) {
    handleError(res, error, "Error rejecting order");
  }
};

// ===============================
// Generic Update Order Status
// ===============================
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const allowed = ["accepted", "rejected", "preparing", "out_for_delivery", "delivered"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findOne({ _id: orderId, vendor: req.vendor._id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Validate transitions
    const validFrom = {
      accepted: ["pending"],
      rejected: ["pending"],
      preparing: ["accepted", "preparing"],
      out_for_delivery: ["preparing", "out_for_delivery"],
      delivered: ["out_for_delivery", "delivered"]
    };
    if (!validFrom[status].includes(order.status)) {
      return res.status(400).json({ message: `Cannot move from ${order.status} to ${status}` });
    }

    // Special handling
    if (status === "accepted") {
      await Payout.create({
        vendor: order.vendor,
        order: order._id,
        amount: order.totalAmount,
        status: "pending_receipt"
      });
    }
    if (status === "rejected") {
      await processRefund(order.buyer, order.totalAmount, order._id);
    }

    applyVendorOrderStatus(order, status, "vendor");
    if (status === "delivered") order.deliveredAt = new Date();
    await order.save();

    await sendOrderNotifications(
      req,
      order,
      { title: "🚚 Order Update", body: `Your order #${order._id} is now "${status}".` },
      { title: "📦 Vendor Update", body: `You marked order #${order._id} as "${status}".` }
    );

    res.json({ message: "Order status updated", order });
  } catch (error) {
    handleError(res, error, "Error updating order status");
  }
};

module.exports = {
  getVendorOrders,
  acceptOrder,
  rejectOrder,
  updateOrderStatus
};
