const Admin = require('../models/Admin');
const Buyer = require('../models/Buyer');
const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');
const Order = require('../models/Order');
const VendorOrder = require('../models/vendorOrderModel');
const PayoutRequest = require('../models/PayoutRequest');
const Transaction = require('../models/Transaction');
const Dispute = require('../models/Dispute');
const generateToken = require('../utils/generateToken');
const autoAssignmentService = require('../services/autoAssignmentService');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Admin Authentication
const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.json({
      success: true,
      data: admin
    });
  } catch (error) {
    console.error('Error getting admin profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting admin profile',
      error: error.message
    });
  }
};

const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('🔍 Admin login attempt:', { username, password: password ? '***' : 'undefined' });

    if (!username || !password) {
      console.log('❌ Missing username or password');
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find admin by username
    const admin = await Admin.findOne({ username: username.toLowerCase() });
    console.log('🔍 Admin found:', admin ? { id: admin._id, username: admin.username, email: admin.email, isActive: admin.isActive } : 'null');
    
    if (!admin) {
      console.log('❌ Admin not found with username:', username.toLowerCase());
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (admin.isLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.'
      });
    }

    // Check if account is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Contact super admin.'
      });
    }

    // Verify password
    console.log('🔍 Verifying password...');
    const isPasswordValid = await admin.matchPassword(password);
    console.log('🔍 Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password');
      // Increment login attempts
      await admin.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    await admin.resetLoginAttempts();
    
    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate token
    const token = generateToken(admin._id, 'admin');

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        admin: {
          id: admin._id,
          username: admin.username,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role,
          permissions: admin.permissions
        }
      }
    });

  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get Admin Dashboard Overview
