const Post = require('../models/Post');
const Category = require('../models/Category');
const Barangay = require('../models/Barangay');
const db = require('../config/db'); // Add this import

const postController = {

  createPost: async (req, res) => {
    try {
      const { title, description, type, category_id, barangay_id, color, contact_info } = req.body;

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
        color: color || '',
        contact_info,
        photo: req.file ? req.file.filename : null
      };

      const postId = await Post.create(postData);

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

  // NEW: Get single post by ID
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
      const { title, description, type, category_id, barangay_id, color, contact_info } = req.body;

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
        color: color || '',
        contact_info,
        updated_at: new Date()
      };

      // Add photo if a new one was uploaded
      if (req.file) {
        updateData.photo = req.file.filename;
      }

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

  // Update post status
  updatePostStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      // Validate status
      const validStatuses = ['Active', 'Resolved', 'Removed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be one of: Active, Resolved, Removed'
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

      if (existingPost.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only update your own posts.'
        });
      }

      // Update post status
      const updated = await Post.update(id, {
        status: status,
        updated_at: new Date()
      });

      if (updated) {
        res.json({
          success: true,
          message: `Post status updated to ${status} successfully!`
        });
      } else {
        throw new Error('Failed to update post status');
      }
    } catch (error) {
      console.error('Update post status error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error updating post status'
      });
    }
  },

  // Delete post
  deletePost: async (req, res) => {
    try {
      const { id } = req.params;

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
          error: 'Access denied. You can only delete your own posts.'
        });
      }

      const deleted = await Post.delete(id);

      if (deleted) {
        res.json({
          success: true,
          message: 'Post deleted successfully!'
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
      const [categories, barangays] = await Promise.all([
        Category.getAll(),
        Barangay.getAll()
      ]);

      res.json({ success: true, categories, barangays });
    } catch (error) {
      console.error('Get form data error:', error);
      res.status(500).json({ success: false, error: 'Server error fetching form data' });
    }
  }

};

module.exports = postController;