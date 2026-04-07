const pool = require('../../config/database');
const bcrypt = require('bcryptjs');

class EmployeeController {
    async getAllEmployees(req, res) {
        try {
            const { search, is_active } = req.query;
            
            let query = `
                SELECT id, user_id, name, email, designation, role, phone, is_active, created_at
                FROM users
                WHERE 1=1
            `;
            const params = [];
            
            // Filter by is_active
            if (is_active !== undefined && is_active !== '') {
                query += ` AND is_active = ?`;
                params.push(parseInt(is_active));
            }
            
            if (search) {
                query += ` AND (name LIKE ? OR email LIKE ? OR user_id LIKE ?)`;
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }
            
            query += ` ORDER BY created_at DESC`;
            
            const [employees] = await pool.query(query, params);
            
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
            
            const [employees] = await pool.query(
                `SELECT id, user_id, name, email, designation, role, phone, is_active, created_at
                 FROM users WHERE id = ?`,
                [id]
            );
            
            if (employees.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }
            
            res.status(200).json({
                success: true,
                data: employees[0]
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
            
            // is_active validation
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
            
            // Check if email exists
            const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
            if (existing.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered'
                });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Generate shorter employee ID
            // Get the last employee ID to determine the next sequential number
            const [lastEmployee] = await pool.query(
                "SELECT user_id FROM users WHERE user_id LIKE 'E%' ORDER BY id DESC LIMIT 1"
            );
            
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
            
            const [result] = await pool.query(
                `INSERT INTO users (user_id, name, email, password, designation, role, phone, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, name, email, hashedPassword, designation || 'Sales Executive', 
                 role || 'salesperson', phone || null, is_active]
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
            
            params.push(id);
            await pool.query(
                `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
                params
            );
            
            // Fetch updated employee data
            const [updatedEmployee] = await pool.query(
                `SELECT id, user_id, name, email, designation, role, phone, is_active
                 FROM users WHERE id = ?`,
                [id]
            );
            
            res.status(200).json({
                success: true,
                message: 'Employee updated successfully',
                data: updatedEmployee[0]
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
            
            // Check if employee exists
            const [employee] = await pool.query('SELECT id, is_active FROM users WHERE id = ?', [id]);
            if (employee.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }
            
            // Soft delete - set is_active to 0 (inactive)
            await pool.query('UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?', [id]);
            
            res.status(200).json({
                success: true,
                message: 'Employee deactivated successfully',
                data: {
                    id: parseInt(id),
                    previous_status: employee[0].is_active,
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
            
            // Check if employee exists
            const [employee] = await pool.query('SELECT id, is_active FROM users WHERE id = ?', [id]);
            if (employee.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }
            
            // Activate employee - set is_active to 1
            await pool.query('UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?', [id]);
            
            res.status(200).json({
                success: true,
                message: 'Employee activated successfully',
                data: {
                    id: parseInt(id),
                    previous_status: employee[0].is_active,
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