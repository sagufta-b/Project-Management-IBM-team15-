const express = require('express');
const { register, login, getMe, googleLogin } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', protect, (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
    }
    next();
}, register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', protect, getMe);

module.exports = router;
