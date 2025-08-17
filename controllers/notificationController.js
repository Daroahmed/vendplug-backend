const Notification = require('../models/Notification');
const createNotification = require('../utils/createNotification');

// Get notifications for the logged-in user
const getUserNotifications = async (req, res) => {
  try {
    const io = req.app.get('io'); // get io for this request
    const role = req.user.role;
    const userId = req.user._id;

    const notifications = await Notification.find({
      recipientId: userId,
      recipientType: role.charAt(0).toUpperCase() + role.slice(1) // Buyer, Agent, Vendor
    }).sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

// Mark a single notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { id } = req.params;
    const role = req.user.role;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: userId, recipientType: role.charAt(0).toUpperCase() + role.slice(1) },
      { read: true },
      { new: true }
    );

    if (!notification) return res.status(404).json({ message: 'Notification not found' });

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification as read', error: error.message });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const io = req.app.get('io');
    const role = req.user.role;
    const userId = req.user._id;

    await Notification.updateMany(
      { recipientId: userId, recipientType: role.charAt(0).toUpperCase() + role.slice(1) },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking all notifications as read', error: error.message });
  }
};

module.exports = {
  createNotification, // from utils
  getUserNotifications,
  markNotificationAsRead,
  markAllAsRead
};
