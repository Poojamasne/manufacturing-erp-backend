const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login', authController.login);
router.get('/profile', authenticate, authController.getProfile);
router.get('/debug-users', authController.debugUsers); 

module.exports = router;