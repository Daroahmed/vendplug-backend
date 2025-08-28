const Notification = require('../models/Notification');
const { emitNotification } = require('../utils/socketHelpers');

/**
 * Get notifications for the logged-in user
 */
const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipientId: req.user._id,
      recipientType: req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1)
    })
    .sort('-createdAt')
    .limit(50);

    res.json(notifications);
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

/**
 * Mark a single notification as read
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipientId: req.user._id
      },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ message: 'Error updating notification' });
  }
};

/**
 * Mark all notifications as read for the user
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipientId: req.user._id,
        read: false
      },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Error updating notifications' });
  }
};

/**
 * Create a new notification
 */
const createNotification = async (req, res) => {
  try {
    const { recipientId, recipientType, title, message, orderId } = req.body;

    const notification = await Notification.create({
      recipientId,
      recipientType,
      title,
      message,
      orderId
    });

    // Emit the notification via Socket.IO
    const io = req.app.get('io');
    if (io) {
      emitNotification(io, recipientId, notification);
    }

    res.status(201).json(notification);
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    res.status(500).json({ message: 'Error creating notification' });
  }
};

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllAsRead,
  createNotification
};