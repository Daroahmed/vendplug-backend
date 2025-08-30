const express = require('express');
const router = express.Router();

const {
  registerAgent,
  loginAgent,
  getAgentProfile,
  getAgentStats
} = require('../controllers/agentController');

const { protectAgent } = require('../middleware/authMiddleware');
const Agent = require('../models/Agent');
const asyncHandler = require('express-async-handler');


router.post('/register', registerAgent);
router.post('/login', loginAgent);
router.get("/profile", protectAgent, getAgentProfile);
router.get('/stats', protectAgent, getAgentStats);

// ✅ Get agent transaction count
router.get('/:agentId/transactions', asyncHandler(async (req, res) => {
  const { agentId } = req.params;
  
  const agent = await Agent.findById(agentId).select('totalTransactions fullName');
  if (!agent) {
    return res.status(404).json({ message: 'Agent not found' });
  }
  
  res.json({
    agentId: agent._id,
    fullName: agent.fullName,
    totalTransactions: agent.totalTransactions || 0
  });
}));


module.exports = router;

