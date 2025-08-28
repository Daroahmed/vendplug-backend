const PaystackService = require('../services/paystackService');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/Transaction');
const { sendWalletNotification } = require('../utils/notificationHelper');

/**
 * Initialize transaction for wallet funding
 */
const initializePayment = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.user;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const reference = PaystackService.generateReference();
    const metadata = {
      userId: user._id,
      userType: user.role,
      purpose: 'wallet_funding'
    };

    const response = await PaystackService.initializeTransaction({
      email: user.email,
      amount,
      reference,
      metadata
    });

    res.json({
      authorization_url: response.data.authorization_url,
      reference: response.data.reference
    });
  } catch (error) {
    console.error('❌ Payment initialization error:', error);
    res.status(500).json({ message: 'Failed to initialize payment' });
  }
};

/**
 * Verify transaction after payment
 */
const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.query;
    const response = await PaystackService.verifyTransaction(reference);

    if (!response.data.status || response.data.status !== 'success') {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    const metadata = response.data.metadata;
    const amount = response.data.amount / 100; // Convert from kobo to naira

    // Update user's wallet
    const wallet = await Wallet.findOne({ user: metadata.userId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    wallet.balance += amount;
    await wallet.save();

    // Record transaction
    const transaction = await Transaction.create({
      user: metadata.userId,
      type: 'credit',
      amount,
      reference,
      description: 'Wallet funding via Paystack',
      metadata: {
        paymentGateway: 'paystack',
        paymentReference: reference
      }
    });

    // Send notification
    const io = req.app.get('io');
    await sendWalletNotification(io, {
      userId: metadata.userId,
      userType: metadata.userType,
      type: 'credit',
      amount,
      source: 'Paystack Payment',
      balance: wallet.balance
    });

    res.json({
      message: 'Payment verified successfully',
      transaction
    });
  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({ message: 'Failed to verify payment' });
  }
};

/**
 * Handle Paystack webhook
 */
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const payload = req.body;

    // Verify webhook signature
    if (!PaystackService.verifyWebhookSignature(payload, signature)) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const { event, data } = payload;

    switch (event) {
      case 'charge.success':
        // Handle successful charge
        if (data.metadata.purpose === 'wallet_funding') {
          const amount = data.amount / 100;
          const wallet = await Wallet.findOne({ user: data.metadata.userId });
          
          if (wallet) {
            wallet.balance += amount;
            await wallet.save();

            // Create transaction record
            await Transaction.create({
              user: data.metadata.userId,
              type: 'credit',
              amount,
              reference: data.reference,
              description: 'Wallet funding via Paystack (webhook)',
              metadata: {
                paymentGateway: 'paystack',
                paymentReference: data.reference
              }
            });

            // Send notification
            const io = req.app.get('io');
            await sendWalletNotification(io, {
              userId: data.metadata.userId,
              userType: data.metadata.userType,
              type: 'credit',
              amount,
              source: 'Paystack Payment',
              balance: wallet.balance
            });
          }
        }
        break;

      // Add more event handlers as needed
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  handleWebhook
};
