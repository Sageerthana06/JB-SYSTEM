/**
 * Dedicated Expense Management Routes
 * JB GROUP (PVT) LTD — Version 3.4.0
 * Routes for business expenses, category sections, dashboard, recurring bills, and comprehensive reports.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const expenseController = require('../controllers/expenseController');

// All expense routes require authenticated management / branch staff
router.use(authenticateToken);

// 1. Expense Dashboard (Summary Telemetry, Charts, Overdue)
router.get(
  '/dashboard',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.getExpenseDashboard
);

// 1B. Business Cash Summary (Sales Payments Received, Expenses Paid, Salaries Paid, Remaining Cash)
router.get(
  '/cash-summary',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.getBusinessCashSummary
);

// 2. Comprehensive Expense Reports (Daily, Weekly, Monthly, Yearly, Category, Branch)
router.get(
  '/reports/comprehensive',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.getComprehensiveExpenseReports
);

// 3. Expense Reports (Monthly Breakdown)
router.get(
  '/reports/monthly',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.getMonthlyExpenseReport
);

// 4. Recurring Bills (Monthly Utilities & Rent Commitments)
router.get(
  '/recurring',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.getRecurringBills
);

// 5. Generate Recurring Bills for Billing Month (with previous balance carryover)
router.post(
  '/recurring/generate',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.generateRecurringBills
);

// 6. List Expenses (with filtering by category, branch, status, search, date range)
router.get(
  '/',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.getExpenses
);

// 7. Create New Expense (Paid Now or Pending / Bill)
router.post(
  '/',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.createExpense
);

// 8. Get Single Expense with complete payment history
router.get(
  '/:id',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.getExpenseById
);

// 9. Update Expense (unpaid or partially paid; amount cannot be below paidAmount)
router.put(
  '/:id',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.updateExpense
);

// 10. Record Payment for an expense (Pay full or partial)
router.post(
  '/:id/pay',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.payExpense
);

// 11. Delete / Cancel unpaid expense (strictly blocked if any payment made)
router.delete(
  '/:id',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  expenseController.deleteExpense
);

module.exports = router;
