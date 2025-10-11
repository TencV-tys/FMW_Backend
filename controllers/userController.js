const db = require('../config/db');
const { deleteUser, updateUser, findUserById } = require('../models/User');

const getAllUsers = async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'first_name', 'last_name', 'email', 'gender', 'role', 'status', 'created_at')
      .orderBy('created_at', 'desc');
    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching users'
    });
  }
};

const deleted = async (req, res) => {
  try {
    const id = req.params.id;
    await deleteUser(id);
    res.json({
      message: 'User deleted successfully!'
    });
  } catch (err) {
    res.status(500).json({
      message: 'Error deleting user'
    });
  }
}

//  Get users statistics
const getUsersStats = async (req, res) => {
  try {
    const stats = await db('users')
      .select(
        db.raw('COUNT(*) as totalUsers'),
        db.raw('SUM(CASE WHEN role = "admin" THEN 1 ELSE 0 END) as adminUsers'),
        db.raw('SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as activeUsers'),
        db.raw('SUM(CASE WHEN status = "suspended" THEN 1 ELSE 0 END) as suspendedUsers'),
        db.raw('SUM(CASE WHEN status = "banned" THEN 1 ELSE 0 END) as bannedUsers')
      )
      .first();

    res.json({
      success: true,
      stats: {
        totalUsers: parseInt(stats.totalUsers) || 0,
        adminUsers: parseInt(stats.adminUsers) || 0,
        activeUsers: parseInt(stats.activeUsers) || 0,
        suspendedUsers: parseInt(stats.suspendedUsers) || 0,
        bannedUsers: parseInt(stats.bannedUsers) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching users stats:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching users statistics'
    });
  }
};

//Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const updated = await db('users')
      .where('id', id)
      .update({
        status,
        updated_at: new Date()
      });

    if (updated) {
      res.json({
        success: true,
        message: `User ${status} successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating user status'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, email, gender } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!first_name || !last_name || !email) {
      return res.status(400).json({
        success: false,
        error: 'First name, last name, and email are required'
      });
    }

    // Check if email is already taken by another user
    const existingUser = await db('users')
      .where('email', email)
      .andWhere('id', '!=', userId)
      .first();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email is already taken by another user'
      });
    }

    const updateData = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.trim(),
      gender: gender || null,
      updated_at: new Date()
    };

    // Add profile photo if uploaded
    if (req.file) {
      updateData.profile_photo = req.file.filename;
    }

    const updated = await updateUser(userId, updateData);

    if (updated) {
      // Get updated user data
      const updatedUser = await findUserById(userId);
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating profile'
    });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await findUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching profile'
    });
  }
};


// 🎯 Get user post statistics
const getUserPostStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await db('posts')
      .select(
        db.raw('COUNT(*) as totalPosts'),
        db.raw('SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as activePosts'),
        db.raw('SUM(CASE WHEN status = "resolved" THEN 1 ELSE 0 END) as resolvedPosts')
      )
      .where('user_id', userId)
      .first();

    res.json({
      success: true,
      stats: {
        totalPosts: parseInt(stats.totalPosts) || 0,
        activePosts: parseInt(stats.activePosts) || 0,
        resolvedPosts: parseInt(stats.resolvedPosts) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching user post stats:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching user post statistics'
    });
  }
};


module.exports = {
  getAllUsers,
  deleted,
  getUsersStats,
  updateUserStatus,
  updateProfile,
  getProfile,
  getUserPostStats
};