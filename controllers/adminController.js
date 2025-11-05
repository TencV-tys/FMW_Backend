const db = require('../config/db');
const emailService = require('../services/emailService');

const adminController = {
  // Get all posts for admin moderation WITH REPORT COUNTS
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
      
      // 🆕 ADD REPORT COUNTS TO EACH POST (SAME LOGIC AS IN ALL FUNCTIONS)
      const postsWithReportCounts = await Promise.all(
        posts.map(async (post) => {
          const currentDate = new Date();
          const currentMonth = currentDate.getFullYear() * 100 + (currentDate.getMonth() + 1);
          
          // 🆕 GET CURRENT MONTH'S UNIQUE REPORT COUNT (same as in removePost/deletePost)
          const monthlyReportResult = await db('reports')
            .where('post_id', post.id)
            .where('reported_month', currentMonth)
            .count('id as report_count')
            .first();

          const monthly_report_count = monthlyReportResult ? parseInt(monthlyReportResult.report_count) : 0;

          // 🆕 GET ALL-TIME REPORT COUNT (same as in removePost/deletePost)
          const totalReportResult = await db('reports')
            .where('post_id', post.id)
            .count('id as report_count')
            .first();

          const total_report_count = totalReportResult ? parseInt(totalReportResult.report_count) : 0;

          return {
            ...post,
            monthly_report_count, // Same as monthlyReportCount in removePost/deletePost
            total_report_count    // Same as totalReportCount in removePost/deletePost
          };
        })
      );
      
      res.json({ success: true, posts: postsWithReportCounts });
    } catch (error) {
      console.error('Get all posts error:', error);
      res.status(500).json({ success: false, error: 'Server error fetching posts' });
    }
  },

  // Remove post from public view - WITH MONTHLY REPORT VALIDATION
  removePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, force = false } = req.body || {};

      // Get post with user info
      const post = await db('posts')
        .where('posts.id', id)
        .join('users', 'posts.user_id', 'users.id')
        .select(
          'posts.*',
          'users.first_name',
          'users.last_name',
          'users.email'
        )
        .first();

      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }

      // 🆕 GET CURRENT MONTH'S UNIQUE REPORT COUNT
      const currentDate = new Date();
      const currentMonth = currentDate.getFullYear() * 100 + (currentDate.getMonth() + 1);
      
      const reportCountResult = await db('reports')
        .where('post_id', id)
        .where('reported_month', currentMonth)
        .count('id as report_count')
        .first();

      const monthlyReportCount = reportCountResult ? parseInt(reportCountResult.report_count) : 0;

      // 🆕 GET ALL-TIME REPORT COUNT
      const allTimeReportResult = await db('reports')
        .where('post_id', id)
        .count('id as report_count')
        .first();

      const allTimeReportCount = allTimeReportResult ? parseInt(allTimeReportResult.report_count) : 0;

      // 🎯 Report-based validation with MONTHLY counts
      const MIN_REPORTS_FOR_REMOVAL = 3;
      const hasEnoughReports = monthlyReportCount >= MIN_REPORTS_FOR_REMOVAL;
      
      if (!hasEnoughReports && !force) {
        return res.status(400).json({
          success: false,
          error: `Post needs at least ${MIN_REPORTS_FOR_REMOVAL} unique user reports this month to be removed. Currently has ${monthlyReportCount} unique monthly reports.`,
          monthlyReportCount: monthlyReportCount,
          totalReportCount: allTimeReportCount,
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

      // 🆕 USER WARNING SYSTEM: Check if this is a forced action with low reports
      if (force && monthlyReportCount < MIN_REPORTS_FOR_REMOVAL) {
        // Create warning notification for user
        const warningNotification = {
          user_id: post.user_id,
          title: 'Post Removed - Warning',
          message: `Your post "${post.title}" was removed by administrator despite having only ${monthlyReportCount} report(s) this month. Please review community guidelines.${reason ? ` Reason: ${reason}` : ''}`,
          type: 'post_removed_warning',
          metadata: JSON.stringify({
            post_id: id,
            action: 'removed_forced',
            admin_id: req.user.id,
            reason: reason || 'Post removed by administrator (forced)',
            post_title: post.title,
            monthly_report_count: monthlyReportCount,
            total_report_count: allTimeReportCount,
            forced: true,
            warning_type: 'low_reports_override'
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(warningNotification);

        // Send warning email to user
        await emailService.sendPostActionWarning(
          post.email,
          `${post.first_name} ${post.last_name}`,
          'removed',
          post.title,
          reason,
          monthlyReportCount,
          MIN_REPORTS_FOR_REMOVAL
        );
      } else {
        // Regular notification (not forced or has enough reports)
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
            post_title: post.title,
            monthly_report_count: monthlyReportCount,
            total_report_count: allTimeReportCount,
            forced: force
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(userNotificationData);

        // Send regular email notification
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
        message: `You removed post "${post.title}" by ${post.first_name} ${post.last_name} from public view${force ? ' (FORCED - Low monthly reports)' : ''}`,
        type: 'post_removed',
        metadata: JSON.stringify({
          post_id: id,
          action: 'removed',
          target_user_id: post.user_id,
          target_user_name: `${post.first_name} ${post.last_name}`,
          reason: reason || 'Post removed by administrator',
          post_title: post.title,
          performed_by: req.user.id,
          monthly_report_count: monthlyReportCount,
          total_report_count: allTimeReportCount,
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
        monthlyReportCount: monthlyReportCount,
        totalReportCount: allTimeReportCount,
        forced: force,
        userWarned: force && monthlyReportCount < MIN_REPORTS_FOR_REMOVAL
      });
    } catch (error) {
      console.error('Remove post error:', error);
      res.status(500).json({ success: false, error: 'Server error removing post' });
    }
  },

  // Delete post permanently - WITH MONTHLY REPORT VALIDATION
  deletePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, force = false } = req.body || {};

      // Get post with user info
      const post = await db('posts')
        .where('posts.id', id)
        .join('users', 'posts.user_id', 'users.id')
        .select(
          'posts.*',
          'users.first_name',
          'users.last_name',
          'users.email'
        )
        .first();
      
      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }

      // 🆕 GET CURRENT MONTH'S UNIQUE REPORT COUNT
      const currentDate = new Date();
      const currentMonth = currentDate.getFullYear() * 100 + (currentDate.getMonth() + 1);
      
      const reportCountResult = await db('reports')
        .where('post_id', id)
        .where('reported_month', currentMonth)
        .count('id as report_count')
        .first();

      const monthlyReportCount = reportCountResult ? parseInt(reportCountResult.report_count) : 0;

      // 🆕 GET ALL-TIME REPORT COUNT
      const allTimeReportResult = await db('reports')
        .where('post_id', id)
        .count('id as report_count')
        .first();

      const allTimeReportCount = allTimeReportResult ? parseInt(allTimeReportResult.report_count) : 0;

      // 🎯 Report-based validation for deletion with MONTHLY counts
      const MIN_REPORTS_FOR_DELETION = 5;
      const hasEnoughReports = monthlyReportCount >= MIN_REPORTS_FOR_DELETION;
      
      if (!hasEnoughReports && !force) {
        return res.status(400).json({
          success: false,
          error: `Post needs at least ${MIN_REPORTS_FOR_DELETION} unique user reports this month to be permanently deleted. Currently has ${monthlyReportCount} unique monthly reports.`,
          monthlyReportCount: monthlyReportCount,
          totalReportCount: allTimeReportCount,
          requiredCount: MIN_REPORTS_FOR_DELETION,
          canForce: true
        });
      }

      await db('posts').where('id', id).delete();

      const currentTime = new Date();
      const notificationsToInsert = [];

      // 🆕 USER WARNING SYSTEM: Check if this is a forced action with low reports
      if (force && monthlyReportCount < MIN_REPORTS_FOR_DELETION) {
        // Create warning notification for user
        const warningNotification = {
          user_id: post.user_id,
          title: 'Post Deleted - Serious Warning',
          message: `Your post "${post.title}" was permanently deleted by administrator despite having only ${monthlyReportCount} report(s) this month. This is a serious violation of community guidelines.${reason ? ` Reason: ${reason}` : ''}`,
          type: 'post_deleted_warning',
          metadata: JSON.stringify({
            post_id: id,
            action: 'deleted_forced',
            admin_id: req.user.id,
            reason: reason || 'Post permanently deleted (forced)',
            post_title: post.title,
            monthly_report_count: monthlyReportCount,
            total_report_count: allTimeReportCount,
            forced: true,
            warning_type: 'severe_violation'
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(warningNotification);

        // Send warning email to user
        await emailService.sendPostActionWarning(
          post.email,
          `${post.first_name} ${post.last_name}`,
          'deleted',
          post.title,
          reason,
          monthlyReportCount,
          MIN_REPORTS_FOR_DELETION,
          true // serious violation
        );
      } else {
        // Regular notification (not forced or has enough reports)
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
            post_title: post.title,
            monthly_report_count: monthlyReportCount,
            total_report_count: allTimeReportCount,
            forced: force
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(userNotificationData);

        // Send regular email notification
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
        message: `You deleted post "${post.title}" by ${post.first_name} ${post.last_name}${force ? ' (FORCED - Low monthly reports)' : ''}`,
        type: 'post_deleted',
        metadata: JSON.stringify({
          post_id: id,
          action: 'deleted',
          target_user_id: post.user_id,
          target_user_name: `${post.first_name} ${post.last_name}`,
          reason: reason || 'Post permanently deleted',
          post_title: post.title,
          performed_by: req.user.id,
          monthly_report_count: monthlyReportCount,
          total_report_count: allTimeReportCount,
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
        monthlyReportCount: monthlyReportCount,
        totalReportCount: allTimeReportCount,
        forced: force,
        userWarned: force && monthlyReportCount < MIN_REPORTS_FOR_DELETION
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

      // Create admin notification
      const adminNotificationData = {
        user_id: req.user.id,
        title: 'Post Restored',
        message: `You restored post "${post.title}" by ${post.first_name} ${post.last_name}`,
        type: 'post_restored',
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

      // Create admin notification
      const adminNotificationData = {
        user_id: req.user.id,
        title: 'Post Resolved',
        message: `You marked post "${post.title}" by ${post.first_name} ${post.last_name} as resolved`,
        type: 'post_resolved',
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