// models/Notification.js
const db = require('../config/db');

const Notification = {
  create: async (notificationData) => {
    const [notificationId] = await db('notifications').insert(notificationData);
    return notificationId;
  },

  getByUserId: async (userId, limit = 20) => {
    return await db('notifications')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit);
  },

  markAsRead: async (id) => {
    return await db('notifications')
      .where('id', id)
      .update({
        is_read: true,
        updated_at: new Date()
      });
  },

  markAllAsRead: async (userId) => {
    return await db('notifications')
      .where('user_id', userId)
      .update({
        is_read: true,
        updated_at: new Date()
      });
  },

  getUnreadCount: async (userId) => {
    const result = await db('notifications')
      .where({
        user_id: userId,
        is_read: false
      })
      .count('* as count')
      .first();
    
    return result.count;
  },

  // Get all admin users for notifications
  getAdminUsers: async () => {
    return await db('users').where('role', 'admin').select('id');
  }
};

module.exports = Notification;