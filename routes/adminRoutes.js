const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Admin post management
router.get('/admin/posts', authMiddleware, adminMiddleware, adminController.getAllPosts);
router.put('/admin/posts/:id/remove', authMiddleware, adminMiddleware, adminController.removePost);
router.put('/admin/posts/:id/restore', authMiddleware, adminMiddleware, adminController.restorePost); 
router.delete('/admin/posts/:id', authMiddleware, adminMiddleware, adminController.deletePost);
router.put('/admin/posts/:id/resolve', authMiddleware, adminMiddleware, adminController.resolvePost);

module.exports = router;