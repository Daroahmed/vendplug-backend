const ShareAnalytics = require('../models/ShareAnalytics');

// Track shop sharing
const trackShare = async (req, res) => {
  try {
    const { platform, vendorId, shopUrl, timestamp } = req.body;

    // Create share analytics record
    const shareRecord = new ShareAnalytics({
      platform,
      vendorId,
      shopUrl,
      timestamp: timestamp || new Date(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress
    });

    await shareRecord.save();

    console.log(`📊 Share tracked: ${platform} for shop ${shopUrl}`);

    res.status(200).json({ 
      success: true, 
      message: 'Share tracked successfully' 
    });

  } catch (error) {
    console.error('❌ Error tracking share:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to track share' 
    });
  }
};

// Get share analytics for a vendor
const getVendorShareStats = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const stats = await ShareAnalytics.aggregate([
      { $match: { vendorId } },
      { $group: {
        _id: '$platform',
        count: { $sum: 1 },
        lastShared: { $max: '$timestamp' }
      }},
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error getting share stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get share statistics' 
    });
  }
};

// Get overall platform sharing stats
const getPlatformStats = async (req, res) => {
  try {
    const stats = await ShareAnalytics.aggregate([
      { $group: {
        _id: '$platform',
        totalShares: { $sum: 1 },
        uniqueVendors: { $addToSet: '$vendorId' }
      }},
      { $project: {
        platform: '$_id',
        totalShares: 1,
        uniqueVendors: { $size: '$uniqueVendors' }
      }},
      { $sort: { totalShares: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error getting platform stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get platform statistics' 
    });
  }
};

module.exports = {
  trackShare,
  getVendorShareStats,
  getPlatformStats
};
