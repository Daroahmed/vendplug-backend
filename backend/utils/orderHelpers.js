// utils/orderHelpers.js
const PayoutQueue = require("../models/payoutModel");
const Wallet = require("../models/walletModel");
const Transaction = require("../models/Transaction");
const  createNotification  = require('./createNotification');

/**
 * Sends a notification with Socket.IO + DB persist
 */
async function notifyUser(io, recipientId, recipientType, title, message, orderId) {
  await createNotification({
    recipientId,
    recipientType,
    title,
    message,
    orderId,
    io
  });
}

/**
 * Updates order status & history
 */
function applyOrderStatus(order, status, by) {
  order.status = status;
  order.statusHistory = [
    ...(order.statusHistory || []),
    { status, at: new Date(), by }
  ];
  return order;
}

/**
 * Queue payout for vendor when fulfilled
 */
async function queuePayout(order) {
  const amount = order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  await PayoutQueue.create({
    vendor: order.vendor,
    order: order._id,
    amount,
    status: "pending"
  });
  console.log(`💸 Payout queued for Order ${order._id}: ₦${amount}`);
}

/**
 * Refund buyer if order rejected
 */
async function refundBuyer(order) {
  const wallet = await Wallet.findOne({ buyer: order.buyer });
  if (!wallet) throw new Error("Buyer wallet not found for refund");

  wallet.balance += order.totalAmount;
  await wallet.save();

  if (Transaction) {
    await Transaction.create({
      buyer: order.buyer,
      amount: order.totalAmount,
      type: "credit",
      description: "Refund: vendor rejected order",
      meta: { orderId: order._id }
    });
  }
}

/**
 * Common error response
 */
function handleError(res, error, defaultMessage = "Server error") {
  console.error(`❌ ${defaultMessage}:`, error);
  res.status(500).json({ message: defaultMessage, error: error.message });
}

async function processRefund(buyerId, amount, orderId) {
  // Find wallet
  const wallet = await Wallet.findOne({ buyer: buyerId });
  if (!wallet) throw new Error("Buyer wallet not found");

  // Add amount back
  wallet.balance += amount;
  await wallet.save();

  // Record transaction
  await Transaction.create({
    buyer: buyerId,
    amount,
    type: "credit",
    description: "Refund issued by vendor",
    meta: { orderId }
  });

  await WalletTransaction.create({
    user: buyer._id,
    type: "debit",
    amount: order.totalAmount,
    reference: order._id,
    description: "Escrow payment for order"
  });


  await WalletTransaction.create({
    user: buyer._id,
    type: "credit",
    amount: order.totalAmount,
    reference: order._id,
    description: "Refund for rejected order"
  });
  
  

  console.log(`💸 Refund processed for Buyer ${buyerId}: ₦${amount}`);
}

function applyVendorOrderStatus(order, status, by, extraFields = {}) {
  order.status = status;
  order.statusHistory = [
    ...(order.statusHistory || []),
    { status, at: new Date(), by }
  ];
  Object.assign(order, extraFields);
  return order;
}

module.exports = {
  notifyUser,
  applyOrderStatus,
  queuePayout,
  refundBuyer,
  processRefund, // ✅ added
  applyVendorOrderStatus, // ✅ added
  handleError
};

