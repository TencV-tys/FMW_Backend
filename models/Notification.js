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
  },


// Create notification for post owner when admin modifies their post
  createPostActionNotification: async (postId, action, adminId, reason = '') => {
    try {
      // Get post details and owner
      const post = await db('posts')
        .where('posts.id', postId)
        .join('users', 'posts.user_id', 'users.id')
        .select('posts.*', 'users.first_name', 'users.last_name')
        .first();

      if (!post) return null;

      let title, message, type;

      switch (action) {
        case 'resolved':
          title = 'Post Resolved';
          message = `Your post "${post.title}" has been marked as resolved by administrator`;
          type = 'post_resolved';
          break;
        case 'removed':
          title = 'Post Removed';
          message = `Your post "${post.title}" has been removed from public view by administrator`;
          if (reason) message += `. Reason: ${reason}`;
          type = 'post_removed';
          break;
        case 'deleted':
          title = 'Post Deleted';
          message = `Your post "${post.title}" has been permanently deleted by administrator`;
          if (reason) message += `. Reason: ${reason}`;
          type = 'post_deleted';
          break;
        case 'restored':
          title = 'Post Restored';
          message = `Your post "${post.title}" has been restored by administrator`;
          type = 'post_restored';
          break;
        default:
          return null;
      }

      const notificationData = {
        user_id: post.user_id,
        title,
        message,
        type,
        metadata: JSON.stringify({
          post_id: postId,
          action,
          admin_id: adminId,
          reason,
          post_title: post.title
        }),
        is_read: false
      };

      return await Notification.create(notificationData);
    } catch (error) {
      console.error('Create post action notification error:', error);
      return null;
    }
  },

  // Get admin notifications (for admin notification page)
  getAdminNotifications: async (limit = 50) => {
    return await db('notifications')
      .join('users', 'notifications.user_id', 'users.id')
      .select(
        'notifications.*',
        'users.first_name',
        'users.last_name',
        'users.role'
      )
      .orderBy('notifications.created_at', 'desc')
      .limit(limit);
  },

  // Get notifications for specific types (admin actions)
  getByType: async (type, limit = 50) => {
    return await db('notifications')
      .where('type', type)
      .join('users', 'notifications.user_id', 'users.id')
      .select(
        'notifications.*',
        'users.first_name',
        'users.last_name'
      )
      .orderBy('notifications.created_at', 'desc')
      .limit(limit);
  }

};

module.exports = Notification;