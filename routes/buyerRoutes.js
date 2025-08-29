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

router.post('/register', registerBuyer);
router.post('/login', loginBuyer);

router.get('/profile', protectBuyer, getBuyerProfile);



module.exports = router;
