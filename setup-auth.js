const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function setupDatabase() {
    let connection;
    try {
        console.log('🔧 Starting database setup...\n');

        // Create connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
        });

        console.log('✅ Connected to MySQL');

        // Create employees table
        console.log('📋 Creating employees table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS employees (
                id INT PRIMARY KEY AUTO_INCREMENT,
                employee_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                designation VARCHAR(100) DEFAULT 'Sales Executive',
                role VARCHAR(50) DEFAULT 'salesperson',
                phone VARCHAR(20),
                is_active TINYINT DEFAULT 1,
                last_login TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_role (role),
                INDEX idx_created_at (created_at)
            )
        `);
        console.log('✅ Employees table created\n');

        // Hash the test password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('sales123', salt);

        // Insert test user
        console.log('👤 Adding test user...');
        try {
            await connection.query(
                `INSERT INTO employees (employee_id, name, email, password, designation, role, phone, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    'EMP001',
                    'Sales Manager',
                    'salesmanager@erp.com',
                    hashedPassword,
                    'Sales Manager',
                    'salesperson',
                    '+91-9876543210',
                    1
                ]
            );
            console.log('✅ Test user created: salesmanager@erp.com\n');
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                console.log('ℹ️  Test user already exists\n');
            } else {
                throw error;
            }
        }

        // Display database info
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM employees');
        console.log(`📊 Total employees in database: ${rows[0].count}`);

        console.log('\n✅ Database setup completed successfully!');
        console.log('\n🔐 Test Credentials:');
        console.log('   Email: salesmanager@erp.com');
        console.log('   Password: sales123');
        console.log('\n📍 You can now test login at: POST http://localhost:5000/api/auth/login');

        await connection.end();
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}

setupDatabase();
