const pool = require('../../config/database');
const bcrypt = require('bcryptjs');
const EmployeeModel = require('../../models/sales/employeeModel');

class EmployeeController {
    async getAllEmployees(req, res) {
        try {
            const { search, is_active } = req.query;
            
            const employeeModel = new EmployeeModel();
            const employees = await employeeModel.getAllEmployees(search, is_active);
            
            res.status(200).json({
                success: true,
                data: employees
            });
        } catch (error) {
            console.error('Error fetching employees:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching employees',
                error: error.message
            });
        }
    }
    
    async getEmployeeById(req, res) {
        try {
            const { id } = req.params;
            
            const employeeModel = new EmployeeModel();
            const employee = await employeeModel.getEmployeeById(id);
            
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }
            
            res.status(200).json({
                success: true,
                data: employee
            });
        } catch (error) {
            console.error('Error fetching employee:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching employee',
                error: error.message
            });
        }
    }
    
    async createEmployee(req, res) {
        try {
            const { name, email, password, designation, role, phone, is_active } = req.body;
            
            // Validate required fields
            if (!name || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Name, email, and password are required'
                });
            }
            
        
            if (is_active === undefined || is_active === null) {
                return res.status(400).json({
                    success: false,
                    message: 'is_active is required. Use 1 for Active or 0 for Inactive'
                });
            }
            
            // Validate is_active value (must be 0 or 1)
            if (is_active !== 0 && is_active !== 1) {
                return res.status(400).json({
                    success: false,
                    message: 'is_active must be either 0 (Inactive) or 1 (Active)'
                });
            }
            
            const employeeModel = new EmployeeModel();
            
    
            const emailExists = await employeeModel.checkEmailExists(email);
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered'
                });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Generate shorter employee ID
            const lastEmployee = await employeeModel.getLastEmployeeId();
            
            let nextNumber = 1;
            if (lastEmployee.length > 0) {
                const lastId = lastEmployee[0].user_id;
                const lastNum = parseInt(lastId.substring(1));
                if (!isNaN(lastNum)) {
                    nextNumber = lastNum + 1;
                }
            }
            
            // Format: E001, E002, E003, etc. (supports up to 999 employees)
            const userId = 'E' + nextNumber.toString().padStart(3, '0');
            
            const result = await employeeModel.createEmployee(
                userId, name, email, hashedPassword, designation, role, phone, is_active
            );
            
            res.status(201).json({
                success: true,
                message: 'Employee created successfully',
                data: { 
                    id: result.insertId, 
                    user_id: userId, 
                    name, 
                    email,
                    designation: designation || 'Sales Executive',
                    role: role || 'salesperson',
                    phone: phone || null,
                    is_active: is_active,
                    status_text: is_active === 1 ? 'Active' : 'Inactive'
                }
            });
        } catch (error) {
            console.error('Error creating employee:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating employee',
                error: error.message
            });
        }
    }
    
    async updateEmployee(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            const allowedFields = ['name', 'designation', 'role', 'phone', 'is_active'];
            
            const updateFields = [];
            const params = [];
            
            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    // For is_active field, validate it's 0 or 1
                    if (field === 'is_active') {
                        const isActiveValue = parseInt(updates[field]);
                        if (isActiveValue !== 0 && isActiveValue !== 1) {
                            return res.status(400).json({
                                success: false,
                                message: 'is_active must be either 0 (Inactive) or 1 (Active)'
                            });
                        }
                        updateFields.push(`${field} = ?`);
                        params.push(isActiveValue);
                    } else {
                        updateFields.push(`${field} = ?`);
                        params.push(updates[field]);
                    }
                }
            }
            
            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No fields to update'
                });
            }
            
            const employeeModel = new EmployeeModel();
            await employeeModel.updateEmployee(id, updateFields, params);
            
            const updatedEmployee = await employeeModel.getUpdatedEmployee(id);
            
            res.status(200).json({
                success: true,
                message: 'Employee updated successfully',
                data: updatedEmployee
            });
        } catch (error) {
            console.error('Error updating employee:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating employee',
                error: error.message
            });
        }
    }
    
    async deleteEmployee(req, res) {
        try {
            const { id } = req.params;
            
            const employeeModel = new EmployeeModel();
            
            const employee = await employeeModel.getEmployeeForUpdate(id);
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }
            
            // Soft delete - set is_active to 0 (inactive)
            await employeeModel.deactivateEmployee(id);
            
            res.status(200).json({
                success: true,
                message: 'Employee deactivated successfully',
                data: {
                    id: parseInt(id),
                    previous_status: employee.is_active,
                    current_status: 0,
                    status_text: 'Inactive'
                }
            });
        } catch (error) {
            console.error('Error deleting employee:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting employee',
                error: error.message
            });
        }
    }
    
    async activateEmployee(req, res) {
        try {
            const { id } = req.params;
            
            const employeeModel = new EmployeeModel();
            
            const employee = await employeeModel.getEmployeeForUpdate(id);
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }
            
            // Activate employee - set is_active to 1
            await employeeModel.activateEmployee(id);
            
            res.status(200).json({
                success: true,
                message: 'Employee activated successfully',
                data: {
                    id: parseInt(id),
                    previous_status: employee.is_active,
                    current_status: 1,
                    status_text: 'Active'
                }
            });
        } catch (error) {
            console.error('Error activating employee:', error);
            res.status(500).json({
                success: false,
                message: 'Error activating employee',
                error: error.message
            });
        }
    }
}

module.exports = new EmployeeController();