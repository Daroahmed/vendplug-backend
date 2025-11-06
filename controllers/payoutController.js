const PayoutRequest = require('../models/PayoutRequest');
const BankAccount = require('../models/BankAccount');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/Transaction');
const { paystackService } = require('../controllers/paystackController');
const PaystackService = require('../services/paystackService');
const mongoose = require('mongoose');
const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');

// Request a payout
const requestPayout = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, bankAccountId, payoutPin } = req.body;
    const userId = req.user._id || req.user._id || req.user.id;
    
    // More robust role detection
    let userType;
    let userRole;
    if (req.user.role && req.user.role.toLowerCase() === 'vendor') {
      userType = 'Vendor';
      userRole = 'vendor';
    } else if (req.user.role && req.user.role.toLowerCase() === 'agent') {
      userType = 'Agent';
      userRole = 'agent';
    } else {
      // Fallback - try to determine from the user model
      userType = 'Vendor'; // Default fallback
      userRole = 'vendor';
    }
    
    console.log('🔍 Payout request details:', {
      userId,
      userType,
      userRole: req.user.role,
      amount,
      bankAccountId,
      hasPayoutPin: !!payoutPin
    });
    
    // Validate PIN if provided
    if (payoutPin) {
      let user;
      if (userType === 'Vendor') {
        user = await Vendor.findById(userId);
      } else if (userType === 'Agent') {
        user = await Agent.findById(userId);
      }
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if user has set a PIN
      if (!user.payoutPin) {
        return res.status(400).json({
          success: false,
          message: 'Payout PIN not set. Please set your PIN first.',
          requiresPinSetup: true
        });
      }
      
      // Validate PIN
      const isPinValid = await user.matchPayoutPin(payoutPin);
      if (!isPinValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payout PIN'
        });
      }
    } else {
      // Check if user has a PIN set (PIN is required for payouts)
      let user;
      if (userType === 'Vendor') {
        user = await Vendor.findById(userId);
      } else if (userType === 'Agent') {
        user = await Agent.findById(userId);
      }
      
      if (user && user.payoutPin) {
        return res.status(400).json({
          success: false,
          message: 'Payout PIN is required for this transaction',
          requiresPin: true
        });
      }
    }
    
    console.log('🔍 Full req.user object:', JSON.stringify(req.user, null, 2));
    
    // Debug: Check what bank accounts exist for this user
    const allBankAccounts = await BankAccount.find({ userId });
    console.log('🔍 All bank accounts for this user:', allBankAccounts.map(acc => ({
      _id: acc._id,
      userType: acc.userType,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      isVerified: acc.isVerified
    })));
    
    // Debug: Check what bank accounts exist with the specific userType
    const bankAccountsWithUserType = await BankAccount.find({ userId, userType });
    console.log('🔍 Bank accounts with userType:', bankAccountsWithUserType.map(acc => ({
      _id: acc._id,
      userType: acc.userType,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      isVerified: acc.isVerified
    })));

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    // Check if bank account exists and belongs to user
    const bankAccount = await BankAccount.findOne({
      _id: bankAccountId,
      userId,
      userType
    });

    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    if (!bankAccount.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Bank account not verified'
      });
    }

    // Check wallet balance
    console.log('🔍 Looking for wallet with:', { user: userId, role: userRole });
    
    // Let's also check what wallets exist for this user
    const allUserWallets = await Wallet.find({ user: userId });
    console.log('🔍 All wallets for this user:', allUserWallets.map(w => ({ role: w.role, balance: w.balance })));
    
    const wallet = await Wallet.findOne({ user: userId, role: userRole });
    console.log('🔍 Found wallet:', wallet ? { balance: wallet.balance, amount: amount } : 'Not found');
    
    if (!wallet) {
      return res.status(400).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    // No additional transfer fee - already handled in order processing (2% commission + ₦10)
    const transferFee = 0; // No additional fees for payout
    const netAmount = amount; // Amount user will receive
    const totalRequired = amount; // Amount user will receive (no additional fees)
    
    // Check Paystack wallet balance for instant payout capability
    let paystackBalance = 0;
    let canProcessInstantly = false;
    try {
      const paystackServiceInstance = new PaystackService();
      const balanceResponse = await paystackServiceInstance.getBalance();
      // Convert from kobo to naira (Paystack returns balance in kobo)
      paystackBalance = balanceResponse.data[0].balance / 100;
      canProcessInstantly = paystackBalance >= totalRequired;
      
      console.log('💰 Paystack balance check:', {
        paystackBalance,
        requiredAmount: totalRequired,
        canProcessInstantly
      });
    } catch (balanceError) {
      console.warn('⚠️ Could not check Paystack balance:', balanceError.message);
      // Continue with payout request even if balance check fails
    }
    
    // Create payout request
    const payoutRequest = new PayoutRequest({
      userId,
      userType,
      bankAccountId,
      amount,
      netAmount,
      transferFee,
      status: canProcessInstantly ? 'processing' : 'pending',
      metadata: {
        paystackBalance,
        canProcessInstantly,
        instantProcessingAvailable: canProcessInstantly
      }
    });

    await payoutRequest.save({ session });

    // ✅ ATOMIC: Deduct balance only if sufficient funds exist (prevents race conditions)
    // This ensures no negative balances can occur from concurrent requests
    const updatedWallet = await Wallet.findOneAndUpdate(
      { 
        _id: wallet._id,
        balance: { $gte: totalRequired } // Atomic check: balance must be >= required
      },
      { 
        $inc: { balance: -totalRequired } // Atomically decrement balance
      },
      { 
        session,
        new: true // Return updated document
      }
    );

    if (!updatedWallet) {
      // Balance was insufficient or wallet was modified between check and update
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. Required: ₦${totalRequired}, Available: ₦${wallet.balance}. Please refresh and try again.`
      });
    }

    // Use updated wallet for further processing
    wallet.balance = updatedWallet.balance;

    // Create transaction record
    const transaction = new Transaction({
      ref: `PAYOUT_${Date.now()}_${userId}`,
      type: 'withdrawal',
      status: 'pending',
      amount: amount, // Amount user will receive (no additional fees)
      from: wallet.virtualAccount,
      to: bankAccount.accountNumber,
      description: `Payout to ${bankAccount.bankName} - ${bankAccount.accountName} (no additional fees)`,
      initiatedBy: userId,
      initiatorType: userType,
      metadata: {
        payoutRequestId: payoutRequest._id,
        bankAccountId: bankAccount._id,
        note: 'Commission and fees already deducted during order processing'
      }
    });

    await transaction.save({ session });

    // Audit: payout requested
    try { const AuditLog = require('../models/AuditLog'); await AuditLog.create({ eventType: 'PAYOUT_REQUESTED', userId, userType, amount, refId: String(payoutRequest._id) }); } catch(_){ }

    // Initiate Paystack transfer
    try {
      const transferResult = await initiatePaystackTransfer(payoutRequest, bankAccount, amount);
      
      if (transferResult.success) {
        // Update payout request with Paystack reference
        payoutRequest.status = 'processing';
        payoutRequest.paystackReference = transferResult.reference;
        await payoutRequest.save({ session });
        
        // Update transaction
        transaction.status = 'processing';
        transaction.metadata.paystackReference = transferResult.reference;
        await transaction.save({ session });
        
        console.log(`🔄 Paystack transfer initiated: ${transferResult.reference}`);
        try { const AuditLog = require('../models/AuditLog'); await AuditLog.create({ eventType: 'PAYOUT_PROCESSING', userId, userType, amount, refId: transferResult.reference }); } catch(_){ }
      } else {
        // Transfer failed, refund wallet atomically
        await Wallet.findByIdAndUpdate(
          wallet._id,
          { $inc: { balance: totalRequired } },
          { session }
        );
        
        // Update payout status
        payoutRequest.status = 'failed';
        payoutRequest.failureReason = transferResult.error;
        await payoutRequest.save({ session });
        
        // Update transaction
        transaction.status = 'failed';
        transaction.metadata.failureReason = transferResult.error;
        await transaction.save({ session });
        
        console.log(`❌ Paystack transfer failed: ${transferResult.error}`);
        try { const AuditLog = require('../models/AuditLog'); await AuditLog.create({ eventType: 'PAYOUT_FAILED', userId, userType, amount, refId: String(payoutRequest._id), metadata: { reason: transferResult.error } }); } catch(_){ }
        
        return res.status(400).json({
          success: false,
          message: `Transfer failed: ${transferResult.error}`
        });
      }
    } catch (error) {
      // Transfer error, refund wallet atomically
      await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: totalRequired } },
        { session }
      );
      
      // Update payout status
      payoutRequest.status = 'failed';
      payoutRequest.failureReason = error.message;
      await payoutRequest.save({ session });
      
      // Update transaction
      transaction.status = 'failed';
      transaction.metadata.failureReason = error.message;
      await transaction.save({ session });
      
      console.log(`❌ Paystack transfer error: ${error.message}`);
      try { const AuditLog = require('../models/AuditLog'); await AuditLog.create({ eventType: 'PAYOUT_FAILED', userId, userType, amount, refId: String(payoutRequest._id), metadata: { reason: error.message } }); } catch(_){ }
      
      return res.status(500).json({
        success: false,
        message: `Transfer error: ${error.message}`
      });
    }

    await session.commitTransaction();

    // Sync balance with user model (after transaction is committed)
    const { syncWalletBalance } = require('./walletHelper');
    await syncWalletBalance(userId, userRole, wallet.balance);

    // Send payout requested notification
    try {
      const io = req.app.get('io');
      const { sendNotification } = require('../utils/notificationHelper');
      
      await sendNotification(io, {
        recipientId: userId,
        recipientType: userType,
        notificationType: 'PAYOUT_REQUESTED',
        args: [amount]
      });
    } catch (notificationError) {
      console.error('⚠️ Payout notification error (non-critical):', notificationError);
    }

    try { const AuditLog = require('../models/AuditLog'); await AuditLog.create({ eventType: 'PAYOUT_SUBMITTED', userId, userType, amount, refId: String(payoutRequest._id) }); } catch(_){ }

    res.status(201).json({
      success: true,
      message: canProcessInstantly ? 
        'Payout request submitted and will be processed instantly!' : 
        'Payout request submitted successfully. Processing may take up to 24 hours.',
      data: {
        payoutRequest,
        newBalance: wallet.balance,
        instantProcessing: canProcessInstantly,
        paystackBalance,
        estimatedProcessingTime: canProcessInstantly ? 'Instant' : 'Up to 24 hours'
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error requesting payout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit payout request',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Process pending payouts (Admin/System function)
const processPayouts = async (req, res) => {
  try {
    const pendingPayouts = await PayoutRequest.find({ status: 'pending' })
      .populate('bankAccountId');

    const results = [];

    for (const payout of pendingPayouts) {
      try {
        // Update status to processing
        payout.status = 'processing';
        await payout.save();

        // Create transfer recipient
        const recipientResult = await paystackService.createTransferRecipient(
          payout.bankAccountId.accountNumber,
          payout.bankAccountId.bankCode,
          payout.bankAccountId.accountName
        );

        if (!recipientResult.success) {
          payout.status = 'failed';
          payout.failureReason = recipientResult.message;
          await payout.save();
          results.push({ payoutId: payout._id, status: 'failed', reason: recipientResult.message });
          continue;
        }

        // Initiate transfer
        const transferResult = await paystackService.initiateTransfer(
          recipientResult.data.recipient_code,
          payout.amount, // Amount in naira (Paystack service will convert to kobo)
          `Payout for ${payout.userType} - ${payout._id}`
        );

        if (!transferResult.success) {
          payout.status = 'failed';
          payout.failureReason = transferResult.message;
          await payout.save();
          results.push({ payoutId: payout._id, status: 'failed', reason: transferResult.message });
          continue;
        }

        // Update payout request
        payout.status = 'completed';
        payout.paystackReference = transferResult.data.reference;
        payout.paystackTransferCode = transferResult.data.transfer_code;
        payout.processedAt = new Date();
        await payout.save();

        // Update transaction status
        await Transaction.findOneAndUpdate(
          { 'metadata.payoutRequestId': payout._id },
          { 
            status: 'successful',
            metadata: { 
              ...payout.metadata,
              paystackReference: transferResult.data.reference,
              paystackTransferCode: transferResult.data.transfer_code
            }
          }
        );

        results.push({ payoutId: payout._id, status: 'completed' });

        // Send success notification
        try {
          const io = req.app.get('io');
          const { sendNotification } = require('../utils/notificationHelper');
          
          await sendNotification(io, {
            recipientId: payout.userId,
            recipientType: payout.userType,
            notificationType: 'PAYOUT_PROCESSED',
            args: [payout.amount],
            meta: {
              payoutId: payout._id,
              paystackReference: transferResult.data.reference
            }
          });
        } catch (notificationError) {
          console.error('Payout success notification error:', notificationError);
        }

      } catch (error) {
        console.error(`Error processing payout ${payout._id}:`, error);
        payout.status = 'failed';
        payout.failureReason = error.message;
        await payout.save();
        results.push({ payoutId: payout._id, status: 'failed', reason: error.message });

        // Send failure notification
        try {
          const io = req.app.get('io');
          const { sendNotification } = require('../utils/notificationHelper');
          
          await sendNotification(io, {
            recipientId: payout.userId,
            recipientType: payout.userType,
            notificationType: 'PAYOUT_FAILED',
            args: [payout.amount, error.message],
            meta: {
              payoutId: payout._id,
              failureReason: error.message
            }
          });
        } catch (notificationError) {
          console.error('Payout failure notification error:', notificationError);
        }
      }
    }

    res.json({
      success: true,
      message: 'Payout processing completed',
      data: results
    });

  } catch (error) {
    console.error('Error processing payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payouts',
      error: error.message
    });
  }
};

// Get user's payout history
const getPayoutHistory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    // More robust role detection
    let userType;
    let userRole;
    if (req.user.role && req.user.role.toLowerCase() === 'vendor') {
      userType = 'Vendor';
      userRole = 'vendor';
    } else if (req.user.role && req.user.role.toLowerCase() === 'agent') {
      userType = 'Agent';
      userRole = 'agent';
    } else {
      // Fallback - try to determine from the user model
      userType = 'Vendor'; // Default fallback
      userRole = 'vendor';
    }

    const payouts = await PayoutRequest.find({ userId, userType })
      .populate('bankAccountId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: payouts
    });

  } catch (error) {
    console.error('Error fetching payout history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payout history',
      error: error.message
    });
  }
};

// Get payout details
const getPayoutDetails = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const userId = req.user._id || req.user.id;
    
    // More robust role detection
    let userType;
    let userRole;
    if (req.user.role && req.user.role.toLowerCase() === 'vendor') {
      userType = 'Vendor';
      userRole = 'vendor';
    } else if (req.user.role && req.user.role.toLowerCase() === 'agent') {
      userType = 'Agent';
      userRole = 'agent';
    } else {
      // Fallback - try to determine from the user model
      userType = 'Vendor'; // Default fallback
      userRole = 'vendor';
    }

    const payout = await PayoutRequest.findOne({
      _id: payoutId,
      userId,
      userType
    }).populate('bankAccountId');

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: 'Payout not found'
      });
    }

    res.json({
      success: true,
      data: payout
    });

  } catch (error) {
    console.error('Error fetching payout details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payout details',
      error: error.message
    });
  }
};

// Initiate Paystack transfer
const initiatePaystackTransfer = async (payoutRequest, bankAccount, amount) => {
  try {
    console.log(`🔄 Initiating Paystack transfer for payout: ${payoutRequest._id}`);
    
    // First, create transfer recipient
    const recipientResult = await paystackService.createTransferRecipient(
      bankAccount.accountNumber,
      bankAccount.bankCode,
      bankAccount.accountName
    );

    if (!recipientResult.success) {
      return {
        success: false,
        error: `Failed to create recipient: ${recipientResult.message}`
      };
    }

    // Then, initiate the transfer
    const transferResult = await paystackService.initiateTransfer(
      recipientResult.data.recipient_code,
      amount, // Amount in naira (Paystack service will convert to kobo)
      `Payout for ${payoutRequest.userType} - ${payoutRequest._id}`
    );

    if (!transferResult.success) {
      return {
        success: false,
        error: `Failed to initiate transfer: ${transferResult.message}`
      };
    }

    return {
      success: true,
      reference: transferResult.data.reference,
      transferCode: transferResult.data.transfer_code,
      message: 'Transfer initiated successfully'
    };

  } catch (error) {
    console.error('❌ Error initiating Paystack transfer:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Fix stuck processing payouts (Admin function)
const fixStuckProcessingPayouts = async (req, res) => {
  try {
    console.log('🔧 Fixing stuck processing payouts...');
    
    // Find all payouts stuck in processing status for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const stuckPayouts = await PayoutRequest.find({
      status: 'processing',
      updatedAt: { $lt: fiveMinutesAgo }
    });

    console.log(`🔍 Found ${stuckPayouts.length} stuck processing payouts`);

    const results = [];
    
    for (const payout of stuckPayouts) {
      try {
        // Check if we have a Paystack reference
        if (payout.paystackReference) {
          // Assume it was successful if we have a reference
          payout.status = 'completed';
          payout.processedAt = new Date();
          await payout.save();

          // Update transaction status
          await Transaction.findOneAndUpdate(
            { ref: { $regex: `PAYOUT_${payout._id}` } },
            { 
              status: 'completed',
              metadata: {
                ...payout.metadata,
                fixedAt: new Date(),
                note: 'Status fixed from stuck processing'
              }
            }
          );

          results.push({ 
            payoutId: payout._id, 
            status: 'fixed', 
            message: 'Marked as completed (had Paystack reference)' 
          });
          
          console.log(`✅ Fixed payout ${payout._id} - marked as completed`);
        } else {
          // No Paystack reference - mark as failed
          payout.status = 'failed';
          payout.failureReason = 'No Paystack reference found - transfer may have failed';
          payout.processedAt = new Date();
          await payout.save();

          // Refund wallet
          const wallet = await Wallet.findOne({
            user: payout.userId,
            role: payout.userType.toLowerCase()
          });

          if (wallet) {
            await Wallet.findByIdAndUpdate(
              wallet._id,
              { $inc: { balance: payout.amount } }
            );
            console.log(`💰 Refunded ₦${payout.amount} to wallet for failed payout ${payout._id}`);
          }

          results.push({ 
            payoutId: payout._id, 
            status: 'failed', 
            message: 'Marked as failed - no Paystack reference, refunded wallet' 
          });
          
          console.log(`❌ Fixed payout ${payout._id} - marked as failed and refunded`);
        }

      } catch (error) {
        console.error(`❌ Error fixing payout ${payout._id}:`, error);
        results.push({ 
          payoutId: payout._id, 
          status: 'error', 
          message: error.message 
        });
      }
    }

    res.json({
      success: true,
      message: `Fixed ${results.length} stuck processing payouts`,
      data: results
    });

  } catch (error) {
    console.error('❌ Fix stuck processing payouts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix stuck processing payouts',
      error: error.message
    });
  }
};

// Check and update payout statuses from Paystack
const checkPayoutStatuses = async (req, res) => {
  try {
    console.log('🔍 Checking payout statuses from Paystack...');
    
    const PayoutRequest = require('../models/PayoutRequest');
    const Transaction = require('../models/Transaction');
    const Wallet = require('../models/walletModel');
    const PaystackService = require('../services/paystackService');
    
    // Find all processing payouts
    const processingPayouts = await PayoutRequest.find({
      status: 'processing',
      paystackReference: { $exists: true, $ne: null }
    });

    console.log(`📊 Found ${processingPayouts.length} processing payouts to check`);

    if (processingPayouts.length === 0) {
      return res.json({
        success: true,
        message: 'No processing payouts found',
        updated: 0
      });
    }

    let updatedCount = 0;
    const paystackService = new PaystackService();

    for (const payout of processingPayouts) {
      try {
        console.log(`🔍 Checking payout ${payout._id} with reference: ${payout.paystackReference}`);
        
        // Get transfer details from Paystack
        const transferDetails = await paystackService.getTransfer(payout.paystackReference);
        console.log(`📊 Transfer status for ${payout.paystackReference}:`, transferDetails.status);
        
        if (transferDetails.status === 'success') {
          // Update payout status to completed
          payout.status = 'completed';
          payout.paystackTransferCode = transferDetails.transfer_code;
          payout.processedAt = new Date();
          await payout.save();

          // Update transaction status
          await Transaction.findOneAndUpdate(
            { ref: { $regex: `PAYOUT_${payout._id}` } },
            { 
              status: 'completed',
              metadata: {
                ...payout.metadata,
                paystackTransferCode: transferDetails.transfer_code,
                completedAt: new Date()
              }
            }
          );

          console.log(`✅ Updated payout ${payout._id} to completed`);
          updatedCount++;
          
        } else if (transferDetails.status === 'failed') {
          // Update payout status to failed
          payout.status = 'failed';
          payout.failureReason = transferDetails.failure_reason || 'Transfer failed';
          payout.processedAt = new Date();
          await payout.save();

          // Refund the amount back to vendor's wallet
          const wallet = await Wallet.findOne({
            user: payout.userId,
            role: payout.userType.toLowerCase()
          });

          if (wallet) {
            await Wallet.findByIdAndUpdate(
              wallet._id,
              { $inc: { balance: payout.amount } }
            );
            console.log(`💰 Refunded ₦${payout.amount} to wallet`);
          }

          // Update transaction status
          await Transaction.findOneAndUpdate(
            { ref: { $regex: `PAYOUT_${payout._id}` } },
            { 
              status: 'failed',
              metadata: {
                ...payout.metadata,
                failureReason: transferDetails.failure_reason,
                failedAt: new Date()
              }
            }
          );

          console.log(`❌ Updated payout ${payout._id} to failed`);
          updatedCount++;
          
        } else {
          console.log(`⏳ Payout ${payout._id} still processing on Paystack`);
        }
        
      } catch (error) {
        console.error(`❌ Error checking payout ${payout._id}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `Updated ${updatedCount} payout statuses`,
      updated: updatedCount,
      total: processingPayouts.length
    });

  } catch (error) {
    console.error('❌ Error checking payout statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking payout statuses',
      error: error.message
    });
  }
};

