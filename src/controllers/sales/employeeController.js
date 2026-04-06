const pool = require('../../config/database');
const bcrypt = require('bcryptjs');

class EmployeeController {
    async getAllEmployees(req, res) {
        try {
            const { search, status, page = 1, limit = 10 } = req.query;
            
            let query = `
                SELECT id, user_id, name, email, designation, role, phone, status, created_at
                FROM users
                WHERE 1=1
            `;
            const params = [];
            
            // Filter by status
            if (status !== undefined && status !== '') {
                query += ` AND status = ?`;
                params.push(parseInt(status));
            }
            
            if (search) {
                query += ` AND (name LIKE ? OR email LIKE ? OR user_id LIKE ?)`;
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }
            
            query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
            
            const [employees] = await pool.query(query, params);
            
            // Get total count with filters
            let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
            const countParams = [];
            
            if (status !== undefined && status !== '') {
                countQuery += ` AND status = ?`;
                countParams.push(parseInt(status));
            }
            
            if (search) {
                countQuery += ` AND (name LIKE ? OR email LIKE ? OR user_id LIKE ?)`;
                const searchTerm = `%${search}%`;
                countParams.push(searchTerm, searchTerm, searchTerm);
            }
            
            const [countResult] = await pool.query(countQuery, countParams);
            
            res.status(200).json({
                success: true,
                data: employees,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countResult[0].total,
                    pages: Math.ceil(countResult[0].total / limit)
                }
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
                `SELECT id, user_id, name, email, designation, role, phone, status, created_at
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
            const { name, email, password, designation, role, phone, status } = req.body;
            
            // Validate required fields including status
            if (!name || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Name, email, and password are required'
                });
            }
            
            // Status is compulsory
            if (status === undefined || status === null) {
                return res.status(400).json({
                    success: false,
                    message: 'Status is required. Use 1 for Active or 0 for Inactive'
                });
            }
            
            // Validate status value (must be 0 or 1)
            if (status !== 0 && status !== 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Status must be either 0 (Inactive) or 1 (Active)'
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
            const userId = 'EMP' + Date.now();
            
            const [result] = await pool.query(
                `INSERT INTO users (user_id, name, email, password, designation, role, phone, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, name, email, hashedPassword, designation || 'Sales Executive', 
                 role || 'salesperson', phone || null, status]
            );
            
            res.status(201).json({
                success: true,
                message: 'Employee created successfully',
                data: { 
                    id: result.insertId, 
                    user_id: userId, 
                    name, 
                    email,
                    status: status,
                    status_text: status === 1 ? 'Active' : 'Inactive'
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
            
            const allowedFields = ['name', 'designation', 'role', 'phone', 'status'];
            
            const updateFields = [];
            const params = [];
            
            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    // For status field, validate it's 0 or 1
                    if (field === 'status') {
                        const statusValue = parseInt(updates[field]);
                        if (statusValue !== 0 && statusValue !== 1) {
                            return res.status(400).json({
                                success: false,
                                message: 'Status must be either 0 (Inactive) or 1 (Active)'
                            });
                        }
                        updateFields.push(`${field} = ?`);
                        params.push(statusValue);
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
                `SELECT id, user_id, name, email, designation, role, phone, status
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
            const [employee] = await pool.query('SELECT id, status FROM users WHERE id = ?', [id]);
            if (employee.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }
            
            // Soft delete - set status to 0 (inactive)
            await pool.query('UPDATE users SET status = 0, updated_at = NOW() WHERE id = ?', [id]);
            
            res.status(200).json({
                success: true,
                message: 'Employee deactivated successfully',
                data: {
                    id: parseInt(id),
                    previous_status: employee[0].status,
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
            const [employee] = await pool.query('SELECT id, status FROM users WHERE id = ?', [id]);
            if (employee.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }
            
            // Activate employee - set status to 1
            await pool.query('UPDATE users SET status = 1, updated_at = NOW() WHERE id = ?', [id]);
            
            res.status(200).json({
                success: true,
                message: 'Employee activated successfully',
                data: {
                    id: parseInt(id),
                    previous_status: employee[0].status,
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