const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salaryController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// All salary routes require authentication
router.use(authenticateToken);

// 1. Weekly Tailor Salary Report (CEO, Manager, and Admin)
router.get(
  '/weekly-report',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  salaryController.getWeeklySalaryReport
);

// 2. Individual Tailor Salary (Tailor self-service; scoped to own ID)
router.get(
  '/my-salary',
  authorizeRoles('TAILOR', 'CUTTING', 'EMBROIDERY', 'STAFF', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  salaryController.getMySalary
);

// 3. Record Actual Salary Payment (Disbursement restricted strictly to CEO and MANAGER; ADMIN blocked)
router.post(
  '/record-payment',
  authorizeRoles('MANAGER'), // SUPER_ADMIN automatically passes; ADMIN and others blocked
  salaryController.recordSalaryPayment
);
router.post(
  '/pay',
  authorizeRoles('MANAGER'),
  salaryController.recordSalaryPayment
);

// 4. Payment History & Audit Ledger (Scoped by role & branch)
router.get(
  '/payment-history',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TAILOR', 'CUTTING', 'EMBROIDERY'),
  salaryController.getSalaryPaymentHistory
);

module.exports = router;
