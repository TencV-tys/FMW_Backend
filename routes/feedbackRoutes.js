const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// Public routes (anonymous feedback allowed)
router.post('/feedback', feedbackController.submitFeedback); // No auth required for anonymous feedback

// User routes (for logged-in users to view their own feedback)
router.get('/feedback/my-feedback', authMiddleware, feedbackController.getUserFeedback);

// Admin routes
router.get('/feedback', authMiddleware, adminMiddleware, feedbackController.getAllFeedback);
router.get('/feedback/stats', authMiddleware, adminMiddleware, feedbackController.getFeedbackStats);
router.get('/feedback/status/:status', authMiddleware, adminMiddleware, feedbackController.getFeedbackByStatus);
router.get('/feedback/:id', authMiddleware, adminMiddleware, feedbackController.getFeedbackById);
router.put('/feedback/:id/status', authMiddleware, adminMiddleware, feedbackController.updateFeedbackStatus);
router.put('/feedback/:id/assign', authMiddleware, adminMiddleware, feedbackController.assignFeedback);

module.exports = router;