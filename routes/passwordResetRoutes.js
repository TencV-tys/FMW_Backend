// routes/passwordResetRoutes.js
const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/passwordResetController');

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', passwordResetController.requestReset);

// POST /api/auth/verify-reset-token - Verify reset token
router.post('/verify-reset-token', passwordResetController.verifyResetToken);

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', passwordResetController.resetPassword);

module.exports = router;