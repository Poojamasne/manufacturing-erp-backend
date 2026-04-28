const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class AuthModel {
    static async findByEmail(email) {
        try {
            console.log('AuthModel.findByEmail - Searching for:', email);
            const [rows] = await pool.query(
                'SELECT * FROM employees WHERE email = ? AND is_active = 1',
                [email]
            );
            console.log('Query result rows:', rows.length);
            if (rows.length > 0) {
                console.log('User found:', rows[0].email, 'Role:', rows[0].role);
            } else {
                console.log('No user found with email:', email);
            }
            return rows[0] || null;
        } catch (error) {
            console.error('Error finding user:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.query(
                'SELECT id, employee_id, name, email, designation, role, phone, is_active, last_login, created_at FROM employees WHERE id = ? AND is_active = 1',
                [id]
            );
            return rows[0] || null;
        } catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }

    static async updateLastLogin(id) {
        try {
            await pool.query(
                'UPDATE employees SET last_login = NOW() WHERE id = ?',
                [id]
            );
            console.log('Last login updated for user ID:', id);
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        try {
            console.log(' Verifying password...');
            console.log('   Plain password length:', plainPassword.length);
            console.log('   Hashed password length:', hashedPassword.length);
            const isValid = await bcrypt.compare(plainPassword, hashedPassword);
            console.log('   Password verification result:', isValid ? 'SUCCESS ' : 'FAILED ');
            return isValid;
        } catch (error) {
            console.error('Error verifying password:', error);
            return false;
        }
    }

    static async hashPassword(password) {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    }

    static async createUser(userData) {
        try {
            const hashedPassword = await this.hashPassword(userData.password);
            const [result] = await pool.query(
                'INSERT INTO employees (employee_id, name, email, password, designation, role, phone, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    userData.employee_id || 'EMP' + Date.now(),
                    userData.name,
                    userData.email,
                    hashedPassword,
                    userData.designation || 'Sales Executive',
                    userData.role || 'salesperson',
                    userData.phone,
                    1
                ]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    static async updatePassword(userId, newPassword) {
        try {
            const hashedPassword = await this.hashPassword(newPassword);
            await pool.query(
                'UPDATE employees SET password = ? WHERE id = ?',
                [hashedPassword, userId]
            );
            return true;
        } catch (error) {
            console.error('Error updating password:', error);
            throw error;
        }
    }
}

module.exports = AuthModel;