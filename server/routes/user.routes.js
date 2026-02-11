const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { getUsers } = require('../controllers/user.controller');
const router = express.Router();

router.use(protect);

router.get('/users', getUsers);

module.exports = router;
