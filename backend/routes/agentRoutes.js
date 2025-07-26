const express = require('express');
const router = express.Router();

const {
  registerAgent,
  loginAgent,
  getAgentOrders,
  getAgentProfile,
  getAgentStats
} = require('../controllers/agentController');

const { protectAgent } = require("../middleware/authMiddleware");
const { getWalletBalance } = require("../controllers/walletController");

router.post('/register', registerAgent);
router.post('/login', loginAgent);
router.get('/orders', protectAgent, getAgentOrders);
router.get("/profile", protectAgent, getAgentProfile);
router.get('/stats', protectAgent, getAgentStats);
router.get("/wallet", protectAgent, getWalletBalance);

module.exports = router;

