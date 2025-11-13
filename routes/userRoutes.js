const express = require('express');
const router = express.Router();
const { 
  getAllUsers, 
  deleted,  
  getUsersStats, 
  updateUserStatus,
  updateProfile,
  getProfile,  
  getUserPostStats,
   getUsersWithReportStats,
   sendUserWarning,
   restoreUser
} = require('../controllers/userController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const upload = require('../config/multer'); // Make sure multer is imported
 
//  User profile routes (regular users)
router.get('/users/profile', authMiddleware, getProfile);
router.put('/users/profile', authMiddleware, upload.single('profile_photo'), updateProfile);

// User management routes (admin only)
router.get('/admin/users', authMiddleware, adminMiddleware, getAllUsers);
router.get('/admin/users/stats', authMiddleware, adminMiddleware, getUsersStats);
router.get('/admin/users-with-reports', authMiddleware, adminMiddleware, getUsersWithReportStats); 
router.post('/admin/send-user-warning', authMiddleware, adminMiddleware,sendUserWarning);
router.put('/admin/users/:id/restore', authMiddleware, adminMiddleware, restoreUser);
router.delete('/admin/users/:id', authMiddleware, adminMiddleware, deleted);

//  post statistics (for profile page)
router.get('/users/post-stats', authMiddleware, getUserPostStats);
router.put('/users/:id/status', authMiddleware, adminMiddleware, updateUserStatus);
 
module.exports = router;     