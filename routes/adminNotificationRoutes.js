// routes/adminNotificationRoutes.js
const express = require('express');
const router = express.Router();
const adminNotificationController = require('../controllers/adminNotificationController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Admin notification routes
router.get('/admin/notifications', authMiddleware, adminMiddleware, adminNotificationController.getAllNotifications);
router.get('/admin/notifications/type/:type', authMiddleware, adminMiddleware, adminNotificationController.getNotificationsByType);
router.get('/admin/notifications/stats', authMiddleware, adminMiddleware, adminNotificationController.getNotificationStats);
router.delete('/admin/notifications/:id', authMiddleware, adminMiddleware, adminNotificationController.deleteNotification);
router.delete('/admin/notifications', authMiddleware, adminMiddleware, adminNotificationController.clearAllNotifications);

module.exports = router;