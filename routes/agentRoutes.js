const express = require('express');
const router = express.Router();

const {
  registerAgent,
  loginAgent,
  getAgentProfile,
  getAgentStats
} = require('../controllers/agentController');

const { protectAgent } = require('../middleware/authMiddleware');


router.post('/register', registerAgent);
router.post('/login', loginAgent);
router.get("/profile", protectAgent, getAgentProfile);
router.get('/stats', protectAgent, getAgentStats);


module.exports = router;

