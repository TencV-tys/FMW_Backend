// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Report routes
router.post('/reports', authMiddleware, reportController.submitReport);
router.get('/reports', authMiddleware, adminMiddleware, reportController.getAllReports);
router.get('/reports/my-reports', authMiddleware, reportController.getUserReports);
router.get('/reports/status/:status', authMiddleware, adminMiddleware, reportController.getReportsByStatus);
router.put('/reports/:id/status', authMiddleware, adminMiddleware, reportController.updateReportStatus);
router.delete('/reports/my-reports/:id', authMiddleware, reportController.deleteUserReport);

module.exports = router;