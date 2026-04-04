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

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
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
    res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Error handler
app.use(errorHandler);

module.exports = app;