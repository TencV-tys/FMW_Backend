// controllers/adminNotificationController.js - UPDATED
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
              .orWhere('notifications.user_id', req.user.id); // Current admin's notifications
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

  // Get notifications by type - FILTERED for admin
  getNotificationsByType: async (req, res) => {
    try {
      const { type } = req.params;
      const notifications = await db('notifications')
        .join('users', 'notifications.user_id', 'users.id')
        .where('notifications.type', type)
        .andWhere(function() {
          this.where('notifications.type', 'general')
              .orWhere('users.role', 'admin')
              .orWhere('notifications.user_id', req.user.id);
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
              .orWhere('notifications.user_id', req.user.id);
        })
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread'),
          db.raw('SUM(CASE WHEN type = "post_resolved" THEN 1 ELSE 0 END) as resolved'),
          db.raw('SUM(CASE WHEN type = "post_removed" THEN 1 ELSE 0 END) as removed'),
          db.raw('SUM(CASE WHEN type = "post_deleted" THEN 1 ELSE 0 END) as deleted'),
          db.raw('SUM(CASE WHEN type = "report_submitted" THEN 1 ELSE 0 END) as reports'),
          db.raw('SUM(CASE WHEN type = "general" THEN 1 ELSE 0 END) as admin_actions')
        )
        .first();

      res.json({
        success: true,
        stats: {
          total: parseInt(stats.total) || 0,
          unread: parseInt(stats.unread) || 0,
          resolved: parseInt(stats.resolved) || 0,
          removed: parseInt(stats.removed) || 0,
          deleted: parseInt(stats.deleted) || 0,
          reports: parseInt(stats.reports) || 0,
          admin_actions: parseInt(stats.admin_actions) || 0
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
              .orWhere('user_id', req.user.id);
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
              .orWhere('user_id', req.user.id);
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
              .orWhere('user_id', req.user.id);
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
              .orWhere('user_id', req.user.id);
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