const getDashboardOverview = async (req, res) => {
  try {
    console.log('🔍 Loading dashboard data...');
    
    // Get date filters from query
    const { startDate, endDate } = req.query;
    let dateFilter = {};
    
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add one day to endDate to include the entire day
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        dateFilter.createdAt.$lt = endDateObj;
      }
    }
    
    // Get counts
    const totalBuyers = await Buyer.countDocuments();
    const totalVendors = await Vendor.countDocuments();
    const totalAgents = await Agent.countDocuments();
    
    const totalOrders = await Order.countDocuments();
    const totalVendorOrders = await VendorOrder.countDocuments();
    
    const pendingPayouts = await PayoutRequest.countDocuments({ status: 'pending' });
    const processingPayouts = await PayoutRequest.countDocuments({ status: 'processing' });
    
    // Calculate total transaction amounts
    const totalTransactionAmount = await Transaction.aggregate([
      { $match: { status: 'successful' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalOrderAmount = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    const totalVendorOrderAmount = await VendorOrder.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    const totalPayoutAmount = await PayoutRequest.aggregate([
      { $match: { status: { $in: ['completed', 'processing'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Dispute counts
    const openDisputes = await Dispute.countDocuments({ status: 'open' });
    const assignedDisputes = await Dispute.countDocuments({ status: 'assigned' });
    const underReviewDisputes = await Dispute.countDocuments({ status: 'under_review' });
    const resolvedDisputes = await Dispute.countDocuments({ status: 'resolved' });
    const escalatedDisputes = await Dispute.countDocuments({ status: 'escalated' });
    const totalDisputes = await Dispute.countDocuments();
    
    console.log('📊 Counts loaded:', { totalBuyers, totalVendors, totalAgents, totalOrders, totalVendorOrders, pendingPayouts, processingPayouts });
    
    // Get recent orders with proper populate and date filter
    const recentOrders = await Order.find(dateFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('buyer', 'fullName email')
      .populate('agent', 'fullName email')
      .select('status totalAmount createdAt buyer agent');

    const recentVendorOrders = await VendorOrder.find(dateFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('buyer', 'fullName email')
      .populate('vendor', 'shopName fullName email')
      .select('status totalAmount createdAt buyer vendor');

    // Combine both order types and add orderId field
    const allRecentOrders = [
      ...recentOrders.map(order => ({ ...order.toObject(), orderId: order._id, orderType: 'Order' })),
      ...recentVendorOrders.map(order => ({ ...order.toObject(), orderId: order._id, orderType: 'VendorOrder' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

    // Get recent transactions with proper populate and date filter
    const recentTransactions = await Transaction.find(dateFilter)
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('initiatedBy', 'fullName email shopName')
      .select('type amount status createdAt initiatedBy initiatorType');

    // Get pending payouts with proper populate
    const pendingPayoutList = await PayoutRequest.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'fullName email shopName')
      .populate('bankAccountId', 'bankName accountNumber accountName')
      .select('amount status createdAt userId userType bankAccountId');

    console.log('📋 Recent data loaded:', { 
      recentOrders: recentOrders.length, 
      recentVendorOrders: recentVendorOrders.length,
      recentTransactions: recentTransactions.length,
      pendingPayouts: pendingPayoutList.length
    });

    res.status(200).json({
      success: true,
      data: {
        counts: {
          totalBuyers,
          totalVendors,
          totalAgents,
          totalOrders: totalOrders + totalVendorOrders,
          pendingPayouts,
          processingPayouts,
          // Dispute counts
          openDisputes,
          assignedDisputes,
          underReviewDisputes,
          resolvedDisputes,
          escalatedDisputes,
          totalDisputes
        },
        financial: {
          totalTransactionAmount: totalTransactionAmount[0]?.total || 0,
          totalOrderAmount: (totalOrderAmount[0]?.total || 0) + (totalVendorOrderAmount[0]?.total || 0),
          totalPayoutAmount: totalPayoutAmount[0]?.total || 0,
          netRevenue: (totalTransactionAmount[0]?.total || 0) - (totalPayoutAmount[0]?.total || 0)
        },
        recentOrders: allRecentOrders,
        recentTransactions,
        pendingPayouts: pendingPayoutList
      }
    });

  } catch (error) {
    console.error('❌ Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get All Users (with pagination and filters)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, status } = req.query;
    
    const skip = (page - 1) * limit;
    let query = {};
    let userModel;

    // Determine which model to query based on role
    switch (role) {
      case 'buyer':
        userModel = Buyer;
        break;
      case 'vendor':
        userModel = Vendor;
        break;
      case 'agent':
        userModel = Agent;
        break;
      default:
        // If no role specified, return all users combined
        const [buyers, vendors, agents] = await Promise.all([
          Buyer.find().limit(limit).skip(skip),
          Vendor.find().limit(limit).skip(skip),
          Agent.find().limit(limit).skip(skip)
        ]);
        
        // Combine all users into a single array
        const allUsers = [
          ...buyers.map(user => ({ ...user.toObject(), userType: 'buyer', isActive: user.isActive !== false })),
          ...vendors.map(user => ({ ...user.toObject(), userType: 'vendor', isActive: user.isActive !== false })),
          ...agents.map(user => ({ ...user.toObject(), userType: 'agent', isActive: user.isActive !== false }))
        ];
        
        // Get total counts for pagination
        const [totalBuyers, totalVendors, totalAgents] = await Promise.all([
          Buyer.countDocuments(),
          Vendor.countDocuments(),
          Agent.countDocuments()
        ]);
        
        return res.status(200).json({
          success: true,
          data: {
            users: allUsers,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: totalBuyers + totalVendors + totalAgents,
              pages: Math.ceil((totalBuyers + totalVendors + totalAgents) / limit)
            }
          }
        });
    }

    // Build search query
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
      
      if (role === 'vendor') {
        query.$or.push({ shopName: { $regex: search, $options: 'i' } });
      }
    }

    // Build status query
    if (status) {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }

    const users = await userModel.find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await userModel.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update User Status (suspend/activate)
const updateUserStatus = async (req, res) => {
  try {
    const { userId, userType, action } = req.body;
    
    if (!userId || !userType || !action) {
      return res.status(400).json({
        success: false,
        message: 'User ID, user type, and action are required'
      });
    }

    let userModel;
    switch (userType.toLowerCase()) {
      case 'buyer':
        userModel = Buyer;
        break;
      case 'vendor':
        userModel = Vendor;
        break;
      case 'agent':
        userModel = Agent;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user type'
        });
    }

    const updateData = {};
    if (action === 'suspend') {
      updateData.isActive = false;
    } else if (action === 'activate') {
      updateData.isActive = true;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "suspend" or "activate"'
      });
    }

    const user = await userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `User ${action}d successfully`,
      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('❌ Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get All Orders (with pagination and filters)
const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, orderType } = req.query;
    
    const skip = (page - 1) * limit;
    let orders = [];
    let total = 0;

    // Build query
    let query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'buyer.fullName': { $regex: search, $options: 'i' } },
        { 'vendor.shopName': { $regex: search, $options: 'i' } }
      ];
    }

    if (orderType === 'vendor' || !orderType) {
      const vendorOrders = await VendorOrder.find(query)
        .populate('buyer', 'fullName email')
        .populate('vendor', 'shopName fullName email')
        .limit(parseInt(limit))
        .skip(skip)
        .sort({ createdAt: -1 });
      
      orders.push(...vendorOrders);
      total += await VendorOrder.countDocuments(query);
    }

    if (orderType === 'agent' || !orderType) {
      const agentOrders = await Order.find(query)
        .populate('buyer', 'fullName email')
        .populate('agent', 'fullName email')
        .limit(parseInt(limit))
        .skip(skip)
        .sort({ createdAt: -1 });
      
      orders.push(...agentOrders);
      total += await Order.countDocuments(query);
    }

    // Sort combined orders by creation date
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get Payout Management
const getPayoutManagement = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const skip = (page - 1) * limit;
    let query = {};
    
    if (status) query.status = status;

    const payouts = await PayoutRequest.find(query)
      .populate('userId', 'fullName email shopName')
      .populate('bankAccountId', 'bankName accountNumber accountName')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await PayoutRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        payouts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get payout management error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Approve/Reject Payout
const updatePayoutStatus = async (req, res) => {
  try {
    const { payoutId, action, reason } = req.body;
    
    if (!payoutId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Payout ID and action are required'
      });
    }

    const payout = await PayoutRequest.findById(payoutId);
    if (!payout) {
      return res.status(404).json({
        success: false,
        message: 'Payout request not found'
      });
    }

    if (payout.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payout is not in pending status'
      });
    }

    let updateData = {};
    if (action === 'approve') {
      updateData.status = 'processing';
      updateData.processedAt = new Date();
      updateData.metadata = { ...payout.metadata, approvedBy: req.admin.id, approvedAt: new Date() };
    } else if (action === 'reject') {
      updateData.status = 'failed';
      updateData.failureReason = reason || 'Rejected by admin';
      updateData.metadata = { ...payout.metadata, rejectedBy: req.admin.id, rejectedAt: new Date() };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject"'
      });
    }

    const updatedPayout = await PayoutRequest.findByIdAndUpdate(
      payoutId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: `Payout ${action}d successfully`,
      data: updatedPayout
    });

  } catch (error) {
    console.error('❌ Update payout status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Dispute Management
const getDisputeManagement = async (req, res) => {
  try {
    const { status, priority, assignedTo, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter['assignment.assignedTo'] = assignedTo;

    const disputes = await Dispute.find(filter)
      .populate({
        path: 'order',
        select: 'totalAmount status createdAt',
        populate: [
          { path: 'buyer', select: 'fullName email' },
          { path: 'vendor', select: 'shopName email' }
        ]
      })
      .populate('raisedBy', 'fullName email shopName')
      .populate('assignment.assignedTo', 'fullName email role')
      .populate('resolution.resolvedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Dispute.countDocuments(filter);

    // Debug: Log the first dispute to see the data structure
    if (disputes.length > 0) {
      console.log('🔍 First dispute in getDisputeManagement:', JSON.stringify(disputes[0], null, 2));
    }

    // Get dispute statistics
    const stats = await Dispute.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const disputeStats = {
      total: await Dispute.countDocuments(),
      open: await Dispute.countDocuments({ status: 'open' }),
      under_review: await Dispute.countDocuments({ status: 'under_review' }),
      resolved: await Dispute.countDocuments({ status: 'resolved' }),
      closed: await Dispute.countDocuments({ status: 'closed' })
    };

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        },
        stats: disputeStats
      }
    });

  } catch (error) {
    console.error('❌ Get dispute management error:', error);
    res.status(500).json({ error: 'Failed to fetch dispute data' });
  }
};

const assignDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { assignedTo } = req.body;
    const adminId = req.user.id;

    const dispute = await Dispute.findOne({ disputeId });
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    dispute.assignedTo = assignedTo;
    dispute.status = 'under_review';
    dispute.lastActivity = new Date();
    await dispute.save();

    res.json({ message: 'Dispute assigned successfully' });

  } catch (error) {
    console.error('❌ Assign dispute error:', error);
    res.status(500).json({ error: 'Failed to assign dispute' });
  }
};

const resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { decision, reason, refundAmount, notes } = req.body;
    const adminId = req.user.id;

    const dispute = await Dispute.findOne({ disputeId });
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    // Resolve the dispute
    await dispute.resolve(decision, reason, refundAmount, adminId, notes);

    res.json({ message: 'Dispute resolved successfully' });

  } catch (error) {
    console.error('❌ Resolve dispute error:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
};

// ==================== STAFF MANAGEMENT ====================

// Get all staff members
const getAllStaff = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isActive } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const staff = await Admin.find(query)
      .select('-password')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await Admin.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        staff,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get all staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new staff member
