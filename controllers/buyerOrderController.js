// controllers/buyerOrderController.js
const asyncHandler = require("express-async-handler");
const mongoose = require('mongoose');
const VendorOrder = require('../models/vendorOrderModel');
const Payout = require('../models/payoutModel');
const Notification = require('../models/Notification');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/Transaction');
const { handleError } = require('../utils/orderHelpers');
const { sendOrderStatusNotification, sendPayoutNotification } = require('../utils/notificationHelper');
const { incrementVendorTransactions } = require('../utils/transactionHelper');

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

    // Send cancellation notifications
    await sendOrderStatusNotification(io, order, 'cancelled');

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
const confirmReceipt = async (req, res) => {
  const buyerId = req.user._id; // ✅ fixed
  const { orderId } = req.params;

  console.log('🔍 Finding order:', orderId);
  const order = await VendorOrder.findById(orderId).populate({
    path: "vendor",
    select: "_id virtualAccount walletBalance"
  });
  console.log('📦 Found order:', {
    id: order._id,
    vendorId: order.vendor?._id,
    amount: order.totalAmount,
    status: order.status
  });

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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ✅ Update order status
    order.status = "fulfilled"; // Changed from "delivered" to "fulfilled" for consistency
    order.deliveredAt = Date.now();
    await order.save({ session });

    // ✅ Increment vendor's total transactions count
    await incrementVendorTransactions(order.vendor._id, session);

    // ✅ Credit vendor's wallet
    console.log('🔍 Finding vendor wallet:', order.vendor._id);
    const wallet = await Wallet.findOne({ 
      user: order.vendor._id,
      role: 'vendor'
    }).session(session);

    if (!wallet) {
      throw new Error("Vendor wallet not found");
    }

    console.log('💰 Current wallet balance:', wallet.balance);
    console.log('💵 Order amount to add:', order.totalAmount);

    // Update wallet balance
    const newBalance = Number(wallet.balance || 0) + Number(order.totalAmount);
    console.log('🏦 New balance will be:', newBalance);
    
    wallet.balance = newBalance;
    const savedWallet = await wallet.save({ session });
    console.log('✅ Saved wallet balance:', savedWallet.balance);

    // ✅ Log transaction
    await Transaction.create([{
      ref: new mongoose.Types.ObjectId().toString(),
      type: "transfer",
      status: "successful",
      amount: order.totalAmount,
      description: "Order payment released from escrow",
      from: "escrow",
      to: wallet.virtualAccount,
      initiatedBy: order.vendor._id,
      initiatorType: "Vendor"
    }], { session });

    // ✅ Order completed - vendor can now request payout from their wallet
    console.log('✅ Order fulfilled - vendor wallet credited. They can request payout anytime.');

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Delivery confirmed. Funds moved to vendor payout queue.",
      order
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Error in confirmReceipt:', error);
    res.status(500).json({ 
      message: "Error confirming receipt", 
      error: error.message 
    });
  } finally {
    session.endSession();
  }

  // ✅ Send notifications (after successful response and transaction)
  try {
    const io = req.app.get('io');
    await sendOrderStatusNotification(io, order, 'delivered');
    await sendPayoutNotification(io, {
      vendorId: order.vendor._id,
      amount: order.totalAmount,
      status: 'ready',
      orderId: order._id
    });
  } catch (notificationError) {
    console.error('⚠️ Notification error (non-critical):', notificationError);
    // Don't fail the request for notification errors
  }
}

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
