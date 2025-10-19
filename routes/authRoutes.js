const express = require('express');
const router = express.Router();
const { register, login, me, logout, checkEmail } = require('../controllers/authController'); 
router.post('/register', register);
router.post('/login', login);
router.get('/me', me);
router.post('/logout', logout);
router.get('/check-email', checkEmail); 

module.exports = router;