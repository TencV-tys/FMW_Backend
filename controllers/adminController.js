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
// Remove post - WITH WARNING NOTIFICATION
removePost: async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    // Get post with user info
    const post = await db('posts')
      .where('posts.id', id)
      .join('users', 'posts.user_id', 'users.id')
      .select('posts.*', 'users.first_name', 'users.last_name', 'users.email')
      .first();

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Get total report count (all-time)
    const totalReportResult = await db('reports')
      .where('post_id', id)
      .count('id as report_count')
      .first();

    const totalReportCount = totalReportResult ? parseInt(totalReportResult.report_count) : 0;

    // Simple report count check - remove if 3+ reports
    const MIN_REPORTS_FOR_REMOVAL = 3;
    if (totalReportCount < MIN_REPORTS_FOR_REMOVAL) {
      return res.status(400).json({
        success: false,
        error: `Post needs at least ${MIN_REPORTS_FOR_REMOVAL} reports to be removed (currently has ${totalReportCount})`
      });
    }

    // Remove the post
    await db('posts')
      .where('id', id)
      .update({ 
        status: 'Removed',
        reason: reason || 'Post removed by administrator',
        updated_at: new Date()
      });

    const currentTime = new Date();
    const notificationsToInsert = [];

    // USER WARNING NOTIFICATION - KEEP THIS!
    const warningNotification = {
      user_id: post.user_id,
      title: 'Post Removed - Community Reports',
      message: `Your post "${post.title}" was removed due to reaching ${totalReportCount} community reports. Please review community guidelines.${reason ? ` Additional reason: ${reason}` : ''}`,
      type: 'post_removed_warning',
      metadata: JSON.stringify({
        post_id: id,
        action: 'removed',
        admin_id: req.user.id,
        reason: reason || 'Post removed due to community reports',
        post_title: post.title,
        total_report_count: totalReportCount,
        threshold: MIN_REPORTS_FOR_REMOVAL,
        warning_type: 'community_reports_threshold'
      }),
      is_read: false,
      created_at: currentTime
    };
    notificationsToInsert.push(warningNotification);

    // ADMIN NOTIFICATION
    const adminNotificationData = {
      user_id: req.user.id,
      title: 'Post Removed',
      message: `You removed post "${post.title}" by ${post.first_name} ${post.last_name} from public view (${totalReportCount} reports)`,
      type: 'post_removed',
      metadata: JSON.stringify({
        post_id: id,
        action: 'removed',
        target_user_id: post.user_id,
        target_user_name: `${post.first_name} ${post.last_name}`,
        reason: reason || 'Post removed by administrator',
        post_title: post.title,
        performed_by: req.user.id,
        total_report_count: totalReportCount
      }),
      is_read: false,
      created_at: currentTime
    };
    notificationsToInsert.push(adminNotificationData);

    if (notificationsToInsert.length > 0) {
      await db('notifications').insert(notificationsToInsert);
    }

    // Send warning email to user
    await emailService.sendPostActionWarning(
      post.email,
      `${post.first_name} ${post.last_name}`,
      'removed',
      post.title,
      reason,
      totalReportCount,
      MIN_REPORTS_FOR_REMOVAL
    );

    res.json({ 
      success: true, 
      message: 'Post removed from public view!'
    });
  } catch (error) {
    console.error('Remove post error:', error);
    res.status(500).json({ success: false, error: 'Server error removing post' });
  }
},
// Delete post permanently - WITH SERIOUS WARNING NOTIFICATION
deletePost: async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    // Get post with user info
    const post = await db('posts')
      .where('posts.id', id)
      .join('users', 'posts.user_id', 'users.id')
      .select('posts.*', 'users.first_name', 'users.last_name', 'users.email')
      .first();
    
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Get total report count (all-time)
    const totalReportResult = await db('reports')
      .where('post_id', id)
      .count('id as report_count')
      .first();

    const totalReportCount = totalReportResult ? parseInt(totalReportResult.report_count) : 0;

    // Simple report count check - delete if 5+ reports
    const MIN_REPORTS_FOR_DELETION = 5;
    if (totalReportCount < MIN_REPORTS_FOR_DELETION) {
      return res.status(400).json({
        success: false,
        error: `Post needs at least ${MIN_REPORTS_FOR_DELETION} reports to be permanently deleted (currently has ${totalReportCount})`
      });
    }

    await db('posts').where('id', id).delete();

    const currentTime = new Date();
    const notificationsToInsert = [];

    // SERIOUS WARNING NOTIFICATION - KEEP THIS!
    const warningNotification = {
      user_id: post.user_id,
      title: 'Post Deleted - Serious Violation',
      message: `Your post "${post.title}" was permanently deleted due to reaching ${totalReportCount} community reports, indicating serious violations. Please review community guidelines immediately.${reason ? ` Reason: ${reason}` : ''}`,
      type: 'post_deleted_warning',
      metadata: JSON.stringify({
        post_id: id,
        action: 'deleted',
        admin_id: req.user.id,
        reason: reason || 'Post permanently deleted due to serious community reports',
        post_title: post.title,
        total_report_count: totalReportCount,
        threshold: MIN_REPORTS_FOR_DELETION,
        warning_type: 'serious_violation_threshold'
      }),
      is_read: false,
      created_at: currentTime
    };
    notificationsToInsert.push(warningNotification);

    // ADMIN NOTIFICATION
    const adminNotificationData = {
      user_id: req.user.id,
      title: 'Post Deletion',
      message: `You deleted post "${post.title}" by ${post.first_name} ${post.last_name} (${totalReportCount} reports - serious violation)`,
      type: 'post_deleted',
      metadata: JSON.stringify({
        post_id: id,
        action: 'deleted',
        target_user_id: post.user_id,
        target_user_name: `${post.first_name} ${post.last_name}`,
        reason: reason || 'Post permanently deleted',
        post_title: post.title,
        performed_by: req.user.id,
        total_report_count: totalReportCount
      }),
      is_read: false,
      created_at: currentTime
    };
    notificationsToInsert.push(adminNotificationData);

    if (notificationsToInsert.length > 0) {
      await db('notifications').insert(notificationsToInsert);
    }

    // Send serious warning email to user
    await emailService.sendPostActionWarning(
      post.email,
      `${post.first_name} ${post.last_name}`,
      'deleted',
      post.title,
      reason,
      totalReportCount,
      MIN_REPORTS_FOR_DELETION,
      true // serious violation
    );

    res.json({ 
      success: true, 
      message: 'Post deleted permanently!'
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