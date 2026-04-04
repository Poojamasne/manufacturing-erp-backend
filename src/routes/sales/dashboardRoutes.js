const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/sales/dashboardController');
const { authenticate } = require('../../middleware/auth');

router.get('/dashboard', authenticate, dashboardController.getDashboardData);

module.exports = router;