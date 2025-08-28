// backend/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllAsRead,
  createNotification
} = require('../controllers/notificationController');
const { protectAnyUser } = require('../middleware/authMiddleware'); // works for all roles

// ✅ Get notifications for the logged-in user
router.get('/', protectAnyUser, getUserNotifications);

// ✅ Mark a single notification as read
router.put('/:id/read', protectAnyUser, markNotificationAsRead);

// ✅ Mark all notifications as read
router.put('/read-all', protectAnyUser, markAllAsRead);

// ✅ Create a new notification
router.post('/', protectAnyUser, createNotification);

module.exports = router;
