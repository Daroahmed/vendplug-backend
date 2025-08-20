const Notification = require('../models/Notification');

/**
 * Create and optionally emit a new notification.
 * @param {Object} params
 * @param {string} params.recipientId - The MongoDB _id of the recipient.
 * @param {"Buyer"|"Agent"|"Vendor"} params.recipientType - Who will receive it.
 * @param {string} params.title - Notification title.
 * @param {string} params.message - Notification message body.
 * @param {string|null} [params.orderId=null] - Related order ID if applicable.
 * @param {Object} [params.io] - Socket.IO instance for real-time emit.
 * @returns {Promise<Object>} Created notification document.
 */
async function createNotification({ recipientId, recipientType, title, message, orderId = null, io }) {
  if (!recipientId || !recipientType || !title) {
    throw new Error("Missing required notification parameters.");
  }

  try {
    const notification = await Notification.create({
      recipientId,
      recipientType,
      title,
      message,
      order: orderId
    });

    if (io) {
      io.to(`${recipientType}:${recipientId}`).emit('new-notification', notification);
    }

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

module.exports = createNotification;
