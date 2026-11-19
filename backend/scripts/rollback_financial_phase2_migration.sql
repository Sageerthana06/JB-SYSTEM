-- =====================================================================
-- ROLLBACK SCRIPT FOR FINANCIAL ACCOUNTING & BUSINESS CONTROL (PHASE 2)
-- JB GROUP (PVT) LTD — Version 3.2.0
-- Drops ONLY the 7 newly added financial tables.
-- PRESERVES all pre-existing tables, users, branches, orders, etc.
-- =====================================================================

DROP TABLE IF EXISTS "FinancialAuditLog" CASCADE;
DROP TABLE IF EXISTS "BankReconciliation" CASCADE;
DROP TABLE IF EXISTS "SalaryAdvance" CASCADE;
DROP TABLE IF EXISTS "EmployeeSalary" CASCADE;
DROP TABLE IF EXISTS "FinancialTransaction" CASCADE;
DROP TABLE IF EXISTS "AccountingCategory" CASCADE;
DROP TABLE IF EXISTS "FinancialAccount" CASCADE;
