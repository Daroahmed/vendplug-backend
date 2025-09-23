const Ad = require('../models/Ad');
const NotificationCampaign = require('../models/NotificationCampaign');
const { sendNotification, broadcastNotification } = require('../utils/notificationHelper');
const mongoose = require('mongoose');

// ===============================
// Ad Management
// ===============================

// Get all ads with filtering and pagination
const getAds = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      status, 
      position, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Apply filters
    if (type) query.type = type;
    if (status) query.status = status;
    if (position) query.position = position;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const ads = await Ad.find(query)
      .populate('createdBy', 'fullName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Ad.countDocuments(query);

    res.json({
      success: true,
      data: {
        ads,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Get ads error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ads'
    });
  }
};

// Get single ad
const getAd = async (req, res) => {
  try {
    const { adId } = req.params;
    const ad = await Ad.findById(adId).populate('createdBy', 'fullName email');

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    res.json({
      success: true,
      data: ad
    });
  } catch (error) {
    console.error('❌ Get ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ad'
    });
  }
};

// Create new ad
const createAd = async (req, res) => {
  try {
    const adData = {
      ...req.body,
      createdBy: req.admin._id
    };

    const ad = new Ad(adData);
    await ad.save();

    res.status(201).json({
      success: true,
      message: 'Ad created successfully',
      data: ad
    });
  } catch (error) {
    console.error('❌ Create ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating ad'
    });
  }
};

// Update ad
const updateAd = async (req, res) => {
  try {
    const { adId } = req.params;
    const ad = await Ad.findById(adId);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    Object.assign(ad, req.body);
    await ad.save();

    res.json({
      success: true,
      message: 'Ad updated successfully',
      data: ad
    });
  } catch (error) {
    console.error('❌ Update ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating ad'
    });
  }
};

// Delete ad
const deleteAd = async (req, res) => {
  try {
    const { adId } = req.params;
    const ad = await Ad.findById(adId);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    await Ad.findByIdAndDelete(adId);

    res.json({
      success: true,
      message: 'Ad deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting ad'
    });
  }
};

// Toggle ad status
const toggleAdStatus = async (req, res) => {
  try {
    const { adId } = req.params;
    const ad = await Ad.findById(adId);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    ad.isActive = !ad.isActive;
    ad.status = ad.isActive ? 'active' : 'paused';
    await ad.save();

    res.json({
      success: true,
      message: `Ad ${ad.isActive ? 'activated' : 'paused'} successfully`,
      data: ad
    });
  } catch (error) {
    console.error('❌ Toggle ad status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling ad status'
    });
  }
};

// Get ad analytics
const getAdAnalytics = async (req, res) => {
  try {
    const { adId } = req.params;
    const ad = await Ad.findById(adId);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    const analytics = {
      views: ad.views,
      clicks: ad.clicks,
      impressions: ad.impressions,
      ctr: ad.ctr,
      status: ad.status,
      isActive: ad.isActive,
      createdAt: ad.createdAt,
      startDate: ad.startDate,
      endDate: ad.endDate
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('❌ Get ad analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ad analytics'
    });
  }
};

// ===============================
// Notification Campaigns
// ===============================

// Get all notification campaigns
const getNotificationCampaigns = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      status, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Apply filters
    if (type) query.type = type;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const campaigns = await NotificationCampaign.find(query)
      .populate('createdBy', 'fullName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await NotificationCampaign.countDocuments(query);

    res.json({
      success: true,
      data: {
        campaigns,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Get notification campaigns error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification campaigns'
    });
  }
};

// Get single notification campaign
const getNotificationCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await NotificationCampaign.findById(campaignId).populate('createdBy', 'fullName email');

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('❌ Get notification campaign error:', error);
    res.status(500).json({ success: false, message: 'Error fetching notification campaign' });
  }
};

// Create notification campaign
const createNotificationCampaign = async (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      createdBy: req.admin._id
    };

    const campaign = new NotificationCampaign(campaignData);
    await campaign.save();

    res.status(201).json({
      success: true,
      message: 'Notification campaign created successfully',
      data: campaign
    });
  } catch (error) {
    console.error('❌ Create notification campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating notification campaign'
    });
  }
};

// Update notification campaign
const updateNotificationCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await NotificationCampaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (campaign.status === 'sending') {
      return res.status(400).json({ success: false, message: 'Cannot update a campaign while sending' });
    }

    // Allow updating core fields
    const updatable = ['title','message','type','image','link','linkText','targetUserTypes','targetUserIds','targetUserType','deliveryMethod','priority','scheduledFor','expiresAt','isActive','status','settings'];
    for (const key of updatable) {
      if (key in req.body) {
        campaign[key] = req.body[key];
      }
    }

    await campaign.save();
    res.json({ success: true, message: 'Campaign updated successfully', data: campaign });
  } catch (error) {
    console.error('❌ Update notification campaign error:', error);
    res.status(500).json({ success: false, message: 'Error updating notification campaign' });
  }
};

// Delete notification campaign
const deleteNotificationCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await NotificationCampaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (campaign.status === 'sending') {
      return res.status(400).json({ success: false, message: 'Cannot delete a campaign while sending' });
    }

    await NotificationCampaign.deleteOne({ _id: campaignId });
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('❌ Delete notification campaign error:', error);
    res.status(500).json({ success: false, message: 'Error deleting notification campaign' });
  }
};

