// controllers/buyerOrderController.js
const asyncHandler = require("express-async-handler");
const mongoose = require('mongoose');
const VendorOrder = require('../models/vendorOrderModel');
const AgentOrder = require('../models/AgentOrder');
// Order model will be determined dynamically based on order type
const Payout = require('../models/payoutModel');
const Notification = require('../models/Notification');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/Transaction');
const { handleError } = require('../utils/orderHelpers');
const { sendOrderStatusNotification, sendPayoutNotification } = require('../utils/notificationHelper');
const { incrementVendorTransactions, incrementAgentTransactions } = require('../utils/transactionHelper');

// Fetch all orders for the logged-in buyer (both vendor and agent orders)
const getBuyerVendorOrders = async (req, res) => {
  try {
    const buyerId = req.user._id;

    // Fetch both vendor and agent orders
    const [vendorOrders, agentOrders] = await Promise.all([
      VendorOrder.find({ buyer: buyerId })
        .populate("vendor", "shopName")
        .populate("items.product", "name price")
        .sort({ createdAt: -1 }),
      AgentOrder.find({ buyer: buyerId })
        .populate("agent", "businessName")
        .populate("items.product", "name price")
        .sort({ createdAt: -1 })
    ]);

    // Format vendor orders
    const formattedVendorOrders = vendorOrders.map(order => ({
      _id: order._id,
      type: 'vendor',
      vendor: order.vendor?.shopName || "Unknown Vendor",
      agent: null,
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

    // Format agent orders
    const formattedAgentOrders = agentOrders.map(order => ({
      _id: order._id,
      type: 'agent',
      vendor: null,
      agent: order.agent?.businessName || "Unknown Agent",
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

    // Combine and sort all orders by creation date
    const allOrders = [...formattedVendorOrders, ...formattedAgentOrders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(allOrders);
  } catch (error) {
    console.error("❌ Error fetching buyer orders:", error);
    res.status(500).json({ message: "Error fetching orders" });
  }
};

// Get single buyer order by ID (both vendor and agent orders)
const getBuyerOrderDetails = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const orderId = req.params.id;

    // Try to find the order in both VendorOrder and AgentOrder collections
    const [vendorOrder, agentOrder] = await Promise.all([
      VendorOrder.findOne({
        _id: orderId,
        buyer: buyerId
      })
        .populate("vendor", "shopName _id")
        .populate("items.product", "name price description image"),
      AgentOrder.findOne({
        _id: orderId,
        buyer: buyerId
      })
        .populate("agent", "businessName _id")
        .populate("items.product", "name price description image")
    ]);

    const order = vendorOrder || agentOrder;
    const isAgentOrder = !!agentOrder;

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Debug logging
    if (isAgentOrder) {
      console.log("🔍 Order agent data:", {
        agent: order.agent,
        agentId: order.agent?._id,
        agentName: order.agent?.businessName
      });
    } else {
      console.log("🔍 Order vendor data:", {
        vendor: order.vendor,
        vendorId: order.vendor?._id,
        vendorName: order.vendor?.shopName
      });
    }

    const formatted = {
      _id: order._id,
      type: isAgentOrder ? 'agent' : 'vendor',
      vendor: isAgentOrder ? null : (order.vendor?.shopName || "Unknown Vendor"),
      vendorId: isAgentOrder ? null : (order.vendor?._id || null),
      agent: isAgentOrder ? (order.agent?.businessName || "Unknown Agent") : null,
      agentId: isAgentOrder ? (order.agent?._id || null) : null,
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
    console.error("❌ Error fetching buyer order details:", error);
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
  
  // Try to find the order in both VendorOrder and AgentOrder collections
  const [vendorOrder, agentOrder] = await Promise.all([
    VendorOrder.findById(orderId).populate({
      path: "vendor",
      select: "_id virtualAccount walletBalance"
    }),
    AgentOrder.findById(orderId).populate({
      path: "agent",
      select: "_id virtualAccount walletBalance"
    })
  ]);

  const order = vendorOrder || agentOrder;
  const isAgentOrder = !!agentOrder;

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  console.log('📦 Found order:', {
    id: order._id,
    type: isAgentOrder ? 'agent' : 'vendor',
    userId: isAgentOrder ? order.agent?._id : order.vendor?._id,
    amount: order.totalAmount,
    status: order.status
  });

  // ✅ Make sure buyer owns this order
  if (order.buyer.toString() !== buyerId.toString()) {
    res.status(403);
    throw new Error("Not authorized to confirm this order");
  }

  // ✅ Ensure status is correct and not already fulfilled
  if (order.status === "fulfilled") {
    res.status(400);
    throw new Error("Order has already been confirmed and funded");
  }
  
  if (order.status !== "delivered") {
    res.status(400);
    throw new Error("Order cannot be confirmed yet");
  }

  // Retry logic for MongoDB write conflicts
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
    // ✅ Double-check order status inside transaction to prevent race conditions
    const OrderModel = isAgentOrder ? AgentOrder : VendorOrder;
    const currentOrder = await OrderModel.findById(orderId).session(session);
    if (!currentOrder) {
      throw new Error("Order not found");
    }
    
    if (currentOrder.status === "fulfilled") {
      throw new Error("Order has already been confirmed and funded");
    }
    
    if (currentOrder.status !== "delivered") {
      throw new Error("Order cannot be confirmed yet");
    }

    // ✅ Update order status
    currentOrder.status = "fulfilled"; // Changed from "delivered" to "fulfilled" for consistency
    currentOrder.deliveredAt = Date.now();
    await currentOrder.save({ session });

    const userId = isAgentOrder ? currentOrder.agent._id : currentOrder.vendor._id;
    const userRole = isAgentOrder ? 'agent' : 'vendor';
    const userType = isAgentOrder ? 'Agent' : 'Vendor';

    // ✅ Increment user's total transactions count
    if (isAgentOrder) {
      await incrementAgentTransactions(userId, session);
    } else {
      await incrementVendorTransactions(userId, session);
    }

    // ✅ Credit user's wallet
    console.log(`🔍 Finding ${userRole} wallet:`, userId);
    const wallet = await Wallet.findOne({ 
      user: userId,
      role: userRole
    }).session(session);

    if (!wallet) {
      throw new Error(`${userType} wallet not found`);
    }

    console.log('💰 Current wallet balance:', wallet.balance);
    console.log('💵 Order amount to add:', order.totalAmount);

    // Update wallet balance
    const newBalance = Number(wallet.balance || 0) + Number(order.totalAmount);
    console.log('🏦 New balance will be:', newBalance);
    
    wallet.balance = newBalance;
    const savedWallet = await wallet.save({ session });
    console.log('✅ Saved wallet balance:', savedWallet.balance);

    // Sync balance with user model
    const { syncWalletBalance } = require('./walletHelper');
    await syncWalletBalance(userId, userRole, newBalance);

    // ✅ Log transaction
    await Transaction.create([{
      ref: new mongoose.Types.ObjectId().toString(),
      type: "transfer",
      status: "successful",
      amount: currentOrder.totalAmount,
      description: "Order payment released from escrow",
      from: "escrow",
      to: wallet.virtualAccount,
      initiatedBy: userId,
      initiatorType: userType
    }], { session });

    // ✅ Order completed - user can now request payout from their wallet
    console.log(`✅ Order fulfilled - ${userRole} wallet credited. They can request payout anytime.`);

    await session.commitTransaction();

    // ✅ Send notifications (after successful transaction but before response)
    try {
      const io = req.app.get('io');
      const { sendNotification } = require('../utils/notificationHelper');
      
      // Notify buyer that order is confirmed
      await sendNotification(io, {
        recipientId: currentOrder.buyer,
        recipientType: 'Buyer',
        notificationType: 'ORDER_CONFIRMED',
        args: [currentOrder._id],
        orderId: currentOrder._id
      });

      // Notify vendor/agent that order is fulfilled and funds released
      await sendNotification(io, {
        recipientId: userId,
        recipientType: userType,
        notificationType: 'ORDER_FULFILLED',
        args: [currentOrder._id, currentOrder.totalAmount],
        orderId: currentOrder._id
      });

      // Notify about escrow release
      await sendNotification(io, {
        recipientId: currentOrder.buyer,
        recipientType: 'Buyer',
        notificationType: 'ESCROW_RELEASED',
        args: [currentOrder._id, currentOrder.totalAmount],
        orderId: currentOrder._id
      });

      // Send payout ready notification to vendor/agent
      await sendNotification(io, {
        recipientId: userId,
        recipientType: userType,
        notificationType: 'PAYOUT_READY',
        args: [currentOrder.totalAmount],
        orderId: currentOrder._id
      });

      // Notify admins about high-value orders (₦50,000+)
      if (currentOrder.totalAmount >= 50000) {
        const Admin = require('../models/Admin');
        const admins = await Admin.find({ isActive: true });
        for (const admin of admins) {
          await sendNotification(io, {
            recipientId: admin._id,
            recipientType: 'Admin',
            notificationType: 'HIGH_VALUE_ORDER',
            args: [currentOrder._id, currentOrder.totalAmount],
            orderId: currentOrder._id
          });
        }
      }

    } catch (notificationError) {
      console.error('⚠️ Notification error (non-critical):', notificationError);
    }

    res.json({
      success: true,
      message: "Delivery confirmed. Funds moved to vendor payout queue.",
      order: currentOrder
    });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      // Check if it's a write conflict or transient error
      if ((error.code === 112 || error.code === 251) && retryCount < maxRetries - 1) {
        retryCount++;
        console.log(`⚠️ Write conflict detected, retrying... (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100 * retryCount)); // Exponential backoff
        continue;
      }
      
      console.error('❌ Error in confirmReceipt:', error);
      res.status(500).json({ 
        message: "Error confirming receipt", 
        error: error.message 
      });
      return;
    }
    
    // If we get here, the transaction was successful
    session.endSession();
    break;
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
