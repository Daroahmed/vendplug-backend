// backend/controllers/notificationController.js

const Notification = require('../models/Notification');

const getNotifications = async (req, res) => {
  try {
    const agentId = req.user._id;

    const notifications = await Notification.find({ recipient: agentId })
      .populate('order', 'pickupLocation status createdAt')
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    console.error("❌ Error fetching notifications:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const agentId = req.user._id;

    await Notification.updateMany(
      { recipient: agentId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ message: "All notifications marked as read." });
  } catch (err) {
    console.error("❌ Error marking notifications:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Helper for emitting notifications (not part of express router)
const createNotification = async (recipientId, message, orderId) => {
  try {
    const notif = new Notification({
      recipient: recipientId,
      message,
      order: orderId,
    });
    await notif.save();
  } catch (err) {
    console.error("❌ Failed to save notification:", err.message);
  }
};

module.exports = {
  getNotifications,
  markAllAsRead,
  createNotification, // for backend use (emit and save)
};