// Send notification campaign
const sendNotificationCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await NotificationCampaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Campaign can only be sent from draft or scheduled status'
      });
    }

    // Update campaign status
    campaign.status = 'sending';
    await campaign.save();

    // Build recipient list
    let targetUsers = [];

    // If explicit user IDs provided, use them with provided capitalized type
    if (campaign.targetUserIds && campaign.targetUserIds.length > 0 && campaign.targetUserType) {
      targetUsers = campaign.targetUserIds.map(userId => ({ id: userId, type: campaign.targetUserType }));
    } else {
      // Otherwise use targetUserTypes array (lowercase enums) or 'all'
      let roles = Array.isArray(campaign.targetUserTypes) && campaign.targetUserTypes.length
        ? campaign.targetUserTypes
        : ['all'];

      if (roles.includes('all')) {
        roles = ['buyer', 'agent', 'vendor']; // staff/admin excluded from mass sends by default
      }

      const roleToModel = {
        buyer: { modelKey: 'Buyer', type: 'Buyer' },
        agent: { modelKey: 'Agent', type: 'Agent' },
        vendor: { modelKey: 'Vendor', type: 'Vendor' },
        staff: { modelKey: 'Staff', type: 'Staff' },
        admin: { modelKey: 'Admin', type: 'Admin' },
      };

      // Use static requires that match real filenames
      const userModels = {
        Buyer: require('../models/Buyer'),
        Agent: require('../models/Agent'),
        Vendor: require('../models/vendorModel'),
        Staff: require('../models/Staff'),
        Admin: require('../models/Admin'),
      };

      for (const role of roles) {
        const map = roleToModel[role];
        if (!map) continue;
        const UserModel = userModels[map.modelKey];
        if (!UserModel || !UserModel.find) continue;
        const hasIsActive = !!(UserModel.schema && UserModel.schema.path && UserModel.schema.path('isActive'));
        const query = hasIsActive ? { isActive: true } : {};
        const users = await UserModel.find(query).select('_id');
        targetUsers.push(...users.map(u => ({ id: u._id, type: map.type })));
      }
    }

    campaign.totalRecipients = targetUsers.length;
    await campaign.save();

    if (targetUsers.length === 0) {
      campaign.status = 'failed';
      await campaign.save();
      return res.status(400).json({
        success: false,
        message: 'No recipients matched the campaign filters',
        data: { totalRecipients: 0 }
      });
    }

    // Send notifications
    const io = req.app.get('io');
    let successCount = 0;
    let errorCount = 0;

    for (const user of targetUsers) {
      try {
        await sendNotification(io, {
          recipientId: user.id,
          recipientType: user.type,
          notificationType: 'ADMIN_ANNOUNCEMENT',
          args: [campaign.title, campaign.message],
          meta: {
            campaignId: campaign._id,
            type: campaign.type,
            link: campaign.link,
            image: campaign.image
          }
        });
        successCount++;
      } catch (error) {
        console.error(`Error sending notification to user ${user.id}:`, error);
        errorCount++;
      }
    }

    // Update campaign status
    campaign.sentCount = successCount;
    campaign.status = errorCount > 0 ? 'failed' : 'sent';
    await campaign.save();

    res.json({
      success: true,
      message: `Campaign sent successfully. ${successCount} sent, ${errorCount} failed`,
      data: {
        totalRecipients: campaign.totalRecipients,
        sentCount: successCount,
        errorCount: errorCount
      }
    });
  } catch (error) {
    console.error('❌ Send notification campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notification campaign'
    });
  }
};

// Get campaign analytics
const getCampaignAnalytics = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await NotificationCampaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const analytics = {
      totalRecipients: campaign.totalRecipients,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      clickCount: campaign.clickCount,
      deliveryRate: campaign.deliveryRate,
      readRate: campaign.readRate,
      clickRate: campaign.clickRate,
      status: campaign.status,
      createdAt: campaign.createdAt,
      scheduledFor: campaign.scheduledFor,
      expiresAt: campaign.expiresAt
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('❌ Get campaign analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching campaign analytics'
    });
  }
};

// ===============================
// Public API for Frontend
// ===============================

// Get ads for display (public endpoint)
const getAdsForDisplay = async (req, res) => {
  try {
    const { userType = 'buyer', page = 'home' } = req.query;
    
    const now = new Date();
    const ads = await Ad.find({
      isActive: true,
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
      $and: [
        {
          $or: [
            { targetUserTypes: 'all' },
            { targetUserTypes: { $in: [userType] } }
          ]
        },
        {
          $or: [
            { targetPages: 'all' },
            { targetPages: { $in: [page] } }
          ]
        }
      ]
    })
    .sort({ priority: -1, createdAt: -1 })
    .limit(20);

    // Record impressions
    for (const ad of ads) {
      await ad.recordView();
    }

    res.json({
      success: true,
      data: ads
    });
  } catch (error) {
    console.error('❌ Get ads for display error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ads'
    });
  }
};

// Record ad click
const recordAdClick = async (req, res) => {
  try {
    const { adId } = req.params;
    const ad = await Ad.findById(adId);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    await ad.recordClick();

    res.json({
      success: true,
      message: 'Click recorded'
    });
  } catch (error) {
    console.error('❌ Record ad click error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording click'
    });
  }
};

module.exports = {
  // Ad Management
  getAds,
  getAd,
  createAd,
  updateAd,
  deleteAd,
  toggleAdStatus,
  getAdAnalytics,
  
  // Notification Campaigns
  getNotificationCampaigns,
  getNotificationCampaign,
  createNotificationCampaign,
  updateNotificationCampaign,
  deleteNotificationCampaign,
  sendNotificationCampaign,
  getCampaignAnalytics,
  
  // Public API
  getAdsForDisplay,
  recordAdClick
};
