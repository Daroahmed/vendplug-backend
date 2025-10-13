const axios = require('axios');
const PaystackService = require('../services/paystackService');

// Create Paystack service instance
const paystackService = new PaystackService();

/**
 * Get Paystack wallet balance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaystackBalance = async (req, res) => {
  try {
    const balance = await paystackService.getBalance();
    
    // Convert balance from kobo to naira (Paystack returns balance in kobo)
    const balanceInNaira = balance.data[0].balance / 100;
    
    res.json({
      success: true,
      data: {
        balance: balanceInNaira,
        balanceInKobo: balance.data[0].balance,
        currency: balance.data[0].currency,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Error fetching Paystack balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Paystack balance',
      error: error.message
    });
  }
};

/**
 * Top up Paystack wallet (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const topUpPaystackWallet = async (req, res) => {
  try {
    const { amount, source } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    // For now, this would require manual bank transfer to Paystack
    // In the future, this could be automated with bank integration
    res.json({
      success: true,
      message: `To top up ₦${amount} to your Paystack wallet, please transfer the amount to your Paystack bank account. Contact Paystack support for assistance.`,
      data: {
        amount,
        source: source || 'manual_transfer',
        instructions: 'Manual bank transfer required to Paystack account'
      }
    });
  } catch (error) {
    console.error('❌ Error processing wallet top-up:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process wallet top-up',
      error: error.message
    });
  }
};

/**
 * Get payout capacity (how much can be paid out instantly)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPayoutCapacity = async (req, res) => {
  try {
    const balance = await paystackService.getBalance();
    const currentBalanceInKobo = balance.data[0].balance;
    const currentBalanceInNaira = currentBalanceInKobo / 100;
    
    // Calculate capacity based on current balance (in naira)
    const instantPayoutCapacity = currentBalanceInNaira;
    const pendingPayouts = 0; // This would come from your database
    
    res.json({
      success: true,
      data: {
        currentBalance: currentBalanceInNaira,
        currentBalanceInKobo: currentBalanceInKobo,
        instantPayoutCapacity,
        pendingPayouts,
        canProcessInstantPayouts: currentBalanceInNaira > 0,
        recommendation: currentBalanceInNaira < 1000 ? 
          'Consider topping up wallet for better payout capacity' : 
          'Wallet has sufficient balance for instant payouts'
      }
    });
  } catch (error) {
    console.error('❌ Error calculating payout capacity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate payout capacity',
      error: error.message
    });
  }
};

module.exports = {
  getPaystackBalance,
  topUpPaystackWallet,
  getPayoutCapacity
};
