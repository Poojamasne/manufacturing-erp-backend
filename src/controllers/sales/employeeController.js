

const pool = require('../../config/database');
const bcrypt = require('bcryptjs');

class EmployeeController {
    async getAllEmployees(req, res) {
        try {
            const { search, page = 1, limit = 10 } = req.query;
            
            let query = `
                SELECT id, user_id, name, email, designation, role, phone, is_active, created_at
                FROM users
                WHERE 1=1
            `;
            const params = [];
            
            if (search) {
                query += ` AND (name LIKE ? OR email LIKE ? OR user_id LIKE ?)`;
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }
            
            query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
            
            const [employees] = await pool.query(query, params);
            
            const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');
            
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
            const { name, email, password, designation, role, phone } = req.body;
            
            if (!name || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Name, email, and password are required'
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
                `INSERT INTO users (user_id, name, email, password, designation, role, phone, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                [userId, name, email, hashedPassword, designation || 'Sales Executive', 
                 role || 'salesperson', phone || null]
            );
            
            res.status(201).json({
                success: true,
                message: 'Employee created successfully',
                data: { id: result.insertId, user_id: userId, name, email }
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
                    updateFields.push(`${field} = ?`);
                    params.push(updates[field]);
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
            
            res.status(200).json({
                success: true,
                message: 'Employee updated successfully'
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
            await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
            
            res.status(200).json({
                success: true,
                message: 'Employee deactivated successfully'
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
}

module.exports = new EmployeeController();