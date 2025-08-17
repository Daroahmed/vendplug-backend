// controllers/vendorOrderController.js
const Order = require("../models/vendorOrderModel");
const {
  handleError,
  notifyUser,
  processRefund,
  applyVendorOrderStatus
} = require("../utils/orderHelpers");

// Helper to send buyer + vendor notifications
const sendOrderNotifications = async (req, order, buyerMsg, vendorMsg) => {
  const io = req.app.get("io");
  await notifyUser(io, order.buyer, "Buyer", buyerMsg.title, buyerMsg.body, order._id);
  await notifyUser(io, order.vendor, "Vendor", vendorMsg.title, vendorMsg.body, order._id);
};

const getVendorOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { vendor: req.vendor._id };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate("buyer", "name phone")
      .populate("items.product", "name image");

    res.json(orders);
  } catch (error) {
    handleError(res, error, "Error fetching vendor orders");
  }
};

const acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ _id: orderId, vendor: req.vendor._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "pending") return res.status(400).json({ message: "Only pending orders can be accepted" });

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
      { title: "✅ Order Accepted", body: `Your order #${order._id} has been accepted by the vendor.` },
      { title: "📦 You accepted an order", body: `Order #${order._id} has been marked as accepted.` }
    );

    res.json({ message: "Order accepted", order });
  } catch (error) {
    handleError(res, error, "Error accepting order");
  }
};

const rejectOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ _id: orderId, vendor: req.vendor._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "pending") return res.status(400).json({ message: "Only pending orders can be rejected" });

    await processRefund(order.buyer, order.totalAmount, order._id);

    applyVendorOrderStatus(order, "rejected", "vendor", { escrow: false });
    await order.save();

    await sendOrderNotifications(
      req,
      order,
      { title: "❌ Order Rejected", body: `Your order #${order._id} was rejected. A refund has been issued.` },
      { title: "🛑 Order Rejected", body: `You rejected order #${order._id} and refunded the buyer.` }
    );

    res.json({ message: "Order rejected and refunded to buyer", order });
  } catch (error) {
    handleError(res, error, "Error rejecting order");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const allowed = ["preparing", "out_for_delivery", "delivered"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const order = await Order.findOne({ _id: orderId, vendor: req.vendor._id });
    if (!order) return res.status(404).json({ message: "Order not found" });

    const validFrom = {
      preparing: ["accepted", "preparing"],
      out_for_delivery: ["preparing", "out_for_delivery"],
      delivered: ["out_for_delivery", "delivered"]
    };
    if (!validFrom[status].includes(order.status)) {
      return res.status(400).json({ message: `Cannot move from ${order.status} to ${status}` });
    }

    applyVendorOrderStatus(order, status, "vendor");
    if (status === "delivered") order.deliveredAt = new Date();
    await order.save();

    await sendOrderNotifications(
      req,
      order,
      { title: "🚚 Order Status Update", body: `Your order #${order._id} is now "${status}".` },
      { title: "📦 Order Status Updated", body: `You marked order #${order._id} as "${status}".` }
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
