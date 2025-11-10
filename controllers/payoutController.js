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
    // Deterministic, idempotent reference we will use with Paystack
    const transferReference = `PAYOUT_${userType}_${String(userId)}_${Date.now()}`;
    const payoutRequest = new PayoutRequest({
      userId,
      userType,
      bankAccountId,
      amount,
      netAmount,
      transferFee,
      status: canProcessInstantly ? 'processing' : 'pending',
      transferReference,
      metadata: {
        paystackBalance,
        canProcessInstantly,
        instantProcessingAvailable: canProcessInstantly
      }
    });

    await payoutRequest.save({ session });

    // Notify admins of payout request
    try {
      const io = req.app.get('io');
      const { sendNotification } = require('../utils/notificationHelper');
      const Admin = require('../models/Admin');
      const admins = await Admin.find({ isActive: true });
      for (const admin of admins) {
        await sendNotification(io, {
          recipientId: admin._id,
          recipientType: 'Admin',
          notificationType: 'ADMIN_PAYOUT_REQUESTED',
          args: [amount, userType]
        });
      }
      // Low Paystack balance alert
      const LOW_BALANCE_THRESHOLD = Number(process.env.PAYSTACK_LOW_BALANCE_THRESHOLD || 50000);
      if (Number(paystackBalance) < LOW_BALANCE_THRESHOLD) {
        for (const admin of admins) {
          await sendNotification(io, {
            recipientId: admin._id,
            recipientType: 'Admin',
            notificationType: 'ADMIN_LOW_PAYSTACK_BALANCE',
            args: [paystackBalance, LOW_BALANCE_THRESHOLD]
          });
        }
      }
    } catch (adminNotifyError) {
      console.error('⚠️ Admin payout notification error:', adminNotifyError?.message || adminNotifyError);
    }

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

    // Initiate Paystack transfer (only if balance allows instant processing)
    if (canProcessInstantly) {
      try {
        const transferResult = await initiatePaystackTransfer(payoutRequest, bankAccount, amount, transferReference);
        
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
          // If failure looks like insufficient balance, queue instead of failing/refunding
          const isInsufficient = /insufficient/i.test(String(transferResult.error || ''));
          if (isInsufficient) {
            payoutRequest.status = 'pending';
            payoutRequest.failureReason = 'Queued due to low Paystack balance';
            payoutRequest.queuedAt = new Date();
            payoutRequest.attempts = (payoutRequest.attempts || 0) + 1;
            payoutRequest.nextAttemptAt = new Date(Date.now() + 5 * 60 * 1000); // retry in 5 min
            await payoutRequest.save({ session });

            // Leave transaction as pending and keep wallet deducted (funds reserved)
            transaction.status = 'pending';
            transaction.metadata.queueReason = 'Low Paystack balance';
            await transaction.save({ session });

            console.log('⏳ Transfer queued due to low Paystack balance');
          } else {
            // Other failure modes: refund and fail
            await Wallet.findByIdAndUpdate(
              wallet._id,
              { $inc: { balance: totalRequired } },
              { session }
            );
            
            payoutRequest.status = 'failed';
            payoutRequest.failureReason = transferResult.error;
            await payoutRequest.save({ session });
            
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
        }
      } catch (error) {
        // Unknown error: treat as queued if possible, else fail
        const isInsufficient = /insufficient/i.test(String(error?.message || ''));
        if (isInsufficient) {
          payoutRequest.status = 'pending';
          payoutRequest.failureReason = 'Queued due to low Paystack balance';
          payoutRequest.queuedAt = new Date();
          payoutRequest.attempts = (payoutRequest.attempts || 0) + 1;
          payoutRequest.nextAttemptAt = new Date(Date.now() + 5 * 60 * 1000);
          await payoutRequest.save({ session });

          transaction.status = 'pending';
          transaction.metadata.queueReason = 'Low Paystack balance';
          await transaction.save({ session });

          console.log('⏳ Transfer queued due to low Paystack balance (exception)');
        } else {
          await Wallet.findByIdAndUpdate(
            wallet._id,
            { $inc: { balance: totalRequired } },
            { session }
          );
          
          payoutRequest.status = 'failed';
          payoutRequest.failureReason = error.message;
          await payoutRequest.save({ session });
          
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
      }
    } else {
      // Queue immediately if balance cannot cover this payout
      payoutRequest.status = 'pending';
      payoutRequest.failureReason = 'Queued due to low Paystack balance';
      payoutRequest.queuedAt = new Date();
      payoutRequest.attempts = 0;
      payoutRequest.nextAttemptAt = new Date(Date.now() + 5 * 60 * 1000);
      await payoutRequest.save({ session });

      // Leave transaction pending; wallet remains deducted (reserved)
      transaction.status = 'pending';
      transaction.metadata.queueReason = 'Low Paystack balance (initial)';
      await transaction.save({ session });

      console.log('⏳ Payout queued due to low Paystack balance (no initiation attempted)');
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
        'Payout queued due to low Paystack balance. It will be processed automatically once funds are available.',
      data: {
        payoutRequest,
        newBalance: wallet.balance,
        instantProcessing: canProcessInstantly,
        paystackBalance,
        estimatedProcessingTime: canProcessInstantly ? 'Instant' : 'Up to 24 hours',
        transferReference
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
const initiatePaystackTransfer = async (payoutRequest, bankAccount, amount, reference) => {
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
      `Payout for ${payoutRequest.userType} - ${payoutRequest._id}`,
      reference || payoutRequest.transferReference
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

// Background-safe processor for queued payouts
const processPayoutQueue = async () => {
  try {
    const now = new Date();
    // Fetch pending payouts whose retry time has arrived, in FIFO order
    const queued = await PayoutRequest.find({
      status: 'pending',
      $or: [
        { nextAttemptAt: { $lte: now } },
        { nextAttemptAt: { $exists: false } },
        { nextAttemptAt: null }
      ]
    }).sort({ createdAt: 1 }).limit(25);

    if (!queued.length) return;

    const paystackServiceInstance = new PaystackService();
    const balanceResponse = await paystackServiceInstance.getBalance();
    let available = (balanceResponse?.data?.[0]?.balance || 0) / 100;

    console.log(`🧮 Processing payout queue: ${queued.length} queued, Paystack balance ₦${available}`);

    for (const p of queued) {
      // Ensure required financial fields exist for legacy records
      if (p.netAmount == null) {
        const fee = p.transferFee != null ? Number(p.transferFee) : 50;
        p.transferFee = fee;
        const amt = Number(p.amount || 0);
        p.netAmount = Math.max(0, amt - fee);
      }
      // Skip if a transfer was already initiated (idempotency)
      if (p.paystackReference) continue;

      // Stop if insufficient for this payout
      if (available < p.amount) {
        // Push next attempt by a few minutes to avoid hammering
        p.nextAttemptAt = new Date(Date.now() + 5 * 60 * 1000);
        // Guard required fields on save
        if (p.netAmount == null) {
          const fee = p.transferFee != null ? Number(p.transferFee) : 50;
          p.transferFee = fee;
          const amt = Number(p.amount || 0);
          p.netAmount = Math.max(0, amt - fee);
        }
        await p.save();
        continue;
      }

      // Fetch related bank account and user wallet role for logging
      const bankAccount = await BankAccount.findById(p.bankAccountId);
      if (!bankAccount) {
        // Permanently fail if bank account vanished
        p.status = 'failed';
        p.failureReason = 'Bank account not found during queued processing';
        // Guard required fields on save
        if (p.netAmount == null) {
          const fee = p.transferFee != null ? Number(p.transferFee) : 50;
          p.transferFee = fee;
          const amt = Number(p.amount || 0);
          p.netAmount = Math.max(0, amt - fee);
        }
        await p.save();
        continue;
      }

      // Try initiate
      const transferRef = p.transferReference || `PAYOUT_${p.userType}_${String(p.userId)}_${Date.now()}`;
      const result = await initiatePaystackTransfer(p, bankAccount, p.amount, transferRef);

      if (result.success) {
        p.status = 'processing';
        p.paystackReference = result.reference;
        p.attempts = (p.attempts || 0) + 1;
        p.nextAttemptAt = undefined;
        // Guard required fields on save
        if (p.netAmount == null) {
          const fee = p.transferFee != null ? Number(p.transferFee) : 50;
          p.transferFee = fee;
          const amt = Number(p.amount || 0);
          p.netAmount = Math.max(0, amt - fee);
        }
        await p.save();

        // Update linked transaction to processing
        await Transaction.findOneAndUpdate(
          { 'metadata.payoutRequestId': p._id },
          { status: 'processing', $set: { 'metadata.paystackReference': result.reference } }
        );

        available -= p.amount;
        console.log(`🚀 Initiated queued payout ${p._id} → ${result.reference}; remaining ₦${available}`);
      } else {
        const isInsufficient = /insufficient/i.test(String(result.error || ''));
        p.attempts = (p.attempts || 0) + 1;
        p.nextAttemptAt = new Date(Date.now() + (isInsufficient ? 5 : 10) * 60 * 1000);
        p.failureReason = result.error;
        // Guard required fields on save
        if (p.netAmount == null) {
          const fee = p.transferFee != null ? Number(p.transferFee) : 50;
          p.transferFee = fee;
          const amt = Number(p.amount || 0);
          p.netAmount = Math.max(0, amt - fee);
        }
        await p.save();

        if (!isInsufficient) {
          // Hard failure for non-balance reasons: refund wallet and mark failed
          const wallet = await Wallet.findOne({ user: p.userId, role: p.userType.toLowerCase() });
          if (wallet) {
            await Wallet.findByIdAndUpdate(wallet._id, { $inc: { balance: p.amount } });
          }
          p.status = 'failed';
          // Guard required fields on save
          if (p.netAmount == null) {
            const fee = p.transferFee != null ? Number(p.transferFee) : 50;
            p.transferFee = fee;
            const amt = Number(p.amount || 0);
            p.netAmount = Math.max(0, amt - fee);
          }
          await p.save();

          await Transaction.findOneAndUpdate(
            { 'metadata.payoutRequestId': p._id },
            { status: 'failed', $set: { 'metadata.failureReason': result.error } }
          );

          console.log(`❌ Queued payout ${p._id} hard-failed: ${result.error} (refunded)`);
        } else {
          console.log(`⏳ Queued payout ${p._id} deferred: ${result.error}`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error processing payout queue:', err.message);
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
          // Guard required fields for legacy docs
          if (payout.netAmount == null) {
            const fee = payout.transferFee != null ? Number(payout.transferFee) : 50;
            payout.transferFee = fee;
            const amt = Number(payout.amount || 0);
            payout.netAmount = Math.max(0, amt - fee);
          }
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
          // Guard required fields for legacy docs
          if (payout.netAmount == null) {
            const fee = payout.transferFee != null ? Number(payout.transferFee) : 50;
            payout.transferFee = fee;
            const amt = Number(payout.amount || 0);
            payout.netAmount = Math.max(0, amt - fee);
          }
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

// Admin: list payouts with queue info
const listPayoutsAdmin = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      PayoutRequest.find(query)
        .populate('bankAccountId')
        .populate({ path: 'userId', select: 'fullName businessName email phoneNumber role' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PayoutRequest.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: items,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)) || 1
    });
  } catch (error) {
    console.error('Error listing payouts (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list payouts'
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
  resetPin,
  processPayoutQueue,
  listPayoutsAdmin
};


