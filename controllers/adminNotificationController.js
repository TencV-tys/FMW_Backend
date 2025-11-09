const db = require('../config/db');

const adminNotificationController = {
  // Get all admin-related notifications - FIXED
getAllNotifications: async (req, res) => {
    try {
      const notifications = await db('notifications')
        .leftJoin('users', 'notifications.user_id', 'users.id')
        .where(function() {
          // Show notifications for current admin OR from admin users
          this.where('notifications.user_id', req.user.id)
            .orWhere('users.role', 'admin'); 
        })
        .andWhere(function() {
          // Only show specific admin notification types (INCLUDES WARNING TYPES)
          this.where('notifications.type', 'in', [
            'post_resolved', 'post_removed', 'post_deleted', 'post_restored',
            'report_submitted',
            'user_suspended', 'user_banned', 'user_activated', 'user_deleted',
            'feedback_submitted', 'feedback_updated', 'feedback_deleted',
            'post_resolved_by_user',
            'deletion_request', 'deletion_request_submitted', 'deletion_request_approved', 
            'deletion_request_rejected', 'deletion_reset', 'additional_deletions_granted',
            // 🆕 ADD WARNING TYPES FOR ADMIN AUDIT
            'post_removed_warning', 'post_deleted_warning' 
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

  // Get unread notifications only - FIXED
  getUnreadNotifications: async (req, res) => {
    try {
      const notifications = await db('notifications')
        .leftJoin('users', 'notifications.user_id', 'users.id')
        .where('notifications.is_read', false)
        .andWhere(function() {
          this.where('notifications.user_id', req.user.id)
            .orWhere('users.role', 'admin');
        })
        .andWhere(function() {
          this.where('notifications.type', 'in', [
            'post_resolved', 'post_removed', 'post_deleted', 'post_restored',
            'report_submitted',
            'user_suspended', 'user_banned', 'user_activated', 'user_deleted',
            'feedback_submitted', 'feedback_updated', 'feedback_deleted',
            'post_resolved_by_user',
            'deletion_request', 'deletion_request_submitted', 'deletion_request_approved', 
            'deletion_request_rejected', 'deletion_reset', 'additional_deletions_granted'
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
      console.error('Get unread notifications error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching unread notifications'
      });
    }
  },

  // Get notifications by type - FIXED
  getNotificationsByType: async (req, res) => {
    try {
      const { type } = req.params;
      
      if (type === 'unread') {
        return adminNotificationController.getUnreadNotifications(req, res);
      }
      
      const notifications = await db('notifications')
        .leftJoin('users', 'notifications.user_id', 'users.id')
        .where('notifications.type', type)
        .andWhere(function() {
          this.where('notifications.user_id', req.user.id)
            .orWhere('users.role', 'admin');
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

  // Get notification statistics for admin - FIXED
  // Get notification statistics for admin - FIXED COMPLETE VERSION
getNotificationStats: async (req, res) => {
  try { 
    const stats = await db('notifications')
      .leftJoin('users', 'notifications.user_id', 'users.id')
      .where(function() {
        this.where('notifications.user_id', req.user.id)
          .orWhere('users.role', 'admin');
      })
      .andWhere('notifications.type', 'in', [
        'post_resolved', 'post_removed', 'post_deleted', 'post_restored',
        'report_submitted',
        'user_suspended', 'user_banned', 'user_activated', 'user_deleted',
        'feedback_submitted', 'feedback_updated', 'feedback_deleted',
        'post_resolved_by_user',
        'deletion_request', 'deletion_request_submitted', 'deletion_request_approved', 
        'deletion_request_rejected', 'deletion_reset', 'additional_deletions_granted',
        // 🆕 ADD WARNING TYPES FOR ADMIN AUDIT
        'post_removed_warning', 'post_deleted_warning'
      ])
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread'),
        db.raw('SUM(CASE WHEN type = "post_resolved" THEN 1 ELSE 0 END) as post_resolved'),
        db.raw('SUM(CASE WHEN type = "post_removed" THEN 1 ELSE 0 END) as post_removed'),
        db.raw('SUM(CASE WHEN type = "post_deleted" THEN 1 ELSE 0 END) as post_deleted'),
        db.raw('SUM(CASE WHEN type = "post_restored" THEN 1 ELSE 0 END) as post_restored'),
        db.raw('SUM(CASE WHEN type = "report_submitted" THEN 1 ELSE 0 END) as reports'),
        db.raw('SUM(CASE WHEN type = "user_suspended" THEN 1 ELSE 0 END) as user_suspended'),
        db.raw('SUM(CASE WHEN type = "user_banned" THEN 1 ELSE 0 END) as user_banned'),
        db.raw('SUM(CASE WHEN type = "user_activated" THEN 1 ELSE 0 END) as user_activated'),
        db.raw('SUM(CASE WHEN type = "user_deleted" THEN 1 ELSE 0 END) as user_deleted'),
        db.raw('SUM(CASE WHEN type = "feedback_submitted" THEN 1 ELSE 0 END) as feedback_submitted'),
        db.raw('SUM(CASE WHEN type = "feedback_updated" THEN 1 ELSE 0 END) as feedback_updated'),
        db.raw('SUM(CASE WHEN type = "feedback_deleted" THEN 1 ELSE 0 END) as feedback_deleted'),
        db.raw('SUM(CASE WHEN type = "post_resolved_by_user" THEN 1 ELSE 0 END) as post_resolved_by_user'),
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
        post_resolved_by_user: parseInt(stats.post_resolved_by_user) || 0,
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

  // Delete notification - KEEP SAME
  deleteNotification: async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await db('notifications')
        .where('id', id)
        .andWhere(function() {
          this.where('user_id', req.user.id)
            .orWhereExists(function() {
              this.select('*')
                .from('users')
                .whereRaw('users.id = notifications.user_id')
                .andWhere('users.role', 'admin');
            });
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

  // Clear only admin's notifications - KEEP SAME
  clearAllNotifications: async (req, res) => {
    try {
      await db('notifications')
        .where(function() {
          this.where('user_id', req.user.id)
            .orWhereExists(function() {
              this.select('*')
                .from('users')
                .whereRaw('users.id = notifications.user_id')
                .andWhere('users.role', 'admin');
            });
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

  // Mark notification as read - KEEP SAME
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;
      
      const updated = await db('notifications')
        .where('id', id)
        .andWhere(function() {
          this.where('user_id', req.user.id)
            .orWhereExists(function() {
              this.select('*')
                .from('users')
                .whereRaw('users.id = notifications.user_id')
                .andWhere('users.role', 'admin');
            });
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

  // Mark all notifications as read - KEEP SAME
  markAllAsRead: async (req, res) => {
    try {
      await db('notifications')
        .where(function() {
          this.where('user_id', req.user.id)
            .orWhereExists(function() {
              this.select('*')
                .from('users')
                .whereRaw('users.id = notifications.user_id')
                .andWhere('users.role', 'admin');
            });
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