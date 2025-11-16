const express = require('express');
const router = express.Router();

const controller = require('../controllers/buyerController');
console.log("Exported controller functions:", Object.keys(controller)); // 🛠️ Debug log

const {
  registerBuyer,
  loginBuyer,
  getBuyerProfile
} = controller;

const { protectBuyer } = require('../middleware/authMiddleware');
const { authLimiter, registrationLimiter } = require('../middleware/rateLimiter');

// Registration limiter with runtime kill‑switch and debug header
const registrationGuard = (req, res, next) => {
  const globalOn = String(process.env.RATE_LIMIT_ENABLED || 'true').trim().toLowerCase() !== 'false';
  const regOn = String(process.env.REGISTRATION_RATE_LIMIT_ENABLED || 'true').trim().toLowerCase() !== 'false';
  try { res.setHeader('x-app-registration-limit-enabled', String(globalOn && regOn)); } catch (_) {}
  if (!globalOn || !regOn) return next();
  return registrationLimiter(req, res, next);
};

router.post('/register', registrationGuard, registerBuyer);
router.post('/login', authLimiter, loginBuyer);

router.get('/profile', protectBuyer, getBuyerProfile);



module.exports = router;