const createStaff = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      fullName,
      role,
      permissions,
      disputeSpecialties,
      maxConcurrentDisputes
    } = req.body;
    
    // Check if user already exists
    const existingStaff = await Admin.findOne({
      $or: [{ email }, { username }]
    });
    
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'Staff member with this email or username already exists'
      });
    }
    
    // Set default permissions based on role
    let defaultPermissions = {
      userManagement: false,
      orderManagement: false,
      payoutManagement: false,
      disputeManagement: false,
      disputeAssignment: false,
      disputeResolution: false,
      disputeEscalation: false,
      analytics: false,
      systemSettings: false
    };
    
    // Set role-specific permissions
    switch (role) {
      case 'super_admin':
        Object.keys(defaultPermissions).forEach(key => {
          defaultPermissions[key] = true;
        });
        break;
      case 'dispute_manager':
        defaultPermissions.disputeManagement = true;
        defaultPermissions.disputeAssignment = true;
        defaultPermissions.disputeResolution = true;
        defaultPermissions.disputeEscalation = true;
        defaultPermissions.analytics = true;
        break;
      case 'dispute_specialist':
        defaultPermissions.disputeManagement = true;
        defaultPermissions.disputeResolution = true;
        break;
      case 'dispute_analyst':
        defaultPermissions.disputeManagement = true;
        break;
      case 'admin':
        defaultPermissions.userManagement = true;
        defaultPermissions.orderManagement = true;
        defaultPermissions.payoutManagement = true;
        defaultPermissions.disputeManagement = true;
        defaultPermissions.analytics = true;
        break;
    }
    
    const staff = new Admin({
      username,
      email,
      password,
      fullName,
      role,
      permissions: { ...defaultPermissions, ...permissions },
      disputeSpecialties: disputeSpecialties || [],
      maxConcurrentDisputes: maxConcurrentDisputes || 10
    });
    
    await staff.save();
    
    // Remove password from response
    const staffResponse = staff.toObject();
    delete staffResponse.password;
    
    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: staffResponse
    });
    
  } catch (error) {
    console.error('❌ Create staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update staff member
const updateStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const updateData = req.body;
    
    // Don't allow updating password through this endpoint
    delete updateData.password;
    
    const staff = await Admin.findByIdAndUpdate(
      staffId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Staff member updated successfully',
      data: staff
    });
    
  } catch (error) {
    console.error('❌ Update staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get staff activity logs (all staff)
const getStaffActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, staffId, action, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;
    
    // Build filter query
    let filter = {};
    
    if (staffId) {
      filter['resolution.resolvedBy'] = staffId;
    }
    
    if (action) {
      filter['resolution.decision'] = action;
    }
    
    if (startDate || endDate) {
      filter['resolution.resolvedAt'] = {};
      if (startDate) {
        filter['resolution.resolvedAt'].$gte = new Date(startDate);
      }
      if (endDate) {
        filter['resolution.resolvedAt'].$lte = new Date(endDate);
      }
    }
    
    // Get resolved disputes (staff activity)
    const disputes = await Dispute.find(filter)
      .populate('resolution.resolvedBy', 'fullName email role')
      .populate('complainant', 'fullName email')
      .populate('respondent', 'fullName email')
      .sort({ 'resolution.resolvedAt': -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Dispute.countDocuments(filter);
    
    // Format activity logs
    const activityLogs = disputes.map(dispute => ({
      id: dispute._id,
      disputeId: dispute.disputeId,
      action: dispute.resolution?.decision || 'resolved',
      staff: {
        id: dispute.resolution?.resolvedBy?._id,
        name: dispute.resolution?.resolvedBy?.fullName,
        email: dispute.resolution?.resolvedBy?.email,
        role: dispute.resolution?.resolvedBy?.role
      },
      dispute: {
        title: dispute.title,
        category: dispute.category,
        status: dispute.status,
        priority: dispute.priority
      },
      parties: {
        complainant: {
          name: dispute.complainant?.fullName,
          email: dispute.complainant?.email
        },
        respondent: {
          name: dispute.respondent?.fullName,
          email: dispute.respondent?.email
        }
      },
      timestamp: dispute.resolution?.resolvedAt,
      details: dispute.resolution?.reason || 'Dispute resolved'
    }));
    
    res.json({
      success: true,
      data: activityLogs,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: activityLogs.length,
        totalRecords: total
      }
    });
    
  } catch (error) {
    console.error('❌ Get staff activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff activity logs',
      error: error.message
    });
  }
};

