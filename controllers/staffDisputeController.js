// backend/controllers/staffDisputeController.js
const Dispute = require('../models/Dispute');
const Admin = require('../models/Admin');
const Order = require('../models/Order');
const Buyer = require('../models/Buyer');
const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');

// Get staff's assigned disputes
const getStaffDisputes = async (req, res) => {
  try {
    const staffId = req.admin._id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build query for staff's disputes
    let query = {
      'assignment.assignedTo': staffId
    };

    if (status) {
      query.status = status;
    }

    const disputes = await Dispute.find(query)
      .populate('order', 'orderId totalAmount status')
      .populate('complainant.userId', 'fullName email')
      .populate('respondent.userId', 'fullName email businessName')
      .populate('raisedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Dispute.countDocuments(query);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching staff disputes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching disputes',
      error: error.message
    });
  }
};

// Get dispute details for staff
const getDisputeDetails = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const staffId = req.admin._id;

    const dispute = await Dispute.findOne({
      disputeId,
      'assignment.assignedTo': staffId
    })
      .populate('order', 'orderId totalAmount status items')
      .populate('complainant.userId', 'fullName email phone')
      .populate('respondent.userId', 'fullName email businessName phone')
      .populate('raisedBy', 'fullName email')
      .populate('messages.sender.userId', 'fullName email')
      .populate('evidence.uploadedBy', 'fullName email');

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    res.json({
      success: true,
      data: dispute
    });
  } catch (error) {
    console.error('Error fetching dispute details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dispute details',
      error: error.message
    });
  }
};

// Add message to dispute
const addDisputeMessage = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { message, isInternal = false, attachments = [] } = req.body;
    const staffId = req.admin._id;

    const dispute = await Dispute.findOne({
      disputeId,
      'assignment.assignedTo': staffId
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    // Add message
    dispute.messages.push({
      sender: {
        userId: staffId,
        userType: 'Admin'
      },
      message,
      isInternal,
      attachments
    });

    dispute.lastActivity = new Date();
    await dispute.save();

    res.json({
      success: true,
      message: 'Message added successfully',
      data: dispute.messages[dispute.messages.length - 1]
    });
  } catch (error) {
    console.error('Error adding dispute message:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding message',
      error: error.message
    });
  }
};

// Update dispute status
const updateDisputeStatus = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { status, notes } = req.body;
    const staffId = req.admin._id;

    const dispute = await Dispute.findOne({
      disputeId,
      'assignment.assignedTo': staffId
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    // Update status
    dispute.status = status;
    dispute.lastActivity = new Date();

    // Add status change message
    dispute.messages.push({
      sender: {
        userId: staffId,
        userType: 'Admin'
      },
      message: `Status changed to: ${status}${notes ? ` - ${notes}` : ''}`,
      isInternal: true
    });

    await dispute.save();

    res.json({
      success: true,
      message: 'Dispute status updated successfully',
      data: { status: dispute.status, lastActivity: dispute.lastActivity }
    });
  } catch (error) {
    console.error('Error updating dispute status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating dispute status',
      error: error.message
    });
  }
};

// Resolve dispute
const resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { decision, reason, refundAmount, notes } = req.body;
    const staffId = req.admin._id;

    const dispute = await Dispute.findOne({
      disputeId,
      'assignment.assignedTo': staffId
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or not assigned to you'
      });
    }

    // Resolve dispute
    dispute.status = 'resolved';
    dispute.resolution = {
      decision,
      reason,
      refundAmount: refundAmount || 0,
      resolvedBy: staffId,
      resolvedAt: new Date(),
      notes
    };
    dispute.lastActivity = new Date();

    // Add resolution message
    dispute.messages.push({
      sender: {
        userId: staffId,
        userType: 'Admin'
      },
      message: `Dispute resolved: ${decision}${reason ? ` - ${reason}` : ''}${refundAmount ? ` (Refund: $${refundAmount})` : ''}`,
      isInternal: false
    });

    await dispute.save();

    // Update staff activity stats
    const staff = await Admin.findById(staffId);
    if (staff && staff.activityStats) {
      staff.activityStats.disputesResolved += 1;
      staff.activityStats.currentDisputes = staff.activityStats.currentDisputes.filter(
        id => id.toString() !== dispute._id.toString()
      );
      staff.activityStats.lastActivity = new Date();
      await staff.save();
    }

    res.json({
      success: true,
      message: 'Dispute resolved successfully',
      data: dispute.resolution
    });
  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolving dispute',
      error: error.message
    });
  }
};

