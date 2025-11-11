// routes/resolutionRoutes.js
const express = require('express');
const router = express.Router();
const resolutionController = require('../controllers/resolutionController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const upload = require('../config/multer');

// User routes - Submit resolution request and get user's requests
router.post('/posts/:id/resolution-request', authMiddleware, upload.single('resolution_photo'), resolutionController.submitResolutionRequest);
router.get('/user/resolution-requests', authMiddleware, resolutionController.getUserResolutionRequests);

// Admin routes - Manage resolution requests
router.get('/admin/resolution-requests/pending', authMiddleware, adminMiddleware, resolutionController.getPendingResolutionRequests);
router.put('/admin/resolution-requests/:requestId/approve', authMiddleware, adminMiddleware, resolutionController.approveResolutionRequest);
router.put('/admin/resolution-requests/:requestId/reject', authMiddleware, adminMiddleware, resolutionController.rejectResolutionRequest);
 
module.exports = router;