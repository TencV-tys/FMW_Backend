const express = require('express');
const router = express.Router();
const { 
  getAllUsers, 
  deleted, 
  getUsersStats, 
  updateUserStatus,
  updateProfile,
  getProfile,
  getUserPostStats
} = require('../controllers/userController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const upload = require('../config/multer'); // Make sure multer is imported

//  User profile routes (regular users)
router.get('/users/profile', authMiddleware, getProfile);
router.put('/users/profile', authMiddleware, upload.single('profile_photo'), updateProfile);

// User management routes (admin only)
router.get('/users', authMiddleware, adminMiddleware, getAllUsers);
router.delete('/users/:id', authMiddleware, adminMiddleware, deleted);
router.get('/users/stats', authMiddleware, adminMiddleware, getUsersStats);
//  post statistics (for profile page)
router.get('/users/post-stats', authMiddleware, getUserPostStats);
router.put('/users/:id/status', authMiddleware, adminMiddleware, updateUserStatus);

module.exports = router;