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
const { subscribe, getVapidPublicKey } = require('../controllers/pushController');

// ✅ Get notifications for the logged-in user
router.get('/', protectAnyUser, getUserNotifications);

// ✅ Mark a single notification as read
router.put('/:id/read', protectAnyUser, markNotificationAsRead);

// ✅ Mark all notifications as read
router.put('/read-all', protectAnyUser, markAllAsRead);

// ✅ Create a new notification
router.post('/', protectAnyUser, createNotification);

// PWA Web Push endpoints
router.get('/push/vapid-public-key', (req, res) => getVapidPublicKey(req, res));
router.post('/push/subscribe', protectAnyUser, (req, res) => subscribe(req, res));

module.exports = router;