// Get staff activity stats (specific staff)
const getStaffActivity = async (req, res) => {
  try {
    const { staffId } = req.params;
    
    const staff = await Admin.findById(staffId)
      .select('-password')
      .populate('activityStats.currentDisputes', 'disputeId title status priority createdAt');
    
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    // Get recent dispute activity
    const recentDisputes = await Dispute.find({
      'resolution.resolvedBy': staffId
    })
    .sort({ 'resolution.resolvedAt': -1 })
    .limit(10)
    .select('disputeId title status resolution.resolvedAt resolution.decision');
    
    res.status(200).json({
      success: true,
      data: {
        staff,
        recentDisputes
      }
    });
    
  } catch (error) {
    console.error('❌ Get staff activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get available staff for dispute assignment
const getAvailableStaff = async (req, res) => {
  try {
    const { category, priority } = req.query;
    
    let query = {
      isActive: true,
      'permissions.disputeResolution': true
    };
    
    // Filter by dispute specialties if category is specified
    if (category) {
      query.disputeSpecialties = { $in: [category, 'other'] };
    }
    
    const staff = await Admin.find(query)
      .select('_id fullName role disputeSpecialties maxConcurrentDisputes activityStats')
      .populate('activityStats.currentDisputes', 'disputeId status priority');
    
    // Filter staff based on current workload
    const availableStaff = staff.filter(member => {
      const currentDisputes = member.activityStats.currentDisputes.length;
      return currentDisputes < member.maxConcurrentDisputes;
    });
    
    // Sort by workload (least busy first)
    availableStaff.sort((a, b) => {
      const aWorkload = a.activityStats.currentDisputes.length;
      const bWorkload = b.activityStats.currentDisputes.length;
      return aWorkload - bWorkload;
    });
    
    res.status(200).json({
      success: true,
      data: availableStaff
    });
    
  } catch (error) {
    console.error('❌ Get available staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Auto Assignment Management
const getAssignmentStats = async (req, res) => {
  try {
    const stats = await autoAssignmentService.getAssignmentStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting assignment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting assignment statistics',
      error: error.message
    });
  }
};

const autoAssignDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    
    const result = await autoAssignmentService.autoAssignDispute(disputeId);
    
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error auto-assigning dispute:', error);
    res.status(500).json({
      success: false,
      message: 'Error auto-assigning dispute',
      error: error.message
    });
  }
};

const rebalanceAssignments = async (req, res) => {
  try {
    await autoAssignmentService.rebalanceAssignments();
    
    res.json({
      success: true,
      message: 'Assignment rebalancing completed successfully'
    });
  } catch (error) {
    console.error('Error rebalancing assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Error rebalancing assignments',
      error: error.message
    });
  }
};

const toggleAutoAssignment = async (req, res) => {
  try {
    const { action } = req.body; // 'start' or 'stop'
    
    if (action === 'start') {
      autoAssignmentService.start();
      res.json({
        success: true,
        message: 'Auto-assignment service started'
      });
    } else if (action === 'stop') {
      autoAssignmentService.stop();
      res.json({
        success: true,
        message: 'Auto-assignment service stopped'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid action. Use "start" or "stop"'
      });
    }
  } catch (error) {
    console.error('Error toggling auto-assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling auto-assignment service',
      error: error.message
    });
  }
};

