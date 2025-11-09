const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// All feedback routes require authentication
router.post('/feedback', authMiddleware, feedbackController.submitFeedback);
router.get('/feedback/my-feedback', authMiddleware, feedbackController.getUserFeedback);
router.put('/feedback/my-feedback/:id', authMiddleware, feedbackController.updateFeedback);
router.delete('/feedback/my-feedback/:id', authMiddleware, feedbackController.deleteUserFeedback);

// Admin routes 
router.get('/admin/feedback', authMiddleware, adminMiddleware, feedbackController.getAllFeedback);
router.get('/admin/feedback/stats', authMiddleware, adminMiddleware, feedbackController.getFeedbackStats);
router.get('/admin/feedback/status/:status', authMiddleware, adminMiddleware, feedbackController.getFeedbackByStatus);
router.get('/admin/feedback/:id', authMiddleware, adminMiddleware, feedbackController.getFeedbackById);
router.put('/admin/feedback/:id/status', authMiddleware, adminMiddleware, feedbackController.updateFeedbackStatus);
router.delete('/admin/feedback/:id', authMiddleware, adminMiddleware, feedbackController.deleteFeedback);

module.exports = router; 