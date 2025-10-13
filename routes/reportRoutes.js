// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const notificationController = require('../controllers/notificationController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Report routes
router.post('/reports', authMiddleware, reportController.submitReport);
router.get('/reports', authMiddleware, adminMiddleware, reportController.getAllReports);
router.get('/reports/status/:status', authMiddleware, adminMiddleware, reportController.getReportsByStatus);
router.put('/reports/:id/status', authMiddleware, adminMiddleware, reportController.updateReportStatus);
router.get('/reports/my-reports', authMiddleware, reportController.getUserReports);

// Notification routes
router.get('/notifications', authMiddleware, notificationController.getUserNotifications);
router.put('/notifications/:id/read', authMiddleware, notificationController.markAsRead);
router.put('/notifications/read-all', authMiddleware, notificationController.markAllAsRead);
router.get('/notifications/unread-count', authMiddleware, notificationController.getUnreadCount);

module.exports = router;