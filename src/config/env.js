require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || 'root@123',
    DB_NAME: process.env.DB_NAME || 'manufacturing_erp',
    JWT_SECRET: process.env.JWT_SECRET || 'your_secret_key',
    JWT_EXPIRE: process.env.JWT_EXPIRE || '24h'
};
