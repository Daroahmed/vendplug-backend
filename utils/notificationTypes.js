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
  ORDER_SHIPPED: {
    title: '🚚 Order Shipped',
    getMessage: (orderId) => `Order #${orderId} is on its way to you`,
  },
  ORDER_DELIVERED: {
    title: '📦 Order Delivered',
    getMessage: (orderId) => `Order #${orderId} has been delivered. Please confirm receipt.`,
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

  // System Announcements
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
