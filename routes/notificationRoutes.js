// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/authMiddleware');

// User notification routes
router.get('/notifications', authMiddleware, notificationController.getUserNotifications);
router.put('/notifications/:id/read', authMiddleware, notificationController.markAsRead);
router.put('/notifications/read-all', authMiddleware, notificationController.markAllAsRead);
router.get('/notifications/unread-count', authMiddleware, notificationController.getUnreadCount);
router.delete('/notifications/:id', authMiddleware, notificationController.deleteNotification); 

module.exports = router;