// Set payout PIN
const setPayoutPin = async (req, res) => {
  try {
    const { payoutPin, confirmPin } = req.body;
    const userId = req.user._id || req.user.id;
    
    // Determine user type
    let userType;
    if (req.user.role && req.user.role.toLowerCase() === 'vendor') {
      userType = 'Vendor';
    } else if (req.user.role && req.user.role.toLowerCase() === 'agent') {
      userType = 'Agent';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user role'
      });
    }
    
    // Validate PIN
    if (!payoutPin || payoutPin.length < 4 || payoutPin.length > 6) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be between 4 and 6 digits'
      });
    }
    
    // Validate PIN is numeric
    if (!/^\d+$/.test(payoutPin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must contain only numbers'
      });
    }
    
    if (payoutPin !== confirmPin) {
      return res.status(400).json({
        success: false,
        message: 'PIN and confirmation do not match'
      });
    }
    
    // Update user with new PIN
    let user;
    if (userType === 'Vendor') {
      user = await Vendor.findById(userId);
    } else if (userType === 'Agent') {
      user = await Agent.findById(userId);
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    user.payoutPin = payoutPin;
    await user.save();
    
    res.json({
      success: true,
      message: 'Payout PIN set successfully'
    });
    
  } catch (error) {
    console.error('Error setting payout PIN:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set payout PIN'
    });
  }
};

