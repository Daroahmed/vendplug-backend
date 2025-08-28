const { createNotificationContent } = require('./notificationTypes');
const createNotification = require('./createNotification');

/**
 * Enhanced notification helper that uses predefined notification types
 */
async function sendNotification(io, params) {
  const {
    recipientId,
    recipientType,
    notificationType,
    args = [],
    orderId = null,
    meta = {}
  } = params;

  try {
    const { title, message } = createNotificationContent(notificationType, ...args);

    await createNotification({
      recipientId,
      recipientType,
      title,
      message,
      orderId,
      meta,
      io
    });

    return true;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return false;
  }
}

/**
 * Send notifications to multiple recipients
 */
async function broadcastNotification(io, params) {
  const {
    recipients,  // Array of {id, type} objects
    notificationType,
    args = [],
    orderId = null,
    meta = {}
  } = params;

  try {
    const results = await Promise.all(
      recipients.map(recipient =>
        sendNotification(io, {
          recipientId: recipient.id,
          recipientType: recipient.type,
          notificationType,
          args,
          orderId,
          meta
        })
      )
    );

    return results.every(result => result === true);
  } catch (error) {
    console.error('❌ Error broadcasting notification:', error);
    return false;
  }
}

/**
 * Send order status notification to all relevant parties
 */
async function sendOrderStatusNotification(io, order, status, extraData = {}) {
  const notifications = [];

  // Always notify buyer
  notifications.push({
    id: order.buyer,
    type: 'Buyer'
  });

  // Notify vendor if exists
  if (order.vendor) {
    notifications.push({
      id: order.vendor,
      type: 'Vendor'
    });
  }

  // Notify agent if exists
  if (order.agent) {
    notifications.push({
      id: order.agent,
      type: 'Agent'
    });
  }

  const notificationMap = {
    'pending': 'ORDER_CREATED',
    'accepted': 'ORDER_ACCEPTED',
    'rejected': 'ORDER_REJECTED',
    'cancelled': 'ORDER_CANCELLED',
    'shipped': 'ORDER_SHIPPED',
    'delivered': 'ORDER_DELIVERED',
    'in_transit': 'IN_TRANSIT',
    'ready_for_pickup': 'PICKUP_READY'
  };

  // Handle special cases for notifications
  let args = [order._id, order.totalAmount];
  if (status === 'rejected' && extraData.rejectionReason) {
    args = [order._id, extraData.rejectionReason];
  }

  return broadcastNotification(io, {
    recipients: notifications,
    notificationType: notificationMap[status] || 'ORDER_STATUS_UPDATED',
    args: args,
    orderId: order._id,
    meta: { status, ...extraData }
  });
}

/**
 * Send wallet transaction notification
 */
async function sendWalletNotification(io, params) {
  const {
    userId,
    userType,
    type,  // 'credit' or 'debit'
    amount,
    source,
    balance
  } = params;

  // Check for low balance
  if (type === 'debit' && balance < 1000) {
    await sendNotification(io, {
      recipientId: userId,
      recipientType: userType,
      notificationType: 'LOW_BALANCE',
      args: [balance]
    });
  }

  return sendNotification(io, {
    recipientId: userId,
    recipientType: userType,
    notificationType: type === 'credit' ? 'WALLET_CREDITED' : 'WALLET_DEBITED',
    args: [amount, source],
    meta: { type, amount, balance }
  });
}

/**
 * Send payout notification
 */
async function sendPayoutNotification(io, params) {
  const {
    vendorId,
    amount,
    status,  // 'ready' or 'processed'
    orderId
  } = params;

  return sendNotification(io, {
    recipientId: vendorId,
    recipientType: 'Vendor',
    notificationType: status === 'ready' ? 'PAYOUT_READY' : 'PAYOUT_PROCESSED',
    args: [amount],
    orderId,
    meta: { status, amount }
  });
}

module.exports = {
  sendNotification,
  broadcastNotification,
  sendOrderStatusNotification,
  sendWalletNotification,
  sendPayoutNotification
};
