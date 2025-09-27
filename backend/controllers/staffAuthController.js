const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

// Staff Login
const staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find staff member by email
    const staff = await Admin.findOne({ 
      email: email.toLowerCase(),
      role: { $in: ['dispute_manager', 'dispute_specialist', 'dispute_analyst', 'moderator'] }
    });

    if (!staff) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if staff is active
    if (!staff.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, staff.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: staff._id,
        email: staff.email,
        role: staff.role,
        permissions: staff.permissions
      },
      process.env.JWT_SECRET || 'vendplugSecret',
      { expiresIn: '24h' }
    );

    // Update last login
    staff.lastLogin = new Date();
    await staff.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        staff: {
          id: staff._id,
          fullName: staff.fullName,
          email: staff.email,
          role: staff.role,
          permissions: staff.permissions,
          lastLogin: staff.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('❌ Staff login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get Staff Profile
const getStaffProfile = async (req, res) => {
  try {
    const staff = await Admin.findById(req.staff.staffId)
      .select('-password')
      .populate('activityStats.currentDisputes', 'disputeId status priority category createdAt');

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        staff: {
          id: staff._id,
          fullName: staff.fullName,
          email: staff.email,
          role: staff.role,
          permissions: staff.permissions,
          isActive: staff.isActive,
          lastLogin: staff.lastLogin,
          activityStats: staff.activityStats,
          createdAt: staff.createdAt
        }
      }
    });

  } catch (error) {
    console.error('❌ Get staff profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update Staff Profile
const updateStaffProfile = async (req, res) => {
  try {
    const { fullName, email, currentPassword, newPassword } = req.body;
    const staffId = req.staff.staffId;

    const staff = await Admin.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Update basic info
    if (fullName) staff.fullName = fullName;
    if (email) staff.email = email.toLowerCase();

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to change password'
        });
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, staff.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      staff.password = await bcrypt.hash(newPassword, 12);
    }

    await staff.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        staff: {
          id: staff._id,
          fullName: staff.fullName,
          email: staff.email,
          role: staff.role,
          lastLogin: staff.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('❌ Update staff profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  staffLogin,
  getStaffProfile,
  updateStaffProfile
};
