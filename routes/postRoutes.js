const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authMiddleware } = require('../middleware/authMiddleware');
// const upload = require('../config/multer'); // Uncomment when you set up multer

// Get categories and barangays for form
router.get('/posts/form-data', postController.getFormData);

// Create new post
router.post('/posts', authMiddleware, /* upload.single('photo'), */ postController.createPost);

// Get all active posts for bulletin board
router.get('/posts/active', postController.getActivePosts);

// Get user's own posts
router.get('/posts/my-posts', authMiddleware, postController.getMyPosts);

module.exports = router;