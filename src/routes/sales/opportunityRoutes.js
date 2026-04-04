const express = require('express');
const router = express.Router();
const opportunityController = require('../../controllers/sales/opportunityController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.post('/opportunities', opportunityController.createOpportunity);
router.get('/opportunities', opportunityController.getAllOpportunities);
router.get('/opportunities/:id', opportunityController.getOpportunityById);
router.put('/opportunities/:id', opportunityController.updateOpportunity);
router.delete('/opportunities/:id', authorize('admin', 'manager'), opportunityController.deleteOpportunity);

module.exports = router;