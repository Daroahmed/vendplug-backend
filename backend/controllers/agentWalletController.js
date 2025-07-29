const Wallet = require('../models/walletModel');

const getAgentWallet = async (req, res) => {
  try {
    const agentId = req.user._id;

    const wallet = await Wallet.findOne({ userId: agentId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    res.json({
      balance: wallet.balance,
      virtualAccount: wallet.virtualAccount,
    });
  } catch (error) {
    console.error('Error getting agent wallet:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAgentWallet };
