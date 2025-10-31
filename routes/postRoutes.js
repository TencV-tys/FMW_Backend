const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authMiddleware } = require('../middleware/authMiddleware');
const upload = require('../config/multer');

// Get categories and barangays for form
router.get('/posts/form-data', postController.getFormData);

// Create new post
router.post('/posts', authMiddleware, upload.single('photo'), postController.createPost);

// Get all active posts for bulletin board
router.get('/posts/active', postController.getActivePosts);

// Get user's own posts
router.get('/posts/my-posts', authMiddleware, postController.getMyPosts);

// 🎯 FIX: Get user deletion statistics - MUST COME BEFORE :id routes!
router.get('/posts/my-deletion-stats', authMiddleware, postController.getUserDeletionStats);

// Update post status (mark as resolved)
router.put('/posts/:id/status', authMiddleware, postController.updatePostStatus);

// Delete post permanently
router.delete('/posts/:id', authMiddleware, postController.deletePost);

// Update post
router.put('/posts/:id', authMiddleware, upload.single('photo'), postController.updatePost);

// Get single post for editing
router.get('/posts/:id', authMiddleware, postController.getPostById);

module.exports = router;