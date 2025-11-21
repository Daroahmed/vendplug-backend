const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const DeviceToken = require('../models/DeviceToken');
const { protectAnyUser } = require('../middleware/authMiddleware');

// Register or update a device token for the authenticated user
router.post('/register', protectAnyUser, asyncHandler(async (req, res) => {
  const { token, role, platform } = req.body || {};
  if (!token) return res.status(400).json({ message: 'Missing token' });
  const userRole = role || (req.user && req.user.role) || 'buyer';
  const userId = req.user && req.user._id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const update = {
    userId,
    role: userRole,
    platform: (platform || 'unknown').toString().toLowerCase(),
    active: true,
    lastUsedAt: new Date()
  };
  const doc = await DeviceToken.findOneAndUpdate(
    { token },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return res.json({ success: true, data: { id: doc._id } });
}));

// Unregister a device token
router.post('/unregister', protectAnyUser, asyncHandler(async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ message: 'Missing token' });
  await DeviceToken.findOneAndUpdate({ token }, { active: false, lastUsedAt: new Date() });
  return res.json({ success: true });
}));

module.exports = router;

