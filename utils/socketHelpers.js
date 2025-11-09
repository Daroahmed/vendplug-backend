const Notification = require('../models/Notification');

/**
 * Emit pending notifications to a specific user
 * @param {string} userId - The user's ID
 * @param {Object} socket - The socket instance
 */
async function emitPendingNotifications(userId, socket) {
  try {
    // Check if MongoDB is connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️  MongoDB not connected, skipping pending notifications');
      return;
    }

    // Find unread notifications for this user
    const notifications = await Notification.find({
      recipientId: userId,
      read: false
    }).sort('-createdAt').limit(10);

    if (notifications.length > 0) {
      notifications.forEach(notification => {
        socket.emit('new-notification', notification);
      });
    }
  } catch (error) {
    console.error('❌ Error emitting pending notifications:', error);
  }
}

/**
 * Emit a notification to a specific user
 * @param {Object} io - The Socket.IO instance
 * @param {string} userId - The recipient's user ID
 * @param {Object} notification - The notification object
 */
function emitNotification(io, userId, notification) {
  try {
    io.to(`user:${userId}`).emit('new-notification', notification);
  } catch (error) {
    console.error('❌ Error emitting notification:', error);
  }
}

module.exports = {
  emitPendingNotifications,
  emitNotification
};
