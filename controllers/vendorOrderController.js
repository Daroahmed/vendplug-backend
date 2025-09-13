// controllers/vendorOrderController.js
const mongoose = require("mongoose");
const Vendor = require("../models/vendorModel");
const Order = require("../models/vendorOrderModel");
const Payout = require("../models/payoutModel"); // ✅ Import Payout model
const Wallet = require("../models/walletModel");
const Transaction = require("../models/Transaction");
const {
  handleError,
  processRefund,
  applyVendorOrderStatus
} = require("../utils/orderHelpers");
const {
  sendNotification,
  sendOrderStatusNotification,
  sendPayoutNotification,
  sendWalletNotification
} = require('../utils/notificationHelper');
const { incrementVendorTransactions } = require('../utils/transactionHelper');

// This helper is replaced by the new notification system

// ===============================
// Get all vendor orders
// ===============================
const getVendorOrders = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    const query = { vendor: req.vendor._id };

    if (status) {
      if (status === "delivered") {
        // For delivered orders, include both delivered and fulfilled
        query.status = { $in: ["delivered", "fulfilled"] };
      } else {
        query.status = status;
      }
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
      .populate("buyer", "_id fullName phoneNumber email")
      .populate("items.product", "name image price")
      .sort({ createdAt: -1 });

    const formatted = orders.map(order => ({
      _id: order._id,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      buyer: order.buyer
        ? {
            _id: order.buyer._id,
            fullName: order.buyer.fullName,
            phoneNumber: order.buyer.phoneNumber,
            email: order.buyer.email,
          }
        : null,
      deliveryAddress: order.deliveryLocation || "No address provided",
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

    // Don't credit vendor wallet yet - wait for delivery confirmation

    // ✅ Create payout record
    await Payout.create({
      vendor: order.vendor,
      order: order._id,
      amount: order.totalAmount,
      status: "pending_receipt"
    });

    const io = req.app.get('io');
    await sendOrderStatusNotification(io, order, 'accepted');
    
    // Send payout notification
    await sendPayoutNotification(io, {
      vendorId: order.vendor,
      amount: order.totalAmount,
      status: 'pending',
      orderId: order._id
    });

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
    const { rejectionReason } = req.body;
    
    if (!rejectionReason || rejectionReason.trim().length < 10) {
      return res.status(400).json({ 
        message: "Rejection reason is required and must be at least 10 characters long" 
      });
    }

    const order = await Order.findOne({ _id: orderId, vendor: req.vendor._id });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "pending") {
      return res.status(400).json({ message: "Only pending orders can be rejected" });
    }

    // Start MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Refund buyer's wallet
      const buyerWallet = await Wallet.findOne({ user: order.buyer, role: 'buyer' }).session(session);
      if (!buyerWallet) {
        throw new Error("Buyer wallet not found");
      }

      // Credit buyer's wallet
      buyerWallet.balance = Number(buyerWallet.balance || 0) + Number(order.totalAmount);
      await buyerWallet.save({ session });

      // Log refund transaction
      await Transaction.create([{
        ref: new mongoose.Types.ObjectId().toString(),
        type: "refund",
        status: "successful",
        amount: order.totalAmount,
        description: `Order rejected: ${rejectionReason}`,
        from: "escrow",
        to: buyerWallet.virtualAccount,
        initiatedBy: req.vendor._id,
        initiatorType: "Vendor"
      }], { session });

      // Update order status with rejection reason
      order.status = "rejected";
      order.rejectionReason = rejectionReason;
      order.rejectedAt = new Date();
      order.statusHistory = [
        ...(order.statusHistory || []),
        { 
          status: "rejected", 
          at: new Date(), 
          by: "vendor",
          reason: rejectionReason
        }
      ];
      await order.save({ session });

      // Commit transaction
      await session.commitTransaction();

      // Send notifications
      const io = req.app.get('io');
      
      // Send order rejection notification with reason
      await sendOrderStatusNotification(io, order, 'rejected', { rejectionReason });
      
      // Send refund notification to buyer
      await sendWalletNotification(io, {
        userId: order.buyer,
        userType: 'Buyer',
        type: 'credit',
        amount: order.totalAmount,
        source: 'Order Refund',
        balance: buyerWallet.balance,
        meta: { 
          orderId: order._id,
          rejectionReason 
        }
      });

      res.json({ 
        success: true,
        message: "Order rejected and refunded successfully", 
        order: {
          _id: order._id,
          status: order.status,
          rejectionReason: order.rejectionReason,
          rejectedAt: order.rejectedAt
        }
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('❌ Error rejecting order:', error);
    res.status(500).json({ 
      message: "Error rejecting order", 
      error: error.message 
    });
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

      try {
        const vendor = await Vendor.findById(req.vendor._id);
        if (vendor) {
          vendor.walletBalance += order.totalAmount;
          await vendor.save();
        }
      } catch (walletError) {
        console.error("Error updating vendor wallet:", walletError);
      }
      // Existing payout creation code
  
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

    // ✅ Increment vendor's total transactions count when order is delivered
    if (status === "delivered") {
      await incrementVendorTransactions(req.vendor._id);
    }

    const io = req.app.get('io');
    await sendOrderStatusNotification(io, order, status);
    
    // Send additional notifications based on status
    if (status === 'delivered') {
      await sendNotification(io, {
        recipientId: order.buyer,
        recipientType: 'Buyer',
        notificationType: 'ORDER_DELIVERED',
        args: [order._id],
        orderId: order._id
      });
    }

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






