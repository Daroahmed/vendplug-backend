const express = require('express');
const { protectAdmin } = require('../middleware/adminAuth');
const {
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
} = require('../controllers/adminAdController');

// Image upload controller
const { upload, uploadImage, deleteImage, getOptimizedImage } = require('../controllers/imageController');

const router = express.Router();

// ===============================
// Ad Management Routes (Admin Only)
// ===============================

// Get all ads
router.get('/ads', protectAdmin, getAds);

// Get single ad
router.get('/ads/:adId', protectAdmin, getAd);

// Create new ad
router.post('/ads', protectAdmin, createAd);

// Update ad
router.put('/ads/:adId', protectAdmin, updateAd);

// Delete ad
router.delete('/ads/:adId', protectAdmin, deleteAd);

// Toggle ad status
router.patch('/ads/:adId/toggle', protectAdmin, toggleAdStatus);

// Get ad analytics
router.get('/ads/:adId/analytics', protectAdmin, getAdAnalytics);

// ===============================
// Notification Campaign Routes (Admin Only)
// ===============================

// Get all notification campaigns
router.get('/campaigns', protectAdmin, getNotificationCampaigns);

// Get single campaign
router.get('/campaigns/:campaignId', protectAdmin, getNotificationCampaign);

// Create notification campaign
router.post('/campaigns', protectAdmin, createNotificationCampaign);

// Update notification campaign
router.put('/campaigns/:campaignId', protectAdmin, updateNotificationCampaign);

// Delete notification campaign
router.delete('/campaigns/:campaignId', protectAdmin, deleteNotificationCampaign);

// Send notification campaign
router.post('/campaigns/:campaignId/send', protectAdmin, sendNotificationCampaign);

// Get campaign analytics
router.get('/campaigns/:campaignId/analytics', protectAdmin, getCampaignAnalytics);

// ===============================
// Image Upload Routes (Admin Only)
// ===============================

// Upload image to Cloudinary
router.post('/upload-image', protectAdmin, upload.single('image'), uploadImage);

// Delete image from Cloudinary
router.delete('/delete-image', protectAdmin, deleteImage);

// Get optimized image URL
router.get('/optimize-image', getOptimizedImage);

// ===============================
// Public API Routes (No Auth Required)
// ===============================

// Get ads for display
router.get('/public/ads', getAdsForDisplay);

// Record ad click
router.post('/public/ads/:adId/click', recordAdClick);

module.exports = router;
