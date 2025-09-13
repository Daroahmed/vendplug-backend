const Dispute = require('../models/Dispute');
const Order = require('../models/Order');
const VendorOrder = require('../models/vendorOrderModel');
const Buyer = require('../models/Buyer');
const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');
const Admin = require('../models/Admin');
const Notification = require('../models/Notification');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/Transaction');

// Helper function to send notifications
const sendNotification = async (io, userId, userType, title, message, type = 'info') => {
  try {
    const notification = new Notification({
      userId,
      userType,
      title,
      message,
      type
    });
    await notification.save();
    
    if (io) {
      io.to(`${userType.toLowerCase()}_${userId}`).emit('notification', {
        title,
        message,
        type,
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('❌ Notification error:', error);
  }
};

// Create a new dispute
const createDispute = async (req, res) => {
  try {
    // Handle FormData with multer
    console.log('🔍 Raw req.body:', req.body);
    console.log('🔍 req.body keys:', Object.keys(req.body));
    console.log('🔍 req.files:', req.files);
    
    let disputeData;
    if (req.body.disputeData) {
      // FormData request - parse the JSON string
      console.log('🔍 Found disputeData field:', req.body.disputeData);
      disputeData = JSON.parse(req.body.disputeData);
    } else {
      // Direct JSON request
      console.log('🔍 Using req.body directly');
      disputeData = req.body;
    }
    
    console.log('🔍 Parsed disputeData:', disputeData);

    const {
      orderId,
      orderType,
      respondentUserId,
      respondentUserType,
      title,
      description,
      category,
      evidence
    } = disputeData;

    console.log('🔍 Dispute creation request:');
    console.log('   Order ID:', orderId);
    console.log('   Order Type:', orderType);
    console.log('   Respondent ID:', respondentUserId);
    console.log('   Respondent Type:', respondentUserType);
    console.log('   User ID:', req.user._id);
    console.log('   User Role:', req.user.role);

    const complainantUserId = req.user._id;
    const complainantUserType = req.user.role === 'buyer' ? 'Buyer' : 
                                req.user.role === 'vendor' ? 'Vendor' : 'Agent';

    // Validate order exists and user has access
    let order;
    if (orderType === 'Order') {
      console.log('🔍 Looking in Order model...');
      order = await Order.findById(orderId);
    } else if (orderType === 'VendorOrder') {
      console.log('🔍 Looking in VendorOrder model...');
      order = await VendorOrder.findById(orderId);
    } else {
      console.log('❌ Invalid order type:', orderType);
    }

    console.log('🔍 Order found:', order ? 'YES' : 'NO');
    if (order) {
      console.log('   Order status:', order.status);
      console.log('   Order buyer:', order.buyer);
      console.log('   Order vendor:', order.vendor);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user is involved in the order
    console.log('🔍 Authorization check:');
    console.log('   complainantUserId:', complainantUserId, typeof complainantUserId);
    console.log('   order.buyer:', order.buyer, typeof order.buyer);
    console.log('   order.buyer.toString():', order.buyer.toString());
    console.log('   order.vendor:', order.vendor);
    console.log('   order.agent:', order.agent);
    
    const isInvolved = order.buyer.toString() === complainantUserId.toString() ||
                      (order.vendor && order.vendor.toString() === complainantUserId.toString()) ||
                      (order.agent && order.agent.toString() === complainantUserId.toString());

    console.log('🔍 isInvolved:', isInvolved);

    if (!isInvolved) {
      return res.status(403).json({ error: 'You are not authorized to dispute this order' });
    }

    // Check if dispute already exists for this order
    const existingDispute = await Dispute.findOne({
      orderId,
      orderType,
      status: { $in: ['open', 'under_review'] }
    });

    if (existingDispute) {
      return res.status(400).json({ error: 'A dispute already exists for this order' });
    }

    // Process evidence files from multer
    const evidenceFiles = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        // Determine file type based on mimetype
        let evidenceType = 'other';
        if (file.mimetype.startsWith('image/')) {
          evidenceType = 'image';
        } else if (file.mimetype.includes('pdf') || file.mimetype.includes('document')) {
          evidenceType = 'document';
        }
        
        evidenceFiles.push({
          type: evidenceType,
          url: `/uploads/evidence/${file.filename}`, // You might want to save files properly
          description: file.originalname,
          uploadedBy: complainantUserId,
          uploadedByType: complainantUserType,
          uploadedAt: new Date()
        });
      });
    }

    // Generate dispute ID manually
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    const disputeId = `DISP-${timestamp}-${random}`;

    // Create the dispute
    console.log('🔍 Creating dispute with data:');
    console.log('   disputeId:', disputeId);
    console.log('   orderId:', orderId);
    console.log('   orderType:', orderType);
    console.log('   complainant:', { userId: complainantUserId, userType: complainantUserType });
    console.log('   respondent:', { userId: respondentUserId, userType: respondentUserType });
    console.log('   title:', title);
    console.log('   description:', description);
    console.log('   category:', category);
    console.log('   evidence:', evidenceFiles);

    const dispute = new Dispute({
      disputeId,
      orderId,
      orderType,
      order: orderId, // Add the direct order reference
      raisedBy: complainantUserId, // Add the new required field
      raisedByType: complainantUserType, // Add the new required field
      complainant: {
        userId: complainantUserId,
        userType: complainantUserType
      },
      respondent: {
        userId: respondentUserId,
        userType: respondentUserType
      },
      title,
      description,
      category,
      evidence: evidenceFiles
    });

    console.log('🔍 Dispute object created, saving...');
    await dispute.save();
    console.log('✅ Dispute saved successfully with ID:', dispute.disputeId);

    // Send notifications
    const io = req.app.get('io');
    
    // Notify respondent
    await sendNotification(
      io,
      respondentUserId,
      respondentUserType,
      'New Dispute Opened',
      `A dispute has been opened against you for order ${orderId}`,
      'warning'
    );

    // Notify all admins
    const admins = await Admin.find({ isActive: true });
    for (const admin of admins) {
      await sendNotification(
        io,
        admin._id,
        'Admin',
        'New Dispute Requires Review',
        `Dispute ${dispute.disputeId} has been opened and requires review`,
        'urgent'
      );
    }

    // Trigger immediate auto-assignment
    const autoAssignmentService = require('../services/autoAssignmentService');
    try {
      await autoAssignmentService.autoAssignDispute(dispute.disputeId);
      console.log('✅ Auto-assignment triggered for dispute:', dispute.disputeId);
    } catch (error) {
      console.log('⚠️ Auto-assignment failed for dispute:', dispute.disputeId, error.message);
      // Don't fail the dispute creation if auto-assignment fails
    }

    res.status(201).json({
      message: 'Dispute created successfully',
      dispute: {
        id: dispute._id,
        disputeId: dispute.disputeId,
        title: dispute.title,
        status: dispute.status,
        createdAt: dispute.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Create dispute error:', error);
    res.status(500).json({ error: 'Failed to create dispute' });
  }
};

// Get disputes for a user
const getUserDisputes = async (req, res) => {
  try {
    const userId = req.user._id;
    const userType = req.user.role === 'buyer' ? 'Buyer' : 
                    req.user.role === 'vendor' ? 'Vendor' : 'Agent';

    const disputes = await Dispute.find({
      $or: [
        { raisedBy: userId, raisedByType: userType },
        { 'complainant.userId': userId, 'complainant.userType': userType },
        { 'respondent.userId': userId, 'respondent.userType': userType }
      ]
    })
    .populate('orderId', 'totalAmount status createdAt')
    .populate('raisedBy', 'fullName email shopName')
    .populate('complainant.userId', 'fullName email shopName')
    .populate('respondent.userId', 'fullName email shopName')
    .sort({ createdAt: -1 });

    res.json({ disputes });

  } catch (error) {
    console.error('❌ Get user disputes error:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
};

// Get dispute details
const getDisputeDetails = async (req, res) => {
  try {
    const { disputeId } = req.params;
    
    // Handle both admin and user access
    let userId, userType;
    if (req.admin) {
      // Admin access
      userId = req.admin._id;
      userType = 'Admin';
    } else if (req.user) {
      // User access
      userId = req.user._id;
      userType = req.user.role === 'buyer' ? 'Buyer' : 
                 req.user.role === 'vendor' ? 'Vendor' : 
                 req.user.role === 'agent' ? 'Agent' : 'Admin';
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log('🔍 Looking for dispute with ID:', disputeId);
    
    const dispute = await Dispute.findOne({ disputeId })
      .populate({
        path: 'orderId',
        select: 'totalAmount status createdAt items',
        populate: [
          { path: 'buyer', select: 'fullName email' },
          { path: 'vendor', select: 'shopName email' }
        ]
      })
      .populate('raisedBy', 'fullName email shopName')
      .populate('complainant.userId', 'fullName email shopName')
      .populate('respondent.userId', 'fullName email shopName')
      .populate('assignment.assignedTo', 'fullName email role')
      .populate('resolution.resolvedBy', 'fullName email');
    
    console.log('🔍 Dispute found:', dispute ? 'YES' : 'NO');
    if (dispute) {
          console.log('🔍 Dispute data:', {
      disputeId: dispute.disputeId,
      status: dispute.status,
      priority: dispute.priority,
      category: dispute.category,
      title: dispute.title,
      description: dispute.description,
      raisedBy: dispute.raisedBy,
      raisedByType: dispute.raisedByType
    });
  }

  if (!dispute) {
    return res.status(404).json({ error: 'Dispute not found' });
  }

  // Check if user has access to this dispute
  const hasAccess = userType === 'Admin' ||
                   (dispute.raisedBy.toString() === userId && dispute.raisedByType === userType) ||
                   (dispute.order && (
                     (dispute.order.buyer && dispute.order.buyer.toString() === userId) ||
                     (dispute.order.vendor && dispute.order.vendor.toString() === userId)
                   ));

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Filter messages based on user type (hide internal messages from non-admins)
    const filteredMessages = userType === 'Admin' 
      ? dispute.messages 
      : dispute.messages.filter(msg => !msg.isInternal);

    const disputeData = {
      ...dispute.toObject(),
      messages: filteredMessages
    };

    res.json({ dispute: disputeData });

  } catch (error) {
    console.error('❌ Get dispute details error:', error);
    res.status(500).json({ error: 'Failed to fetch dispute details' });
  }
};

// Add message to dispute
const addMessage = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { message, attachments = [] } = req.body;
    const userId = req.user._id;
    const userType = req.user.role === 'buyer' ? 'Buyer' : 
                    req.user.role === 'vendor' ? 'Vendor' : 
                    req.user.role === 'agent' ? 'Agent' : 'Admin';

    const dispute = await Dispute.findOne({ disputeId });

    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    // Check if user has access to this dispute
    const hasAccess = userType === 'Admin' ||
                     (dispute.complainant.userId.toString() === userId && dispute.complainant.userType === userType) ||
                     (dispute.respondent.userId.toString() === userId && dispute.respondent.userType === userType);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if dispute is still open
    if (dispute.status === 'closed' || dispute.status === 'resolved') {
      return res.status(400).json({ error: 'Cannot add messages to closed disputes' });
    }

    // Add message
    await dispute.addMessage(userId, userType, message, false, attachments);

    // Send notifications to other parties
    const io = req.app.get('io');
    const otherParty = dispute.complainant.userId.toString() === userId ? 
                      dispute.respondent : dispute.complainant;

    await sendNotification(
      io,
      otherParty.userId,
      otherParty.userType,
      'New Message in Dispute',
      `New message added to dispute ${dispute.disputeId}`,
      'info'
    );

    res.json({ message: 'Message added successfully' });

  } catch (error) {
    console.error('❌ Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
};

// Add evidence to dispute
const addEvidence = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { type, url, description } = req.body;
    const userId = req.user._id;
    const userType = req.user.role === 'buyer' ? 'Buyer' : 
                    req.user.role === 'vendor' ? 'Vendor' : 
                    req.user.role === 'agent' ? 'Agent' : 'Admin';

    const dispute = await Dispute.findOne({ disputeId });

    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    // Check if user has access to this dispute
    const hasAccess = userType === 'Admin' ||
                     (dispute.complainant.userId.toString() === userId && dispute.complainant.userType === userType) ||
                     (dispute.respondent.userId.toString() === userId && dispute.respondent.userType === userType);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if dispute is still open
    if (dispute.status === 'closed' || dispute.status === 'resolved') {
      return res.status(400).json({ error: 'Cannot add evidence to closed disputes' });
    }

    // Add evidence
    await dispute.addEvidence(type, url, description, userId, userType);

    res.json({ message: 'Evidence added successfully' });

  } catch (error) {
    console.error('❌ Add evidence error:', error);
    res.status(500).json({ error: 'Failed to add evidence' });
  }
};

// Admin: Get all disputes
const getAllDisputes = async (req, res) => {
  try {
    const { status, priority, assignedTo, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    const disputes = await Dispute.find(filter)
      .populate('orderId', 'totalAmount status createdAt')
      .populate('complainant.userId', 'fullName email shopName')
      .populate('respondent.userId', 'fullName email shopName')
      .populate('assignedTo', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Dispute.countDocuments(filter);

    res.json({
      disputes,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('❌ Get all disputes error:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
};

// Admin: Assign dispute
const assignDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { assignedTo } = req.body;
    const adminId = req.user._id;

    const dispute = await Dispute.findOne({ disputeId });
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    dispute.assignedTo = assignedTo;
    dispute.status = 'under_review';
    dispute.lastActivity = new Date();
    await dispute.save();

    // Notify assigned admin
    const io = req.app.get('io');
    await sendNotification(
      io,
      assignedTo,
      'Admin',
      'Dispute Assigned',
      `Dispute ${dispute.disputeId} has been assigned to you`,
      'info'
    );

    res.json({ message: 'Dispute assigned successfully' });

  } catch (error) {
    console.error('❌ Assign dispute error:', error);
    res.status(500).json({ error: 'Failed to assign dispute' });
  }
};

// Admin: Resolve dispute
const resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { decision, reason, refundAmount, notes } = req.body;
    const adminId = req.user._id;

    const dispute = await Dispute.findOne({ disputeId });
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    // Resolve the dispute
    await dispute.resolve(decision, reason, refundAmount, adminId, notes);

    // Process refund if applicable
    if (decision === 'no_refund' || (refundAmount > 0 && (decision === 'favor_complainant' || decision === 'partial_refund' || decision === 'full_refund'))) {
      await processDisputeRefund(dispute, refundAmount || 0, decision);
    }

    // Send notifications
    const io = req.app.get('io');
    
    // Notify complainant
    await sendNotification(
      io,
      dispute.complainant.userId,
      dispute.complainant.userType,
      'Dispute Resolved',
      `Your dispute ${dispute.disputeId} has been resolved`,
      'success'
    );

    // Notify respondent
    await sendNotification(
      io,
      dispute.respondent.userId,
      dispute.respondent.userType,
      'Dispute Resolved',
      `Dispute ${dispute.disputeId} has been resolved`,
      'info'
    );

    res.json({ message: 'Dispute resolved successfully' });

  } catch (error) {
    console.error('❌ Resolve dispute error:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
};

// Helper function to process dispute refunds
const processDisputeRefund = async (dispute, refundAmount, resolution) => {
  try {
    // Get the order to find the buyer and vendor/agent
    let order;
    if (dispute.orderType === 'Order') {
      order = await Order.findById(dispute.orderId);
    } else if (dispute.orderType === 'VendorOrder') {
      order = await VendorOrder.findById(dispute.orderId);
    }

    if (!order) {
      throw new Error('Order not found for dispute resolution');
    }

    // Determine who gets the money based on resolution
    if (resolution === 'no_refund' || resolution === 'favor_respondent') {
      // Vendor/Agent wins - credit their wallet
      const vendorAgentId = dispute.orderType === 'Order' ? order.agent : order.vendor;
      const vendorAgentRole = dispute.orderType === 'Order' ? 'agent' : 'vendor';
      
      const vendorAgentWallet = await Wallet.findOne({ 
        user: vendorAgentId, 
        role: vendorAgentRole 
      });

      if (!vendorAgentWallet) {
        throw new Error(`${vendorAgentRole} wallet not found`);
      }

      // Credit vendor/agent's wallet with full order amount
      const orderAmount = order.totalAmount || order.amount;
      vendorAgentWallet.balance += orderAmount;
      await vendorAgentWallet.save();

      // Create transaction record for vendor/agent
      const transaction = new Transaction({
        ref: `DISP_WIN_${dispute.disputeId}_${Date.now()}`,
        type: 'credit',
        status: 'successful',
        amount: orderAmount,
        to: vendorAgentId.toString(),
        description: `Dispute resolved in favor of ${vendorAgentRole} - ${dispute.disputeId}`,
        initiatedBy: dispute.resolution.resolvedBy,
        initiatorType: 'Admin',
        metadata: {
          disputeId: dispute.disputeId,
          orderId: order._id,
          orderType: dispute.orderType,
          resolution: 'no_refund'
        }
      });

      await transaction.save();

      // Update order status to completed
      order.status = 'completed';
      order.completedAt = new Date();
      await order.save();

      console.log(`✅ Dispute resolved in favor of ${vendorAgentRole}: ${orderAmount} credited to ${vendorAgentId}`);

    } else if (refundAmount > 0 && (resolution === 'favor_complainant' || resolution === 'partial_refund' || resolution === 'full_refund')) {
      // Buyer gets refund - credit their wallet
      const buyerWallet = await Wallet.findOne({ 
        user: order.buyer, 
        role: 'buyer' 
      });

      if (!buyerWallet) {
        throw new Error('Buyer wallet not found');
      }

      // Credit buyer's wallet
      buyerWallet.balance += refundAmount;
      await buyerWallet.save();

      // Create transaction record for buyer refund
      const transaction = new Transaction({
        ref: `DISP_REFUND_${dispute.disputeId}_${Date.now()}`,
        type: 'credit',
        status: 'successful',
        amount: refundAmount,
        to: order.buyer.toString(),
        description: `Dispute refund for ${dispute.disputeId}`,
        initiatedBy: dispute.resolution.resolvedBy,
        initiatorType: 'Admin',
        metadata: {
          disputeId: dispute.disputeId,
          orderId: order._id,
          orderType: dispute.orderType,
          resolution: resolution
        }
      });

      await transaction.save();

      // If partial refund, also credit vendor/agent with remaining amount
      if (resolution === 'partial_refund') {
        const vendorAgentId = dispute.orderType === 'Order' ? order.agent : order.vendor;
        const vendorAgentRole = dispute.orderType === 'Order' ? 'agent' : 'vendor';
        const orderAmount = order.totalAmount || order.amount;
        const remainingAmount = orderAmount - refundAmount;
        
        if (remainingAmount > 0) {
          const vendorAgentWallet = await Wallet.findOne({ 
            user: vendorAgentId, 
            role: vendorAgentRole 
          });

          if (vendorAgentWallet) {
            vendorAgentWallet.balance += remainingAmount;
            await vendorAgentWallet.save();

            // Create transaction for vendor/agent
            const vendorTransaction = new Transaction({
              ref: `DISP_PARTIAL_${dispute.disputeId}_${Date.now()}`,
              type: 'credit',
              status: 'successful',
              amount: remainingAmount,
              to: vendorAgentId.toString(),
              description: `Partial dispute resolution - ${dispute.disputeId}`,
              initiatedBy: dispute.resolution.resolvedBy,
              initiatorType: 'Admin',
              metadata: {
                disputeId: dispute.disputeId,
                orderId: order._id,
                orderType: dispute.orderType,
                resolution: 'partial_refund'
              }
            });

            await vendorTransaction.save();
          }
        }
      }

      // Update order status to completed
      order.status = 'completed';
      order.completedAt = new Date();
      await order.save();

      console.log(`✅ Dispute refund processed: ${refundAmount} to buyer ${order.buyer}`);
    }

  } catch (error) {
    console.error('❌ Process dispute refund error:', error);
    throw error;
  }
};

module.exports = {
  createDispute,
  getUserDisputes,
  getDisputeDetails,
  addMessage,
  addEvidence,
  getAllDisputes,
  assignDispute,
  resolveDispute,
  processDisputeRefund
};
