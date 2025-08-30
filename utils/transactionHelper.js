const Vendor = require('../models/vendorModel');
const Agent = require('../models/Agent');

/**
 * Increment transaction count for a vendor
 * @param {string} vendorId - Vendor's ObjectId
 * @param {Object} session - MongoDB session (optional)
 * @returns {Promise<void>}
 */
const incrementVendorTransactions = async (vendorId, session = null) => {
  try {
    const updateOperation = { $inc: { totalTransactions: 1 } };
    
    if (session) {
      await Vendor.findByIdAndUpdate(vendorId, updateOperation, { session });
    } else {
      await Vendor.findByIdAndUpdate(vendorId, updateOperation);
    }
    
    console.log(`✅ Incremented transaction count for vendor: ${vendorId}`);
  } catch (error) {
    console.error(`❌ Error incrementing vendor transaction count:`, error);
    throw error;
  }
};

/**
 * Increment transaction count for an agent
 * @param {string} agentId - Agent's ObjectId
 * @param {Object} session - MongoDB session (optional)
 * @returns {Promise<void>}
 */
const incrementAgentTransactions = async (agentId, session = null) => {
  try {
    const updateOperation = { $inc: { totalTransactions: 1 } };
    
    if (session) {
      await Agent.findByIdAndUpdate(agentId, updateOperation, { session });
    } else {
      await Agent.findByIdAndUpdate(agentId, updateOperation);
    }
    
    console.log(`✅ Incremented transaction count for agent: ${agentId}`);
  } catch (error) {
    console.error(`❌ Error incrementing agent transaction count:`, error);
    throw error;
  }
};

/**
 * Get transaction count for a user (vendor or agent)
 * @param {string} userId - User's ObjectId
 * @param {string} userType - 'vendor' or 'agent'
 * @returns {Promise<number>}
 */
const getUserTransactionCount = async (userId, userType) => {
  try {
    let user;
    
    if (userType === 'vendor') {
      user = await Vendor.findById(userId).select('totalTransactions');
    } else if (userType === 'agent') {
      user = await Agent.findById(userId).select('totalTransactions');
    } else {
      throw new Error('Invalid user type');
    }
    
    return user ? user.totalTransactions || 0 : 0;
  } catch (error) {
    console.error(`❌ Error getting transaction count:`, error);
    return 0;
  }
};

/**
 * Reset transaction count for a user (useful for testing or corrections)
 * @param {string} userId - User's ObjectId
 * @param {string} userType - 'vendor' or 'agent'
 * @param {number} newCount - New transaction count
 * @returns {Promise<void>}
 */
const resetUserTransactionCount = async (userId, userType, newCount = 0) => {
  try {
    if (userType === 'vendor') {
      await Vendor.findByIdAndUpdate(userId, { totalTransactions: newCount });
    } else if (userType === 'agent') {
      await Agent.findByIdAndUpdate(userId, { totalTransactions: newCount });
    } else {
      throw new Error('Invalid user type');
    }
    
    console.log(`✅ Reset transaction count for ${userType} ${userId} to ${newCount}`);
  } catch (error) {
    console.error(`❌ Error resetting transaction count:`, error);
    throw error;
  }
};

module.exports = {
  incrementVendorTransactions,
  incrementAgentTransactions,
  getUserTransactionCount,
  resetUserTransactionCount
};