// Check if user has PIN set
const checkPayoutPinStatus = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    // Determine user type
    let userType;
    if (req.user.role && req.user.role.toLowerCase() === 'vendor') {
      userType = 'Vendor';
    } else if (req.user.role && req.user.role.toLowerCase() === 'agent') {
      userType = 'Agent';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user role'
      });
    }
    
    // Check if user has PIN set
    let user;
    if (userType === 'Vendor') {
      user = await Vendor.findById(userId);
    } else if (userType === 'Agent') {
      user = await Agent.findById(userId);
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      hasPin: !!user.payoutPin,
      pinSetAt: user.payoutPinSetAt
    });
    
  } catch (error) {
    console.error('Error checking payout PIN status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check PIN status'
    });
  }
};

// Request PIN reset (send verification code to email)
const requestPinReset = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user._id || req.user.id;
    
    // Determine user type
    let userType;
    if (req.user.role && req.user.role.toLowerCase() === 'vendor') {
      userType = 'Vendor';
    } else if (req.user.role && req.user.role.toLowerCase() === 'agent') {
      userType = 'Agent';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user role'
      });
    }
    
    // Get user and verify password
    let user;
    if (userType === 'Vendor') {
      user = await Vendor.findById(userId);
    } else if (userType === 'Agent') {
      user = await Agent.findById(userId);
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Verify password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }
    
    // Check if user has a PIN to reset
    if (!user.payoutPin) {
      return res.status(400).json({
        success: false,
        message: 'No PIN set to reset'
      });
    }
    
    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Store reset code in user document
    user.pinResetCode = resetCode;
    user.pinResetCodeExpiry = resetCodeExpiry;
    await user.save();
    
    // Send email with reset code
    try {
      const { sendPinResetEmail } = require('../utils/emailService');
      const emailSent = await sendPinResetEmail(user.email, resetCode, userType);
      
      if (emailSent) {
        console.log(`✅ PIN reset email sent to ${user.email}`);
        res.json({
          success: true,
          message: 'Reset code sent to your email',
          // Only show code in development for debugging
          resetCode: process.env.NODE_ENV === 'development' ? resetCode : undefined
        });
      } else {
        console.error(`❌ Failed to send PIN reset email to ${user.email}`);
        res.status(500).json({
          success: false,
          message: 'Failed to send reset code. Please try again.',
          // Show code in development even if email fails
          resetCode: process.env.NODE_ENV === 'development' ? resetCode : undefined
        });
      }
    } catch (emailError) {
      console.error('❌ Email service error:', emailError);
      res.status(500).json({
        success: false,
        message: 'Failed to send reset code. Please try again.',
        // Show code in development even if email fails
        resetCode: process.env.NODE_ENV === 'development' ? resetCode : undefined
      });
    }
    
  } catch (error) {
    console.error('Error requesting PIN reset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request PIN reset'
    });
  }
};

