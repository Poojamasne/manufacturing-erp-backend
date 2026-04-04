const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const env = require('../config/env');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('Login attempt:', { email, passwordProvided: !!password });
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        
        // Query user from USERS table (not employees)
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND is_active = 1',
            [email]
        );
        
        console.log('User found:', users.length > 0 ? users[0].email : 'No user');
        
        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        const user = users[0];
        
        // Compare password
        let isValidPassword = false;
        
        // Check if password is bcrypt hash
        if (user.password && user.password.startsWith('$2a$')) {
            isValidPassword = await bcrypt.compare(password, user.password);
            console.log('Bcrypt comparison result:', isValidPassword);
        } else {
            // Plain text password
            isValidPassword = (password === user.password);
            console.log('Plain text comparison result:', isValidPassword);
        }
        
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        // Update last login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        
        // Generate token
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                name: user.name,
                user_id: user.user_id
            },
            env.JWT_SECRET,
            { expiresIn: env.JWT_EXPIRE }
        );
        
        const userData = {
            id: user.id,
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            role: user.role,
            designation: user.designation,
            phone: user.phone
        };
        
        res.json({
            success: true,
            message: 'Login successful',
            data: { user: userData, token }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

const getProfile = async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, user_id, name, email, designation, role, phone, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            data: { user: users[0] }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
};

// Debug function to see users
const debugUsers = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, user_id, name, email, role, password FROM users');
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = { login, getProfile, debugUsers };