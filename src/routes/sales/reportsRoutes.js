const express = require('express');
const router = express.Router();
const reportsController = require('../../controllers/sales/reportsController');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);

router.get('/reports/dashboard-stats', reportsController.getDashboardStats);
router.get('/reports/revenue-trend', reportsController.getRevenueTrend);
router.get('/reports/sales-leaderboard', reportsController.getSalesLeaderboard);

module.exports = router;