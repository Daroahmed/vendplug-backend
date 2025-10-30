const crypto = require('crypto');
const PayoutRequest = require('../models/PayoutRequest');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/walletModel');
const emailService = require('../utils/emailService');

// Verify Paystack webhook signature
const verifyWebhookSignature = (req) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  return hash === req.headers['x-paystack-signature'];
};

// Process transfer webhook
const processTransferWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    if (!verifyWebhookSignature(req)) {
      console.log('⚠️ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, data } = req.body;
    console.log(`🔔 Paystack webhook received: ${event}`);
    console.log('📊 Webhook data:', JSON.stringify(data, null, 2));

    // Handle different transfer events
    switch (event) {
      case 'transfer.success':
        console.log('✅ Processing transfer success...');
        await handleTransferSuccess(data);
        break;
      
      case 'transfer.failed':
        console.log('❌ Processing transfer failure...');
        await handleTransferFailed(data);
        break;
      
      case 'transfer.reversed':
        console.log('🔄 Processing transfer reversal...');
        await handleTransferReversed(data);
        break;
      
      default:
        console.log(`ℹ️ Unhandled webhook event: ${event}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Handle successful transfer
const handleTransferSuccess = async (transferData) => {
  try {
    const { reference, transfer_code, amount, recipient, metadata } = transferData;
    
    console.log(`✅ Transfer successful: ${reference}`);
    console.log('📊 Transfer details:', {
      reference,
      transfer_code,
      amount: amount / 100, // Convert from kobo to naira
      recipient: recipient.account_number,
      metadata
    });

    // Find payout request by reference
    console.log(`🔍 Looking for payout request with reference: ${reference}`);
    const payoutRequest = await PayoutRequest.findOne({
      paystackReference: reference
    });

    if (!payoutRequest) {
      console.log(`⚠️ Payout request not found for reference: ${reference}`);
      console.log('🔍 Available payout references:', await PayoutRequest.find({}, 'paystackReference').limit(10));
      return;
    }

    console.log(`✅ Found payout request: ${payoutRequest._id}, current status: ${payoutRequest.status}`);

    // Update payout status
    payoutRequest.status = 'completed';
    payoutRequest.paystackTransferCode = transfer_code;
    payoutRequest.processedAt = new Date();
    await payoutRequest.save();
    
    console.log(`✅ Updated payout request ${payoutRequest._id} to completed status`);

    // Update transaction status
    await Transaction.findOneAndUpdate(
      { ref: { $regex: `PAYOUT_${payoutRequest._id}` } },
      { 
        status: 'completed',
        metadata: {
          ...payoutRequest.metadata,
          paystackTransferCode: transfer_code,
          completedAt: new Date()
        }
      }
    );

    // Send success notification to vendor
    await sendPayoutNotification(payoutRequest, 'success');

    // Send real-time notification
    try {
      const { sendNotification } = require('../utils/notificationHelper');
      const io = require('../server').io; // Get io instance
      
      if (io) {
        await sendNotification(io, {
          recipientId: payoutRequest.userId,
          recipientType: payoutRequest.userType,
          notificationType: 'PAYOUT_PROCESSED',
          args: [amount / 100] // Convert from kobo to naira
        });
      }
    } catch (notificationError) {
      console.error('⚠️ Payout success notification error:', notificationError);
    }

    console.log(`✅ Payout ${payoutRequest._id} marked as completed`);

  } catch (error) {
    console.error('❌ Error handling transfer success:', error);
  }
};

// Handle failed transfer
const handleTransferFailed = async (transferData) => {
  try {
    const { reference, failure_reason, metadata } = transferData;
    
    console.log(`❌ Transfer failed: ${reference}`);
    console.log('📊 Failure details:', {
      reference,
      failure_reason,
      metadata
    });

    // Find payout request
    const payoutRequest = await PayoutRequest.findOne({
      paystackReference: reference
    });

    if (!payoutRequest) {
      console.log(`⚠️ Payout request not found for reference: ${reference}`);
      return;
    }

    // Update payout status
    payoutRequest.status = 'failed';
    payoutRequest.failureReason = failure_reason;
    payoutRequest.processedAt = new Date();
    await payoutRequest.save();

    // Refund wallet (add money back)
    const wallet = await Wallet.findOne({
      user: payoutRequest.userId,
      role: payoutRequest.userType.toLowerCase()
    });

    if (wallet) {
      await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: payoutRequest.amount } }
      );
      console.log(`💰 Refunded ₦${payoutRequest.amount} to wallet`);
    }

    // Update transaction status
    await Transaction.findOneAndUpdate(
      { ref: { $regex: `PAYOUT_${payoutRequest._id}` } },
      { 
        status: 'failed',
        metadata: {
          ...payoutRequest.metadata,
          failureReason,
          failedAt: new Date()
        }
      }
    );

    // Send failure notification to vendor
    await sendPayoutNotification(payoutRequest, 'failed');

    // Send real-time notification
    try {
      const { sendNotification } = require('../utils/notificationHelper');
      const io = require('../server').io; // Get io instance
      
      if (io) {
        await sendNotification(io, {
          recipientId: payoutRequest.userId,
          recipientType: payoutRequest.userType,
          notificationType: 'PAYOUT_FAILED',
          args: [amount / 100, transferData.failure_reason || 'Unknown error']
        });
      }
    } catch (notificationError) {
      console.error('⚠️ Payout failure notification error:', notificationError);
    }

    console.log(`❌ Payout ${payoutRequest._id} marked as failed`);

  } catch (error) {
    console.error('❌ Error handling transfer failure:', error);
  }
};

// Handle reversed transfer
const handleTransferReversed = async (transferData) => {
  try {
    const { reference, metadata } = transferData;
    
    console.log(`🔄 Transfer reversed: ${reference}`);

    // Find payout request
    const payoutRequest = await PayoutRequest.findOne({
      paystackReference: reference
    });

    if (!payoutRequest) {
      console.log(`⚠️ Payout request not found for reference: ${reference}`);
      return;
    }

    // Update payout status
    payoutRequest.status = 'reversed';
    payoutRequest.processedAt = new Date();
    await payoutRequest.save();

    // Refund wallet
    const wallet = await Wallet.findOne({
      user: payoutRequest.userId,
      role: payoutRequest.userType.toLowerCase()
    });

    if (wallet) {
      await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: payoutRequest.amount } }
      );
      console.log(`💰 Refunded ₦${payoutRequest.amount} to wallet`);
    }

    // Update transaction status
    await Transaction.findOneAndUpdate(
      { ref: { $regex: `PAYOUT_${payoutRequest._id}` } },
      { 
        status: 'reversed',
        metadata: {
          ...payoutRequest.metadata,
          reversedAt: new Date()
        }
      }
    );

    // Send reversal notification to vendor
    await sendPayoutNotification(payoutRequest, 'reversed');

    console.log(`🔄 Payout ${payoutRequest._id} marked as reversed`);

  } catch (error) {
    console.error('❌ Error handling transfer reversal:', error);
  }
};

// Send payout notification to vendor
const sendPayoutNotification = async (payoutRequest, status) => {
  try {
    let subject, message;
    
    switch (status) {
      case 'success':
        subject = 'Payout Completed Successfully! 🎉';
        message = `
          <h2>Great news! Your payout has been completed.</h2>
          <p><strong>Amount:</strong> ₦${payoutRequest.amount}</p>
          <p><strong>Reference:</strong> ${payoutRequest.paystackReference}</p>
          <p><strong>Completed at:</strong> ${new Date().toLocaleString()}</p>
          <p>The money should be in your bank account within 24 hours.</p>
        `;
        break;
      
      case 'failed':
        subject = 'Payout Failed ❌';
        message = `
          <h2>Your payout request has failed.</h2>
          <p><strong>Amount:</strong> ₦${payoutRequest.amount}</p>
          <p><strong>Reason:</strong> ${payoutRequest.failureReason}</p>
          <p><strong>Reference:</strong> ${payoutRequest.paystackReference}</p>
          <p>The money has been refunded to your wallet. Please check your bank details and try again.</p>
        `;
        break;
      
      case 'reversed':
        subject = 'Payout Reversed 🔄';
        message = `
          <h2>Your payout has been reversed.</h2>
          <p><strong>Amount:</strong> ₦${payoutRequest.amount}</p>
          <p><strong>Reference:</strong> ${payoutRequest.paystackReference}</p>
          <p>The money has been refunded to your wallet. Please contact support if you have questions.</p>
        `;
        break;
    }

    // TODO: Get user email from user model
    // For now, we'll log the notification
    console.log(`📧 Payout notification (${status}):`, {
      subject,
      message: message.replace(/<[^>]*>/g, ''), // Strip HTML for console
      payoutId: payoutRequest._id
    });

    // TODO: Uncomment when email service is ready
    // await emailService.sendEmail(userEmail, subject, message);

  } catch (error) {
    console.error('❌ Error sending payout notification:', error);
  }
};

// Manual payout processing (for admin use)
const processPayoutsManually = async (req, res) => {
  try {
    const { payoutIds } = req.body;
    
    if (!payoutIds || !Array.isArray(payoutIds)) {
      return res.status(400).json({
        success: false,
        message: 'Payout IDs array is required'
      });
    }

    const results = [];
    
    for (const payoutId of payoutIds) {
      try {
        const payout = await PayoutRequest.findById(payoutId);
        
        if (!payout || payout.status !== 'pending') {
          results.push({ payoutId, status: 'skipped', reason: 'Invalid status' });
          continue;
        }

        // Process payout via Paystack
        const transferResult = await processPayoutViaPaystack(payout);
        
        if (transferResult.success) {
          payout.status = 'processing';
          payout.paystackReference = transferResult.reference;
          await payout.save();
          
          results.push({ payoutId, status: 'processing', reference: transferResult.reference });
        } else {
          results.push({ payoutId, status: 'failed', reason: transferResult.error });
        }

      } catch (error) {
        results.push({ payoutId, status: 'error', reason: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Manual payout processing completed',
      data: results
    });

  } catch (error) {
    console.error('❌ Manual payout processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Manual payout processing failed',
      error: error.message
    });
  }
};

// Process payout via Paystack API
const processPayoutViaPaystack = async (payoutRequest) => {
  try {
    // TODO: Implement actual Paystack transfer API call
    // For now, return mock success
    console.log(`🔄 Processing payout via Paystack: ${payoutRequest._id}`);
    
    return {
      success: true,
      reference: `PS_${Date.now()}_${payoutRequest._id}`,
      message: 'Payout initiated successfully'
    };

  } catch (error) {
    console.error('❌ Paystack transfer error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  processTransferWebhook,
  processPayoutsManually
};
