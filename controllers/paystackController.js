const axios = require('axios');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

/**
 * Initialize wallet funding payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const initializeWalletFunding = async (req, res) => {
  try {
    const { amount, email } = req.body;
    const userId = req.user.id;
    const userType = req.user.role;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Generate unique reference
    const reference = `VENDPLUG_${userType.toUpperCase()}_${userId}_${Date.now()}`;
    
    // Create callback URL for payment verification - prioritize environment variable
    let frontendUrl = process.env.FRONTEND_URL;
    
    // If no environment variable, try to detect from request
    if (!frontendUrl) {
      const origin = req.get('origin');
      const host = req.get('host');
      const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
      
      if (origin) {
        frontendUrl = origin;
      } else if (host) {
        frontendUrl = `${protocol}://${host}`;
      } else {
        frontendUrl = 'http://localhost:5000'; // fallback
      }
    }
    
    const callbackUrl = `${frontendUrl}/payment-success.html?reference=${reference}`;

    console.log('💰 Initializing wallet funding:', {
      userId,
      userType,
      amount,
      reference,
      callbackUrl
    });

    // Initialize payment with Paystack
    const paymentResult = await paystackService.initializePayment({
      email,
      amount: amount * 100, // Convert naira to kobo for Paystack
      reference,
      callback_url: callbackUrl,
      metadata: {
        userId: userId.toString(),
        userType,
        purpose: 'wallet_funding',
        amount
      }
    });

    if (!paymentResult.success) {
      return res.status(400).json({
        success: false,
        message: paymentResult.error || 'Failed to initialize payment'
      });
    }

    // Store pending transaction in database
    const pendingTransaction = await Transaction.create({
      ref: reference,
      type: 'fund',
      status: 'pending',
      amount: amount,
      description: 'Wallet funding via Paystack',
      from: 'paystack',
      to: userId,
      initiatedBy: userId,
      initiatorType: userType.charAt(0).toUpperCase() + userType.slice(1),
      metadata: {
        paystackReference: reference,
        authorizationUrl: paymentResult.data.authorization_url,
        accessCode: paymentResult.data.access_code
      }
    });

    console.log('✅ Pending transaction created:', pendingTransaction._id);

    res.json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        reference,
        authorizationUrl: paymentResult.data.authorization_url,
        accessCode: paymentResult.data.access_code,
        amount,
        transactionId: pendingTransaction._id
      }
    });

  } catch (error) {
    console.error('❌ Wallet funding initialization failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize payment',
      error: error.message
    });
  }
};

/**
 * Verify payment and credit wallet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    console.log('🔍 Verifying payment:', reference);

    // Verify payment with Paystack
    const verificationResult = await paystackService.verifyPayment(reference);

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: verificationResult.error || 'Payment verification failed'
      });
    }

    // Find the pending transaction
    const pendingTransaction = await Transaction.findOne({ ref: reference });
    
    if (!pendingTransaction) {
      return res.status(404).json({
        success: false,
        message: 'Pending transaction not found'
      });
    }

    if (pendingTransaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Transaction already processed'
      });
    }

    // Start database transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update transaction status
      pendingTransaction.status = 'successful';
      pendingTransaction.metadata.paystackData = verificationResult.data;
      await pendingTransaction.save({ session });

      // Find or create wallet
      let wallet = await Wallet.findOne({
        user: pendingTransaction.to,
        role: pendingTransaction.initiatorType.toLowerCase()
      }).session(session);
      
      console.log('🔍 Looking for wallet:', {
        user: pendingTransaction.to,
        role: pendingTransaction.initiatorType.toLowerCase(),
        found: !!wallet
      });

      if (!wallet) {
        // Create wallet if it doesn't exist
        console.log('🏗️ Creating new wallet for user:', {
          user: pendingTransaction.to,
          role: pendingTransaction.initiatorType.toLowerCase()
        });
        
        wallet = await Wallet.create({
          user: pendingTransaction.to,
          role: pendingTransaction.initiatorType.toLowerCase(),
          balance: 0,
          virtualAccount: `VA_${pendingTransaction.to}_${Date.now()}`
        }, { session });
        
        console.log('✅ New wallet created:', wallet._id);
      }

      // Credit wallet
      const oldBalance = Number(wallet.balance || 0);
      const newBalance = oldBalance + Number(pendingTransaction.amount);
      
      console.log('💰 Crediting wallet:', {
        walletId: wallet._id,
        oldBalance,
        amount: pendingTransaction.amount,
        newBalance
      });
      
      wallet.balance = newBalance;
      await wallet.save({ session });

      // Create success transaction record
      await Transaction.create([{
        ref: `SUCCESS_${reference}`,
        type: 'credit',
        status: 'successful',
        amount: pendingTransaction.amount,
        description: 'Wallet credited from Paystack payment',
        from: 'paystack',
        to: wallet.virtualAccount,
        initiatedBy: pendingTransaction.to, // Use the actual user ID, not the role string
        initiatorType: pendingTransaction.initiatorType,
        metadata: {
          originalTransaction: pendingTransaction._id,
          paystackReference: reference
        }
      }], { session });

      await session.commitTransaction();

      // Sync balance with user model (after transaction is committed)
      const { syncWalletBalance } = require('./walletHelper');
      await syncWalletBalance(pendingTransaction.to, pendingTransaction.initiatorType, newBalance);

      // Send payment verified notification
      try {
        const io = req.app.get('io');
        const { sendNotification } = require('../utils/notificationHelper');
        
        await sendNotification(io, {
          recipientId: pendingTransaction.to,
          recipientType: pendingTransaction.initiatorType,
          notificationType: 'PAYMENT_VERIFIED',
          args: [pendingTransaction.amount]
        });
      } catch (notificationError) {
        console.error('⚠️ Payment verification notification error:', notificationError);
      }

      console.log('✅ Wallet credited successfully:', {
        userId: pendingTransaction.to,
        amount: pendingTransaction.amount,
        newBalance
      });

      res.json({
        success: true,
        message: 'Payment verified and wallet credited successfully',
        data: {
          reference,
          amount: pendingTransaction.amount,
          newBalance,
          walletId: wallet._id
        }
      });

    } catch (sessionError) {
      console.error('❌ Payment verification failed:', sessionError);
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error('⚠️ Error aborting transaction:', abortError);
      }
      throw sessionError;
    } finally {
      try {
        session.endSession();
      } catch (endError) {
        console.error('⚠️ Error ending session:', endError);
      }
    }

  } catch (error) {
    console.error('❌ Payment verification failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};

/**
 * Get list of Nigerian banks for transfer setup
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBanks = async (req, res) => {
  try {
    console.log('🏦 Fetching Nigerian banks list');

    const banksResult = await paystackService.getBanks();

    if (!banksResult.success) {
      return res.status(400).json({
        success: false,
        message: banksResult.error || 'Failed to fetch banks'
      });
    }

    res.json({
      success: true,
      message: 'Banks list fetched successfully',
      data: banksResult.data
    });

  } catch (error) {
    console.error('❌ Banks fetch failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banks',
      error: error.message
    });
  }
};

/**
 * Verify bank account number
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyBankAccount = async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;

    if (!accountNumber || !bankCode) {
      return res.status(400).json({
        success: false,
        message: 'Account number and bank code are required'
      });
    }

    console.log('🏦 Verifying bank account:', { accountNumber, bankCode });

    const verificationResult = await paystackService.verifyBankAccount(accountNumber, bankCode);

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: verificationResult.error || 'Account verification failed'
      });
    }

    res.json({
      success: true,
      message: 'Bank account verified successfully',
      data: verificationResult.data
    });

  } catch (error) {
    console.error('❌ Bank account verification failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify bank account',
      error: error.message
    });
  }
};

/**
 * Create transfer recipient for automated payouts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createTransferRecipient = async (req, res) => {
  try {
    const { name, accountNumber, bankCode } = req.body;
    const userId = req.user.id;

    if (!name || !accountNumber || !bankCode) {
      return res.status(400).json({
        success: false,
        message: 'Name, account number, and bank code are required'
      });
    }

    console.log('🏦 Creating transfer recipient:', { userId, name, accountNumber, bankCode });

    const recipientResult = await paystackService.createTransferRecipient({
      type: 'nuban',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN'
    });

    if (!recipientResult.success) {
      return res.status(400).json({
        success: false,
        message: recipientResult.error || 'Failed to create transfer recipient'
      });
    }

    // Store recipient code in user profile (you might want to add this to your user models)
    // For now, we'll just return the recipient code

    res.json({
      success: true,
      message: 'Transfer recipient created successfully',
      data: {
        recipientCode: recipientResult.data.recipient_code,
        accountName: recipientResult.data.details.account_name,
        accountNumber: recipientResult.data.details.account_number,
        bankName: recipientResult.data.details.bank_name
      }
    });

  } catch (error) {
    console.error('❌ Transfer recipient creation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transfer recipient',
      error: error.message
    });
  }
};

/**
 * Initiate automated payout transfer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const initiatePayout = async (req, res) => {
  try {
    const { amount, recipientCode, reason } = req.body;
    const userId = req.user.id;

    if (!amount || !recipientCode || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Amount, recipient code, and reason are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    console.log('💸 Initiating payout:', { userId, amount, recipientCode, reason });

    const transferResult = await paystackService.initiateTransfer({
      source: 'balance', // Use Paystack balance
      amount,
      recipient: recipientCode,
      reason
    });

    if (!transferResult.success) {
      return res.status(400).json({
        success: false,
        message: transferResult.error || 'Failed to initiate transfer'
      });
    }

    res.json({
      success: true,
      message: 'Payout initiated successfully',
      data: {
        transferCode: transferResult.data.transfer_code,
        amount,
        status: transferResult.data.status,
        reason
      }
    });

  } catch (error) {
    console.error('❌ Payout initiation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payout',
      error: error.message
    });
  }
};

/**
 * Webhook handler for Paystack events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;

    console.log('🔔 Paystack webhook received:', event);

    // Verify webhook signature (you should implement this for production)
    // const signature = req.headers['x-paystack-signature'];
    // const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    //   .update(JSON.stringify(req.body))
    //   .digest('hex');
    // if (signature !== hash) {
    //   return res.status(401).json({ message: 'Invalid signature' });
    // }

    switch (event) {
      case 'charge.success':
        // Handle successful payment
        console.log('✅ Payment successful via webhook:', data.reference);
        // You can trigger additional actions here
        break;

      case 'transfer.success':
        // Handle successful transfer
        console.log('✅ Transfer successful via webhook:', data.transfer_code);
        // Update payout status in your system
        break;

      case 'transfer.failed':
        // Handle failed transfer
        console.log('❌ Transfer failed via webhook:', data.transfer_code);
        // Update payout status and notify user
        break;

      default:
        console.log('ℹ️ Unhandled webhook event:', event);
    }

    res.json({ status: 'success' });

  } catch (error) {
    console.error('❌ Webhook handling failed:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Service functions for internal use (without Express req/res)
const paystackService = {
  async initializePayment(paymentData) {
    try {
      console.log('💳 Initializing payment:', paymentData);

      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        paymentData,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        console.log('✅ Payment initialized successfully');
        return {
          success: true,
          data: response.data.data
        };
      } else {
        console.log('❌ Payment initialization failed:', response.data.message);
        return {
          success: false,
          message: response.data.message
        };
      }
    } catch (error) {
      console.error('❌ Error initializing payment:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to initialize payment'
      };
    }
  },

  async verifyPayment(reference) {
    try {
      console.log('🔍 Verifying payment:', reference);

      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        }
      );

      if (response.data.status) {
        console.log('✅ Payment verified successfully');
        return {
          success: true,
          data: response.data.data
        };
      } else {
        console.log('❌ Payment verification failed:', response.data.message);
        return {
          success: false,
          message: response.data.message
        };
      }
    } catch (error) {
      console.error('❌ Error verifying payment:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to verify payment'
      };
    }
  },

  async getBanks() {
    try {
      console.log('🏦 Fetching banks list');

      const response = await axios.get(
        'https://api.paystack.co/bank?country=nigeria',
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        }
      );

      if (response.data.status) {
        console.log('✅ Banks fetched successfully');
        return {
          success: true,
          data: response.data.data
        };
      } else {
        console.log('❌ Failed to fetch banks:', response.data.message);
        return {
          success: false,
          message: response.data.message
        };
      }
    } catch (error) {
      console.error('❌ Error fetching banks:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch banks'
      };
    }
  },

  async createTransferRecipient(accountNumber, bankCode, accountName) {
    try {
      console.log('🏦 Creating transfer recipient:', { accountNumber, bankCode, accountName });

      const response = await axios.post(
        'https://api.paystack.co/transferrecipient',
        {
          type: 'nuban',
          name: accountName,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: 'NGN'
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        console.log('✅ Transfer recipient created successfully');
        return {
          success: true,
          data: response.data.data
        };
      } else {
        console.log('❌ Transfer recipient creation failed:', response.data.message);
        return {
          success: false,
          message: response.data.message
        };
      }
    } catch (error) {
      console.error('❌ Error creating transfer recipient:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create transfer recipient'
      };
    }
  },

  async initiateTransfer(recipientCode, amount, description) {
    try {
      console.log('💸 Initiating transfer:', { recipientCode, amount, description });

      const response = await axios.post(
        'https://api.paystack.co/transfer',
        {
          source: 'balance',
          amount: amount * 100, // Convert naira to kobo
          recipient: recipientCode,
          reason: description
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        console.log('✅ Transfer initiated successfully');
        return {
          success: true,
          data: response.data.data
        };
      } else {
        console.log('❌ Transfer initiation failed:', response.data.message);
        return {
          success: false,
          message: response.data.message
        };
      }
    } catch (error) {
      console.error('❌ Error initiating transfer:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to initiate transfer'
      };
    }
  },

  async verifyBankAccount(accountNumber, bankCode) {
    try {
      console.log('🔍 Verifying bank account:', { accountNumber, bankCode });

      const response = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        }
      );

      if (response.data.status) {
        console.log('✅ Bank account verified successfully');
        return {
          success: true,
          data: response.data.data
        };
      } else {
        console.log('❌ Bank account verification failed:', response.data.message);
        return {
          success: false,
          message: response.data.message
        };
      }
    } catch (error) {
      console.error('❌ Error verifying bank account:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to verify bank account'
      };
    }
  }
};

module.exports = {
  initializeWalletFunding,
  verifyPayment,
  getBanks,
  verifyBankAccount,
  createTransferRecipient,
  initiatePayout,
  handleWebhook,
  paystackService
};
