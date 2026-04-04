const express = require('express');
const router = express.Router();
const quotationController = require('../../controllers/sales/quotationController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.post('/quotations', quotationController.createQuotation);
router.get('/quotations', quotationController.getAllQuotations);
router.get('/quotations/:id', quotationController.getQuotationById);
router.put('/quotations/:id', quotationController.updateQuotation);
router.delete('/quotations/:id', authorize('admin', 'manager'), quotationController.deleteQuotation);

module.exports = router;