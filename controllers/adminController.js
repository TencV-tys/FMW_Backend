const db = require('../config/db');
const Post = require('../models/Post');
const Notification = require('../models/Notification');

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

  // Remove post from public view - UPDATED with reason
  removePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {}; // Get reason from request body

      // Update post with status and reason
      await db('posts')
        .where('id', id)
        .update({ 
          status: 'Removed',
          reason: reason || 'Post removed by administrator', // Store the reason
          updated_at: new Date()
        });
     
      // Send notification to post owner with reason
      await Notification.createPostActionNotification(
        id, 
        'removed', 
        req.user.id,
        reason || 'Post removed by administrator'
      );
    
      res.json({ success: true, message: 'Post removed from public view' });
    } catch (error) {
      console.error('Remove post error:', error);
      res.status(500).json({ success: false, error: 'Server error removing post' });
    }
  },

  // Delete post permanently - UPDATED with reason
   // Delete post permanently - FIXED
deletePost: async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

  
    
    // 1. Get the post FIRST with all needed information
    const post = await db('posts')
      .where('posts.id', id)
      .join('users', 'posts.user_id', 'users.id')
      .select('posts.*', 'users.first_name', 'users.last_name')
      .first();
    
    if (!post) {
     
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    console.log('Post found - Owner ID:', post.user_id, 'Title:', post.title);

    // 2. Delete the post
    await db('posts').where('id', id).delete();
   

    // 3. Create notification using the post data we already fetched
    const notificationData = {
      user_id: post.user_id,
      title: 'Post Deleted',
      message: `The post "${post.title}" has been permanently deleted ${reason ? `. Reason: ${reason}` : ''}`,
      type: 'post_deleted',
      metadata: JSON.stringify({
        post_id: id,
        action: 'deleted',
        admin_id: req.user.id,
        reason: reason || 'Post permanently deleted by administrator',
        post_title: post.title
      }),
      is_read: false
    };

    
    const notificationResult = await db('notifications').insert(notificationData);
    

    res.json({ success: true, message: 'Post deleted permanently' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, error: 'Server error deleting post' });
  }
},

  // Resolve post - UPDATED with optional reason
  resolvePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {}; // Optional reason for resolution
      
      await db('posts')
        .where('id', id)
        .update({ 
          status: 'Resolved',
          reason: reason || 'Post marked as resolved by administrator', // Store reason
          updated_at: new Date()
      });
      
      // Send notification to post owner
      await Notification.createPostActionNotification(
        id, 
        'resolved', 
        req.user.id,
        reason || 'Post marked as resolved by administrator'
      );

      res.json({ success: true, message: 'Post marked as resolved' });
    } catch (error) {
      console.error('Resolve post error:', error);
      res.status(500).json({ success: false, error: 'Server error resolving post' });
    }
  },

  // Restore post - UPDATED (clear reason when restoring)
  restorePost: async (req, res) => {
    try {
      const { id } = req.params;
      
      await db('posts')
        .where('id', id)
        .update({ 
          status: 'Active',
          reason: null, // Clear the reason when restoring
          updated_at: new Date()
        });

      // Send notification to post owner
      await Notification.createPostActionNotification(
        id, 
        'restored', 
        req.user.id
      );

      res.json({ success: true, message: 'Post restored successfully' });
    } catch (error) {
      console.error('Restore post error:', error);
      res.status(500).json({ success: false, error: 'Server error restoring post' });
    }
  },
};

module.exports = adminController;