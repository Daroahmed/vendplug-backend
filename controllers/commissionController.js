const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

/**
 * Get commission analytics for admin dashboard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCommissionAnalytics = async (req, res) => {
  try {
    const { period = '30d', startDate, endDate } = req.query;
    
    // Calculate date range
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      dateFilter.createdAt = { $gte: startDate };
    }

    console.log('📊 Fetching commission analytics:', { period, dateFilter });

    // Get commission transactions
    const commissionTransactions = await Transaction.find({
      type: 'commission',
      status: 'successful',
      ...dateFilter
    }).sort({ createdAt: -1 });

    // Calculate totals
    const totalCommission = commissionTransactions.reduce((sum, txn) => sum + txn.amount, 0);
    const totalOrders = commissionTransactions.length;
    const averageCommission = totalOrders > 0 ? totalCommission / totalOrders : 0;

    // Get daily breakdown
    const dailyBreakdown = await Transaction.aggregate([
      {
        $match: {
          type: 'commission',
          status: 'successful',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalCommission: { $sum: '$amount' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Get vendor/agent breakdown
    const vendorBreakdown = await Transaction.aggregate([
      {
        $match: {
          type: 'commission',
          status: 'successful',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$metadata.orderType',
          totalCommission: { $sum: '$amount' },
          orderCount: { $sum: 1 }
        }
      }
    ]);

    // Get recent commission transactions
    const recentCommissions = commissionTransactions.slice(0, 10).map(txn => ({
      id: txn._id,
      amount: txn.amount,
      orderId: txn.metadata?.orderId,
      orderType: txn.metadata?.orderType,
      commissionRate: txn.metadata?.commissionRate,
      capped: txn.metadata?.capped,
      createdAt: txn.createdAt
    }));

    // Calculate profit (commission only - Paystack fees paid by buyers)
    const netProfit = totalCommission; // No Paystack fees deducted (buyers pay them)
    
    // Calculate capped commission statistics
    const cappedTransactions = commissionTransactions.filter(txn => txn.metadata?.capped === true);
    const cappedCommissionCount = cappedTransactions.length;
    const cappedCommissionAmount = cappedTransactions.reduce((sum, txn) => sum + txn.amount, 0);

    const analytics = {
      summary: {
        totalCommission,
        totalOrders,
        averageCommission,
        netProfit,
        period,
        cappedCommission: {
          count: cappedCommissionCount,
          amount: cappedCommissionAmount,
          percentage: totalOrders > 0 ? (cappedCommissionCount / totalOrders * 100).toFixed(1) : 0
        },
        note: 'Paystack fees (1.5% + ₦100) are paid by buyers during wallet funding'
      },
      dailyBreakdown,
      vendorBreakdown,
      recentCommissions
    };

    console.log('✅ Commission analytics generated:', {
      totalCommission,
      totalOrders,
      netProfit
    });

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('❌ Error fetching commission analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission analytics',
      error: error.message
    });
  }
};

/**
 * Get commission details for a specific order
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getOrderCommission = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log('🔍 Fetching commission for order:', orderId);

    const commissionTransaction = await Transaction.findOne({
      ref: `COMMISSION_${orderId}`,
      type: 'commission'
    });

    if (!commissionTransaction) {
      return res.status(404).json({
        success: false,
        message: 'Commission record not found for this order'
      });
    }

    const orderTransaction = await Transaction.findOne({
      'metadata.orderId': orderId,
      type: 'transfer',
      status: 'successful'
    });

    const commissionDetails = {
      commission: {
        amount: commissionTransaction.amount,
        rate: commissionTransaction.metadata?.commissionRate,
        capped: commissionTransaction.metadata?.capped,
        createdAt: commissionTransaction.createdAt
      },
      order: {
        originalAmount: commissionTransaction.metadata?.originalAmount,
        vendorAmount: commissionTransaction.metadata?.vendorAmount,
        orderType: commissionTransaction.metadata?.orderType
      },
      transaction: orderTransaction ? {
        amount: orderTransaction.amount,
        description: orderTransaction.description,
        createdAt: orderTransaction.createdAt
      } : null
    };

    res.json({
      success: true,
      data: commissionDetails
    });

  } catch (error) {
    console.error('❌ Error fetching order commission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order commission',
      error: error.message
    });
  }
};

module.exports = {
  getCommissionAnalytics,
  getOrderCommission
};
