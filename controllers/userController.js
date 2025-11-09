const db = require('../config/db');
const { deleteUser, updateUser, findUserById } = require('../models/User');
const Notification = require('../models/Notification');
const emailService = require('../services/emailService');

const getAllUsers = async (req, res) => {
  try {
    const users = await db('users')
      .select(
        'id', 
        'first_name', 
        'last_name', 
        'email', 
        'gender', 
        'role', 
        'status', 
        'created_at', 
        'suspended_until',
        'suspension_reason',
        'suspension_days'
      )
      .orderBy('created_at', 'desc');
    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching users'
    });
  }
};

// 🆕 UPDATED: DELETE USER WITH ADMIN PROTECTION
const deleted = async (req, res) => {
  try {
    const id = req.params.id;
    
    // Get user details before deletion for email notification
    const user = await db('users')
      .where('id', id)
      .select('id', 'first_name', 'last_name', 'email', 'role')
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // 🆕 PREVENT DELETING ADMIN USERS
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete admin users'
      });
    }

    const adminUser = req.user;

    // 🎯 KEEP BANNED EMAILS - DON'T DELETE THEM! (Prevent new account creation)
    // We intentionally DON'T remove from banned_emails when user is deleted
    // This prevents banned users from creating new accounts with the same email

    await deleteUser(id);

    const currentTime = new Date();

    // 🎯 CREATE ADMIN NOTIFICATION FOR USER DELETION
    const adminNotificationData = {
      user_id: adminUser.id,
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
};

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

// 🆕 UPDATED: Update user status with ADMIN PROTECTION (removed user notifications)
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, duration, customDays } = req.body;

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    // Get user details for notification
    const user = await db('users')
      .where('id', id)
      .select('id', 'email', 'first_name', 'last_name', 'status', 'role')
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // 🆕 PREVENT ACTION ON ADMIN USERS
    if (user.role === 'admin' && (status === 'suspended' || status === 'banned')) {
      return res.status(400).json({
        success: false,
        error: 'Cannot suspend or ban admin users'
      });
    }

    const updateData = {
      status,
      updated_at: new Date()
    };

    let suspensionDays = 0;

    // Add suspension details if suspending
    if (status === 'suspended') {
      updateData.suspension_reason = reason || 'Violation of terms';
      
      suspensionDays = 7; // Default 7 days
      if (duration === '3') suspensionDays = 3;
      else if (duration === '7') suspensionDays = 7;
      else if (duration === '30') suspensionDays = 30;
      else if (duration === 'custom' && customDays) {
        suspensionDays = parseInt(customDays);
      }
      
      const suspendedUntil = new Date();
      suspendedUntil.setDate(suspendedUntil.getDate() + suspensionDays);
      updateData.suspended_until = suspendedUntil;
      updateData.suspension_days = suspensionDays;
      
    } else if (status === 'banned') {
      // For bans, store the ban reason
      updateData.suspension_reason = reason || 'Violation of terms';
      
      // 🎯 ADD EMAIL TO BANNED_EMAILS TABLE
      const existingBan = await db('banned_emails')
        .where('email', user.email)
        .first();

      if (!existingBan) {
        await db('banned_emails').insert({
          email: user.email,
          banned_by: req.user.id,
          reason: reason || 'Account ban'
        });
      }
      
    } else if (status === 'active') {
      // Clear suspension data when reactivating
      updateData.suspension_reason = null;
      updateData.suspended_until = null;
      updateData.suspension_days = null;
      
      // 🎯 REMOVE FROM BANNED_EMAILS TABLE ONLY WHEN ACTIVATING (not when deleting)
      await db('banned_emails').where('email', user.email).delete();
    }

    const updated = await db('users')
      .where('id', id)
      .update(updateData);

    if (updated) {
      const currentTime = new Date();
      const adminUser = req.user;

      // Calculate suspension days for notifications
      let suspensionDays = 7; // Default
      if (status === 'suspended') {
        if (duration === '3') suspensionDays = 3;
        else if (duration === '7') suspensionDays = 7;
        else if (duration === '30') suspensionDays = 30;
        else if (duration === 'custom' && customDays) {
          suspensionDays = parseInt(customDays);
        }
      }

      // 🎯 CREATE ADMIN NOTIFICATION FOR USER STATUS CHANGE
      let adminNotificationTitle, adminNotificationMessage, notificationType;

      switch (status) {
        case 'suspended':
          adminNotificationTitle = 'User Suspended';
          adminNotificationMessage = `You suspended user "${user.first_name} ${user.last_name}" (${user.email}) for ${suspensionDays} day(s)${reason ? `. Reason: ${reason}` : ''}`;
          notificationType = 'user_suspended';
          break;
        case 'banned':
          adminNotificationTitle = 'User Banned';
          adminNotificationMessage = `You banned user "${user.first_name} ${user.last_name}" (${user.email})${reason ? `. Reason: ${reason}` : ''}. Their email has been blocked from future registrations.`;
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
          user_id: adminUser.id,
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
            duration: suspensionDays,
            suspended_until: updateData.suspended_until,
            performed_by: adminUser.id,
            performed_by_name: `${adminUser.first_name} ${adminUser.last_name}`
          }),
          is_read: false,
          created_at: currentTime
        };

        await db('notifications').insert(adminNotificationData);
      }

      // 🎯 ONLY SEND EMAIL (NO USER NOTIFICATION) - User will see email only
      await emailService.sendUserStatusNotification(
        user.email,
        `${user.first_name} ${user.last_name}`,
        status,
        reason,
        suspensionDays
      );

      res.json({
        success: true,
        message: `User ${status} successfully`,
        data: {
          id: user.id,
          email: user.email,
          newStatus: status,
          reason: reason,
          duration: suspensionDays,
          suspended_until: updateData.suspended_until
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
          suspension_days: null,
          updated_at: new Date()
        });

      // Send email notification about auto-restoration
      await emailService.sendUserStatusNotification(
        user.email,
        `${user.first_name} ${user.last_name}`,
        'activated'
      );

      console.log(`Auto-restored user: ${user.email}`);
    }
  } catch (error) {
    console.error('Error auto-restoring suspended users:', error);
  }
};

