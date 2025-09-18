// Notification types and templates
const NOTIFICATION_TYPES = {
  // Order Status Changes
  ORDER_CREATED: {
    title: '🛍️ New Order Placed',
    getMessage: (orderId, amount) => `Order #${orderId} has been placed for ₦${amount}`,
  },
  ORDER_ACCEPTED: {
    title: '✅ Order Accepted',
    getMessage: (orderId) => `Order #${orderId} has been accepted and is being processed`,
  },
  ORDER_REJECTED: {
    title: '❌ Order Rejected',
    getMessage: (orderId, reason) => `Order #${orderId} has been rejected. ${reason ? `Reason: ${reason}` : 'Your payment will be refunded.'}`,
  },
  ORDER_CANCELLED: {
    title: '🚫 Order Cancelled',
    getMessage: (orderId) => `Order #${orderId} has been cancelled`,
  },
  ORDER_PREPARING: {
    title: '👨‍🍳 Order Being Prepared',
    getMessage: (orderId) => `Order #${orderId} is being prepared by the vendor`,
  },
  ORDER_OUT_FOR_DELIVERY: {
    title: '🚚 Order Out for Delivery',
    getMessage: (orderId) => `Order #${orderId} is on its way to you`,
  },
  ORDER_DELIVERED: {
    title: '📦 Order Delivered',
    getMessage: (orderId) => `Order #${orderId} has been delivered. Please confirm receipt.`,
  },
  ORDER_FULFILLED: {
    title: '🎉 Order Fulfilled',
    getMessage: (orderId, amount) => `Order #${orderId} has been fulfilled! ₦${amount} has been credited to your wallet.`,
  },
  ORDER_RESOLVED: {
    title: '⚖️ Order Resolved',
    getMessage: (orderId, resolution) => `Order #${orderId} has been resolved through dispute: ${resolution}`,
  },

  // Payment Notifications
  PAYMENT_RECEIVED: {
    title: '💰 Payment Received',
    getMessage: (amount) => `Payment of ₦${amount} has been received`,
  },
  PAYMENT_REFUNDED: {
    title: '↩️ Payment Refunded',
    getMessage: (amount) => `₦${amount} has been refunded to your wallet`,
  },
  PAYSTACK_SUCCESS: {
    title: '✅ Payment Successful',
    getMessage: (amount, orderId) => `Payment of ₦${amount} for order #${orderId} was successful via Paystack`,
  },
  PAYSTACK_FAILED: {
    title: '❌ Payment Failed',
    getMessage: (amount, reason) => `Payment of ₦${amount} failed: ${reason || 'Please try again'}`,
  },
  PAYSTACK_PENDING: {
    title: '⏳ Payment Pending',
    getMessage: (amount) => `Payment of ₦${amount} is being processed`,
  },
  PAYOUT_READY: {
    title: '💸 Payout Ready',
    getMessage: (amount) => `₦${amount} is ready for payout`,
  },
  PAYOUT_PROCESSED: {
    title: '✅ Payout Processed',
    getMessage: (amount) => `₦${amount} has been sent to your account`,
  },

  // Wallet Transactions
  WALLET_CREDITED: {
    title: '💳 Wallet Credited',
    getMessage: (amount, source) => `₦${amount} added to your wallet${source ? ` from ${source}` : ''}`,
  },
  WALLET_DEBITED: {
    title: '💸 Wallet Debited',
    getMessage: (amount, reason) => `₦${amount} deducted from your wallet${reason ? ` for ${reason}` : ''}`,
  },
  LOW_BALANCE: {
    title: '⚠️ Low Balance Alert',
    getMessage: (balance) => `Your wallet balance is low: ₦${balance}`,
  },

  // Delivery Updates
  PICKUP_READY: {
    title: '📦 Ready for Pickup',
    getMessage: (orderId) => `Order #${orderId} is ready for pickup`,
  },
  IN_TRANSIT: {
    title: '🚚 In Transit',
    getMessage: (orderId) => `Order #${orderId} is in transit`,
  },
  DELIVERY_ATTEMPTED: {
    title: '🚪 Delivery Attempted',
    getMessage: (orderId) => `Delivery attempted for order #${orderId}`,
  },

  // Order Fulfillment
  ORDER_FULFILLED: {
    title: '🎉 Order Fulfilled',
    getMessage: (orderId, amount) => `Order #${orderId} has been fulfilled! ₦${amount} has been credited to your wallet.`,
  },
  ORDER_CONFIRMED: {
    title: '✅ Order Confirmed',
    getMessage: (orderId) => `Order #${orderId} has been confirmed by the buyer.`,
  },

  // Payout Notifications
  PAYOUT_REQUESTED: {
    title: '💸 Payout Requested',
    getMessage: (amount) => `Payout request of ₦${amount} has been submitted and is being processed.`,
  },
  PAYOUT_FAILED: {
    title: '❌ Payout Failed',
    getMessage: (amount, reason) => `Payout of ₦${amount} failed. ${reason ? `Reason: ${reason}` : 'Please check your bank details and try again.'}`,
  },
  PAYOUT_REVERSED: {
    title: '🔄 Payout Reversed',
    getMessage: (amount) => `Payout of ₦${amount} has been reversed and refunded to your wallet.`,
  },

  // Dispute Notifications
  DISPUTE_CREATED: {
    title: '⚖️ New Dispute Created',
    getMessage: (disputeId, orderId) => `A dispute has been created for order #${orderId} (Dispute #${disputeId})`,
  },
  DISPUTE_ASSIGNED: {
    title: '📋 Dispute Assigned',
    getMessage: (disputeId, staffName) => `Dispute ${disputeId} has been assigned to ${staffName}.`,
  },
  DISPUTE_RESOLVED: {
    title: '✅ Dispute Resolved',
    getMessage: (disputeId, resolution) => `Dispute ${disputeId} has been resolved: ${resolution}`,
  },
  DISPUTE_ESCALATED: {
    title: '🚨 Dispute Escalated',
    getMessage: (disputeId, reason) => `Dispute ${disputeId} has been escalated: ${reason}`,
  },
  DISPUTE_MESSAGE: {
    title: '💬 New Dispute Message',
    getMessage: (disputeId) => `New message in dispute ${disputeId}`,
  },
  DISPUTE_REFUND_PROCESSED: {
    title: '💰 Dispute Refund Processed',
    getMessage: (disputeId, amount) => `Refund of ₦${amount} has been processed for dispute ${disputeId}`,
  },
  DISPUTE_FAVOR_COMPLAINANT: {
    title: '✅ Dispute Resolved in Your Favor',
    getMessage: (disputeId, amount) => `Dispute ${disputeId} resolved in your favor. ${amount ? `₦${amount} refunded.` : 'Full refund processed.'}`,
  },
  DISPUTE_FAVOR_RESPONDENT: {
    title: '✅ Dispute Resolved in Your Favor',
    getMessage: (disputeId) => `Dispute ${disputeId} resolved in your favor. No refund required.`,
  },
  DISPUTE_PARTIAL_REFUND: {
    title: '⚖️ Partial Refund Processed',
    getMessage: (disputeId, amount) => `Dispute ${disputeId} resolved with partial refund of ₦${amount}`,
  },

  // Wallet & Transaction Notifications
  ESCROW_RELEASED: {
    title: '🔓 Escrow Released',
    getMessage: (amount, orderId) => `₦${amount} has been released from escrow for order #${orderId}`,
  },
  REFUND_PROCESSED: {
    title: '↩️ Refund Processed',
    getMessage: (amount, orderId) => `₦${amount} has been refunded for order #${orderId}`,
  },
  PAYMENT_VERIFIED: {
    title: '✅ Payment Verified',
    getMessage: (amount) => `Payment of ₦${amount} has been verified and processed.`,
  },

  // Admin & System Notifications
  NEW_USER_REGISTERED: {
    title: '👤 New User Registration',
    getMessage: (userType, userName) => `New ${userType} registered: ${userName}`,
  },
  HIGH_VALUE_ORDER: {
    title: '💰 High Value Order',
    getMessage: (orderId, amount) => `High value order #${orderId} placed for ₦${amount}`,
  },
  SYSTEM_MAINTENANCE: {
    title: '🔧 System Maintenance',
    getMessage: (time) => `System maintenance scheduled for ${time}`,
  },
  FEATURE_UPDATE: {
    title: '🎉 New Feature',
    getMessage: (feature) => `New feature available: ${feature}`,
  },
  SECURITY_ALERT: {
    title: '🔐 Security Alert',
    getMessage: (message) => message,
  },
  
  // Staff Notifications
  NEW_DISPUTE_ASSIGNED: {
    title: '⚖️ New Dispute Assigned',
    getMessage: (disputeId, orderId) => `Dispute ${disputeId} for order #${orderId} has been assigned to you`,
  },
  DISPUTE_ESCALATED_TO_ADMIN: {
    title: '🚨 Dispute Escalated to Admin',
    getMessage: (disputeId, reason) => `Dispute ${disputeId} escalated: ${reason}`,
  },
  NEW_SUPPORT_TICKET_ASSIGNED: {
    title: '🎫 New Support Ticket Assigned',
    getMessage: (ticketNumber, category) => `Support ticket ${ticketNumber} (${category}) assigned to you`,
  },
  STAFF_MESSAGE_RECEIVED: {
    title: '💬 New Message Received',
    getMessage: (senderName, ticketNumber) => `New message from ${senderName} in ticket ${ticketNumber}`,
  },
  
  // Admin Notifications
  ADMIN_DISPUTE_ESCALATED: {
    title: '🚨 Dispute Escalated to Admin',
    getMessage: (disputeId, reason) => `Dispute ${disputeId} requires admin attention: ${reason}`,
  },
  ADMIN_HIGH_VALUE_TRANSACTION: {
    title: '💰 High Value Transaction',
    getMessage: (amount, type) => `High value ${type} transaction: ₦${amount}`,
  },
  ADMIN_SYSTEM_ALERT: {
    title: '⚠️ System Alert',
    getMessage: (message) => message,
  },
  ADMIN_USER_SUSPENDED: {
    title: '🚫 User Suspended',
    getMessage: (userType, userName, reason) => `${userType} ${userName} suspended: ${reason}`,
  },

  // Chat & Messaging Notifications
  NEW_MESSAGE: {
    title: '💬 New Message',
    getMessage: (senderName, preview) => `New message from ${senderName}: ${preview}`,
  },
  MESSAGE_REACTION: {
    title: '😊 Message Reaction',
    getMessage: (senderName, emoji) => `${senderName} reacted with ${emoji}`,
  },
  TYPING_INDICATOR: {
    title: '⌨️ Typing',
    getMessage: (senderName) => `${senderName} is typing...`,
  },

  // Support Ticket Notifications
  NEW_SUPPORT_TICKET: {
    title: '🎫 New Support Ticket',
    getMessage: (ticketNumber, category) => `New ${category} ticket: ${ticketNumber}`,
  },
  TICKET_ASSIGNED: {
    title: '📋 Ticket Assigned',
    getMessage: (ticketNumber, staffName) => `Ticket ${ticketNumber} assigned to ${staffName}`,
  },
  TICKET_UPDATED: {
    title: '📝 Ticket Updated',
    getMessage: (ticketNumber, status) => `Ticket ${ticketNumber} status updated to ${status}`,
  },
  TICKET_RESOLVED: {
    title: '✅ Ticket Resolved',
    getMessage: (ticketNumber) => `Ticket ${ticketNumber} has been resolved`,
  },
  TICKET_RATED: {
    title: '⭐ Ticket Rated',
    getMessage: (ticketNumber, rating) => `Ticket ${ticketNumber} rated ${rating}/5 stars`,
  },
  SUPPORT_MESSAGE: {
    title: '💬 Support Message',
    getMessage: (ticketNumber, senderName) => `New message from ${senderName} in ticket ${ticketNumber}`,
  },
  SUPPORT_MESSAGE_STAFF: {
    title: '💬 Support Reply',
    getMessage: (ticketNumber, staffName) => `${staffName} replied to ticket ${ticketNumber}`,
  }
};

// Helper function to create notification content
function createNotificationContent(type, ...args) {
  const template = NOTIFICATION_TYPES[type];
  if (!template) {
    throw new Error(`Unknown notification type: ${type}`);
  }
  return {
    title: template.title,
    message: template.getMessage(...args)
  };
}

module.exports = {
  NOTIFICATION_TYPES,
  createNotificationContent
};
