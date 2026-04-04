const express = require('express');
const router = express.Router();
const employeeController = require('../../controllers/sales/employeeController');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);
router.use(authorize('admin', 'manager'));

router.get('/employees', employeeController.getAllEmployees);
router.get('/employees/:id', employeeController.getEmployeeById);
router.post('/employees', employeeController.createEmployee);
router.put('/employees/:id', employeeController.updateEmployee);
router.delete('/employees/:id', authorize('admin'), employeeController.deleteEmployee);

module.exports = router;