import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { EXPENSE_CATEGORIES, getCategoryMeta, formatLKR } from './expenseConstants';
import { ExpenseDashboardView } from './ExpenseDashboardView';
import { ExpenseCategorySectionView } from './ExpenseCategorySectionView';
import { ExpenseReportsView } from './ExpenseReportsView';
import { RecurringBillsView } from './RecurringBillsView';
import { AddExpenseModal } from './AddExpenseModal';
import { EditExpenseModal } from './EditExpenseModal';
import { ViewExpenseModal } from './ViewExpenseModal';
import { PayExpenseModal } from './PayExpenseModal';
import { ExpensePaymentHistoryModal } from './ExpensePaymentHistoryModal';
import {
  Receipt,
  LayoutDashboard,
  Calendar,
  FileSpreadsheet,
  Building,
  Lock,
  Plus,
  ChevronDown
} from 'lucide-react';

export const ExpenseManagementERP = () => {
  const { user, activeBranch, setActiveBranch } = useAuth();

  const role = String(user?.role || '').toUpperCase();
  const isCeo = ['SUPER_ADMIN', 'CEO'].includes(role);
  const assignedBranch = user?.branchId ? Number(user.branchId) : 1;

  // Branch Scope Resolution: CEO can view ALL or switch branches; Admin and Manager are locked to assigned branch
  const [selectedBranch, setSelectedBranch] = useState(isCeo ? (activeBranch || 'ALL') : assignedBranch);

  // Active view: 'dashboard', 'recurring', 'reports', or any of the 15 category keys
  const [activeView, setActiveView] = useState('dashboard');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalInitialCategory, setModalInitialCategory] = useState(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedExpenseForEdit, setSelectedExpenseForEdit] = useState(null);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedExpenseIdForView, setSelectedExpenseIdForView] = useState(null);

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedExpenseForPay, setSelectedExpenseForPay] = useState(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedExpenseIdForHistory, setSelectedExpenseIdForHistory] = useState(null);

  // Quick refresh key
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleOpenAddExpense = (catKey = null) => {
    setModalInitialCategory(catKey);
    setIsAddModalOpen(true);
  };

  const handleOpenEditExpense = (expense) => {
    setSelectedExpenseForEdit(expense);
    setIsEditModalOpen(true);
  };

  const handleOpenViewExpense = (expenseOrId) => {
    const id = typeof expenseOrId === 'object' ? expenseOrId.id : expenseOrId;
    setSelectedExpenseIdForView(id);
    setIsViewModalOpen(true);
  };

  const handleOpenPayExpense = (expense) => {
    setSelectedExpenseForPay(expense);
    setIsPayModalOpen(true);
  };

  const handleOpenHistory = (expenseId) => {
    setSelectedExpenseIdForHistory(expenseId);
    setIsHistoryModalOpen(true);
  };

  const handleExpenseMutated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Branch name helper
  const getBranchBadge = () => {
    if (isCeo) {
      if (selectedBranch === 'ALL') return 'Consolidated (All Branches)';
      if (Number(selectedBranch) === 1) return 'Branch 1 – JB Group (Main)';
      if (Number(selectedBranch) === 2) return 'Branch 2 – Bella Design';
      return 'All Branches';
    }
    return assignedBranch === 1 ? 'Branch 1 – JB Group (Main)' : 'Branch 2 – Bella Design';
  };

  return (
    <div className="module-container-responsive" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.15)'
          }}>
            <Receipt size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                JB GROUP — Expense Management System
              </h1>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                backgroundColor: '#dc2626',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                EXPENSES ONLY
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Showroom rent, utility bills, maintenance, salaries, petty cash, and operating disbursements
            </p>
          </div>
        </div>

        {/* Branch Controls & Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {isCeo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={16} color="#64748b" />
              <select
                value={selectedBranch}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedBranch(val === 'ALL' ? 'ALL' : Number(val));
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">Consolidated (Branch 1 + Branch 2)</option>
                <option value={1}>Branch 1 – JB Group (Main)</option>
                <option value={2}>Branch 2 – Bella Design</option>
              </select>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#475569'
            }}>
              <Lock size={14} color="#dc2626" />
              <span>{getBranchBadge()}</span>
            </div>
          )}

          <button
            onClick={() => handleOpenAddExpense()}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.25)'
            }}
          >
            <Plus size={16} /> Record Expense
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '8px',
        borderBottom: '1px solid #f1f5f9'
      }}>
        <button
          onClick={() => setActiveView('dashboard')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: activeView === 'dashboard' ? '1px solid #0284c7' : '1px solid #e2e8f0',
            backgroundColor: activeView === 'dashboard' ? '#eff6ff' : '#ffffff',
            color: activeView === 'dashboard' ? '#0284c7' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <LayoutDashboard size={16} /> Expense Dashboard
        </button>

        <button
          onClick={() => setActiveView('recurring')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: activeView === 'recurring' ? '1px solid #2563eb' : '1px solid #e2e8f0',
            backgroundColor: activeView === 'recurring' ? '#eff6ff' : '#ffffff',
            color: activeView === 'recurring' ? '#2563eb' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Calendar size={16} /> Monthly Recurring Bills
        </button>

        <button
          onClick={() => setActiveView('reports')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: activeView === 'reports' ? '1px solid #0284c7' : '1px solid #e2e8f0',
            backgroundColor: activeView === 'reports' ? '#eff6ff' : '#ffffff',
            color: activeView === 'reports' ? '#0284c7' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <FileSpreadsheet size={16} /> Analytics & Reports
        </button>

        <div style={{ width: '1px', height: '24px', backgroundColor: '#cbd5e1', margin: '0 4px' }} />

        {/* 15 Separate Category Tabs */}
        {EXPENSE_CATEGORIES.map(cat => {
          const isActive = activeView === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveView(cat.key)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: isActive ? `1px solid ${cat.color}` : '1px solid #e2e8f0',
                backgroundColor: isActive ? cat.bgColor : '#ffffff',
                color: isActive ? cat.color : '#64748b',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Main View Router */}
      {activeView === 'dashboard' && (
        <ExpenseDashboardView
          key={`dash-${refreshTrigger}-${selectedBranch}`}
          branchScope={selectedBranch}
          onSelectCategory={(catKey) => setActiveView(catKey)}
          onOpenAddExpense={handleOpenAddExpense}
          onOpenPayExpense={handleOpenPayExpense}
          onOpenHistory={handleOpenHistory}
          onOpenViewExpense={handleOpenViewExpense}
          onOpenEditExpense={handleOpenEditExpense}
        />
      )}

      {activeView === 'recurring' && (
        <RecurringBillsView
          key={`rec-${refreshTrigger}-${selectedBranch}`}
          branchScope={selectedBranch}
          onOpenPayExpense={handleOpenPayExpense}
          onOpenHistory={handleOpenHistory}
          onOpenEditExpense={handleOpenEditExpense}
        />
      )}

      {activeView === 'reports' && (
        <ExpenseReportsView
          key={`rep-${refreshTrigger}-${selectedBranch}`}
          branchScope={selectedBranch}
        />
      )}

      {/* When a specific category is selected */}
      {activeView !== 'dashboard' && activeView !== 'recurring' && activeView !== 'reports' && (
        <ExpenseCategorySectionView
          key={`cat-${activeView}-${refreshTrigger}-${selectedBranch}`}
          categoryKey={activeView}
          branchScope={selectedBranch}
          onOpenAddExpense={handleOpenAddExpense}
          onOpenPayExpense={handleOpenPayExpense}
          onOpenHistory={handleOpenHistory}
          onOpenViewExpense={handleOpenViewExpense}
          onOpenEditExpense={handleOpenEditExpense}
          onExpenseDeleted={handleExpenseMutated}
        />
      )}

      {/* Modals */}
      <AddExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onExpenseAdded={handleExpenseMutated}
        initialCategory={modalInitialCategory}
        defaultBranchId={selectedBranch}
      />

      <EditExpenseModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        expense={selectedExpenseForEdit}
        onExpenseUpdated={handleExpenseMutated}
      />

      <ViewExpenseModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        expenseId={selectedExpenseIdForView}
        onOpenPayExpense={handleOpenPayExpense}
        onOpenEditExpense={handleOpenEditExpense}
      />

      <PayExpenseModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        expense={selectedExpenseForPay}
        onPaymentRecorded={handleExpenseMutated}
      />

      <ExpensePaymentHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        expenseId={selectedExpenseIdForHistory}
      />
    </div>
  );
};

export default ExpenseManagementERP;