// Bulk import staff from CSV
const bulkImportStaff = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No CSV file uploaded'
      });
    }

    const results = [];
    const errors = [];
    let imported = 0;

    // Parse CSV file
    const csvData = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => csvData.push(data))
      .on('end', async () => {
        try {
          for (const row of csvData) {
            try {
              // Validate required fields
              if (!row.fullName || !row.email || !row.username || !row.password || !row.role) {
                errors.push(`Row ${csvData.indexOf(row) + 1}: Missing required fields`);
                continue;
              }

              // Check if staff already exists
              const existingStaff = await Admin.findOne({
                $or: [{ email: row.email }, { username: row.username }]
              });

              if (existingStaff) {
                errors.push(`Row ${csvData.indexOf(row) + 1}: Staff with email ${row.email} or username ${row.username} already exists`);
                continue;
              }

              // Parse specialties
              const specialties = row.disputeSpecialties ? 
                row.disputeSpecialties.split(',').map(s => s.trim()) : [];

              // Create staff member
              const staffData = {
                fullName: row.fullName,
                email: row.email,
                username: row.username,
                password: row.password,
                role: row.role,
                maxConcurrentDisputes: parseInt(row.maxConcurrentDisputes) || 10,
                disputeSpecialties: specialties,
                permissions: getDefaultPermissionsForRole(row.role),
                isActive: true
              };

              const staff = new Admin(staffData);
              await staff.save();
              
              results.push({
                fullName: staff.fullName,
                email: staff.email,
                role: staff.role
              });
              
              imported++;

            } catch (error) {
              errors.push(`Row ${csvData.indexOf(row) + 1}: ${error.message}`);
            }
          }

          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          res.json({
            success: true,
            message: `Successfully imported ${imported} staff members`,
            data: {
              imported,
              results,
              errors
            }
          });

        } catch (error) {
          console.error('Error processing CSV:', error);
          res.status(500).json({
            success: false,
            message: 'Error processing CSV file',
            error: error.message
          });
        }
      });

  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({
      success: false,
      message: 'Error importing staff',
      error: error.message
    });
  }
};

