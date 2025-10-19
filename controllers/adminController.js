const db = require('../config/db');

const adminController = {
  // Get all posts for admin moderation
  getAllPosts: async (req, res) => {
    try {
      const posts = await db('posts')
        .join('users', 'posts.user_id', 'users.id')
        .join('categories', 'posts.category_id', 'categories.id')
        .join('barangays', 'posts.barangay_id', 'barangays.id')
        .select(
          'posts.*',
          'users.first_name',
          'users.last_name',
          'categories.name as category_name',
          'barangays.name as barangay_name'
        )
        .orderBy('posts.created_at', 'desc');
      
      res.json({ success: true, posts });
    } catch (error) {
      console.error('Get all posts error:', error);
      res.status(500).json({ success: false, error: 'Server error fetching posts' });
    }
  },

  // Remove post from public view - FIXED
  removePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};

      const post = await db('posts')
        .where('posts.id', id)
        .join('users', 'posts.user_id', 'users.id')
        .select('posts.*', 'users.first_name', 'users.last_name')
        .first();

      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }

      await db('posts')
        .where('id', id)
        .update({ 
          status: 'Removed',
          reason: reason || 'Post removed by administrator',
          updated_at: new Date()
        });

      const currentTime = new Date();
      const notificationsToInsert = [];

      // Only create user notification if post owner is NOT the admin
      if (post.user_id !== req.user.id) {
        const userNotificationData = {
          user_id: post.user_id,
          title: 'Post Removed',
          message: `Your post "${post.title}" has been removed from public view${reason ? `. Reason: ${reason}` : ''}`,
          type: 'post_removed',
          metadata: JSON.stringify({
            post_id: id,
            action: 'removed',
            admin_id: req.user.id,
            reason: reason || 'Post removed by administrator',
            post_title: post.title
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(userNotificationData);
      }

      // Always create admin notification for audit trail
      const adminNotificationData = {
        user_id: req.user.id,
        title: 'Post Removed',
        message: `You removed post "${post.title}" by ${post.first_name} ${post.last_name} from public view`,
        type: 'general',
        metadata: JSON.stringify({
          post_id: id,
          action: 'removed',
          target_user_id: post.user_id,
          target_user_name: `${post.first_name} ${post.last_name}`,
          reason: reason || 'Post removed by administrator',
          post_title: post.title,
          performed_by: req.user.id
        }),
        is_read: false,
        created_at: currentTime
      };
      notificationsToInsert.push(adminNotificationData);

      if (notificationsToInsert.length > 0) {
        await db('notifications').insert(notificationsToInsert);
      }

      res.json({ success: true, message: 'Post removed from public view' });
    } catch (error) {
      console.error('Remove post error:', error);
      res.status(500).json({ success: false, error: 'Server error removing post' });
    }
  },

  // Delete post permanently - FIXED
  deletePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};

      const post = await db('posts')
        .where('posts.id', id)
        .join('users', 'posts.user_id', 'users.id')
        .select('posts.*', 'users.first_name', 'users.last_name')
        .first();
      
      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }

      await db('posts').where('id', id).delete();

      const currentTime = new Date();
      const notificationsToInsert = [];

      // Only create user notification if post owner is NOT the admin
      if (post.user_id !== req.user.id) {
        const userNotificationData = {
          user_id: post.user_id,
          title: 'Post Deleted',
          message: `Your post "${post.title}" has been permanently deleted${reason ? `. Reason: ${reason}` : ''}`,
          type: 'post_deleted',
          metadata: JSON.stringify({
            post_id: id,
            action: 'deleted',
            admin_id: req.user.id,
            reason: reason || 'Post permanently deleted',
            post_title: post.title
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(userNotificationData);
      }

      // Always create admin notification for audit trail
      const adminNotificationData = {
        user_id: req.user.id,
        title: 'Post Deletion',
        message: `You deleted post "${post.title}" by ${post.first_name} ${post.last_name}`,
        type: 'general',
        metadata: JSON.stringify({
          post_id: id,
          action: 'deleted',
          target_user_id: post.user_id,
          target_user_name: `${post.first_name} ${post.last_name}`,
          reason: reason || 'Post permanently deleted',
          post_title: post.title,
          performed_by: req.user.id
        }),
        is_read: false,
        created_at: currentTime
      };
      notificationsToInsert.push(adminNotificationData);

      if (notificationsToInsert.length > 0) {
        await db('notifications').insert(notificationsToInsert);
      }

      res.json({ success: true, message: 'Post deleted permanently' });
    } catch (error) {
      console.error('Delete post error:', error);
      res.status(500).json({ success: false, error: 'Server error deleting post' });
    }
  },

  // Resolve post - FIXED
  resolvePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};

      const post = await db('posts')
        .where('posts.id', id)
        .join('users', 'posts.user_id', 'users.id')
        .select('posts.*', 'users.first_name', 'users.last_name')
        .first();

      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }
      
      await db('posts')
        .where('id', id)
        .update({ 
          status: 'Resolved',
          reason: reason || 'Post marked as resolved by administrator',
          updated_at: new Date()
      });

      const currentTime = new Date();
      const notificationsToInsert = [];

      // Only create user notification if post owner is NOT the admin
      if (post.user_id !== req.user.id) {
        const userNotificationData = {
          user_id: post.user_id,
          title: 'Post Resolved',
          message: `Your post "${post.title}" has been marked as resolved${reason ? `. Reason: ${reason}` : ''}`,
          type: 'post_resolved',
          metadata: JSON.stringify({
            post_id: id,
            action: 'resolved',
            admin_id: req.user.id,
            reason: reason || 'Post marked as resolved',
            post_title: post.title
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(userNotificationData);
      }

      // Always create admin notification for audit trail
      const adminNotificationData = {
        user_id: req.user.id,
        title: 'Post Resolved',
        message: `You marked post "${post.title}" by ${post.first_name} ${post.last_name} as resolved`,
        type: 'general',
        metadata: JSON.stringify({
          post_id: id,
          action: 'resolved',
          target_user_id: post.user_id,
          target_user_name: `${post.first_name} ${post.last_name}`,
          reason: reason || 'Post marked as resolved',
          post_title: post.title,
          performed_by: req.user.id
        }),
        is_read: false,
        created_at: currentTime
      };
      notificationsToInsert.push(adminNotificationData);

      if (notificationsToInsert.length > 0) {
        await db('notifications').insert(notificationsToInsert);
      }
      
      res.json({ success: true, message: 'Post marked as resolved' });
    } catch (error) {
      console.error('Resolve post error:', error);
      res.status(500).json({ success: false, error: 'Server error resolving post' });
    }
  },

  // Restore post - FIXED
  restorePost: async (req, res) => {
    try {
      const { id } = req.params;

      const post = await db('posts')
        .where('posts.id', id)
        .join('users', 'posts.user_id', 'users.id')
        .select('posts.*', 'users.first_name', 'users.last_name')
        .first();

      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }
      
      await db('posts')
        .where('id', id)
        .update({ 
          status: 'Active',
          reason: null,
          updated_at: new Date()
        });

      const currentTime = new Date();
      const notificationsToInsert = [];

      // Only create user notification if post owner is NOT the admin
      if (post.user_id !== req.user.id) {
        const userNotificationData = {
          user_id: post.user_id,
          title: 'Post Restored',
          message: `Your post "${post.title}" has been restored and is now publicly visible`,
          type: 'post_restored',
          metadata: JSON.stringify({
            post_id: id,
            action: 'restored',
            admin_id: req.user.id,
            post_title: post.title
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(userNotificationData);
      }

      // Always create admin notification for audit trail
      const adminNotificationData = {
        user_id: req.user.id,
        title: 'Post Restored',
        message: `You restored post "${post.title}" by ${post.first_name} ${post.last_name}`,
        type: 'general',
        metadata: JSON.stringify({
          post_id: id,
          action: 'restored',
          target_user_id: post.user_id,
          target_user_name: `${post.first_name} ${post.last_name}`,
          post_title: post.title,
          performed_by: req.user.id
        }),
        is_read: false,
        created_at: currentTime
      };
      notificationsToInsert.push(adminNotificationData);

      if (notificationsToInsert.length > 0) {
        await db('notifications').insert(notificationsToInsert);
      }

      res.json({ success: true, message: 'Post restored successfully' });
    } catch (error) {
      console.error('Restore post error:', error);
      res.status(500).json({ success: false, error: 'Server error restoring post' });
    }
  },
};

module.exports = adminController;