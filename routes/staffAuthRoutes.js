const express = require('express');
const router = express.Router();
const { staffLogin, getStaffProfile, updateStaffProfile } = require('../controllers/staffAuthController');
const { protectStaff } = require('../middleware/staffAuth');
const { authLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/login', authLimiter, staffLogin);

// Protected routes
router.get('/profile', protectStaff, getStaffProfile);
router.put('/profile', protectStaff, updateStaffProfile);

module.exports = router;
