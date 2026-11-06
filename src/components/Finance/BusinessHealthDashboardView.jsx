import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, formatCompactLKR, getBranchName } from './financeUtils';
import { AddExpenseModal } from './AddExpenseModal';
import { AddMonthlyBillModal } from './AddMonthlyBillModal';
import { AddIncomeModal } from './AddIncomeModal';
import { MonthlyControlReportModal } from './MonthlyControlReportModal';
import {
  Wallet,
  Building,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Plus,
  CreditCard,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Clock,
  HelpCircle,
  ShieldCheck,
  ChevronRight,
  Truck,
  Landmark
} from 'lucide-react';

const PERIOD_LABELS = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_year', label: 'This Year' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom Range' }
];

export const BusinessHealthDashboardView = ({ branchScope, user, getAuthHeaders, onNavigateTab }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Date Filters
  const [period, setPeriod] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = useState(false);
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);

  const role = String(user?.role || '').toUpperCase();
  const isCeo = ['SUPER_ADMIN', 'CEO'].includes(role);

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchScope) params.append('branchId', branchScope);
      params.append('period', period);
      if (period === 'custom' && customStart && customEnd) {
        params.append('startDate', customStart);
        params.append('endDate', customEnd);
      }

      const res = await fetch(`${API_BASE}/finance/dashboard/business-health?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load business health dashboard');
      }
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, period, customStart, customEnd, getAuthHeaders]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '380px', gap: '16px' }}>
        <RefreshCw className="animate-spin text-blue-600" size={36} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Loading CEO Business Financial Control Telemetry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '24px', borderLeft: '4px solid var(--jb-crimson)', backgroundColor: '#FEF2F2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={24} color="var(--jb-crimson)" />
          <div>
            <h4 style={{ margin: 0, color: '#991B1B', fontWeight: 700 }}>Unable to Load Business Financial Control Telemetry</h4>
            <p style={{ margin: '4px 0 0 0', color: '#B91C1C', fontSize: '0.875rem' }}>{error}</p>
          </div>
        </div>
        <button
          onClick={fetchTelemetry}
          style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
        >
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  // Cards A through H
  const cards = data?.dashboardCards || {};
  const rem = data?.remainingCalculations || {};
  const cashflow = rem?.cashflowCalculation || {};
  const avail = rem?.availableBalanceCalculation || {};
  const pos = data?.finalBusinessPosition || {};
  const inc = data?.incomeDetails || {};
  const exp = data?.expenseDetails || {};
  const sal = data?.salaryControl || {};
  const bills = data?.billsAndObligations || {};
  const branches = data?.branchComparison || {};
  const alerts = bills?.alerts || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Bar: Title & Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
            JB GROUP — Complete Business Financial Control & Remaining Balance System
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real-time cashflow, collections, verified expenses, salary disbursements, and projected business liquidity for{' '}
            <strong style={{ color: 'var(--text-main)' }}>
              {branchScope === 'ALL' ? 'Both Branches (Combined JB GROUP)' : getBranchName(branchScope)}
            </strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsMonthlyReportOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
            }}
          >
            <FileSpreadsheet size={16} /> Monthly Financial Report
          </button>

          <button
            onClick={() => setIsAddIncomeOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#16a34a',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}
          >
            <Plus size={16} /> Record Income
          </button>

          <button
            onClick={() => setIsAddExpenseOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'var(--jb-crimson)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}
          >
            <Plus size={16} /> Record Expense
          </button>

          <button
            onClick={() => setIsAddBillOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#0B1F3A',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}
          >
            <Plus size={16} /> Add Monthly Bill
          </button>

          <button
            onClick={fetchTelemetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Date Filter Pills */}
      <div className="card" style={{ padding: '12px 18px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '6px' }}>Reporting Period:</span>
          {PERIOD_LABELS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: period === p.id ? 'var(--jb-crimson)' : 'var(--border-color)',
                background: period === p.id ? 'var(--jb-crimson-light)' : 'transparent',
                color: period === p.id ? 'var(--jb-crimson)' : 'var(--text-main)',
                fontWeight: period === p.id ? 800 : 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            />
          </div>
        )}
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '12px',
          backgroundColor: '#FFFBEB',
          border: '1px solid #FCD34D',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#D97706" />
            <strong style={{ color: '#92400E', fontSize: '0.88rem' }}>
              Financial Alerts Requiring Management Attention ({alerts.length})
            </strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {alerts.map((alt, idx) => (
              <span
                key={idx}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#FEE2E2',
                  color: '#991B1B',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <AlertCircle size={13} />
                <strong>{alt.title}:</strong> {formatLKR(alt.amount)} (Due: {new Date(alt.dueDate).toLocaleDateString('en-GB')})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: CEO MAIN FINANCIAL DASHBOARD (CARDS A THROUGH H) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', margin: 0 }}>
            CEO Main Financial Dashboard (8 Core Control Cards)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {/* Card A: TOTAL MONEY RECEIVED */}
          <div className="card" style={{ padding: '20px', borderRadius: '14px', background: '#F8FAFC', borderLeft: '4px solid #16a34a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>
                A. Total Money Received
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', background: '#dcfce7', color: '#16a34a' }}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>
              {formatLKR(cards.cardA_totalMoneyReceived)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>All actual income received (Cash + Bank)</span>
          </div>

          {/* Card B: TOTAL BUSINESS EXPENSES PAID */}
          <div className="card" style={{ padding: '20px', borderRadius: '14px', background: '#F8FAFC', borderLeft: '4px solid #dc2626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>
                B. Total Expenses Paid
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626' }}>
                <TrendingDown size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>
              {formatLKR(cards.cardB_totalExpensesPaid)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Operating rent, utilities, purchases, repairs</span>
          </div>

          {/* Card C: TOTAL SALARIES PAID */}
          <div className="card" style={{ padding: '20px', borderRadius: '14px', background: '#F8FAFC', borderLeft: '4px solid #2563eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                C. Total Salaries Paid
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', background: '#dbeafe', color: '#2563eb' }}>
                <CreditCard size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>
              {formatLKR(cards.cardC_totalSalariesPaid)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Tailor piecework & staff monthly payroll</span>
          </div>

          {/* Card D: TOTAL REMAINING CASHFLOW */}
          <div className="card" style={{
            padding: '20px',
            borderRadius: '14px',
            background: cards.cardD_totalRemainingCashflow >= 0 ? '#ecfdf5' : '#fef2f2',
            borderLeft: `4px solid ${cards.cardD_totalRemainingCashflow >= 0 ? '#10b981' : '#ef4444'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: cards.cardD_totalRemainingCashflow >= 0 ? '#047857' : '#b91c1c', textTransform: 'uppercase' }}>
                D. Total Remaining Cashflow
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', background: cards.cardD_totalRemainingCashflow >= 0 ? '#a7f3d0' : '#fecaca', color: cards.cardD_totalRemainingCashflow >= 0 ? '#047857' : '#b91c1c' }}>
                <Layers size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: cards.cardD_totalRemainingCashflow >= 0 ? '#047857' : '#b91c1c', marginTop: '8px' }}>
              {formatLKR(cards.cardD_totalRemainingCashflow)}
            </div>
            <span style={{ fontSize: '0.75rem', color: cards.cardD_totalRemainingCashflow >= 0 ? '#065f46' : '#991b1b' }}>
              Actual Income minus (Expenses Paid + Salaries Paid)
            </span>
          </div>

          {/* Card E: TOTAL PENDING SALARIES */}
          <div className="card" style={{ padding: '20px', borderRadius: '14px', background: '#F8FAFC', borderLeft: '4px solid #ea580c' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>
                E. Total Pending Salaries
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', background: '#ffedd5', color: '#ea580c' }}>
                <Clock size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>
              {formatLKR(cards.cardE_totalPendingSalaries)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Salary amounts earned and still payable</span>
          </div>

          {/* Card F: TOTAL PENDING BILLS */}
          <div className="card" style={{ padding: '20px', borderRadius: '14px', background: '#F8FAFC', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>
                F. Total Pending Bills
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', background: '#fef3c7', color: '#d97706' }}>
                <Calendar size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>
              {formatLKR(cards.cardF_totalPendingBills)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Unpaid rent, electricity, water, telecom</span>
          </div>

          {/* Card G: TOTAL CUSTOMER BALANCE */}
          <div className="card" style={{ padding: '20px', borderRadius: '14px', background: '#F8FAFC', borderLeft: '4px solid #6366f1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase' }}>
                G. Total Customer Balance
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', background: '#e0e7ff', color: '#4f46e5' }}>
                <DollarSign size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>
              {formatLKR(cards.cardG_totalCustomerBalance)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Customer receivables still outstanding</span>
          </div>

          {/* Card H: TOTAL BUSINESS OBLIGATIONS */}
          <div className="card" style={{ padding: '20px', borderRadius: '14px', background: '#fff7ed', borderLeft: '4px solid #c2410c' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase' }}>
                H. Total Business Obligations
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', background: '#ffedd5', color: '#c2410c' }}>
                <AlertTriangle size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#c2410c', marginTop: '8px' }}>
              {formatLKR(cards.cardH_totalBusinessObligations)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#9a3412' }}>Pending Salaries + Unpaid Bills + Pending Expenses</span>
          </div>

          {/* Card I: TOTAL SUPPLIER OUTSTANDING */}
          <div
            className="card"
            onClick={() => onNavigateTab && onNavigateTab('suppliers')}
            style={{ padding: '20px', borderRadius: '14px', background: '#F8FAFC', borderLeft: '4px solid #b91c1c', cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase' }}>
                I. Supplier Outstanding
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c' }}>
                <Truck size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>
              {formatLKR(cards.cardI_totalSupplierOutstanding || data?.supplierDebtSummary?.totalSupplierOutstanding || 0)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Liabilities owed to suppliers</span>
              <span style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700 }}>View Payables →</span>
            </div>
          </div>

          {/* Card J: TOTAL LOANS OUTSTANDING */}
          <div
            className="card"
            onClick={() => onNavigateTab && onNavigateTab('loans')}
            style={{ padding: '20px', borderRadius: '14px', background: '#F8FAFC', borderLeft: '4px solid #0B1F3A', cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0B1F3A', textTransform: 'uppercase' }}>
                J. Business Loans
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', background: '#e2e8f0', color: '#0B1F3A' }}>
                <Landmark size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', marginTop: '8px' }}>
              {formatLKR(cards.cardJ_totalLoanOutstanding || data?.loanSummary?.totalLoanOutstanding || 0)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Bank & institutional principal</span>
              <span style={{ fontSize: '0.72rem', color: '#0B1F3A', fontWeight: 700 }}>View Loans →</span>
            </div>
          </div>

          {/* Card K: NET BUSINESS POSITION */}
          <div className="card" style={{
            padding: '20px',
            borderRadius: '14px',
            background: (cards.cardK_netBusinessWorth || 0) >= 0 ? '#f0fdf4' : '#fef2f2',
            borderLeft: `4px solid ${(cards.cardK_netBusinessWorth || 0) >= 0 ? '#16a34a' : '#dc2626'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: (cards.cardK_netBusinessWorth || 0) >= 0 ? '#15803D' : '#b91c1c', textTransform: 'uppercase' }}>
                K. Net Business Position
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', background: (cards.cardK_netBusinessWorth || 0) >= 0 ? '#dcfce7' : '#fee2e2', color: (cards.cardK_netBusinessWorth || 0) >= 0 ? '#15803D' : '#b91c1c' }}>
                <Building size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: (cards.cardK_netBusinessWorth || 0) >= 0 ? '#15803D' : '#b91c1c', marginTop: '8px' }}>
              {formatLKR(cards.cardK_netBusinessWorth || data?.netAssetsSummary?.netBusinessWorth || 0)}
            </div>
            <span style={{ fontSize: '0.75rem', color: (cards.cardK_netBusinessWorth || 0) >= 0 ? '#166534' : '#991b1b' }}>
              (Cash + Customer Receivables) minus (Supplier Debts + Loans)
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 6: FINAL REMAINING MONEY CALCULATION (TWO SEPARATE CALCULATIONS) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', margin: 0 }}>
            Section 6: Final Remaining Money Calculations (Two Independent Reconciliations)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
          {/* Panel 1: ACTUAL CASHFLOW */}
          <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  Calculation 1: Actual Cashflow
                </h4>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  Period Inflows Minus Outflows (Operating Cash Flow)
                </div>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '0.75rem', fontWeight: 800 }}>
                CASHFLOW
              </span>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>Total Actual Income Received</span>
                <span style={{ fontWeight: 800, color: '#16a34a' }}>+ {formatLKR(cashflow.totalIncomeReceived)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>Actual Operating Expenses Paid</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>− {formatLKR(cashflow.totalExpensesPaid)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>Actual Salaries Paid</span>
                <span style={{ fontWeight: 700, color: '#2563eb' }}>− {formatLKR(cashflow.totalSalariesPaid)}</span>
              </div>
              <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 900, color: '#0f172a' }}>= Net Cashflow Remaining</span>
                <span style={{ fontWeight: 900, fontSize: '1.25rem', color: cashflow.isSurplus ? '#16a34a' : '#dc2626' }}>
                  {formatLKR(cashflow.netCashflow)}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', fontSize: '0.78rem', color: '#64748b' }}>
              <strong>Accounting Rule:</strong> Net cashflow represents surplus revenue generated during the selected period after settling all cash operating expenses and payroll.
            </div>
          </div>

          {/* Panel 2: ACTUAL AVAILABLE CASH & BANK BALANCE */}
          <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  Calculation 2: Available Cash & Bank Balance
                </h4>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  Opening Balances + Inflows − Outflows
                </div>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#ecfdf5', color: '#047857', fontSize: '0.75rem', fontWeight: 800 }}>
                LIQUIDITY
              </span>
            </div>

            {avail.incompleteWarning && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#fff7ed',
                border: '1px solid #fed7aa',
                color: '#c2410c',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{avail.incompleteWarning}</span>
              </div>
            )}

            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>Opening Cash & Bank Balances</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatLKR(avail.totalOpeningBalance)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>Actual Money Received (Inflows)</span>
                <span style={{ fontWeight: 700, color: '#16a34a' }}>+ {formatLKR(avail.moneyReceived)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>Actual Money Paid (Outflows)</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>− {formatLKR(avail.moneyPaid)}</span>
              </div>
              <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 900, color: '#0f172a' }}>= Current Verified Balance</span>
                <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#0f172a' }}>
                  {formatLKR(avail.totalAvailableBalance)}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
              <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#f1f5f9', textAlign: 'center' }}>
                <span style={{ color: '#64748b' }}>Cash in Drawers:</span>{' '}
                <strong>{formatLKR(avail.currentCashInHand)}</strong>
              </div>
              <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#f1f5f9', textAlign: 'center' }}>
                <span style={{ color: '#64748b' }}>Bank Accounts:</span>{' '}
                <strong>{formatLKR(avail.currentBankBalance)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 7: AFTER ALL PAYMENTS – FINAL BUSINESS POSITION (MANAGEMENT PROJECTION) */}
      <div className="card" style={{
        padding: '24px',
        borderRadius: '16px',
        border: '2px solid #3b82f6',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                Section 7: After All Payments — Final Business Position
              </h4>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 900,
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '6px'
              }}>
                MANAGEMENT PROJECTION
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Projected available funds if all outstanding salaries and pending utility bills were paid immediately. Clearly separated from actual physical cash.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current Available Funds</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
              {formatLKR(pos.baseAvailableFunds)}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Verified current balance or cashflow</span>
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #fed7aa' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase' }}>Less: Total Obligations</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#c2410c', marginTop: '6px' }}>
              − {formatLKR(pos.deductions?.totalObligationsToSettle)}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#ea580c' }}>
              Salaries ({formatCompactLKR(pos.deductions?.pendingSalaries)}) + Bills ({formatCompactLKR(pos.deductions?.unpaidBills)})
            </span>
          </div>

          <div style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: pos.projectedRemainingBalance >= 0 ? '#eff6ff' : '#fef2f2',
            border: `2px solid ${pos.projectedRemainingBalance >= 0 ? '#3b82f6' : '#ef4444'}`
          }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: pos.projectedRemainingBalance >= 0 ? '#1d4ed8' : '#b91c1c', textTransform: 'uppercase' }}>
              Projected Balance After Obligations
            </span>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: pos.projectedRemainingBalance >= 0 ? '#1d4ed8' : '#b91c1c', marginTop: '6px' }}>
              {formatLKR(pos.projectedRemainingBalance)}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Remaining after full settlement</span>
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Customer Receivables</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#475569', marginTop: '6px' }}>
              {formatLKR(pos.customerReceivables?.amount)}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Shown separately — NOT received cash</span>
          </div>
        </div>
      </div>

      {/* TWO COLUMN GRID: INCOME BREAKDOWN vs. COMPLETE EXPENSES BREAKDOWN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '20px' }}>
        {/* SECTION 1: TOTAL BUSINESS INCOME DETAILS */}
        <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
            Section 1: Total Business Income Breakdown
          </h4>

          {/* Timeframe cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '10px 6px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>TODAY</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                {formatCompactLKR(inc.today || 0)}
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '10px 6px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>THIS WEEK</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                {formatCompactLKR(inc.thisWeek || 0)}
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '10px 6px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>THIS MONTH</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                {formatCompactLKR(inc.thisMonth || 0)}
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '10px 6px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>THIS YEAR</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                {formatCompactLKR(inc.thisYear || 0)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <span style={{ color: '#475569' }}>Cash Received (Physical Drawers)</span>
              <strong style={{ color: '#16a34a' }}>{formatLKR(inc.byMethod?.cash || 0)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <span style={{ color: '#475569' }}>Bank Deposits / Transfers / Cheques</span>
              <strong style={{ color: '#0284c7' }}>{formatLKR(inc.byMethod?.bank || 0)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <span style={{ color: '#475569' }}>Card Payments</span>
              <strong style={{ color: '#64748b' }}>{formatLKR(inc.byMethod?.card || 0)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <span style={{ color: '#475569' }}>Other Non-Order Operating Income</span>
              <strong style={{ color: '#0f172a' }}>{formatLKR(inc.byType?.otherOperatingIncome || 0)}</strong>
            </div>
          </div>
        </div>

        {/* SECTION 2: COMPLETE BUSINESS EXPENSES DETAILS */}
        <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              Section 2: Operating Expenses (15 Categories)
            </h4>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626' }}>
              Paid: {formatLKR(exp.totalPaid || 0)}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px', textAlign: 'center' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#991b1b' }}>TOTAL PAID</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#dc2626', marginTop: '2px' }}>
                {formatLKR(exp.totalPaid || 0)}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9a3412' }}>TOTAL PENDING</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#ea580c', marginTop: '2px' }}>
                {formatLKR(exp.totalPending || 0)}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569' }}>TOTAL INCURRED</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                {formatLKR(exp.grandTotal || 0)}
              </div>
            </div>
          </div>

          <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b' }}>Category</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b' }}>Paid</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b' }}>Pending</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(exp.categories || {}).map(([key, c]) => (
                  <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: '#0f172a' }}>{key.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: '#16a34a' }}>{formatLKR(c.paid)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: c.pending > 0 ? '#ea580c' : '#94a3b8' }}>
                      {formatLKR(c.pending)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* TWO COLUMN GRID: SALARY CONTROL vs. MONTHLY BILLS & OBLIGATIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '20px' }}>
        {/* SECTION 3: COMPLETE STAFF SALARY CONTROL */}
        <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
            Section 3: Complete Staff Salary Control
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px', textAlign: 'center' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1e40af' }}>TOTAL PAYABLE</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#1e40af', marginTop: '2px' }}>
                {formatLKR(sal.totalSalariesPayable || 0)}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#15803d' }}>TOTAL PAID</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>
                {formatLKR(sal.totalSalariesPaid || 0)}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#c2410c' }}>REMAINING DUE</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#c2410c', marginTop: '2px' }}>
                {formatLKR(sal.remainingSalaryPayable || 0)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <span style={{ color: '#475569' }}>Tailor Piecework Wages (50/25/25 Model)</span>
              <span>Paid: <strong style={{ color: '#16a34a' }}>{formatLKR(sal.breakdown?.tailorSalariesPaid || 0)}</strong> • Pending: <strong style={{ color: '#ea580c' }}>{formatLKR(sal.breakdown?.pendingTailorSalary || 0)}</strong></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <span style={{ color: '#475569' }}>Staff & Management Salaries</span>
              <span>Paid: <strong style={{ color: '#16a34a' }}>{formatLKR(sal.breakdown?.staffSalariesPaid || 0)}</strong> • Pending: <strong style={{ color: '#ea580c' }}>{formatLKR(sal.breakdown?.pendingStaffSalary || 0)}</strong></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <span style={{ color: '#475569' }}>Active Salary Advances Disbursed</span>
              <strong style={{ color: '#0f172a' }}>{formatLKR(sal.breakdown?.salaryAdvancesDisbursed || 0)}</strong>
            </div>
          </div>
        </div>

        {/* SECTION 4: MONTHLY BILLS & OUTSTANDING OBLIGATIONS */}
        <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
            Section 4: Monthly Bills & Outstanding Obligations
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px', textAlign: 'center' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>BILLS RECEIVED</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                {formatLKR(bills.totalBillsReceived || 0)}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#16a34a' }}>BILLS SETTLED</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>
                {formatLKR(bills.totalBillsPaid || 0)}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ea580c' }}>UNPAID BILLS</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#c2410c', marginTop: '2px' }}>
                {formatLKR(bills.unpaidBills || 0)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '6px', color: '#b91c1c' }}>
              <span>Overdue Bills Amount ({bills.overdueBillsCount || 0} bills)</span>
              <strong>{formatLKR(bills.overdueBillsAmount || 0)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#fff7ed', borderRadius: '6px', color: '#9a3412' }}>
              <span>Outstanding Salaries Payable</span>
              <strong>{formatLKR(bills.outstandingSalaries || 0)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', borderTop: '2px solid #e2e8f0' }}>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>Complete Business Obligations</span>
              <strong style={{ fontWeight: 900, color: '#c2410c' }}>{formatLKR(bills.completeOutstandingObligations || 0)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 9: TWO BRANCHES COMPARISON */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
          Section 9: Two Branches Financial Comparison
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
          {/* Branch 1 */}
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={16} color="#0284c7" />
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>Branch 1: JB Group (Main)</strong>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#dbeafe', color: '#1e40af' }}>
                Branch ID 1
              </span>
            </div>

            <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>INCOME</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                  {formatCompactLKR(branches.branch1?.income || 0)}
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>EXPENSES</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
                  {formatCompactLKR(branches.branch1?.expensesPaid || 0)}
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>SALARIES</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
                  {formatCompactLKR(branches.branch1?.salariesPaid || 0)}
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>NET CASHFLOW</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: (branches.branch1?.netCashflow || 0) >= 0 ? '#16a34a' : '#dc2626', marginTop: '2px' }}>
                  {formatCompactLKR(branches.branch1?.netCashflow || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Branch 2 */}
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={16} color="#7c3aed" />
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>Branch 2: Bella Design</strong>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#ede9fe', color: '#6d28d9' }}>
                Branch ID 2
              </span>
            </div>

            <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>INCOME</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                  {formatCompactLKR(branches.branch2?.income || 0)}
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>EXPENSES</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
                  {formatCompactLKR(branches.branch2?.expensesPaid || 0)}
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>SALARIES</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
                  {formatCompactLKR(branches.branch2?.salariesPaid || 0)}
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>NET CASHFLOW</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: (branches.branch2?.netCashflow || 0) >= 0 ? '#16a34a' : '#dc2626', marginTop: '2px' }}>
                  {formatCompactLKR(branches.branch2?.netCashflow || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddIncomeModal
        isOpen={isAddIncomeOpen}
        onClose={() => setIsAddIncomeOpen(false)}
        branchScope={branchScope}
        user={user}
        getAuthHeaders={getAuthHeaders}
        onIncomeAdded={fetchTelemetry}
      />

      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        branchScope={branchScope}
        user={user}
        getAuthHeaders={getAuthHeaders}
        onExpenseAdded={fetchTelemetry}
      />

      <AddMonthlyBillModal
        isOpen={isAddBillOpen}
        onClose={() => setIsAddBillOpen(false)}
        branchScope={branchScope}
        user={user}
        getAuthHeaders={getAuthHeaders}
        onBillAdded={fetchTelemetry}
      />

      <MonthlyControlReportModal
        isOpen={isMonthlyReportOpen}
        onClose={() => setIsMonthlyReportOpen(false)}
        branchScope={branchScope}
        getAuthHeaders={getAuthHeaders}
      />
    </div>
  );
};

export default BusinessHealthDashboardView;
