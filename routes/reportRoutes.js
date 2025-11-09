// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Report routes - ADMIN ONLY ROUTES (authMiddleware FIRST, then adminMiddleware)
router.get('/admin/reports', authMiddleware, adminMiddleware, reportController.getAllReports);
router.delete('/admin/reports/:id', authMiddleware, adminMiddleware, reportController.deleteReport);
router.get('/admin/reports/status/:status', authMiddleware, adminMiddleware, reportController.getReportsByStatus);
router.put('/admin/reports/:id/status', authMiddleware, adminMiddleware, reportController.updateReportStatus);

// Report routes - USER ROUTES (only authMiddleware)
router.post('/reports', authMiddleware, reportController.submitReport);
router.get('/reports/my-reports', authMiddleware, reportController.getUserReports);
router.delete('/reports/my-reports/:id', authMiddleware, reportController.deleteUserReport);
router.put('/reports/my-reports/:id', authMiddleware, reportController.updateUserReport); 

module.exports = router;      