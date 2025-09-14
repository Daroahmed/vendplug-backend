const Dispute = require('../models/Dispute');
const Admin = require('../models/Admin');
const Wallet = require('../models/walletModel');
const Order = require('../models/Order');
const VendorOrder = require('../models/vendorOrderModel');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

// Get Staff Dispute Statistics
const getStaffDisputeStats = async (req, res) => {
  try {
    const staffId = req.staff.staffId;
    const period = parseInt(req.query.period) || 30;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    
    // Get assigned disputes count
    const assignedDisputes = await Dispute.countDocuments({
      'assignment.assignedTo': staffId,
      status: 'assigned'
    });

    // Get resolved today count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const resolvedToday = await Dispute.countDocuments({
      'assignment.assignedTo': staffId,
      status: 'resolved',
      'resolution.resolvedAt': {
        $gte: today,
        $lt: tomorrow
      }
    });

    // Get pending review count
    const pendingReview = await Dispute.countDocuments({
      'assignment.assignedTo': staffId,
      status: 'under_review'
    });

    // Get overdue disputes (assigned more than 24 hours ago)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const overdueDisputes = await Dispute.countDocuments({
      'assignment.assignedTo': staffId,
      status: { $in: ['assigned', 'under_review'] },
      'assignment.assignedAt': { $lt: twentyFourHoursAgo }
    });

    // Get analytics data for the period
    const totalDisputes = await Dispute.countDocuments({
      'assignment.assignedTo': staffId,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const resolvedDisputes = await Dispute.countDocuments({
      'assignment.assignedTo': staffId,
      status: 'resolved',
      'resolution.resolvedAt': { $gte: startDate, $lte: endDate }
    });

    const escalatedDisputes = await Dispute.countDocuments({
      'assignment.assignedTo': staffId,
      status: 'escalated',
      'escalation.escalatedAt': { $gte: startDate, $lte: endDate }
    });

    // Calculate average resolution time
    const resolvedDisputesWithTime = await Dispute.find({
      'assignment.assignedTo': staffId,
      status: 'resolved',
      'resolution.resolvedAt': { $gte: startDate, $lte: endDate }
    }).select('assignment.assignedAt resolution.resolvedAt');

    let totalResolutionTime = 0;
    let validResolutions = 0;

    resolvedDisputesWithTime.forEach(dispute => {
      if (dispute.assignment.assignedAt && dispute.resolution.resolvedAt) {
        const resolutionTime = (dispute.resolution.resolvedAt - dispute.assignment.assignedAt) / (1000 * 60 * 60); // hours
        totalResolutionTime += resolutionTime;
        validResolutions++;
      }
    });

    const averageResolutionTime = validResolutions > 0 ? totalResolutionTime / validResolutions : 0;

    // Get category breakdown
    const categoryStats = await Dispute.aggregate([
      {
        $match: {
          'assignment.assignedTo': staffId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get status breakdown
    const statusStats = await Dispute.aggregate([
      {
        $match: {
          'assignment.assignedTo': staffId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        // Basic stats
        assignedDisputes,
        resolvedToday,
        pendingReview,
        overdueDisputes,
        
        // Analytics data
        totalDisputes,
        resolvedDisputes,
        escalatedDisputes,
        averageResolutionTime: Math.round(averageResolutionTime * 10) / 10,
        
        // Breakdowns
        categoryStats: categoryStats.map(item => ({
          category: item._id,
          count: item.count
        })),
        statusStats: statusStats.map(item => ({
          status: item._id,
          count: item.count
        })),
        
        // Resolution stats for charts
        resolutionStats: {
          total: totalDisputes,
          resolved: resolvedDisputes,
          escalated: escalatedDisputes,
          averageResolutionTime: Math.round(averageResolutionTime * 10) / 10
        }
      }
    });

  } catch (error) {
    console.error('❌ Get staff dispute stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Staff's Assigned Disputes
const getMyDisputes = async (req, res) => {
  try {
    const staffId = req.staff.staffId;
    const { status, priority, page = 1, limit = 10 } = req.query;

    const filter = { 'assignment.assignedTo': staffId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const disputes = await Dispute.find(filter)
      .populate('orderId', 'totalAmount status createdAt buyer vendor agent')
      .populate('raisedBy', 'fullName email shopName businessName')
      .populate('complainant.userId', 'fullName email shopName businessName')
      .populate('respondent.userId', 'fullName email shopName businessName')
      .populate('assignment.assignedTo', 'fullName email role')
      .populate('resolution.resolvedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Dispute.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        disputes,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('❌ Get my disputes error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Dispute Details for Staff
const getDisputeDetails = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const staffId = req.staff.staffId;

    // Build query conditions
    const queryConditions = [
      { disputeId: disputeId }
    ];
    
    // Only add _id condition if disputeId is a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(disputeId)) {
      queryConditions.push({ _id: disputeId });
    }
    
    const dispute = await Dispute.findOne({
      $or: queryConditions,
      'assignment.assignedTo': staffId
    })
      .populate('orderId', 'totalAmount status createdAt buyer vendor agent')
      .populate('raisedBy', 'fullName email shopName businessName')
      .populate('complainant.userId', 'fullName email shopName businessName')
      .populate('respondent.userId', 'fullName email shopName businessName')
      .populate('assignment.assignedTo', 'fullName email role')
      .populate('resolution.resolvedBy', 'fullName email');

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    res.status(200).json({
      success: true,
      data: { dispute }
    });

  } catch (error) {
    console.error('❌ Get dispute details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Start Review
const startReview = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const staffId = req.staff.staffId;

    const dispute = await Dispute.findOne({
      disputeId: disputeId,
      'assignment.assignedTo': staffId,
      status: 'assigned'
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    // Update status to under_review
    dispute.status = 'under_review';
    dispute.lastActivity = new Date();
    
    // Add activity log
    if (!dispute.activityLog) dispute.activityLog = [];
    dispute.activityLog.push({
      action: 'review_started',
      performedBy: staffId,
      performedByType: 'Staff',
      timestamp: new Date(),
      details: 'Staff member started reviewing the dispute'
    });

    await dispute.save();

    // Update staff activity stats
    await Admin.findByIdAndUpdate(staffId, {
      $inc: { 'activityStats.disputesUnderReview': 1 },
      $set: { lastActivity: new Date() }
    });

    res.status(200).json({
      success: true,
      message: 'Review started successfully',
      data: { dispute }
    });

  } catch (error) {
    console.error('❌ Start review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Resolve Dispute
const resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { resolution, notes, refundAmount } = req.body;
    const staffId = req.staff.staffId;

    if (!resolution || !['refund', 'no_refund', 'partial_refund'].includes(resolution)) {
      return res.status(400).json({
        success: false,
        message: 'Valid resolution type is required'
      });
    }

    const dispute = await Dispute.findOne({
      disputeId: disputeId,
      'assignment.assignedTo': staffId,
      status: { $in: ['assigned', 'under_review'] }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    // Update dispute status and resolution
    dispute.status = 'resolved';
    dispute.resolution = {
      resolution,
      notes: notes || '',
      refundAmount: refundAmount || 0,
      resolvedBy: staffId,
      resolvedAt: new Date()
    };
    dispute.lastActivity = new Date();

    // Add activity log
    if (!dispute.activityLog) dispute.activityLog = [];
    dispute.activityLog.push({
      action: 'dispute_resolved',
      performedBy: staffId,
      performedByType: 'Staff',
      timestamp: new Date(),
      details: `Dispute resolved with ${resolution}`
    });

    await dispute.save();

    // Process wallet credit based on resolution
    try {
      await processDisputeRefund(dispute, refundAmount || 0, resolution);
      console.log(`✅ Dispute resolution processed: ${resolution} for dispute ${dispute.disputeId}`);
    } catch (refundError) {
      console.error('❌ Error processing dispute resolution:', refundError);
      // Continue with resolution even if wallet processing fails
    }

    // Update staff activity stats
    await Admin.findByIdAndUpdate(staffId, {
      $inc: { 
        'activityStats.resolvedDisputes': 1,
        'activityStats.disputesUnderReview': -1
      },
      $set: { lastActivity: new Date() }
    });

    res.status(200).json({
      success: true,
      message: 'Dispute resolved successfully',
      data: { dispute }
    });

  } catch (error) {
    console.error('❌ Resolve dispute error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Add Message to Dispute
const addMessage = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { message } = req.body;
    const staffId = req.staff.staffId;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    const dispute = await Dispute.findOne({
      disputeId: disputeId,
      'assignment.assignedTo': staffId
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    // Add message
    if (!dispute.messages) dispute.messages = [];
    dispute.messages.push({
      sender: staffId,
      senderType: 'Staff',
      message: message.trim(),
      timestamp: new Date()
    });

    dispute.lastActivity = new Date();
    await dispute.save();

    res.status(200).json({
      success: true,
      message: 'Message added successfully',
      data: { dispute }
    });

  } catch (error) {
    console.error('❌ Add message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


// Request Additional Information
const requestInfo = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { requestType, message, dueDate } = req.body;
    const staffId = req.staff.staffId;

    const dispute = await Dispute.findOne({
      disputeId: disputeId,
      'assignment.assignedTo': staffId
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    // Add request to activity log
    if (!dispute.activityLog) dispute.activityLog = [];
    dispute.activityLog.push({
      action: 'info_requested',
      performedBy: staffId,
      performedByType: 'Staff',
      timestamp: new Date(),
      details: `Requested ${requestType}: ${message}`,
      metadata: {
        requestType,
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });

    dispute.lastActivity = new Date();
    await dispute.save();

    res.status(200).json({
      success: true,
      message: 'Information request sent successfully',
      data: { dispute }
    });

  } catch (error) {
    console.error('❌ Request info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update Priority
const updatePriority = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { priority, reason } = req.body;
    const staffId = req.staff.staffId;

    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority level'
      });
    }

    const dispute = await Dispute.findOne({
      disputeId: disputeId,
      'assignment.assignedTo': staffId
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    const oldPriority = dispute.priority;
    dispute.priority = priority;
    dispute.lastActivity = new Date();

    // Add activity log
    if (!dispute.activityLog) dispute.activityLog = [];
    dispute.activityLog.push({
      action: 'priority_updated',
      performedBy: staffId,
      performedByType: 'Staff',
      timestamp: new Date(),
      details: `Priority changed from ${oldPriority} to ${priority}`,
      metadata: { reason: reason || '' }
    });

    await dispute.save();

    res.status(200).json({
      success: true,
      message: 'Priority updated successfully',
      data: { dispute }
    });

  } catch (error) {
    console.error('❌ Update priority error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Add Internal Note
const addInternalNote = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { note } = req.body;
    const staffId = req.staff.staffId;

    const dispute = await Dispute.findOne({
      disputeId: disputeId,
      'assignment.assignedTo': staffId
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    // Add internal note
    if (!dispute.internalNotes) dispute.internalNotes = [];
    dispute.internalNotes.push({
      note,
      addedBy: staffId,
      addedAt: new Date()
    });

    dispute.lastActivity = new Date();
    await dispute.save();

    res.status(200).json({
      success: true,
      message: 'Internal note added successfully',
      data: { dispute }
    });

  } catch (error) {
    console.error('❌ Add internal note error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Internal Notes
const getInternalNotes = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const staffId = req.staff.staffId;

    const dispute = await Dispute.findOne({
      disputeId: disputeId,
      'assignment.assignedTo': staffId
    }).populate('internalNotes.addedBy', 'fullName email');

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        notes: dispute.internalNotes || []
      }
    });

  } catch (error) {
    console.error('❌ Get internal notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Contact Parties
const contactParties = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { contactType, message, isInternal } = req.body;
    const staffId = req.staff.staffId;

    const dispute = await Dispute.findOne({
      disputeId: disputeId,
      'assignment.assignedTo': staffId
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    // Add message to dispute
    await dispute.addMessage(staffId, 'Admin', message, isInternal);

    // Add activity log
    if (!dispute.activityLog) dispute.activityLog = [];
    dispute.activityLog.push({
      action: 'parties_contacted',
      performedBy: staffId,
      performedByType: 'Staff',
      timestamp: new Date(),
      details: `Contacted ${contactType}: ${message.substring(0, 50)}...`,
      metadata: { contactType, isInternal }
    });

    dispute.lastActivity = new Date();
    await dispute.save();

    res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: { dispute }
    });

  } catch (error) {
    console.error('❌ Contact parties error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Escalate Dispute
const escalateDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { reason, priority, notes } = req.body;
    const staffId = req.staff.staffId;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Escalation reason is required'
      });
    }

    const dispute = await Dispute.findOne({
      disputeId: disputeId,
      'assignment.assignedTo': staffId,
      status: { $in: ['assigned', 'under_review'] }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    // Update dispute status and escalation details
    dispute.status = 'escalated';
    dispute.escalation = {
      reason,
      priority: priority || 'high',
      escalatedBy: staffId,
      escalatedAt: new Date(),
      notes: notes || ''
    };
    dispute.lastActivity = new Date();

    // Add activity log
    if (!dispute.activityLog) dispute.activityLog = [];
    dispute.activityLog.push({
      action: 'dispute_escalated',
      performedBy: staffId,
      performedByType: 'Staff',
      timestamp: new Date(),
      details: `Dispute escalated: ${reason}`
    });

    await dispute.save();

    // Update staff activity stats
    await Admin.findByIdAndUpdate(staffId, {
      $inc: { 
        'activityStats.escalatedDisputes': 1,
        'activityStats.disputesUnderReview': -1
      },
      $set: { lastActivity: new Date() }
    });

    // Notify all admins about escalation
    const admins = await Admin.find({ 
      isActive: true, 
      role: 'admin' 
    });

    // Send notifications to admins (you can implement notification system here)
    console.log(`🚨 Dispute ${dispute.disputeId} escalated to admins: ${reason}`);

    res.status(200).json({
      success: true,
      message: 'Dispute escalated successfully',
      data: { dispute }
    });

  } catch (error) {
    console.error('❌ Escalate dispute error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
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
    } else if (dispute.orderType === 'AgentOrder') {
      const AgentOrder = require('../models/agentOrderModel');
      order = await AgentOrder.findById(dispute.orderId);
    }

    if (!order) {
      throw new Error('Order not found for dispute resolution');
    }

    // Determine who gets the money based on resolution
    if (resolution === 'no_refund' || resolution === 'favor_respondent') {
      // Vendor/Agent wins - credit their wallet
      let vendorAgentId, vendorAgentRole;
      if (dispute.orderType === 'Order') {
        vendorAgentId = order.agent;
        vendorAgentRole = 'agent';
      } else if (dispute.orderType === 'VendorOrder') {
        vendorAgentId = order.vendor;
        vendorAgentRole = 'vendor';
      } else if (dispute.orderType === 'AgentOrder') {
        vendorAgentId = order.agent;
        vendorAgentRole = 'agent';
      }
      
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
        let vendorAgentId, vendorAgentRole;
        if (dispute.orderType === 'Order') {
          vendorAgentId = order.agent;
          vendorAgentRole = 'agent';
        } else if (dispute.orderType === 'VendorOrder') {
          vendorAgentId = order.vendor;
          vendorAgentRole = 'vendor';
        } else if (dispute.orderType === 'AgentOrder') {
          vendorAgentId = order.agent;
          vendorAgentRole = 'agent';
        }
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
    console.error('❌ Error processing dispute resolution:', error);
    throw error;
  }
};

module.exports = {
  getStaffDisputeStats,
  getMyDisputes,
  getDisputeDetails,
  startReview,
  resolveDispute,
  addMessage,
  escalateDispute,
  requestInfo,
  updatePriority,
  addInternalNote,
  getInternalNotes,
  contactParties
};