const db = require('../config/db');
const { deleteUser, updateUser, findUserById } = require('../models/User');
const Notification = require('../models/Notification');
const emailService = require('../services/emailService');

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
    
    // Get user details before deletion for email notification
    const user = await db('users')
      .where('id', id)
      .select('id', 'first_name', 'last_name', 'email')
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const adminUser = req.user; // The admin performing the deletion

    await deleteUser(id);

    const currentTime = new Date();

    // 🎯 CREATE ADMIN NOTIFICATION FOR USER DELETION
    const adminNotificationData = {
      user_id: adminUser.id, // Notification for the admin who performed the deletion
      title: 'User Deleted',
      message: `You permanently deleted user "${user.first_name} ${user.last_name}" (${user.email})`,
      type: 'user_deleted',
      metadata: JSON.stringify({
        target_user_id: user.id,
        target_user_name: `${user.first_name} ${user.last_name}`,
        target_user_email: user.email,
        performed_by: adminUser.id,
        performed_by_name: `${adminUser.first_name} ${adminUser.last_name}`
      }),
      is_read: false,
      created_at: currentTime
    };

    await db('notifications').insert(adminNotificationData);

    // Send email notification to user about account deletion
    await emailService.sendUserStatusNotification(
      user.email,
      `${user.first_name} ${user.last_name}`,
      'deleted'
    );

    res.json({
      message: 'User deleted successfully!'
    });
  } catch (err) {
    res.status(500).json({
      message: 'Error deleting user'
    });
  }
}

// Get users statistics
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

// Enhanced: Update user status with notifications and email
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, duration } = req.body;

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    // Get user details for notification
    const user = await db('users')
      .where('id', id)
      .select('id', 'email', 'first_name', 'last_name', 'status')
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const updateData = {
      status,
      updated_at: new Date()
    };

    // Add suspension details if suspending
    if (status === 'suspended') {
      updateData.suspension_reason = reason || 'Violation of terms';
      if (duration) {
        updateData.suspended_until = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
      }
    } else if (status === 'active') {
      // Clear suspension data when reactivating
      updateData.suspension_reason = null;
      updateData.suspended_until = null;
    }

    const updated = await db('users')
      .where('id', id)
      .update(updateData);

    if (updated) {
      const currentTime = new Date();
      const adminUser = req.user; // The admin performing the action

      // 🎯 CREATE ADMIN NOTIFICATION FOR USER STATUS CHANGE
      let adminNotificationTitle, adminNotificationMessage, notificationType;

      switch (status) {
        case 'suspended':
          adminNotificationTitle = 'User Suspended';
          adminNotificationMessage = `You suspended user "${user.first_name} ${user.last_name}" (${user.email})${reason ? `. Reason: ${reason}` : ''}${duration ? ` for ${duration} day(s)` : ''}`;
          notificationType = 'user_suspended';
          break;
        case 'banned':
          adminNotificationTitle = 'User Banned';
          adminNotificationMessage = `You permanently banned user "${user.first_name} ${user.last_name}" (${user.email})${reason ? `. Reason: ${reason}` : ''}`;
          notificationType = 'user_banned';
          break;
        case 'active':
          adminNotificationTitle = 'User Activated';
          adminNotificationMessage = `You activated user "${user.first_name} ${user.last_name}" (${user.email})`;
          notificationType = 'user_activated';
          break;
      }

      if (adminNotificationTitle) {
        const adminNotificationData = {
          user_id: adminUser.id, // Notification for the admin who performed the action
          title: adminNotificationTitle,
          message: adminNotificationMessage,
          type: notificationType,
          metadata: JSON.stringify({
            target_user_id: user.id,
            target_user_name: `${user.first_name} ${user.last_name}`,
            target_user_email: user.email,
            previous_status: user.status,
            new_status: status,
            reason: reason,
            duration: duration,
            performed_by: adminUser.id,
            performed_by_name: `${adminUser.first_name} ${adminUser.last_name}`
          }),
          is_read: false,
          created_at: currentTime
        };

        await db('notifications').insert(adminNotificationData);
      }

      // Send email notification to user about status change
      await emailService.sendUserStatusNotification(
        user.email,
        `${user.first_name} ${user.last_name}`,
        status,
        reason,
        duration
      );

      // Send in-app notification to user
      let userNotificationTitle, userNotificationMessage;

      switch (status) {
        case 'suspended':
          userNotificationTitle = 'Account Suspended';
          userNotificationMessage = `Your account has been suspended. ${reason ? `Reason: ${reason}` : 'Please contact administrator for details.'}`;
          if (duration) {
            userNotificationMessage += ` Duration: ${duration} day(s).`;
          }
          break;
        case 'banned':
          userNotificationTitle = 'Account Banned';
          userNotificationMessage = `Your account has been permanently banned. ${reason ? `Reason: ${reason}` : 'Please contact administrator for details.'}`;
          break;
        case 'active':
          userNotificationTitle = 'Account Reactivated';
          userNotificationMessage = 'Your account has been reactivated and you can now access all features.';
          break;
      }

      if (userNotificationTitle) {
        const userNotificationData = {
          user_id: user.id,
          title: userNotificationTitle,
          message: userNotificationMessage,
          type: 'account_status_change',
          metadata: JSON.stringify({
            previous_status: user.status,
            new_status: status,
            reason: reason,
            duration: duration
          }),
          is_read: false,
          created_at: currentTime
        };

        await db('notifications').insert(userNotificationData);
      }

      res.json({
        success: true,
        message: `User ${status} successfully`,
        data: {
          id: user.id,
          email: user.email,
          newStatus: status,
          reason: reason
        }
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

// Get user post statistics
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

// Optional: Auto-restore suspended users after duration
const checkSuspendedUsers = async () => {
  try {
    const usersToRestore = await db('users')
      .where('status', 'suspended')
      .where('suspended_until', '<', new Date())
      .whereNotNull('suspended_until');

    for (const user of usersToRestore) {
      await db('users')
        .where('id', user.id)
        .update({
          status: 'active',
          suspended_until: null,
          suspension_reason: null,
          updated_at: new Date()
        });

      // Send email notification about auto-restoration
      await emailService.sendUserStatusNotification(
        user.email,
        `${user.first_name} ${user.last_name}`,
        'activated'
      );

      // Notify user about auto-restoration
      const notificationData = {
        user_id: user.id,
        title: 'Account Restored',
        message: 'Your account suspension has been automatically lifted.',
        type: 'account_status_change',
        is_read: false,
        created_at: new Date()
      };

      await db('notifications').insert(notificationData);

      console.log(`Auto-restored user: ${user.email}`);
    }
  } catch (error) {
    console.error('Error auto-restoring suspended users:', error);
  }
};

module.exports = {
  getAllUsers,
  deleted,
  getUsersStats,
  updateUserStatus,
  updateProfile,
  getProfile,
  getUserPostStats,
  checkSuspendedUsers
};