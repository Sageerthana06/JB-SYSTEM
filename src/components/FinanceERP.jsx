import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { resolveEffectiveBranch, getBranchName } from './Finance/financeUtils';
import { BusinessHealthDashboardView } from './Finance/BusinessHealthDashboardView';
import { MonthlyBillsView } from './Finance/MonthlyBillsView';
import { ExecutiveDashboardView } from './Finance/ExecutiveDashboardView';
import { CashBankAccountsView } from './Finance/CashBankAccountsView';
import { IncomeExpenseLedgerView } from './Finance/IncomeExpenseLedgerView';
import { BranchTransfersView } from './Finance/BranchTransfersView';
import { StaffPayrollView } from './Finance/StaffPayrollView';
import { SalaryAdvancesView } from './Finance/SalaryAdvancesView';
import { ProfitLossReportView } from './Finance/ProfitLossReportView';
import { CustomerOutstandingView } from './Finance/CustomerOutstandingView';
import { SupplierPayablesView } from './Finance/SupplierPayablesView';
import { BusinessLoansView } from './Finance/BusinessLoansView';
import { FinancialAuditLogsView } from './Finance/FinancialAuditLogsView';

import {
  LayoutDashboard,
  Wallet,
  Receipt,
  Calendar,
  ArrowRightLeft,
  Users,
  CreditCard,
  FileSpreadsheet,
  AlertCircle,
  ShieldCheck,
  Building,
  Lock,
  Truck,
  Landmark
} from 'lucide-react';

export const FinanceERP = () => {
  const { user, activeBranch, getAuthHeaders } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('dashboard');

  const role = String(user?.role || '').toUpperCase();
  const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);
  const isManager = role === 'MANAGER';

  // Branch Scope Resolution
  const branchScope = resolveEffectiveBranch(activeBranch, user);

  // Tab definitions with RBAC
  const tabs = [
    { id: 'dashboard', label: 'Financial Health', icon: LayoutDashboard, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'] },
    { id: 'bills', label: 'Monthly Bills', icon: Calendar, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'] },
    { id: 'accounts', label: 'Cash & Bank', icon: Wallet, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'] },
    { id: 'transactions', label: 'Income & Expense', icon: Receipt, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'] },
    { id: 'transfers', label: 'Branch Transfers', icon: ArrowRightLeft, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'] },
    { id: 'payroll', label: 'Staff Payroll', icon: Users, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'] },
    { id: 'advances', label: 'Salary Advances', icon: CreditCard, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'] },
    { id: 'pnl', label: 'Profit & Loss', icon: FileSpreadsheet, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'] },
    { id: 'receivables', label: 'Customer Outstanding', icon: AlertCircle, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'] },
    { id: 'suppliers', label: 'Supplier Payables', icon: Truck, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'] },
    { id: 'loans', label: 'Business Loans', icon: Landmark, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'] },
    { id: 'audit', label: 'Audit Trail', icon: ShieldCheck, requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'CEO'] }
  ];

  // Filter tabs authorized for current user
  const accessibleTabs = tabs.filter(t => t.requiredRoles.includes(role));

  if (!isExecutive && !isManager) {
    return (
      <div className="module-container-responsive" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '520px', margin: '0 auto', padding: '40px 24px' }}>
          <Lock size={48} color="var(--jb-crimson)" style={{ margin: '0 auto 16px auto' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0' }}>
            Access Restricted
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            The JB GROUP Financial & Business Control System is strictly restricted to CEO, Admin, and Branch Manager accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="module-container-responsive" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & Branch Scope Badge */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'var(--jb-crimson-light)',
            color: 'var(--jb-crimson)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Wallet size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Business Financial & Operations Control
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
              JB GROUP (PVT) LTD — Centralized executive financial telemetry, general ledger, and branch control
            </p>
          </div>
        </div>

        {/* Branch Scope Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '10px',
          backgroundColor: branchScope === 'ALL' ? '#EFF6FF' : '#FEF3C7',
          border: branchScope === 'ALL' ? '1px solid #BFDBFE' : '1px solid #FDE68A',
          color: branchScope === 'ALL' ? '#1E40AF' : '#92400E',
          fontSize: '0.85rem',
          fontWeight: 700
        }}>
          <Building size={16} />
          <span>
            Scope: {branchScope === 'ALL' ? 'Both Branches Consolidated (Group HQ)' : `${getBranchName(branchScope)} (Branch ${branchScope})`}
          </span>
          {isManager && (
            <span style={{ fontSize: '0.72rem', backgroundColor: '#92400E', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>
              Locked to Assigned Branch
            </span>
          )}
        </div>
      </div>

      {/* Sub-Navigation Navigation Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        paddingBottom: '6px',
        borderBottom: '2px solid var(--border-color)',
        scrollbarWidth: 'thin'
      }}>
        {accessibleTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--jb-crimson)' : '3px solid transparent',
                background: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--jb-crimson)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* View Container */}
      <div style={{ marginTop: '8px' }}>
        {activeSubTab === 'dashboard' && (
          <BusinessHealthDashboardView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
            onNavigateTab={setActiveSubTab}
          />
        )}

        {activeSubTab === 'bills' && (
          <MonthlyBillsView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
            onNavigateTab={setActiveSubTab}
          />
        )}

        {activeSubTab === 'accounts' && (
          <CashBankAccountsView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
          />
        )}

        {activeSubTab === 'transactions' && (
          <IncomeExpenseLedgerView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
          />
        )}

        {activeSubTab === 'transfers' && (
          <BranchTransfersView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
          />
        )}

        {activeSubTab === 'payroll' && (
          <StaffPayrollView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
          />
        )}

        {activeSubTab === 'advances' && (
          <SalaryAdvancesView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
          />
        )}

        {activeSubTab === 'pnl' && (
          <ProfitLossReportView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
          />
        )}

        {activeSubTab === 'receivables' && (
          <CustomerOutstandingView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
          />
        )}

        {activeSubTab === 'suppliers' && (
          <SupplierPayablesView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
          />
        )}

        {activeSubTab === 'loans' && (
          <BusinessLoansView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
          />
        )}

        {activeSubTab === 'audit' && isExecutive && (
          <FinancialAuditLogsView
            branchScope={branchScope}
            user={user}
            getAuthHeaders={getAuthHeaders}
          />
        )}
      </div>
    </div>
  );
};

export default FinanceERP;

