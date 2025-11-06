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
router.get('/feedback', authMiddleware, adminMiddleware, feedbackController.getAllFeedback);
router.get('/feedback/stats', authMiddleware, adminMiddleware, feedbackController.getFeedbackStats);
router.get('/feedback/status/:status', authMiddleware, adminMiddleware, feedbackController.getFeedbackByStatus);
router.get('/feedback/:id', authMiddleware, adminMiddleware, feedbackController.getFeedbackById);
router.put('/feedback/:id/status', authMiddleware, adminMiddleware, feedbackController.updateFeedbackStatus);
router.delete('/feedback/:id', authMiddleware, adminMiddleware, feedbackController.deleteFeedback);

module.exports = router;