// Helper function to get default permissions for role
const getDefaultPermissionsForRole = (role) => {
  const defaultPermissions = {
    disputeResolution: false,
    disputeAssignment: false,
    userManagement: false,
    analytics: false,
    orderManagement: false,
    payoutManagement: false
  };

  switch (role) {
    case 'dispute_manager':
      return {
        disputeResolution: true,
        disputeAssignment: true,
        userManagement: true,
        analytics: true,
        orderManagement: true,
        payoutManagement: true
      };
    case 'dispute_specialist':
      return {
        disputeResolution: true,
        disputeAssignment: false,
        userManagement: false,
        analytics: true,
        orderManagement: true,
        payoutManagement: false
      };
    case 'dispute_analyst':
      return {
        disputeResolution: true,
        disputeAssignment: false,
        userManagement: false,
        analytics: true,
        orderManagement: false,
        payoutManagement: false
      };
    default:
      return defaultPermissions;
  }
};

// Get staff dispute statistics
const getStaffDisputeStats = async (req, res) => {
  try {
    const staff = await Admin.find({ role: 'staff' }).select('_id fullName email');
    
    const staffStats = await Promise.all(staff.map(async (staffMember) => {
      const disputes = await Dispute.find({ assignedTo: staffMember._id });
      
      return {
        staffId: staffMember._id,
        staffName: staffMember.fullName,
        staffEmail: staffMember.email,
        totalAssigned: disputes.length,
        currentDisputes: disputes.filter(d => d.status === 'assigned' || d.status === 'under_review').length,
        resolvedDisputes: disputes.filter(d => d.status === 'resolved').length,
        underReviewDisputes: disputes.filter(d => d.status === 'under_review').length,
        overdueDisputes: disputes.filter(d => {
          if (d.status === 'resolved') return false;
          const daysSinceAssigned = Math.floor((new Date() - new Date(d.assignedAt)) / (1000 * 60 * 60 * 24));
          return daysSinceAssigned > 7; // Consider overdue after 7 days
        }).length
      };
    }));

    res.json({
      success: true,
      data: staffStats
    });

  } catch (error) {
    console.error('Error getting staff dispute stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff dispute statistics',
      error: error.message
    });
  }
};