// Get users with report statistics
const getUsersWithReportStats = async (req, res) => {
  try {
    const users = await db('users')
      .select(
        'users.id', 
        'users.first_name', 
        'users.last_name', 
        'users.email', 
        'users.gender', 
        'users.role', 
        'users.status', 
        'users.created_at', 
        'users.suspended_until',
        'users.suspension_reason',
        'users.suspension_days'
      )
      .orderBy('users.created_at', 'desc');

    // Get report statistics for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const currentDate = new Date();
        const currentMonth = currentDate.getFullYear() * 100 + (currentDate.getMonth() + 1);
        
        // Monthly report count for user's posts
        const monthlyReports = await db('reports')
          .join('posts', 'reports.post_id', 'posts.id')
          .where('posts.user_id', user.id)
          .where('reports.reported_month', currentMonth)
          .count('reports.id as count')
          .first();

        // All-time report count for user's posts
        const allTimeReports = await db('reports')
          .join('posts', 'reports.post_id', 'posts.id')
          .where('posts.user_id', user.id)
          .count('reports.id as count')
          .first();

        // Currently active posts with reports
        const activePostsWithReports = await db('posts')
          .leftJoin('reports', 'posts.id', 'reports.post_id')
          .where('posts.user_id', user.id)
          .where('posts.status', 'Active')
          .select('posts.id')
          .groupBy('posts.id')
          .havingRaw('COUNT(reports.id) > 0');

        return {
          ...user,
          monthly_report_count: parseInt(monthlyReports?.count) || 0,
          total_report_count: parseInt(allTimeReports?.count) || 0,
          active_posts_with_reports: activePostsWithReports.length || 0
        };
      })
    );
    
    res.json(usersWithStats);
  } catch (error) {
    console.error('Get users with report stats error:', error);
    res.status(500).json({
      message: 'Error fetching users with report statistics'
    });
  }
};

// 🆕 SEND AUTOMATIC WARNING TO USER (Email + Notification)
const sendUserWarning = async (req, res) => {
  try {
    const { userId, monthlyReports, totalReports } = req.body;

    const user = await db('users')
      .where('id', userId)
      .select('id', 'email', 'first_name', 'last_name')
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Send warning email
    await emailService.sendUserWarning(
      user.email,
      `${user.first_name} ${user.last_name}`,
      monthlyReports,
      totalReports
    );

    // 🆕 CREATE IN-APP NOTIFICATION FOR USER
    const notificationData = {
      user_id: user.id,
      title: '⚠️ Community Guidelines Warning',
      message: `Your account has received ${monthlyReports} reports this month. Please review our community guidelines.`,
      type: 'user_warning',
      metadata: JSON.stringify({
        monthly_reports: monthlyReports,
        total_reports: totalReports,
        warning_date: new Date().toISOString()
      }),
      is_read: false,
      created_at: new Date()
    };

    await db('notifications').insert(notificationData);

    res.json({
      success: true,
      message: 'Warning sent to user successfully'
    });
  } catch (error) {
    console.error('Send user warning error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error sending warning'
    });
  }
};
// 🆕 ADD: Restore deleted user
const restoreUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Get user details
    const user = await db('users')
      .where('id', id)
      .select('id', 'email', 'first_name', 'last_name', 'role', 'deleted_at')
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.deleted_at) {
      return res.status(400).json({
        success: false,
        error: 'User is not deleted'
      });
    }

    // Restore user
    await db('users')
      .where('id', id)
      .update({
        status: 'active',
        deleted_at: null,
        updated_at: new Date()
      });

    const adminUser = req.user;

    // Create admin notification
    const adminNotificationData = {
      user_id: adminUser.id,
      title: 'User Restored',
      message: `You restored user "${user.first_name} ${user.last_name}" (${user.email})`,
      type: 'user_restored',
      metadata: JSON.stringify({
        target_user_id: user.id,
        target_user_name: `${user.first_name} ${user.last_name}`,
        target_user_email: user.email,
        performed_by: adminUser.id,
        performed_by_name: `${adminUser.first_name} ${adminUser.last_name}`
      }),
      is_read: false,
      created_at: new Date()
    };

    await db('notifications').insert(adminNotificationData);

    // Send email notification
    await emailService.sendUserStatusNotification(
      user.email,
      `${user.first_name} ${user.last_name}`,
      'restored'
    );

    res.json({
      success: true,
      message: 'User restored successfully'
    });
  } catch (error) {
    console.error('Error restoring user:', error);
    res.status(500).json({
      success: false,
      error: 'Server error restoring user'
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
  getUserPostStats, 
  checkSuspendedUsers,
  getUsersWithReportStats,
  sendUserWarning,
  restoreUser,
  
};