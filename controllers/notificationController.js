
// controllers/notificationController.js
const db = require('../config/db');
const Notification = require('../models/Notification');

const notificationController = {
  getUserNotifications: async (req, res) => {
    try {
      const userId = req.user.id;
      const notifications = await Notification.getByUserId(userId);
      
      res.json({
        success: true,
        notifications
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching notifications'
      });
    }
  },

  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await Notification.markAsRead(id);
      
      if (updated) {
        res.json({
          success: true,
          message: 'Notification marked as read'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Notification not found'
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

  markAllAsRead: async (req, res) => {
    try {
      const userId = req.user.id;
      await Notification.markAllAsRead(userId);
      
      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error marking notifications as read'
      });
    }
  },

  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user.id;
      const count = await Notification.getUnreadCount(userId);
      
      res.json({
        success: true,
        count
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching unread count'
      });
    }
  },

  // ADD THIS: User deletes their own notification
  deleteNotification: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const deleted = await db('notifications')
        .where('id', id)
        .andWhere('user_id', userId) // User can only delete their own notifications
        .delete();

      if (deleted) {
        res.json({
          success: true,
          message: 'Notification deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Notification not found'
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
  // Delete all user notifications
deleteAllNotifications: async (req, res) => {
  try {
    const userId = req.user.id;
    
    const deleted = await db('notifications')
      .where('user_id', userId)
      .delete();

    res.json({
      success: true,
      message: 'All notifications deleted successfully',
      deletedCount: deleted
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error deleting all notifications'
    });
  }
}

};

module.exports = notificationController;