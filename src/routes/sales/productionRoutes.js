const express = require('express');
const router = express.Router();
const productionController = require('../../controllers/sales/productionController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.get('/production/jobs', productionController.getAllJobs);
router.get('/production/jobs/:id', productionController.getJobById);
router.put('/production/jobs/:id', productionController.updateJob);
router.delete('/production/jobs/:id', authorize('admin', 'manager'), productionController.deleteJob);

module.exports = router;