const pool = require('../../config/database');
const bcrypt = require('bcryptjs');

class EmployeeModel {

    async getAllEmployees(search, is_active) {
        let query = `
            SELECT id, user_id, name, email, designation, role, phone, is_active, created_at
            FROM users
            WHERE 1=1
        `;
        const params = [];
        
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
        return employees;
    }


    async getEmployeeById(id) {
        const [employees] = await pool.query(
            `SELECT id, user_id, name, email, designation, role, phone, is_active, created_at
             FROM users WHERE id = ?`,
            [id]
        );
        return employees[0];
    }

    
    async checkEmailExists(email) {
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        return existing.length > 0;
    }

    
    async getLastEmployeeId() {
        const [lastEmployee] = await pool.query(
            "SELECT user_id FROM users WHERE user_id LIKE 'E%' ORDER BY id DESC LIMIT 1"
        );
        return lastEmployee;
    }


    async createEmployee(userId, name, email, hashedPassword, designation, role, phone, is_active) {
        const [result] = await pool.query(
            `INSERT INTO users (user_id, name, email, password, designation, role, phone, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, name, email, hashedPassword, designation || 'Sales Executive', 
             role || 'salesperson', phone || null, is_active]
        );
        return result;
    }

    
    async updateEmployee(id, updateFields, params) {
        params.push(id);
        await pool.query(
            `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            params
        );
    }

    
    async getEmployeeForUpdate(id) {
        const [employee] = await pool.query('SELECT id, is_active FROM users WHERE id = ?', [id]);
        return employee[0];
    }


    async deactivateEmployee(id) {
        await pool.query('UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?', [id]);
    }

   
    async activateEmployee(id) {
        await pool.query('UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?', [id]);
    }

  
    async getUpdatedEmployee(id) {
        const [updatedEmployee] = await pool.query(
            `SELECT id, user_id, name, email, designation, role, phone, is_active
             FROM users WHERE id = ?`,
            [id]
        );
        return updatedEmployee[0];
    }
}

module.exports = EmployeeModel;