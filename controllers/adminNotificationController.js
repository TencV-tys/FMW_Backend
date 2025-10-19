// controllers/adminNotificationController.js
const db = require('../config/db');
const Notification = require('../models/Notification');

const adminNotificationController = {
  // Get all notifications for admin view
  getAllNotifications: async (req, res) => {
    try {
      const notifications = await Notification.getAdminNotifications();
      
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

  // Get notifications by type
  getNotificationsByType: async (req, res) => {
    try {
      const { type } = req.params;
      const notifications = await Notification.getByType(type);
      
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

  // Get notification statistics for admin
  getNotificationStats: async (req, res) => {
    try {
      const stats = await db('notifications')
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread'),
          db.raw('SUM(CASE WHEN type = "post_resolved" THEN 1 ELSE 0 END) as resolved'),
          db.raw('SUM(CASE WHEN type = "post_removed" THEN 1 ELSE 0 END) as removed'),
          db.raw('SUM(CASE WHEN type = "post_deleted" THEN 1 ELSE 0 END) as deleted'),
          db.raw('SUM(CASE WHEN type = "report_submitted" THEN 1 ELSE 0 END) as reports')
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
          reports: parseInt(stats.reports) || 0
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
        .andWhere('user_id', req.user.id) // Admin can only delete their own notifications
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
        .where('user_id', req.user.id) // Only clear current admin's notifications
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
  }
};

module.exports = adminNotificationController;