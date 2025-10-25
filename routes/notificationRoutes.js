// routes/notificationRoutes.js - FINAL CLEAN VERSION
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/authMiddleware');

// User notification routes - CORRECT ORDER
router.delete('/notifications/delete-all', authMiddleware, notificationController.deleteAllNotifications);
router.delete('/notifications/:id', authMiddleware, notificationController.deleteNotification);
router.get('/notifications', authMiddleware, notificationController.getUserNotifications);
router.put('/notifications/:id/read', authMiddleware, notificationController.markAsRead);
router.put('/notifications/read-all', authMiddleware, notificationController.markAllAsRead);
router.get('/notifications/unread-count', authMiddleware, notificationController.getUnreadCount);

module.exports = router;