// Verify PIN reset code and set new PIN
const resetPin = async (req, res) => {
  try {
    const { resetCode, newPin, confirmPin } = req.body;
    const userId = req.user._id || req.user.id;
    
    // Determine user type
    let userType;
    if (req.user.role && req.user.role.toLowerCase() === 'vendor') {
      userType = 'Vendor';
    } else if (req.user.role && req.user.role.toLowerCase() === 'agent') {
      userType = 'Agent';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user role'
      });
    }
    
    // Get user
    let user;
    if (userType === 'Vendor') {
      user = await Vendor.findById(userId);
    } else if (userType === 'Agent') {
      user = await Agent.findById(userId);
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Validate reset code
    if (!user.pinResetCode || user.pinResetCode !== resetCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset code'
      });
    }
    
    // Check if reset code has expired
    if (!user.pinResetCodeExpiry || new Date() > user.pinResetCodeExpiry) {
      return res.status(400).json({
        success: false,
        message: 'Reset code has expired'
      });
    }
    
    // Validate new PIN
    if (!newPin || newPin.length < 4 || newPin.length > 6) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be between 4 and 6 digits'
      });
    }
    
    // Validate PIN is numeric
    if (!/^\d+$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must contain only numbers'
      });
    }
    
    if (newPin !== confirmPin) {
      return res.status(400).json({
        success: false,
        message: 'PIN and confirmation do not match'
      });
    }
    
    // Set new PIN and clear reset code
    user.payoutPin = newPin;
    user.pinResetCode = undefined;
    user.pinResetCodeExpiry = undefined;
    await user.save();
    
    res.json({
      success: true,
      message: 'PIN reset successfully'
    });
    
  } catch (error) {
    console.error('Error resetting PIN:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset PIN'
    });
  }
};

module.exports = {
  requestPayout,
  processPayouts,
  getPayoutHistory,
  getPayoutDetails,
  fixStuckProcessingPayouts,
  checkPayoutStatuses,
  setPayoutPin,
  checkPayoutPinStatus,
  requestPinReset,
  resetPin
};


