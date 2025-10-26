const db = require('../config/db');
const Notification = require('../models/Notification');

const adminNotificationController = {
  // Get only admin-related notifications
  getAllNotifications: async (req, res) => {
    try {
      const notifications = await db('notifications')
        .join('users', 'notifications.user_id', 'users.id')
        .where(function() {
          this.where('notifications.type', 'general') // Admin action notifications
              .orWhere('users.role', 'admin') // Notifications sent to admins
              .orWhere('notifications.user_id', req.user.id) // Current admin's notifications
              // 🆕 ADD FEEDBACK NOTIFICATIONS
              .orWhere('notifications.type', 'like', 'feedback_%'); // All feedback notifications
        })
        .select(
          'notifications.*',
          'users.first_name',
          'users.last_name',
          'users.role'
        )
        .orderBy('notifications.created_at', 'desc')
        .limit(50);
      
      res.json({
        success: true,
        notifications
      });
    } catch (error) {
      console.error('Get admin notifications error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching notifications'
      });
    }
  },

  // 🎯 NEW: Get unread notifications only
  getUnreadNotifications: async (req, res) => {
    try {
      const notifications = await db('notifications')
        .join('users', 'notifications.user_id', 'users.id')
        .where('notifications.is_read', false) // Only unread notifications
        .andWhere(function() {
          this.where('notifications.type', 'general')
              .orWhere('users.role', 'admin')
              .orWhere('notifications.user_id', req.user.id)
              // 🆕 ADD FEEDBACK NOTIFICATIONS
              .orWhere('notifications.type', 'like', 'feedback_%');
        })
        .select(
          'notifications.*',
          'users.first_name',
          'users.last_name',
          'users.role'
        )
        .orderBy('notifications.created_at', 'desc')
        .limit(50);

      res.json({
        success: true,
        notifications
      });
    } catch (error) {
      console.error('Get unread notifications error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching unread notifications'
      });
    }
  },

  // Get notifications by type - ONLY ADMIN-RELATED NOTIFICATIONS
  getNotificationsByType: async (req, res) => {
    try {
      const { type } = req.params;
      
      // 🎯 If type is 'unread', use the unread endpoint instead
      if (type === 'unread') {
        return adminNotificationController.getUnreadNotifications(req, res);
      }
      
      const notifications = await db('notifications')
        .join('users', 'notifications.user_id', 'users.id')
        .where(function() {
          // Show notifications of this type that are admin-related
          this.where('notifications.type', type)
              .andWhere(function() {
                this.where('users.role', 'admin')
                    .orWhere('notifications.user_id', req.user.id)
                    // 🆕 ADD FEEDBACK NOTIFICATIONS
                    .orWhere('notifications.type', 'like', 'feedback_%');
              });
        })
        .orWhere(function() {
          // Also show admin's own general notifications that match this action
          this.where('notifications.type', 'general')
              .andWhere('notifications.user_id', req.user.id)
              .andWhere(function() {
                // Match based on the exact action in the message
                if (type === 'post_removed') {
                  this.where('notifications.message', 'like', '%removed post%')
                      .orWhere('notifications.message', 'like', '%remove post%')
                      .orWhere('notifications.title', '=', 'Post Removed');
                } else if (type === 'post_deleted') {
                  this.where('notifications.message', 'like', '%deleted post%')
                      .orWhere('notifications.message', 'like', '%delete post%')
                      .orWhere('notifications.message', 'like', '%permanently deleted%')
                      .orWhere('notifications.title', '=', 'Post Deleted');
                } else if (type === 'post_resolved') {
                  this.where('notifications.message', 'like', '%resolved post%')
                      .orWhere('notifications.message', 'like', '%resolve post%')
                      .orWhere('notifications.message', 'like', '%marked as resolved%')
                      .orWhere('notifications.title', '=', 'Post Resolved');
                } else if (type === 'post_restored') {
                  this.where('notifications.message', 'like', '%restored post%')
                      .orWhere('notifications.message', 'like', '%restore post%')
                      .orWhere('notifications.title', '=', 'Post Restored');
                } else if (type === 'report_submitted') {
                  this.where('notifications.message', 'like', '%report%')
                      .orWhere('notifications.title', 'like', '%Report%');
                } else if (type === 'user_suspended') {
                  this.where('notifications.message', 'like', '%suspended user%')
                      .orWhere('notifications.title', '=', 'User Suspended');
                } else if (type === 'user_banned') {
                  this.where('notifications.message', 'like', '%banned user%')
                      .orWhere('notifications.title', '=', 'User Banned');
                } else if (type === 'user_activated') {
                  this.where('notifications.message', 'like', '%activated user%')
                      .orWhere('notifications.title', '=', 'User Activated');
                } else if (type === 'user_deleted') {
                  this.where('notifications.message', 'like', '%deleted user%')
                      .orWhere('notifications.title', '=', 'User Deleted');
                }
                // 🆕 ADD FEEDBACK NOTIFICATION FILTERING
                else if (type === 'feedback_submitted') {
                  this.where('notifications.message', 'like', '%feedback submitted%')
                      .orWhere('notifications.message', 'like', '%new feedback%')
                      .orWhere('notifications.title', 'like', '%Feedback Submitted%');
                } else if (type === 'feedback_updated') {
                  this.where('notifications.message', 'like', '%feedback updated%')
                      .orWhere('notifications.message', 'like', '%feedback status%')
                      .orWhere('notifications.title', 'like', '%Feedback Updated%');
                } else if (type === 'feedback_deleted') {
                  this.where('notifications.message', 'like', '%feedback deleted%')
                      .orWhere('notifications.message', 'like', '%deleted feedback%')
                      .orWhere('notifications.title', 'like', '%Feedback Deleted%');
                }
                // 🆕 ADD GENERAL NOTIFICATION FILTERING
                else if (type === 'general') {
                  this.where('notifications.message', 'like', '%') // Match all general notifications
                      .orWhere('notifications.title', 'like', '%');
                }
              });
        })
        .select(
          'notifications.*',
          'users.first_name',
          'users.last_name',
          'users.role'
        )
        .orderBy('notifications.created_at', 'desc')
        .limit(50);

      res.json({
        success: true,
        notifications
      });
    } catch (error) {
      console.error('Get notifications by type error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching notifications'
      });
    }
  },

  // Get notification statistics for admin - FILTERED
  getNotificationStats: async (req, res) => {
    try {
      const stats = await db('notifications')
        .join('users', 'notifications.user_id', 'users.id')
        .where(function() {
          this.where('notifications.type', 'general')
              .orWhere('users.role', 'admin')
              .orWhere('notifications.user_id', req.user.id)
              // 🆕 ADD FEEDBACK NOTIFICATIONS
              .orWhere('notifications.type', 'like', 'feedback_%');
        })
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread'),
          db.raw('SUM(CASE WHEN type = "post_resolved" THEN 1 ELSE 0 END) as resolved'),
          db.raw('SUM(CASE WHEN type = "post_removed" THEN 1 ELSE 0 END) as removed'),
          db.raw('SUM(CASE WHEN type = "post_deleted" THEN 1 ELSE 0 END) as deleted'),
          db.raw('SUM(CASE WHEN type = "report_submitted" THEN 1 ELSE 0 END) as reports'),
          db.raw('SUM(CASE WHEN type = "general" THEN 1 ELSE 0 END) as admin_actions'),
          // 🎯 ADD USER ACTION STATS
          db.raw('SUM(CASE WHEN type = "user_suspended" THEN 1 ELSE 0 END) as user_suspended'),
          db.raw('SUM(CASE WHEN type = "user_banned" THEN 1 ELSE 0 END) as user_banned'),
          db.raw('SUM(CASE WHEN type = "user_activated" THEN 1 ELSE 0 END) as user_activated'),
          db.raw('SUM(CASE WHEN type = "user_deleted" THEN 1 ELSE 0 END) as user_deleted'),
          // 🆕 ADD FEEDBACK STATS (REMOVED feedback_assigned)
          db.raw('SUM(CASE WHEN type = "feedback_submitted" THEN 1 ELSE 0 END) as feedback_submitted'),
          db.raw('SUM(CASE WHEN type = "feedback_updated" THEN 1 ELSE 0 END) as feedback_updated'),
          db.raw('SUM(CASE WHEN type = "feedback_deleted" THEN 1 ELSE 0 END) as feedback_deleted')
        )
        .first();

      res.json({
        success: true,
        stats: {
          total: parseInt(stats.total) || 0,
          unread: parseInt(stats.unread) || 0,
          reports: parseInt(stats.reports) || 0,
          user_suspended: parseInt(stats.user_suspended) || 0,
          user_banned: parseInt(stats.user_banned) || 0,
          user_activated: parseInt(stats.user_activated) || 0,
          user_deleted: parseInt(stats.user_deleted) || 0,
          // 🆕 ADD FEEDBACK COUNTS (REMOVED feedback_assigned)
          feedback_submitted: parseInt(stats.feedback_submitted) || 0,
          feedback_updated: parseInt(stats.feedback_updated) || 0,
          feedback_deleted: parseInt(stats.feedback_deleted) || 0
        }
      });
    } catch (error) {
      console.error('Get notification stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching notification statistics'
      });
    }
  },

  // Delete notification (admin only deletes admin notifications)
  deleteNotification: async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await db('notifications')
        .where('id', id)
        .andWhere(function() {
          this.where('type', 'general')
              .orWhere('user_id', req.user.id)
              // 🆕 ALLOW DELETING FEEDBACK NOTIFICATIONS
              .orWhere('type', 'like', 'feedback_%');
        })
        .delete();

      if (deleted) {
        res.json({
          success: true,
          message: 'Notification deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Notification not found or not authorized'
        });
      }
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error deleting notification'
      });
    }
  },

  // Clear only admin's notifications
  clearAllNotifications: async (req, res) => {
    try {
      await db('notifications')
        .where(function() {
          this.where('type', 'general')
              .orWhere('user_id', req.user.id)
              // 🆕 ALLOW CLEARING FEEDBACK NOTIFICATIONS
              .orWhere('type', 'like', 'feedback_%');
        })
        .delete();
      
      res.json({
        success: true,
        message: 'Admin notifications cleared successfully'
      });
    } catch (error) {
      console.error('Clear all notifications error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error clearing notifications'
      });
    }
  },

  // Mark notification as read (admin version)
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;
      
      const updated = await db('notifications')
        .where('id', id)
        .andWhere(function() {
          this.where('type', 'general')
              .orWhere('user_id', req.user.id)
              // 🆕 ALLOW MARKING FEEDBACK NOTIFICATIONS AS READ
              .orWhere('type', 'like', 'feedback_%');
        })
        .update({
          is_read: true,
          updated_at: new Date()
        });

      if (updated) {
        res.json({
          success: true,
          message: 'Notification marked as read'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Notification not found or not authorized'
        });
      }
    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error marking notification as read'
      });
    }
  },

  // Mark all notifications as read (admin version)
  markAllAsRead: async (req, res) => {
    try {
      await db('notifications')
        .where(function() {
          this.where('type', 'general')
              .orWhere('user_id', req.user.id)
              // 🆕 ALLOW MARKING ALL FEEDBACK NOTIFICATIONS AS READ
              .orWhere('type', 'like', 'feedback_%');
        })
        .update({
          is_read: true,
          updated_at: new Date()
        });
      
      res.json({
        success: true,
        message: 'All admin notifications marked as read'
      });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error marking notifications as read'
      });
    }
  }
};

module.exports = adminNotificationController;