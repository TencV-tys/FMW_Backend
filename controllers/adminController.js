const db = require('../config/db');
const Post = require('../models/Post');

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
      await Post.remove(id);
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
      await Post.delete(id);
      res.json({ success: true, message: 'Post deleted permanently' });
    } catch (error) {
      console.error('Delete post error:', error);
      res.status(500).json({ success: false, error: 'Server error deleting post' });
    }
  }
};

module.exports = adminController;