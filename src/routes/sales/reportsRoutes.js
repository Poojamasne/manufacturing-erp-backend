const express = require('express');
const router = express.Router();
const reportsController = require('../../controllers/sales/reportsController');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);

router.get('/data', reportsController.getReportData);  
router.get('/export', reportsController.exportReport);  

module.exports = router;