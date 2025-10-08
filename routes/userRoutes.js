const express = require('express');

const router = express.Router();

const { getAllUsers, deleted } = require('../controllers/userController');

router.get('/users',getAllUsers);
router.delete('/users/:id',deleted);

module.exports = router;