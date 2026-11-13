const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const userRoutes = require('./routes/userRoutes');
const customerPortalRoutes = require('./routes/customerPortalRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const salaryRoutes = require('./routes/salaryRoutes');
const reportRoutes = require('./routes/reportRoutes');
const financeRoutes = require('./routes/financeRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const actionCentreRoutes = require('./routes/actionCentreRoutes');

const { protectPaymentSlips } = require('./middleware/slipProtectionMiddleware');

const app = express();

// Trust only the local Nginx reverse proxy (127.0.0.1 / ::1)
app.set('trust proxy', 'loopback');

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enforce explicit UTF-8 charset on all API responses
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Protected payment slips interceptor (executes BEFORE public static files)
app.use('/uploads', protectPaymentSlips);

// Serve non-sensitive uploads (garment designs, reference photos) statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: "Bella Design API is running"
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customer-portal', customerPortalRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/action-centre', actionCentreRoutes);

app.use(errorHandler);

module.exports = app;
