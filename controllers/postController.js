const Post = require('../models/Post');
const Category = require('../models/Category');
const Barangay = require('../models/Barangay');

const postController = {

   createPost: async(req,res) =>{
       try{
           const { title, description, type, category_id, barangay_id, color, contact_info } = req.body;

         const postData = {
        user_id: req.user.id,
        title,
        description,
        type,
        category_id: parseInt(category_id),
        barangay_id: parseInt(barangay_id),
        color,
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