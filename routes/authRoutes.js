const express = require('express');
const router = express.Router();
const { verifyEmail } = require('../controllers/authController');

// Email verification route
router.post('/verify-email', verifyEmail);

module.exports = router;