// Get staff performance analytics
const getStaffAnalytics = async (req, res) => {
  try {
    const staffId = req.admin._id;
    const { period = '30' } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get staff info
    const staff = await Admin.findById(staffId).select('fullName role activityStats');

    // Get dispute statistics
    const disputeStats = await Dispute.aggregate([
      {
        $match: {
          'assignment.assignedTo': staffId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get resolution time analytics
    const resolutionStats = await Dispute.aggregate([
      {
        $match: {
          'assignment.assignedTo': staffId,
          status: 'resolved',
          'resolution.resolvedAt': { $gte: startDate }
        }
      },
      {
        $project: {
          resolutionTime: {
            $divide: [
              { $subtract: ['$resolution.resolvedAt', '$createdAt'] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          averageResolutionTime: { $avg: '$resolutionTime' },
          minResolutionTime: { $min: '$resolutionTime' },
          maxResolutionTime: { $max: '$resolutionTime' }
        }
      }
    ]);

    // Get category breakdown
    const categoryStats = await Dispute.aggregate([
      {
        $match: {
          'assignment.assignedTo': staffId,
          createdAt: { $gte: startDate }
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

    res.json({
      success: true,
      data: {
        staff: {
          name: staff.fullName,
          role: staff.role,
          currentWorkload: staff.activityStats?.currentDisputes?.length || 0,
          totalAssigned: staff.activityStats?.disputesAssigned || 0,
          totalResolved: staff.activityStats?.disputesResolved || 0
        },
        period: `${period} days`,
        disputeStats,
        resolutionStats: resolutionStats[0] || {},
        categoryStats
      }
    });
  } catch (error) {
    console.error('Error fetching staff analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message
    });
  }
};

// Get available disputes for assignment (for managers)
const getAvailableDisputes = async (req, res) => {
  try {
    const { category, priority, page = 1, limit = 10 } = req.query;

    // Check if user has assignment permissions
    if (!req.admin.permissions?.disputeAssignment) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign disputes'
      });
    }

    let query = {
      status: 'open',
      'assignment.assignedTo': { $exists: false }
    };

    if (category) query.category = category;
    if (priority) query.priority = priority;

    const disputes = await Dispute.find(query)
      .populate('order', 'orderId totalAmount')
      .populate('complainant.userId', 'fullName email')
      .populate('respondent.userId', 'fullName email businessName')
      .sort({ priority: -1, createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Dispute.countDocuments(query);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching available disputes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available disputes',
      error: error.message
    });
  }
};

// Assign dispute to staff (for managers)
const assignDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { assignedTo, notes } = req.body;
    const assignedBy = req.admin._id;

    // Check if user has assignment permissions
    if (!req.admin.permissions?.disputeAssignment) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign disputes'
      });
    }

    // Find the dispute
    const dispute = await Dispute.findOne({
      disputeId,
      status: 'open',
      'assignment.assignedTo': { $exists: false }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found or already assigned'
      });
    }

    // Find the assigned staff member
    const staff = await Admin.findOne({
      _id: assignedTo,
      isActive: true,
      'permissions.disputeResolution': true
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found or not available for dispute resolution'
      });
    }

    // Check if staff can handle this category
    const canHandle = staff.disputeSpecialties.includes(dispute.category) || 
                     staff.disputeSpecialties.includes('other');

    if (!canHandle) {
      return res.status(400).json({
        success: false,
        message: `${staff.fullName} cannot handle ${dispute.category} disputes`
      });
    }

    // Check workload
    const currentWorkload = staff.activityStats?.currentDisputes?.length || 0;
    if (currentWorkload >= staff.maxConcurrentDisputes) {
      return res.status(400).json({
        success: false,
        message: `${staff.fullName} is at maximum capacity (${currentWorkload}/${staff.maxConcurrentDisputes})`
      });
    }

    // Assign dispute
    dispute.assignment = {
      assignedTo: staff._id,
      assignedAt: new Date(),
      assignedBy,
      notes: notes || `Assigned to ${staff.fullName} by ${req.admin.fullName}`
    };
    dispute.status = 'assigned';
    dispute.lastActivity = new Date();

    // Add assignment message
    dispute.messages.push({
      sender: {
        userId: assignedBy,
        userType: 'Admin'
      },
      message: `Dispute assigned to ${staff.fullName}${notes ? ` - ${notes}` : ''}`,
      isInternal: true
    });

    await dispute.save();

    // Update staff activity stats
    if (!staff.activityStats) {
      staff.activityStats = {
        currentDisputes: [],
        disputesAssigned: 0,
        disputesResolved: 0,
        averageResolutionTime: 0,
        lastActivity: new Date()
      };
    }

    staff.activityStats.currentDisputes.push(dispute._id);
    staff.activityStats.disputesAssigned += 1;
    staff.activityStats.lastActivity = new Date();
    await staff.save();

    res.json({
      success: true,
      message: 'Dispute assigned successfully',
      data: {
        disputeId: dispute.disputeId,
        assignedTo: staff.fullName,
        assignedAt: dispute.assignment.assignedAt
      }
    });
  } catch (error) {
    console.error('Error assigning dispute:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning dispute',
      error: error.message
    });
  }
};

module.exports = {
  getStaffDisputes,
  getDisputeDetails,
  addDisputeMessage,
  updateDisputeStatus,
  resolveDispute,
  getStaffAnalytics,
  getAvailableDisputes,
  assignDispute
};
