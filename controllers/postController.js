const Post = require('../models/Post');
const Category = require('../models/Category');
const Barangay = require('../models/Barangay');
const Purok = require('../models/Purok');
const db = require('../config/db');

const postController = {

  createPost: async (req, res) => {
    try {
      const { title, description, type, category_id, barangay_id, purok_id, color, contact_info } = req.body;

      // Validate required fields
      if (!title || !description || !type || !category_id || !barangay_id || !contact_info) {
        return res.status(400).json({
          success: false,
          error: 'All required fields must be filled'
        });
      }

      const postData = {
        user_id: req.user.id,
        title,
        description,
        type,
        category_id: parseInt(category_id),
        barangay_id: parseInt(barangay_id),
        purok_id: purok_id ? parseInt(purok_id) : null,
        color: color || '',
        contact_info,
        photo: req.file ? req.file.filename : null
      };

      const postId = await Post.create(postData);

      // 🆕 NOTIFY ADMINS ABOUT NEW POST
      await postController._notifyAdminsNewPost(postId, postData, req.user);

      res.status(201).json({
        success: true,
        message: 'Post created successfully!',
        postId
      });
    } catch (error) {
      console.error('Create post error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error creating post'
      });
    }
  },

  // 🆕 NOTIFY ADMINS ABOUT NEW POST CREATION
  _notifyAdminsNewPost: async (postId, postData, user) => {
    try {
      const adminUsers = await db('users').where('role', 'admin').select('id', 'email', 'first_name');
      const currentTime = new Date();
      const notificationsToInsert = [];

      // Get category name for notification
      const category = await db('categories').where('id', postData.category_id).select('name').first();
      const categoryName = category ? category.name : 'Unknown Category';

      for (const admin of adminUsers) {
        const notificationData = {
          user_id: admin.id,
          title: `New ${postData.type} Post Created`,
          message: `User ${user.first_name} ${user.last_name} created a new ${postData.type} post in ${categoryName}: "${postData.title}"`,
          type: 'new_post',
          metadata: JSON.stringify({
            post_id: postId,
            post_title: postData.title,
            post_type: postData.type,
            category_id: postData.category_id,
            category_name: categoryName,
            barangay_id: postData.barangay_id,
            created_by_user_id: user.id,
            created_by_user_name: `${user.first_name} ${user.last_name}`,
            created_at: currentTime
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(notificationData);
      }

      if (notificationsToInsert.length > 0) {
        await db('notifications').insert(notificationsToInsert);
      }

      console.log(`✅ Notified ${adminUsers.length} admins about new post ${postId}`);
    } catch (error) {
      console.error('Error notifying admins about new post:', error);
    }
  },

  // Get single post by ID
  getPostById: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if user owns this post
      const post = await Post.getById(id);
      
      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }

      // Check if the post belongs to the current user
      if (post.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only edit your own posts.'
        });
      }

      res.json({ success: true, post });
    } catch (error) {
      console.error('Get post by ID error:', error);
      res.status(500).json({ success: false, error: 'Server error fetching post' });
    }
  },

  // Update post
  updatePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, type, category_id, barangay_id, purok_id, color, contact_info, remove_photo } = req.body;

      // Validate required fields
      if (!title || !description || !type || !category_id || !barangay_id || !contact_info) {
        return res.status(400).json({
          success: false,
          error: 'All required fields must be filled'
        });
      }

      // First, check if post exists and belongs to user
      const existingPost = await Post.getById(id);
      
      if (!existingPost) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }

      if (existingPost.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only edit your own posts.'
        });
      }

      const updateData = {
        title,
        description,
        type,
        category_id: parseInt(category_id),
        barangay_id: parseInt(barangay_id),
        purok_id: purok_id ? parseInt(purok_id) : null,
        color: color || '',
        contact_info,
        updated_at: new Date()
      };

      // Handle photo updates
      if (req.file) {
        // New photo uploaded
        updateData.photo = req.file.filename;
      } else if (remove_photo === 'true') {
        // Photo removal requested
        updateData.photo = null;
      }
      // If neither, keep the existing photo

      const updated = await Post.update(id, updateData);

      if (updated) {
        res.json({
          success: true,
          message: 'Post updated successfully!'
        });
      } else {
        throw new Error('Failed to update post');
      }
    } catch (error) {
      console.error('Update post error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error updating post'
      });
    }
  },

  // Delete post - WITH MONTHLY LIMIT CHECK AND USER NOTIFICATION
  deletePost: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // First, check if post exists and belongs to user
      const existingPost = await Post.getById(id);
      
      if (!existingPost) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }

      if (existingPost.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only delete your own posts.'
        });
      }

      // Check monthly deletion limit
      const canDelete = await postController._checkDeletionLimit(userId);
      
      if (!canDelete.allowed) {
        // Notify user about deletion limit reached
        await postController._notifyUserDeletionLimitReached(userId, canDelete);
        
        return res.status(429).json({
          success: false,
          error: `Monthly deletion limit reached. You can only delete ${canDelete.limit} posts per month.`,
          limitReached: true,
          currentMonthDeletions: canDelete.currentCount,
          monthlyLimit: canDelete.limit,
          requiresAdminApproval: true
        });
      }

      const deleted = await Post.delete(id);

      if (deleted) {
        // Track deletion in user's monthly count
        const newCount = await postController._trackUserDeletion(userId);
        
        // Notify user if they're approaching or reached limit
        await postController._notifyUserDeletionCount(userId, newCount);

        res.json({
          success: true,
          message: 'Post deleted successfully!',
          deletionInfo: {
            currentMonthDeletions: newCount,
            monthlyLimit: canDelete.limit,
            remainingDeletions: canDelete.limit - newCount
          }
        });
      } else {
        throw new Error('Failed to delete post');
      }
    } catch (error) {
      console.error('Delete post error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error deleting post'
      });
    }
  },

  // Get all active posts for bulletin board
  getActivePosts: async (req, res) => {
    try {
      const posts = await Post.getAllActive();
      res.json({ success: true, posts });
    } catch (error) {
      console.error('Get posts error:', error);
      res.status(500).json({ success: false, error: 'Server error fetching posts' });
    }
  },

  // Get user's own posts
  getMyPosts: async (req, res) => {
    try {
      const posts = await Post.getByUserId(req.user.id);
      res.json({ success: true, posts });
    } catch (error) {
      console.error('Get my posts error:', error);
      res.status(500).json({ success: false, error: 'Server error fetching posts' });
    }
  },

  // Get categories and barangays for dropdowns
  getFormData: async (req, res) => {
    try {
      const [categories, barangays, puroks] = await Promise.all([
        Category.getAll(),
        Barangay.getAll(),
        Purok.getAll() 
      ]);

      res.json({ success: true, categories, barangays, puroks });
    } catch (error) {
      console.error('Get form data error:', error);
      res.status(500).json({ success: false, error: 'Server error fetching form data' });
    }
  },

  // Get user's monthly deletion stats
  getUserDeletionStats: async (req, res) => {
    try {
      const userId = req.user.id;
      const stats = await postController._getUserDeletionStats(userId);
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Get user deletion stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error fetching deletion statistics'
      });
    }
  },

  // Notify admins when user marks post as resolved
  _notifyAdminsPostResolved: async (postId, post, user) => {
    try {
      const adminUsers = await db('users').where('role', 'admin').select('id', 'email', 'first_name');
      const currentTime = new Date();
      const notificationsToInsert = [];

      for (const admin of adminUsers) {
        const notificationData = {
          user_id: admin.id,
          title: 'Post Marked as Resolved',
          message: `User ${user.first_name} ${user.last_name} marked post "${post.title}" as resolved`,
          type: 'post_resolved_by_user',
          metadata: JSON.stringify({
            post_id: postId,
            post_title: post.title,
            resolved_by_user_id: user.id,
            resolved_by_user_name: `${user.first_name} ${user.last_name}`,
            resolved_at: currentTime
          }),
          is_read: false,
          created_at: currentTime
        };
        notificationsToInsert.push(notificationData);
      }

      if (notificationsToInsert.length > 0) {
        await db('notifications').insert(notificationsToInsert);
      }

      console.log(`✅ Notified ${adminUsers.length} admins about resolved post ${postId}`);
    } catch (error) {
      console.error('Error notifying admins about resolved post:', error);
    }
  },

  // Check user's monthly deletion limit
  _checkDeletionLimit: async (userId) => {
    try {
      const MONTHLY_DELETION_LIMIT = 3; // 3 posts per month
      
      // Get current month and year
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1-12
      const currentYear = now.getFullYear();
      
      // Get user's deletion count for current month
      const result = await db('user_post_deletions')
        .where('user_id', userId)
        .where('month', currentMonth)
        .where('year', currentYear)
        .first();
      
      const currentCount = result ? result.deletion_count : 0;
      
      return {
        allowed: currentCount < MONTHLY_DELETION_LIMIT,
        currentCount,
        limit: MONTHLY_DELETION_LIMIT
      };
    } catch (error) {
      console.error('Error checking deletion limit:', error);
      // In case of error, allow deletion to not block users
      return { allowed: true, currentCount: 0, limit: 3 };
    }
  },

  // Track user deletion in monthly count
  _trackUserDeletion: async (userId) => {
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      // Check if record exists for this month
      const existingRecord = await db('user_post_deletions')
        .where('user_id', userId)
        .where('month', currentMonth)
        .where('year', currentYear)
        .first();
      
      let newCount;
      
      if (existingRecord) {
        // Increment existing count
        await db('user_post_deletions')
          .where('id', existingRecord.id)
          .increment('deletion_count', 1);
        
        newCount = existingRecord.deletion_count + 1;
      } else {
        // Create new record
        await db('user_post_deletions').insert({
          user_id: userId,
          month: currentMonth,
          year: currentYear,
          deletion_count: 1,
          created_at: now,
          updated_at: now
        });
        
        newCount = 1;
      }
      
      console.log(`✅ Tracked deletion for user ${userId}, month ${currentMonth}/${currentYear}, count: ${newCount}`);
      return newCount;
    } catch (error) {
      console.error('Error tracking user deletion:', error);
      return 0;
    }
  },

  // Get user's deletion statistics
  _getUserDeletionStats: async (userId) => {
    try {
      const MONTHLY_DELETION_LIMIT = 3;
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      // Get current month's deletion count
      const result = await db('user_post_deletions')
        .where('user_id', userId)
        .where('month', currentMonth)
        .where('year', currentYear)
        .first();
      
      const currentCount = result ? result.deletion_count : 0;
      const remaining = MONTHLY_DELETION_LIMIT - currentCount;
      
      return {
        currentMonthDeletions: currentCount,
        monthlyLimit: MONTHLY_DELETION_LIMIT,
        remainingDeletions: remaining,
        limitReached: currentCount >= MONTHLY_DELETION_LIMIT
      };
    } catch (error) {
      console.error('Error getting user deletion stats:', error);
      return {
        currentMonthDeletions: 0,
        monthlyLimit: 3,
        remainingDeletions: 3,
        limitReached: false
      };
    }
  },

  // Notify user when deletion limit is reached
  _notifyUserDeletionLimitReached: async (userId, limitInfo) => {
    try {
      const currentTime = new Date();
      const user = await db('users').where('id', userId).select('first_name', 'last_name').first();
      
      if (!user) return;

      const notificationData = {
        user_id: userId,
        title: 'Monthly Deletion Limit Reached',
        message: `You have reached your monthly deletion limit of ${limitInfo.limit} posts. You cannot delete more posts this month. The limit will reset at the start of next month.`,
        type: 'deletion_limit_reached',
        metadata: JSON.stringify({
          current_deletions: limitInfo.currentCount,
          monthly_limit: limitInfo.limit,
          limit_reached_at: currentTime,
          reset_month: currentTime.getMonth() + 2 > 12 ? 1 : currentTime.getMonth() + 2,
          reset_year: currentTime.getMonth() + 2 > 12 ? currentTime.getFullYear() + 1 : currentTime.getFullYear()
        }),
        is_read: false,
        created_at: currentTime
      };

      await db('notifications').insert(notificationData);
      
      console.log(`✅ Notified user ${userId} about deletion limit reached: ${limitInfo.currentCount}/${limitInfo.limit}`);
    } catch (error) {
      console.error('Error notifying user about deletion limit:', error);
    }
  },

  // Notify user about their current deletion count
  _notifyUserDeletionCount: async (userId, newCount) => {
    try {
      const MONTHLY_DELETION_LIMIT = 3;
      const currentTime = new Date();
      const user = await db('users').where('id', userId).select('first_name', 'last_name').first();
      
      if (!user) return; 

      let notificationData;

      if (newCount === MONTHLY_DELETION_LIMIT) {
        // User just reached the limit
        notificationData = {
          user_id: userId,
          title: 'Monthly Deletion Limit Reached',
          message: `You have reached your monthly deletion limit of ${MONTHLY_DELETION_LIMIT} posts. You cannot delete more posts this month. The limit will reset at the start of next month.`,
          type: 'deletion_limit_reached',
          metadata: JSON.stringify({
            current_deletions: newCount,
            monthly_limit: MONTHLY_DELETION_LIMIT,
            limit_reached_at: currentTime
          }),
          is_read: false,
          created_at: currentTime
        };
      } else if (newCount === MONTHLY_DELETION_LIMIT - 1) {
        // User has one deletion left
        notificationData = {
          user_id: userId,
          title: 'One Deletion Remaining',
          message: `You have 1 deletion remaining this month. You can delete ${MONTHLY_DELETION_LIMIT - newCount} more post(s) this month.`,
          type: 'deletion_warning',
          metadata: JSON.stringify({
            current_deletions: newCount,
            monthly_limit: MONTHLY_DELETION_LIMIT, 
            remaining_deletions: MONTHLY_DELETION_LIMIT - newCount
          }),
          is_read: false,
          created_at: currentTime
        };
      } else {
        // Regular deletion notification
        notificationData = {
          user_id: userId,
          title: 'Post Deleted',
          message: `Your post has been deleted. You have ${MONTHLY_DELETION_LIMIT - newCount} deletion(s) remaining this month.`,
          type: 'post_deleted',
          metadata: JSON.stringify({
            current_deletions: newCount,
            monthly_limit: MONTHLY_DELETION_LIMIT,
            remaining_deletions: MONTHLY_DELETION_LIMIT - newCount
          }),
          is_read: false,
          created_at: currentTime
        };
      }

      await db('notifications').insert(notificationData);
      
      console.log(`✅ Notified user ${userId} about deletion count: ${newCount}/${MONTHLY_DELETION_LIMIT}`);
    } catch (error) {
      console.error('Error notifying user about deletion count:', error);
    }
  }

};

module.exports = postController;