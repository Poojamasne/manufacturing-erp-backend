const express = require('express');
const router = express.Router();
const reportsController = require('../../controllers/sales/reportsController');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);

router.get('/reports', reportsController.getReportData);
router.get('/reports/export', reportsController.exportReport);

module.exports = router;