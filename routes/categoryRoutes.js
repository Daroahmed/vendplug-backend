const express = require('express');
const router = express.Router();
const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');
const asyncHandler = require('express-async-handler');
const { browsingLimiter } = require('../middleware/rateLimiter');

/**
 * GET /api/categories/active-counts
 * Returns count of vendors and agents per category
 * Efficiently uses MongoDB aggregation to get all counts in a single query
 * 
 * Query params:
 * - state (optional): Filter by state
 * - mode (optional): 'vendor' or 'agent' - filter by type
 */
router.get('/active-counts', browsingLimiter, asyncHandler(async (req, res) => {
  const { state, mode } = req.query;
  
  // Build base query filter (state is optional)
  const baseQuery = state && state.trim() !== '' ? { state: state.trim() } : {};
  
  try {
    // Use aggregation to efficiently count vendors and agents per category
    const [vendorCounts, agentCounts] = await Promise.all([
      // Get vendor counts per category
      mode !== 'agent' ? Vendor.aggregate([
        { $match: baseQuery },
        { $unwind: '$category' }, // Unwind category array (vendors can have multiple categories)
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $project: { category: '$_id', count: 1, _id: 0 } }
      ]) : [],
      
      // Get agent counts per category
      mode !== 'vendor' ? Agent.aggregate([
        { $match: baseQuery },
        { $unwind: '$category' }, // Unwind category array (agents can have multiple categories)
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $project: { category: '$_id', count: 1, _id: 0 } }
      ]) : []
    ]);
    
    // Combine vendor and agent counts into a single map
    const categoryMap = {};
    
    // Add vendor counts
    vendorCounts.forEach(({ category, count }) => {
      if (!categoryMap[category]) {
        categoryMap[category] = { vendorCount: 0, agentCount: 0 };
      }
      categoryMap[category].vendorCount = count;
    });
    
    // Add agent counts
    agentCounts.forEach(({ category, count }) => {
      if (!categoryMap[category]) {
        categoryMap[category] = { vendorCount: 0, agentCount: 0 };
      }
      categoryMap[category].agentCount = count;
    });
    
    // Convert to array format for easier frontend consumption
    const categories = Object.entries(categoryMap)
      .map(([category, counts]) => ({
        category,
        vendorCount: counts.vendorCount,
        agentCount: counts.agentCount,
        totalCount: counts.vendorCount + counts.agentCount
      }))
      .filter(item => item.totalCount > 0) // Only return categories with at least one vendor/agent
      .sort((a, b) => b.totalCount - a.totalCount); // Sort by total count (descending)
    
    res.json({
      success: true,
      data: categories,
      counts: categoryMap // Also return map format for quick lookups
    });
    
  } catch (error) {
    console.error('❌ Error fetching category counts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category counts',
      error: error.message
    });
  }
}));

module.exports = router;

