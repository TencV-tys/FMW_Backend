const express = require('express');

const router = express.Router();

const { getAllUsers, deleted } = require('../controllers/userController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');


router.get('/users',authMiddleware,adminMiddleware, getAllUsers);
router.delete('/users/:id',authMiddleware,adminMiddleware, deleted);

module.exports = router;