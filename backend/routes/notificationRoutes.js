// backend/routes/notificationRoutes.js

const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAllAsRead,
} = require('../controllers/notificationController');
const { protectAgent } = require('../middleware/authMiddleware');

router.get('/', protectAgent, getNotifications);
router.put('/mark-read', protectAgent, markAllAsRead);

module.exports = router;
