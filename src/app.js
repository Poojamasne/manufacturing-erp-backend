const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/sales/leadRoutes');
const opportunityRoutes = require('./routes/sales/opportunityRoutes');
const quotationRoutes = require('./routes/sales/quotationRoutes');
const orderRoutes = require('./routes/sales/orderRoutes');
const productionRoutes = require('./routes/sales/productionRoutes');
const employeeRoutes = require('./routes/sales/employeeRoutes');
const reportsRoutes = require('./routes/sales/reportsRoutes');
const dashboardRoutes = require('./routes/sales/dashboardRoutes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS configuration
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://manufacturing-erp-zonixtec.vercel.app',
        'https://your-frontend-domain.vercel.app',
        'https://manufacturing-erp-frontend-eta.vercel.app' 
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Routes - IMPORTANT: Order matters
app.use('/api/auth', authRoutes);
app.use('/api/sales', leadRoutes);
app.use('/api/sales', opportunityRoutes);
app.use('/api/sales', quotationRoutes);
app.use('/api/sales', orderRoutes);
app.use('/api/sales', productionRoutes);
app.use('/api/sales', employeeRoutes);
app.use('/api/sales', reportsRoutes);
app.use('/api/sales', dashboardRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Server is running', timestamp: new Date().toISOString() });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.originalUrl}`,
        availableEndpoints: [
            'POST /api/auth/login',
            'GET /api/auth/profile',
            'GET /api/sales/leads',
            'POST /api/sales/leads',
            'GET /api/sales/opportunities',
            'GET /api/sales/quotations',
            'GET /api/sales/orders',
            'GET /api/sales/production/jobs',
            'GET /api/sales/employees',
            'GET /api/sales/dashboard',
            'GET /api/sales/reports/dashboard-stats'
        ]
    });
});

// Error handler
app.use(errorHandler);

module.exports = app;