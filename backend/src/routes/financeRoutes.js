/**
 * Financial Management & Business Control Routes
 * JB GROUP (PVT) LTD — Version 3.2.0
 * Routes for accounts, transactions, payroll, advances, P&L, AR, and executive dashboard.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const financeAccountController = require('../controllers/financeAccountController');
const financeTransactionController = require('../controllers/financeTransactionController');
const payrollController = require('../controllers/payrollController');
const businessControlController = require('../controllers/businessControlController');
const monthlyBillController = require('../controllers/monthlyBillController');
const businessHealthController = require('../controllers/businessHealthController');

// All finance routes require active authenticated staff/management credentials
router.use(authenticateToken);

// ==========================================
// 1. FINANCIAL ACCOUNTS & CHART OF ACCOUNTS
// ==========================================
// List all cash drawers and bank accounts (branch-scoped)
router.get(
  '/accounts',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  financeAccountController.getAccounts
);

// Create new cash drawer or bank account
router.post(
  '/accounts',
  authorizeRoles('ADMIN'),
  financeAccountController.createAccount
);

// Get single account details with balance
router.get(
  '/accounts/:id',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  financeAccountController.getAccountById
);

// List chart of accounts categories
router.get(
  '/categories',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  financeAccountController.getCategories
);

// Create new custom accounting category
router.post(
  '/categories',
  authorizeRoles('ADMIN'),
  financeAccountController.createCategory
);

// ==========================================
// 2. TRANSACTIONS & GENERAL LEDGER
// ==========================================
// List financial transactions with filters
router.get(
  '/transactions',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  financeTransactionController.getTransactions
);

// Record expense or other operating income
router.post(
  '/transactions',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  financeTransactionController.recordTransaction
);

// Transfer funds between accounts (drawers/banks/branches)
router.post(
  '/transactions/transfer',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  financeTransactionController.transferFunds
);

// Controlled reversal of transaction (creates offset record)
router.post(
  '/transactions/:id/reverse',
  authorizeRoles('ADMIN'),
  financeTransactionController.reverseTransaction
);

// ==========================================
// 3. EMPLOYEE PAYROLL & SALARY ADVANCES
// ==========================================
// List monthly staff payroll
router.get(
  '/payroll',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  payrollController.getStaffPayroll
);

// Generate monthly staff payroll draft
router.post(
  '/payroll/generate',
  authorizeRoles('ADMIN'),
  payrollController.generateStaffPayroll
);

// Disburse staff monthly salary from account
router.post(
  '/payroll/:id/disburse',
  authorizeRoles('ADMIN'),
  payrollController.disburseStaffSalary
);

// List salary advance requests
router.get(
  '/advances',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  payrollController.getSalaryAdvances
);

// Request a salary advance for an employee
router.post(
  '/advances',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  payrollController.requestSalaryAdvance
);
router.post(
  '/advances/request',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  payrollController.requestSalaryAdvance
);

// Approve salary advance
router.post(
  '/advances/:id/approve',
  authorizeRoles('ADMIN'),
  payrollController.approveSalaryAdvance
);

// Reject salary advance
router.post(
  '/advances/:id/reject',
  authorizeRoles('ADMIN'),
  payrollController.rejectSalaryAdvance
);

// Disburse approved salary advance from cash drawer
router.post(
  '/advances/:id/disburse',
  authorizeRoles('ADMIN'),
  payrollController.disburseSalaryAdvance
);

// ==========================================
// 4. BUSINESS REPORTS & EXECUTIVE DASHBOARD
// ==========================================
// Real Profit & Loss statement (Asia/Colombo timezone, branch-isolated)
router.get(
  '/reports/profit-and-loss',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  businessControlController.getProfitAndLoss
);

// Real Accounts Receivable & Customer Outstanding with aging analysis
router.get(
  '/reports/customer-outstanding',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  businessControlController.getCustomerOutstanding
);

// Executive Financial Control Dashboard
router.get(
  '/dashboard/executive',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  businessControlController.getExecutiveDashboard
);

// Central Business Financial Health Dashboard (Cards A-H, Cashflow, Available Balance, Projections)
router.get(
  '/dashboard/business-health',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  businessHealthController.getBusinessHealthDashboard
);

// Monthly Executive Financial Control Report with previous month comparison
router.get(
  '/reports/monthly-control',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  businessHealthController.getMonthlyControlReport
);

// ==========================================
// 5. MONTHLY RECURRING BILLS MANAGEMENT
// ==========================================
// List monthly bills with filters
router.get(
  '/bills',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  monthlyBillController.getMonthlyBills
);

// Add new monthly bill record (non-destructive; does not affect cash/bank balance)
router.post(
  '/bills',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  monthlyBillController.createMonthlyBill
);

// Record full or partial payment for a bill from Cash Drawer or Bank Account
router.post(
  '/bills/:id/pay',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  monthlyBillController.payMonthlyBill
);

// Cancel unpaid monthly bill
router.delete(
  '/bills/:id',
  authorizeRoles('ADMIN', 'CEO', 'MANAGER'),
  monthlyBillController.deleteMonthlyBill
);

// System Financial Audit Logs
router.get(
  '/audit-logs',
  authorizeRoles('ADMIN'),
  businessControlController.getFinancialAuditLogs
);

module.exports = router;

