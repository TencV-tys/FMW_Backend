const express = require('express');
const router = express.Router();
const { register, login, me, logout, checkEmail } = require('../controllers/authController'); 

const passwordResetRoutes = require('./passwordResetRoutes');

// Use password reset routes
router.use('/', passwordResetRoutes);



router.post('/register', register);
router.post('/login', login);
router.get('/me', me);
router.post('/logout', logout);
router.get('/check-email', checkEmail); 

module.exports = router;