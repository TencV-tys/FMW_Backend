const db = require('../config/db');
const Notification = require('../models/Notification');

const adminNotificationController = {
  // Get only admin-related notifications
  getAllNotifications: async (req, res) => {
    try {
      const notifications = await db('notifications')
        .join('users', 'notifications.user_id', 'users.id')
        .where(function() {
          this.where('users.role', 'admin') // Only notifications where the user is an admin
            .orWhere('notifications.user_id', req.user.id) // Or notifications specifically for current admin
            .orWhere('notifications.type', 'general') // General admin notifications
            .orWhere('notifications.type', 'like', 'feedback_%') // Feedback notifications
            .orWhere('notifications.type', 'post_resolved_by_user') // User resolved posts
            .orWhere('notifications.type', 'like', 'deletion_%') // Deletion request notifications
            .orWhere('notifications.type', 'like', '%deletions_granted%')
            .orWhere('notifications.type', 'like', '%deletion_reset%');
        })
        .andWhere(function() {
          // EXCLUDE regular user notifications that aren't system-wide
          this.where('users.role', 'admin')
            .orWhere('notifications.type', 'in', [
              'general',
              'feedback_submitted',
              'feedback_updated', 
              'feedback_deleted',
              'post_resolved_by_user',
              'deletion_request',
              'deletion_request_submitted',
              'deletion_request_approved',
              'deletion_request_rejected',
              'deletion_reset',
              'additional_deletions_granted'
            ]);
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

  // 🎯 Get unread notifications only - UPDATED FILTER
  getUnreadNotifications: async (req, res) => {
    try {
      const notifications = await db('notifications')
        .join('users', 'notifications.user_id', 'users.id')
        .where('notifications.is_read', false)
        .andWhere(function() {
          this.where('users.role', 'admin')
            .orWhere('notifications.user_id', req.user.id)
            .orWhere('notifications.type', 'general')
            .orWhere('notifications.type', 'like', 'feedback_%')
            .orWhere('notifications.type', 'post_resolved_by_user')
            .orWhere('notifications.type', 'like', 'deletion_%')
            .orWhere('notifications.type', 'like', '%deletions_granted%')
            .orWhere('notifications.type', 'like', '%deletion_reset%');
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
      
      if (type === 'unread') {
        return adminNotificationController.getUnreadNotifications(req, res);
      }
      
      const notifications = await db('notifications')
        .join('users', 'notifications.user_id', 'users.id')
        .where('notifications.type', type)
        .andWhere(function() {
          this.where('users.role', 'admin')
            .orWhere('notifications.user_id', req.user.id)
            .orWhere('notifications.type', 'general')
            .orWhere('notifications.type', 'like', 'feedback_%')
            .orWhere('notifications.type', 'post_resolved_by_user')
            .orWhere('notifications.type', 'like', 'deletion_%')
            .orWhere('notifications.type', 'like', '%deletions_granted%')
            .orWhere('notifications.type', 'like', '%deletion_reset%');
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
          this.where('users.role', 'admin')
            .orWhere('notifications.user_id', req.user.id)
            .orWhere('notifications.type', 'general')
            .orWhere('notifications.type', 'like', 'feedback_%')
            .orWhere('notifications.type', 'post_resolved_by_user')
            .orWhere('notifications.type', 'like', 'deletion_%')
            .orWhere('notifications.type', 'like', '%deletions_granted%')
            .orWhere('notifications.type', 'like', '%deletion_reset%');
        })
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread'),
          db.raw('SUM(CASE WHEN type = "post_resolved" THEN 1 ELSE 0 END) as resolved'),
          db.raw('SUM(CASE WHEN type = "post_removed" THEN 1 ELSE 0 END) as removed'),
          db.raw('SUM(CASE WHEN type = "post_deleted" THEN 1 ELSE 0 END) as deleted'),
          db.raw('SUM(CASE WHEN type = "report_submitted" THEN 1 ELSE 0 END) as reports'),
          db.raw('SUM(CASE WHEN type = "general" THEN 1 ELSE 0 END) as admin_actions'),
          db.raw('SUM(CASE WHEN type = "user_suspended" THEN 1 ELSE 0 END) as user_suspended'),
          db.raw('SUM(CASE WHEN type = "user_banned" THEN 1 ELSE 0 END) as user_banned'),
          db.raw('SUM(CASE WHEN type = "user_activated" THEN 1 ELSE 0 END) as user_activated'),
          db.raw('SUM(CASE WHEN type = "user_deleted" THEN 1 ELSE 0 END) as user_deleted'),
          db.raw('SUM(CASE WHEN type = "feedback_submitted" THEN 1 ELSE 0 END) as feedback_submitted'),
          db.raw('SUM(CASE WHEN type = "feedback_updated" THEN 1 ELSE 0 END) as feedback_updated'),
          db.raw('SUM(CASE WHEN type = "feedback_deleted" THEN 1 ELSE 0 END) as feedback_deleted'),
          db.raw('SUM(CASE WHEN type = "post_resolved_by_user" THEN 1 ELSE 0 END) as user_resolved_posts'),
          db.raw('SUM(CASE WHEN type = "deletion_request" THEN 1 ELSE 0 END) as deletion_request'),
          db.raw('SUM(CASE WHEN type = "deletion_request_submitted" THEN 1 ELSE 0 END) as deletion_request_submitted'),
          db.raw('SUM(CASE WHEN type = "deletion_request_approved" THEN 1 ELSE 0 END) as deletion_request_approved'),
          db.raw('SUM(CASE WHEN type = "deletion_request_rejected" THEN 1 ELSE 0 END) as deletion_request_rejected'),
          db.raw('SUM(CASE WHEN type = "deletion_reset" THEN 1 ELSE 0 END) as deletion_reset'),
          db.raw('SUM(CASE WHEN type = "additional_deletions_granted" THEN 1 ELSE 0 END) as additional_deletions_granted')
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
          feedback_submitted: parseInt(stats.feedback_submitted) || 0,
          feedback_updated: parseInt(stats.feedback_updated) || 0,
          feedback_deleted: parseInt(stats.feedback_deleted) || 0,
          user_resolved_posts: parseInt(stats.user_resolved_posts) || 0,
          deletion_request: parseInt(stats.deletion_request) || 0,
          deletion_request_submitted: parseInt(stats.deletion_request_submitted) || 0,
          deletion_request_approved: parseInt(stats.deletion_request_approved) || 0,
          deletion_request_rejected: parseInt(stats.deletion_request_rejected) || 0,
          deletion_reset: parseInt(stats.deletion_reset) || 0,
          additional_deletions_granted: parseInt(stats.additional_deletions_granted) || 0
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
          this.where('users.role', 'admin')
            .orWhere('user_id', req.user.id)
            .orWhere('type', 'general')
            .orWhere('type', 'like', 'feedback_%')
            .orWhere('type', 'post_resolved_by_user')
            .orWhere('type', 'like', 'deletion_%')
            .orWhere('type', 'like', '%deletions_granted%')
            .orWhere('type', 'like', '%deletion_reset%');
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
          this.where('users.role', 'admin')
            .orWhere('user_id', req.user.id)
            .orWhere('type', 'general')
            .orWhere('type', 'like', 'feedback_%')
            .orWhere('type', 'post_resolved_by_user')
            .orWhere('type', 'like', 'deletion_%')
            .orWhere('type', 'like', '%deletions_granted%')
            .orWhere('type', 'like', '%deletion_reset%');
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
          this.where('users.role', 'admin')
            .orWhere('user_id', req.user.id)
            .orWhere('type', 'general')
            .orWhere('type', 'like', 'feedback_%')
            .orWhere('type', 'post_resolved_by_user')
            .orWhere('type', 'like', 'deletion_%')
            .orWhere('type', 'like', '%deletions_granted%')
            .orWhere('type', 'like', '%deletion_reset%');
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
          this.where('users.role', 'admin')
            .orWhere('user_id', req.user.id)
            .orWhere('type', 'general')
            .orWhere('type', 'like', 'feedback_%')
            .orWhere('type', 'post_resolved_by_user')
            .orWhere('type', 'like', 'deletion_%')
            .orWhere('type', 'like', '%deletions_granted%')
            .orWhere('type', 'like', '%deletion_reset%');
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