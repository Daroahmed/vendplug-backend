const Dispute = require('../models/Dispute');
const VendorOrder = require('../models/vendorOrderModel');
const AgentOrder = require('../models/AgentOrder');
const Buyer = require('../models/Buyer');
const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');
const Admin = require('../models/Admin');
const Notification = require('../models/Notification');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/Transaction');

// Helper function to send notifications (legacy - use notificationHelper instead)
const sendNotification = async (io, userId, userType, title, message, type = 'info') => {
  try {
    const { sendNotification: sendNotificationHelper } = require('../utils/notificationHelper');
    
    await sendNotificationHelper(io, {
      recipientId: userId,
      recipientType: userType,
      notificationType: 'DISPUTE_RESOLVED', // Default type
      args: [title, message]
    });
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
    if (orderType === 'VendorOrder') {
      console.log('🔍 Looking in VendorOrder model...');
      order = await VendorOrder.findById(orderId);
    } else if (orderType === 'AgentOrder') {
      console.log('🔍 Looking in AgentOrder model...');
      order = await AgentOrder.findById(orderId);
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

    // Check if order is eligible for disputes (must be in escrow or pending)
    const eligibleStatuses = ['pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered'];
    if (!eligibleStatuses.includes(order.status)) {
      return res.status(400).json({ 
        error: 'Disputes are only allowed for orders in escrow or pending status. This order has already been fulfilled or resolved.',
        orderStatus: order.status,
        eligibleStatuses: eligibleStatuses
      });
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

    // Check if dispute already exists for this order (any status)
    const existingDispute = await Dispute.findOne({
      orderId,
      orderType
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
    const { sendNotification: sendNotificationHelper } = require('../utils/notificationHelper');
    await sendNotificationHelper(io, {
      recipientId: respondentUserId,
      recipientType: respondentUserType,
      notificationType: 'DISPUTE_CREATED',
      args: [dispute.disputeId, orderId]
    });

    // Notify all admins
    const admins = await Admin.find({ isActive: true });
    for (const admin of admins) {
      await sendNotificationHelper(io, {
        recipientId: admin._id,
        recipientType: 'Admin',
        notificationType: 'ADMIN_DISPUTE_ESCALATED',
        args: [dispute.disputeId, 'New dispute requires review']
      });
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

    console.log('🔍 Getting disputes for user:', { userId, userType });

    const disputes = await Dispute.find({
      $or: [
        { raisedBy: userId, raisedByType: userType },
        { 'complainant.userId': userId, 'complainant.userType': userType },
        { 'respondent.userId': userId, 'respondent.userType': userType }
      ]
    })
    .populate('orderId', 'totalAmount status createdAt buyer vendor agent')
    .populate('raisedBy', 'fullName email shopName businessName')
    .populate('complainant.userId', 'fullName email shopName businessName')
    .populate('respondent.userId', 'fullName email shopName businessName')
    .populate('resolution.resolvedBy', 'fullName email')
    .sort({ createdAt: -1 });

    console.log('🔍 Found disputes:', disputes.length);

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
    console.log('🔍 User info:', { userId, userType });
    
    const dispute = await Dispute.findOne({ disputeId })
      .populate('orderId', 'totalAmount status createdAt items buyer vendor agent')
      .populate('raisedBy', 'fullName email shopName businessName')
      .populate('complainant.userId', 'fullName email shopName businessName')
      .populate('respondent.userId', 'fullName email shopName businessName')
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
        raisedByType: dispute.raisedByType,
        complainant: dispute.complainant,
        respondent: dispute.respondent
      });
    }

  if (!dispute) {
    return res.status(404).json({ error: 'Dispute not found' });
  }

  // Check if user has access to this dispute
  const isAdmin = userType === 'Admin' || userType === 'staff';
  const isRaisedBy = dispute.raisedBy.toString() === userId.toString() && dispute.raisedByType === userType;
  const isComplainant = dispute.complainant.userId.toString() === userId.toString() && dispute.complainant.userType === userType;
  const isRespondent = dispute.respondent.userId.toString() === userId.toString() && dispute.respondent.userType === userType;
  const isOrderParticipant = dispute.orderId && (
    (dispute.orderId.buyer && dispute.orderId.buyer.toString() === userId.toString()) ||
    (dispute.orderId.vendor && dispute.orderId.vendor.toString() === userId.toString()) ||
    (dispute.orderId.agent && dispute.orderId.agent.toString() === userId.toString())
  );

  const hasAccess = isAdmin || isRaisedBy || isComplainant || isRespondent || isOrderParticipant;

  console.log('🔍 Access check details:', {
    isAdmin,
    isRaisedBy,
    isComplainant,
    isRespondent,
    isOrderParticipant,
    hasAccess,
    userId: userId.toString(),
    userType,
    disputeRaisedBy: dispute.raisedBy.toString(),
    disputeRaisedByType: dispute.raisedByType,
    disputeComplainant: dispute.complainant.userId.toString(),
    disputeComplainantType: dispute.complainant.userType,
    disputeRespondent: dispute.respondent.userId.toString(),
    disputeRespondentType: dispute.respondent.userType,
    raisedByMatch: dispute.raisedBy.toString() === userId.toString(),
    complainantMatch: dispute.complainant.userId.toString() === userId.toString(),
    respondentMatch: dispute.respondent.userId.toString() === userId.toString(),
    respondentTypeMatch: dispute.respondent.userType === userType,
    complainantTypeMatch: dispute.complainant.userType === userType,
    raisedByTypeMatch: dispute.raisedByType === userType
  });

    if (!hasAccess) {
      console.log('❌ Access denied for user:', { userId, userType });
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

    res.json({ 
      success: true,
      data: disputeData 
    });

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

    const { sendNotification: sendNotificationHelper } = require('../utils/notificationHelper');
    await sendNotificationHelper(io, {
      recipientId: otherParty.userId,
      recipientType: otherParty.userType,
      notificationType: 'DISPUTE_MESSAGE',
      args: [dispute.disputeId]
    });

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
      .populate('orderId', 'totalAmount status createdAt buyer vendor agent')
      .populate('complainant.userId', 'fullName email shopName businessName')
      .populate('respondent.userId', 'fullName email shopName businessName')
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
    const { sendNotification: sendNotificationHelper } = require('../utils/notificationHelper');
    await sendNotificationHelper(io, {
      recipientId: assignedTo,
      recipientType: 'Admin',
      notificationType: 'DISPUTE_ASSIGNED',
      args: [dispute.disputeId, 'Admin'] // Using 'Admin' as staff name for now
    });

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

    // Process refund for all dispute resolutions (money is always in escrow)
    // Always use the actual order amount for security
    await processDisputeRefund(dispute, 0, decision);

    // Send notifications
    const io = req.app.get('io');
    const { sendNotification } = require('../utils/notificationHelper');
    
    // Notify complainant (buyer) with specific resolution details
    let complainantNotificationType = 'DISPUTE_RESOLVED';
    let complainantArgs = [dispute.disputeId, decision];
    
    if (decision === 'favor_complainant') {
      complainantNotificationType = 'DISPUTE_FAVOR_COMPLAINANT';
      complainantArgs = [dispute.disputeId, refundAmount || dispute.order?.totalAmount];
    } else if (decision === 'favor_respondent') {
      complainantNotificationType = 'DISPUTE_FAVOR_RESPONDENT';
      complainantArgs = [dispute.disputeId];
    } else if (decision === 'partial_refund') {
      complainantNotificationType = 'DISPUTE_PARTIAL_REFUND';
      complainantArgs = [dispute.disputeId, refundAmount];
    }
    
    await sendNotification(io, {
      recipientId: dispute.complainant.userId,
      recipientType: dispute.complainant.userType,
      notificationType: complainantNotificationType,
      args: complainantArgs,
      orderId: dispute.orderId
    });

    // Notify respondent (vendor/agent) with specific resolution details
    let respondentNotificationType = 'DISPUTE_RESOLVED';
    let respondentArgs = [dispute.disputeId, decision];
    
    if (decision === 'favor_respondent') {
      respondentNotificationType = 'DISPUTE_FAVOR_RESPONDENT';
      respondentArgs = [dispute.disputeId];
    } else if (decision === 'favor_complainant') {
      respondentNotificationType = 'DISPUTE_FAVOR_COMPLAINANT';
      respondentArgs = [dispute.disputeId, refundAmount || dispute.order?.totalAmount];
    } else if (decision === 'partial_refund') {
      respondentNotificationType = 'DISPUTE_PARTIAL_REFUND';
      respondentArgs = [dispute.disputeId, refundAmount];
    }
    
    await sendNotification(io, {
      recipientId: dispute.respondent.userId,
      recipientType: dispute.respondent.userType,
      notificationType: respondentNotificationType,
      args: respondentArgs,
      orderId: dispute.orderId
    });

    res.json({ message: 'Dispute resolved successfully' });

  } catch (error) {
    console.error('❌ Resolve dispute error:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
};

// Helper function to process dispute refunds within escrow system
const processDisputeRefund = async (dispute, refundAmount, resolution) => {
  try {
    console.log(`🔍 processDisputeRefund called with resolution: ${resolution}, refundAmount: ${refundAmount}`);
    console.log(`🔍 Dispute ID: ${dispute.disputeId}, Order ID: ${dispute.orderId}, Order Type: ${dispute.orderType}`);
    
    // Get the order to find the buyer and vendor/agent
    let order;
    if (dispute.orderType === 'VendorOrder') {
      order = await VendorOrder.findById(dispute.orderId);
    } else if (dispute.orderType === 'AgentOrder') {
      order = await AgentOrder.findById(dispute.orderId);
    } else {
      throw new Error('Invalid order type for dispute resolution');
    }

    if (!order) {
      throw new Error('Order not found for dispute resolution');
    }

    console.log(`🔍 Order found: ${order._id}, Status: ${order.status}, Amount: ${order.totalAmount || order.amount}`);

    // Check if order is still in escrow or pending (disputes only allowed for orders in escrow or pending)
    const escrowStatuses = ['pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered'];
    if (!escrowStatuses.includes(order.status)) {
      throw new Error('Order is no longer in escrow - disputes not allowed after fulfillment');
    }

    const orderAmount = order.totalAmount || order.amount;
    const vendorAgentId = dispute.orderType === 'VendorOrder' ? order.vendor : order.agent;
    const vendorAgentRole = dispute.orderType === 'VendorOrder' ? 'vendor' : 'agent';

    console.log(`🔍 Order Amount: ${orderAmount}, Vendor/Agent ID: ${vendorAgentId}, Role: ${vendorAgentRole}`);

    // Process resolution within escrow system
    if (resolution === 'no_action') {
      // No action - refund buyer (money goes back to buyer from escrow)
      const buyerWallet = await Wallet.findOne({ 
        user: order.buyer, 
        role: 'buyer' 
      });

      if (!buyerWallet) {
        throw new Error('Buyer wallet not found');
      }

      // Credit buyer's wallet with full order amount from escrow
      buyerWallet.balance += orderAmount;
      await buyerWallet.save();

      // Create transaction record for buyer refund from escrow
      const transaction = new Transaction({
        ref: `DISP_ESCROW_NO_ACTION_${dispute.disputeId}_${Date.now()}`,
        type: 'credit',
        status: 'successful',
        amount: orderAmount,
        to: order.buyer.toString(),
        description: `Dispute resolved with no action - refund from escrow - ${dispute.disputeId}`,
        initiatedBy: dispute.resolution.resolvedBy,
        initiatorType: 'Admin',
        metadata: {
          disputeId: dispute.disputeId,
          orderId: order._id,
          orderType: dispute.orderType,
          resolution: 'no_action',
          source: 'escrow'
        }
      });

      await transaction.save();
      
      // Update order status to resolved
      order.status = 'resolved';
      order.resolvedAt = new Date();
      order.resolution = {
        type: 'no_action',
        disputeId: dispute.disputeId,
        resolvedBy: dispute.resolution.resolvedBy,
        resolvedAt: new Date(),
        escrowAction: 'refunded_to_buyer'
      };
      await order.save();

      console.log(`✅ Dispute resolved with no action: ${orderAmount} refunded to buyer ${order.buyer} from escrow`);

    } else if (resolution === 'favor_respondent') {
      console.log(`🔍 Processing favor_respondent resolution - Fund Vendor/Agent`);
      // Vendor/Agent wins - credit their wallet from escrow
      const vendorAgentWallet = await Wallet.findOne({ 
        user: vendorAgentId, 
        role: vendorAgentRole 
      });

      if (!vendorAgentWallet) {
        throw new Error(`${vendorAgentRole} wallet not found`);
      }

      // Credit vendor/agent's wallet with full order amount from escrow
      vendorAgentWallet.balance += orderAmount;
      await vendorAgentWallet.save();

      // Create transaction record for vendor/agent credit from escrow
      const transaction = new Transaction({
        ref: `DISP_ESCROW_WIN_${dispute.disputeId}_${Date.now()}`,
        type: 'credit',
        status: 'successful',
        amount: orderAmount,
        to: vendorAgentId.toString(),
        description: `Dispute resolved in favor of ${vendorAgentRole} from escrow - ${dispute.disputeId}`,
        initiatedBy: dispute.resolution.resolvedBy,
        initiatorType: 'Admin',
        metadata: {
          disputeId: dispute.disputeId,
          orderId: order._id,
          orderType: dispute.orderType,
          resolution: 'favor_respondent',
          source: 'escrow'
        }
      });

      await transaction.save();
      
      // Update order status to resolved
      order.status = 'resolved';
      order.resolvedAt = new Date();
      order.resolution = {
        type: 'favor_respondent',
        disputeId: dispute.disputeId,
        resolvedBy: dispute.resolution.resolvedBy,
        resolvedAt: new Date(),
        escrowAction: 'released_to_vendor_agent'
      };
      await order.save();

      console.log(`✅ Dispute resolved - Fund Vendor/Agent: ${orderAmount} credited to ${vendorAgentId} from escrow`);

    } else if (resolution === 'favor_complainant') {
      console.log(`🔍 Processing favor_complainant resolution - Refund Buyer`);
      // Buyer wins - refund from escrow
      const buyerWallet = await Wallet.findOne({ 
        user: order.buyer, 
        role: 'buyer' 
      });

      if (!buyerWallet) {
        throw new Error('Buyer wallet not found');
      }

      // Always use the actual order amount for security
      const refundToBuyer = orderAmount;
      
      // Credit buyer's wallet from escrow
      buyerWallet.balance += refundToBuyer;
      await buyerWallet.save();

      // Create transaction record for buyer refund from escrow
      const transaction = new Transaction({
        ref: `DISP_ESCROW_REFUND_${dispute.disputeId}_${Date.now()}`,
        type: 'credit',
        status: 'successful',
        amount: refundToBuyer,
        to: order.buyer.toString(),
        description: `Dispute refund from escrow - ${dispute.disputeId}`,
        initiatedBy: dispute.resolution.resolvedBy,
        initiatorType: 'Admin',
        metadata: {
          disputeId: dispute.disputeId,
          orderId: order._id,
          orderType: dispute.orderType,
          resolution: 'favor_complainant',
          source: 'escrow'
        }
      });

      await transaction.save();

      // Update order status to resolved
      order.status = 'resolved';
      order.resolvedAt = new Date();
      order.resolution = {
        type: 'favor_complainant',
        disputeId: dispute.disputeId,
        resolvedBy: dispute.resolution.resolvedBy,
        resolvedAt: new Date(),
        escrowAction: 'refund_to_buyer',
        refundAmount: refundToBuyer
      };
      await order.save();

      console.log(`✅ Dispute resolved - Refund Buyer: ${refundToBuyer} refunded from escrow to buyer ${order.buyer}`);

    } else if (resolution === 'partial_refund') {
      console.log(`🔍 Processing partial_refund resolution - Split 50/50`);
      // Partial refund - split escrow money (50/50 split)
      const buyerRefundAmount = orderAmount * 0.5; // Always 50% to buyer
      const vendorAgentAmount = orderAmount * 0.5; // Always 50% to vendor/agent

      // Credit buyer's wallet with partial refund
      const buyerWallet = await Wallet.findOne({ 
        user: order.buyer, 
        role: 'buyer' 
      });

      if (!buyerWallet) {
        throw new Error('Buyer wallet not found');
      }

      buyerWallet.balance += buyerRefundAmount;
      await buyerWallet.save();

      // Create transaction record for buyer partial refund
      const buyerTransaction = new Transaction({
        ref: `DISP_ESCROW_PARTIAL_${dispute.disputeId}_${Date.now()}`,
        type: 'credit',
        status: 'successful',
        amount: buyerRefundAmount,
        to: order.buyer.toString(),
        description: `Partial dispute refund from escrow - ${dispute.disputeId}`,
        initiatedBy: dispute.resolution.resolvedBy,
        initiatorType: 'Admin',
        metadata: {
          disputeId: dispute.disputeId,
          orderId: order._id,
          orderType: dispute.orderType,
          resolution: 'partial_refund',
          source: 'escrow'
        }
      });

      await buyerTransaction.save();

      // Credit vendor/agent with remaining amount
      const vendorAgentWallet = await Wallet.findOne({ 
        user: vendorAgentId, 
        role: vendorAgentRole 
      });

      if (vendorAgentWallet) {
        vendorAgentWallet.balance += vendorAgentAmount;
        await vendorAgentWallet.save();

        // Create transaction record for vendor/agent
        const vendorTransaction = new Transaction({
          ref: `DISP_ESCROW_PARTIAL_${dispute.disputeId}_${Date.now()}`,
          type: 'credit',
          status: 'successful',
          amount: vendorAgentAmount,
          to: vendorAgentId.toString(),
          description: `Partial dispute resolution from escrow - ${dispute.disputeId}`,
          initiatedBy: dispute.resolution.resolvedBy,
          initiatorType: 'Admin',
          metadata: {
            disputeId: dispute.disputeId,
            orderId: order._id,
            orderType: dispute.orderType,
            resolution: 'partial_refund',
            source: 'escrow'
          }
        });

        await vendorTransaction.save();
      }

      // Update order status to resolved
      order.status = 'resolved';
      order.resolvedAt = new Date();
      order.resolution = {
        type: 'partial_refund',
        disputeId: dispute.disputeId,
        resolvedBy: dispute.resolution.resolvedBy,
        resolvedAt: new Date(),
        escrowAction: 'split_refund',
        buyerRefundAmount: buyerRefundAmount,
        vendorAgentAmount: vendorAgentAmount
      };
      await order.save();

      console.log(`✅ Dispute resolved with partial refund: ${buyerRefundAmount} to buyer, ${vendorAgentAmount} to ${vendorAgentRole}`);
    } else {
      console.error(`❌ Unknown resolution type: ${resolution}`);
      throw new Error(`Unknown resolution type: ${resolution}. Expected: no_action, favor_respondent, favor_complainant, or partial_refund`);
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
