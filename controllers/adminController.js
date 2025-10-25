// controllers/adminController.js - COMPLETE VERSION
const db = require('../config/db');
const emailService = require('../services/emailService');

// controllers/adminController.js - UPDATED WITH REPORT VALIDATION
const adminController = {
  // Get all posts for admin moderation
  getAllPosts: async (req, res) => {
    try {
      const posts = await db('posts')
        .join('users', 'posts.user_id', 'users.id')
        .join('categories', 'posts.category_id', 'categories.id')
        .join('barangays', 'posts.barangay_id', 'barangays.id')
        .leftJoin('puroks', 'posts.purok_id', 'puroks.id') 
        .select(
          'posts.*',
          'users.first_name',
          'users.last_name',
          'categories.name as category_name',
          'barangays.name as barangay_name',
          'puroks.name as purok_name'
        )
        .orderBy('posts.created_at', 'desc');
      
      res.json({ success: true, posts });
    } catch (error) {
      console.error('Get all posts error:', error);
      res.status(500).json({ success: false, error: 'Server error fetching posts' });
    }
  },

  // Remove post from public view - WITH REPORT VALIDATION
  removePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, force = false } = req.body || {};

      // Get post with report count
      const post = await db('posts')
        .where('posts.id', id)
        .join('users', 'posts.user_id', 'users.id')
        .leftJoin('reports', 'posts.id', 'reports.post_id')
        .select(
          'posts.*',
          'users.first_name',
          'users.last_name',
          'users.email',
          db.raw('COUNT(reports.id) as report_count')
        )
        .groupBy('posts.id', 'users.id')
        .first();

      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }

      // 🎯 NEW: Report-based validation
      const MIN_REPORTS_FOR_REMOVAL = 3;
      const hasEnoughReports = post.report_count >= MIN_REPORTS_FOR_REMOVAL;
      
      if (!hasEnoughReports && !force) {
        return res.status(400).json({
          success: false,
          error: `Post needs at least ${MIN_REPORTS_FOR_REMOVAL} reports to be removed. Currently has ${post.report_count} reports.`,
          reportCount: post.report_count,
          requiredCount: MIN_REPORTS_FOR_REMOVAL,
          canForce: true
        });
      }

      await db('posts')
        .where('id', id)
        .update({ 
          status: 'Removed',
          reason: reason || (force ? 'Post removed by administrator (forced)' : 'Post removed by administrator'),
          updated_at: new Date()
        });

      const currentTime = new Date();
      const notificationsToInsert = [];

      // Only create user notification if post owner is NOT the admin
      if (post.user_id !== req.user.id) {
        const userNotificationData = {
          user_id: post.user_id,
          title: 'Post Removed',
          message: `Your post "${post.title}" has been removed from public view${reason ? `. Reason: ${reason}` : ''}${force ? ' (Admin Override)' : ''}`,
          type: 'post_removed',
          metadata: JSON.stringify({
            post_id: id,
            action: 'removed',
            admin_id: req.user.id,
            reason: reason || 'Post removed by administrator',
            post_title: post.title,
            report_count: post.report_count,
            forced: force
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(userNotificationData);

        // Send email notification to user
        await emailService.sendPostActionNotification(
          post.email,
          `${post.first_name} ${post.last_name}`,
          'removed',
          post.title,
          reason
        );
      }

      // Always create admin notification for audit trail
      const adminNotificationData = {
        user_id: req.user.id,
        title: 'Post Removed',
        message: `You removed post "${post.title}" by ${post.first_name} ${post.last_name} from public view${force ? ' (FORCED - Low reports)' : ''}`,
        type: 'general',
        metadata: JSON.stringify({
          post_id: id,
          action: 'removed',
          target_user_id: post.user_id,
          target_user_name: `${post.first_name} ${post.last_name}`,
          reason: reason || 'Post removed by administrator',
          post_title: post.title,
          performed_by: req.user.id,
          report_count: post.report_count,
          forced: force
        }),
        is_read: false,
        created_at: currentTime
      };
      notificationsToInsert.push(adminNotificationData);

      if (notificationsToInsert.length > 0) {
        await db('notifications').insert(notificationsToInsert);
      }

      res.json({ 
        success: true, 
        message: `Post removed from public view${force ? ' (admin override)' : ''}`,
        reportCount: post.report_count,
        forced: force
      });
    } catch (error) {
      console.error('Remove post error:', error);
      res.status(500).json({ success: false, error: 'Server error removing post' });
    }
  },

  // Delete post permanently - WITH REPORT VALIDATION
  deletePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, force = false } = req.body || {};

      // Get post with report count
      const post = await db('posts')
        .where('posts.id', id)
        .join('users', 'posts.user_id', 'users.id')
        .leftJoin('reports', 'posts.id', 'reports.post_id')
        .select(
          'posts.*',
          'users.first_name',
          'users.last_name',
          'users.email',
          db.raw('COUNT(reports.id) as report_count')
        )
        .groupBy('posts.id', 'users.id')
        .first();
      
      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }

      // 🎯 NEW: Report-based validation for deletion (higher threshold)
      const MIN_REPORTS_FOR_DELETION = 5;
      const hasEnoughReports = post.report_count >= MIN_REPORTS_FOR_DELETION;
      
      if (!hasEnoughReports && !force) {
        return res.status(400).json({
          success: false,
          error: `Post needs at least ${MIN_REPORTS_FOR_DELETION} reports to be permanently deleted. Currently has ${post.report_count} reports.`,
          reportCount: post.report_count,
          requiredCount: MIN_REPORTS_FOR_DELETION,
          canForce: true
        });
      }

      await db('posts').where('id', id).delete();

      const currentTime = new Date();
      const notificationsToInsert = [];

      // Only create user notification if post owner is NOT the admin
      if (post.user_id !== req.user.id) {
        const userNotificationData = {
          user_id: post.user_id,
          title: 'Post Deleted',
          message: `Your post "${post.title}" has been permanently deleted${reason ? `. Reason: ${reason}` : ''}${force ? ' (Admin Override)' : ''}`,
          type: 'post_deleted',
          metadata: JSON.stringify({
            post_id: id,
            action: 'deleted',
            admin_id: req.user.id,
            reason: reason || 'Post permanently deleted',
            post_title: post.title,
            report_count: post.report_count,
            forced: force
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(userNotificationData);

        // Send email notification to user
        await emailService.sendPostActionNotification(
          post.email,
          `${post.first_name} ${post.last_name}`,
          'deleted',
          post.title,
          reason
        );
      }

      // Always create admin notification for audit trail
      const adminNotificationData = {
        user_id: req.user.id,
        title: 'Post Deletion',
        message: `You deleted post "${post.title}" by ${post.first_name} ${post.last_name}${force ? ' (FORCED - Low reports)' : ''}`,
        type: 'general',
        metadata: JSON.stringify({
          post_id: id,
          action: 'deleted',
          target_user_id: post.user_id,
          target_user_name: `${post.first_name} ${post.last_name}`,
          reason: reason || 'Post permanently deleted',
          post_title: post.title,
          performed_by: req.user.id,
          report_count: post.report_count,
          forced: force
        }),
        is_read: false,
        created_at: currentTime
      };
      notificationsToInsert.push(adminNotificationData);

      if (notificationsToInsert.length > 0) {
        await db('notifications').insert(notificationsToInsert);
      }

      res.json({ 
        success: true, 
        message: `Post deleted permanently${force ? ' (admin override)' : ''}`,
        reportCount: post.report_count,
        forced: force
      });
    } catch (error) {
      console.error('Delete post error:', error);
      res.status(500).json({ success: false, error: 'Server error deleting post' });
    }
  },

  // Restore post - NO REPORT VALIDATION NEEDED
  restorePost: async (req, res) => {
    try {
      const { id } = req.params;

      const post = await db('posts')
        .where('posts.id', id)
        .join('users', 'posts.user_id', 'users.id')
        .select('posts.*', 'users.first_name', 'users.last_name', 'users.email')
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

        // Send email notification to user
        await emailService.sendPostActionNotification(
          post.email,
          `${post.first_name} ${post.last_name}`,
          'restored',
          post.title
        );
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

  // Resolve post - NO REPORT VALIDATION NEEDED
  resolvePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};

      const post = await db('posts')
        .where('posts.id', id)
        .join('users', 'posts.user_id', 'users.id')
        .select('posts.*', 'users.first_name', 'users.last_name', 'users.email')
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

        // Send email notification to user
        await emailService.sendPostActionNotification(
          post.email,
          `${post.first_name} ${post.last_name}`,
          'resolved',
          post.title,
          reason
        );
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
  }
};

module.exports = adminController;