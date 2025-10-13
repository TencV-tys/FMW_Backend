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

  // Remove post from public view
  removePost: async (req, res) => {
    try {
      const { id } = req.params;
       const { reason } = req.body; // Add reason for removal

      await Post.remove(id);
     
      // Send notification to post owner
      await Notification.createPostActionNotification(
        id, 
        'removed', 
        req.user.id, 
        reason
      );
    
      res.json({ success: true, message: 'Post removed from public view' });
    } catch (error) {
      console.error('Remove post error:', error);
      res.status(500).json({ success: false, error: 'Server error removing post' });
    }
  },

  // Delete post permanently
  deletePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body; // Add reason for deletion

      await Post.delete(id);

      // Send notification to post owner
      await Notification.createPostActionNotification(
        id, 
        'deleted', 
        req.user.id, 
        reason
      );

      res.json({ success: true, message: 'Post deleted permanently' });
    } catch (error) {
      console.error('Delete post error:', error);
      res.status(500).json({ success: false, error: 'Server error deleting post' });
    }
  },
  // Resolve post
resolvePost: async (req, res) => {
  try {
    const { id } = req.params;
    
    await db('posts')
      .where('id', id)
      .update({ 
        status: 'resolved',
        updated_at: new Date()
      });
      
       // Send notification to post owner
      await Notification.createPostActionNotification(
        id, 
        'resolved', 
        req.user.id
      );
        


    res.json({ success: true, message: 'Post marked as resolved' });
  } catch (error) {
    console.error('Resolve post error:', error);
    res.status(500).json({ success: false, error: 'Server error resolving post' });
  }
},

// Restore post (add this function)
  restorePost: async (req, res) => {
    try {
      const { id } = req.params;
      
      await db('posts')
        .where('id', id)
        .update({ 
          status: 'active',  // Changed to lowercase
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