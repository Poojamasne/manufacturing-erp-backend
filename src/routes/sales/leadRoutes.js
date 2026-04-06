const express = require('express');
const router = express.Router();
const leadController = require('../../controllers/sales/leadController');
const { authenticate, authorize } = require('../../middleware/auth');
const { validateLeadCreation } = require('../../middleware/validation');

router.use(authenticate);

router.post('/leads', validateLeadCreation, leadController.createLead);
router.get('/leads', leadController.getAllLeads);
router.get('/leads/:id', leadController.getLeadById);
router.put('/leads/:id', leadController.updateLead);
router.delete('/leads/:id', authorize('admin', 'manager'), leadController.deleteLead);
router.get('/products', leadController.getAllProducts);

module.exports = router;