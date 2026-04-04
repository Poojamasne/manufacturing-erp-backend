const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/sales/orderController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.post('/orders', orderController.createOrder);
router.get('/orders', orderController.getAllOrders);
router.get('/orders/:id', orderController.getOrderById);
router.put('/orders/:id', orderController.updateOrder);
router.delete('/orders/:id', authorize('admin', 'manager'), orderController.deleteOrder);

module.exports = router;