// Get disputes assigned to a specific staff member
const getStaffDisputes = async (req, res) => {
  try {
    const { staffId } = req.params;
    
    const staff = await Admin.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const disputes = await Dispute.find({ assignedTo: staffId })
      .populate('complainant', 'fullName email')
      .populate('respondent', 'fullName email')
      .populate('orderId', 'orderNumber totalAmount status')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        staff: {
          _id: staff._id,
          fullName: staff.fullName,
          email: staff.email,
          role: staff.role
        },
        disputes: disputes
      }
    });

  } catch (error) {
    console.error('Error getting staff disputes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff disputes',
      error: error.message
    });
  }
};

module.exports = {
  getAdminProfile,
  adminLogin,
  getDashboardOverview,
  getAllUsers,
  updateUserStatus,
  getAllOrders,
  getPayoutManagement,
  updatePayoutStatus,
  getDisputeManagement,
  assignDispute,
  resolveDispute,
  // Staff Management
  getAllStaff,
  createStaff,
  updateStaff,
  getStaffActivity,
  getStaffActivityLogs,
  getAvailableStaff,
  getStaffDisputeStats,
  getStaffDisputes,
  // Auto Assignment
  getAssignmentStats,
  autoAssignDispute,
  rebalanceAssignments,
  toggleAutoAssignment,
  bulkImportStaff
};
