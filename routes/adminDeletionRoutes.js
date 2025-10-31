// routes/adminDeletionRoutes.js
const express = require('express');
const router = express.Router();
const adminDeletionController = require('../controllers/adminDeletionController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Admin deletion management routes
router.get('/admin/users-deletion-stats', authMiddleware, adminMiddleware, adminDeletionController.getUsersDeletionStats);
router.get('/admin/deletion-requests', authMiddleware, adminMiddleware, adminDeletionController.getDeletionRequests);
router.put('/admin/deletion-requests/:requestId/process', authMiddleware, adminMiddleware, adminDeletionController.processDeletionRequest);
router.put('/admin/users/:userId/reset-deletions', authMiddleware, adminMiddleware, adminDeletionController.resetUserDeletionCount);
router.put('/admin/users/:userId/grant-deletions', authMiddleware, adminMiddleware, adminDeletionController.grantAdditionalDeletions);

module.exports = router;