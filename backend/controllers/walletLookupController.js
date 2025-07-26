const Buyer = require('../models/Buyer');
const Agent = require('../models/Agent');

const lookupUserByAccountNumber = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    if (!accountNumber) {
      return res.status(400).json({ message: 'Account number is required' });
    }

    // First check buyers
    let user = await Buyer.findOne({ 'wallet.accountNumber': accountNumber }).select('-password');
    if (user) {
      return res.status(200).json({ userType: 'buyer', user });
    }

    // Then check agents
    user = await Agent.findOne({ 'wallet.accountNumber': accountNumber }).select('-password');
    if (user) {
      return res.status(200).json({ userType: 'agent', user });
    }

    res.status(404).json({ message: 'User not found' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { lookupUserByAccountNumber };
