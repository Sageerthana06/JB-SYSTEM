import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';
import { EXPENSE_CATEGORIES, getCategoryMeta, formatLKR, getStatusBadge } from './expenseConstants';
import { BusinessCashSummaryCard } from './BusinessCashSummaryCard';
import {
  TrendingDown,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle,
  Users,
  Building,
  Zap,
  PlusCircle,
  FileText,
  CreditCard,
  ArrowRight,
  RefreshCw,
  Search,
  DollarSign
} from 'lucide-react';

export const ExpenseDashboardView = ({
  branchScope,
  onSelectCategory,
  onOpenAddExpense,
  onOpenPayExpense,
  onOpenHistory,
  onOpenViewExpense,
  onOpenEditExpense
}) => {
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState(null);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (branchScope) params.set('branchId', branchScope);

    const safeJsonFetch = async (url) => {
      const res = await fetch(url, { headers: { ...getAuthHeaders() } });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`API error (${res.status}): Server returned ${contentType || 'non-JSON'}`);
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Request failed with status ${res.status}`);
      }
      return json;
    };

    Promise.all([
      safeJsonFetch(`${API_BASE}/expenses/dashboard?${params.toString()}`),
      safeJsonFetch(`${API_BASE}/expenses?${params.toString()}&limit=6`)
    ])
      .then(([dashRes, expRes]) => {
        setData(dashRes.data);
        setRecentExpenses(expRes.data || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Error loading expense dashboard');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [branchScope]);

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
        <RefreshCw size={32} className="spin-animation" style={{ margin: '0 auto 12px auto' }} />
        <p>Loading Business Expense Dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: '#fef2f2',
        color: '#dc2626',
        borderRadius: '12px',
        border: '1px solid #fecaca',
        textAlign: 'center'
      }}>
        <AlertTriangle size={32} style={{ margin: '0 auto 8px auto' }} />
        <h3 style={{ margin: '0 0 6px 0' }}>Dashboard Error</h3>
        <p style={{ margin: 0 }}>{error || 'Unable to load dashboard data.'}</p>
        <button
          onClick={fetchData}
          style={{
            marginTop: '14px',
            padding: '8px 16px',
            backgroundColor: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 700
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  const { summary, categoryBreakdown, monthlyTrend } = data;

  // Max expense for category progress bars
  const maxCategoryExpense = Math.max(...categoryBreakdown.map(c => c.totalAmount), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* JB GROUP Business Cash Balance Integration Summary */}
      <BusinessCashSummaryCard branchScope={branchScope} />

      {/* 9 Requested Primary Expense KPI Cards */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              Core Expense Metrics
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Live consolidated expense obligations & settled operational cashflows
            </p>
          </div>
          <button
            onClick={() => onOpenAddExpense()}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.25)'
            }}
          >
            + Add New Expense
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px'
        }}>
          {/* 1. Total Expenses This Month */}
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>This Month</span>
              <Calendar size={18} color="#0284c7" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: '8px 0 4px 0' }}>
              {formatLKR(summary.totalExpensesThisMonth)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Current calendar month</span>
          </div>

          {/* 2. Total Expenses This Year */}
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>This Year</span>
              <TrendingDown size={18} color="#6366f1" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: '8px 0 4px 0' }}>
              {formatLKR(summary.totalExpensesThisYear)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cumulative year total</span>
          </div>

          {/* 3. Total Paid Expenses */}
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #bbf7d0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#16a34a' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Total Paid</span>
              <CheckCircle size={18} color="#16a34a" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#16a34a', margin: '8px 0 4px 0' }}>
              {formatLKR(summary.totalPaidExpenses)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>Disbursed settlements</span>
          </div>

          {/* 4. Total Pending Expenses */}
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #fed7aa',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ea580c' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Total Pending</span>
              <Clock size={18} color="#ea580c" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ea580c', margin: '8px 0 4px 0' }}>
              {formatLKR(summary.totalPendingExpenses)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#ea580c' }}>Outstanding payable</span>
          </div>

          {/* 5. Overdue Bills */}
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: summary.overdueCount > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: summary.overdueCount > 0 ? '#dc2626' : '#64748b' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Overdue Bills</span>
              <AlertTriangle size={18} color={summary.overdueCount > 0 ? '#dc2626' : '#64748b'} />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: summary.overdueCount > 0 ? '#dc2626' : '#64748b', margin: '8px 0 4px 0' }}>
              {summary.overdueCount} ({formatLKR(summary.overdueAmount)})
            </div>
            <span style={{ fontSize: '0.75rem', color: summary.overdueCount > 0 ? '#dc2626' : '#64748b' }}>
              Past payment deadline
            </span>
          </div>

          {/* 6. Salary Expenses */}
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Staff Salary</span>
              <Users size={18} color="#10b981" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: '8px 0 4px 0' }}>
              {formatLKR(summary.salaryExpenses)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Staff & employee wages</span>
          </div>

          {/* 7. Monthly Rent */}
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Monthly Rent</span>
              <Building size={18} color="#3b82f6" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: '8px 0 4px 0' }}>
              {formatLKR(summary.monthlyRent)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Showroom & facility leases</span>
          </div>

          {/* 8. Electricity Expenses */}
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Electricity</span>
              <Zap size={18} color="#eab308" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: '8px 0 4px 0' }}>
              {formatLKR(summary.electricityExpenses)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Power & utility bills</span>
          </div>

          {/* 9. Other Expenses */}
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Other Expenses</span>
              <PlusCircle size={18} color="#a855f7" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: '8px 0 4px 0' }}>
              {formatLKR(summary.otherExpenses)}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Extra cash & incidentals</span>
          </div>
        </div>
      </div>

      {/* 15 Expense Category Grid Navigation */}
      <div>
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
            Separate Expense Category Sections
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            Click any category to open its dedicated section with detailed entries, receipts, and payment history
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px'
        }}>
          {EXPENSE_CATEGORIES.map(cat => {
            const dataCat = categoryBreakdown.find(c => c.category === cat.key) || { totalAmount: 0, paidAmount: 0, pendingAmount: 0, count: 0 };
            return (
              <div
                key={cat.key}
                onClick={() => onSelectCategory(cat.key)}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  border: `1px solid ${cat.borderColor}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px -2px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = cat.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                  e.currentTarget.style.borderColor = cat.borderColor;
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: cat.bgColor,
                      color: cat.color,
                      fontSize: '0.78rem',
                      fontWeight: 800
                    }}>
                      {cat.label}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {dataCat.count} item{dataCat.count === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '12px 0 4px 0' }}>
                    {formatLKR(dataCat.totalAmount)}
                  </div>
                </div>

                <div style={{
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '10px',
                  marginTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.74rem'
                }}>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>
                    Paid: {formatLKR(dataCat.paidAmount)}
                  </span>
                  <span style={{ color: dataCat.pendingAmount > 0 ? '#ea580c' : '#64748b', fontWeight: 700 }}>
                    Pending: {formatLKR(dataCat.pendingAmount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expense Charts & Breakdown */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {/* Category Expense Distribution */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
            Category Expense Allocation
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {categoryBreakdown
              .filter(c => c.totalAmount > 0)
              .sort((a, b) => b.totalAmount - a.totalAmount)
              .slice(0, 8)
              .map(c => {
                const meta = getCategoryMeta(c.category);
                const percent = Math.round((c.totalAmount / maxCategoryExpense) * 100);

                return (
                  <div key={c.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#334155' }}>{meta.label}</span>
                      <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatLKR(c.totalAmount)}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${percent}%`,
                        height: '100%',
                        backgroundColor: meta.color,
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>
                );
              })}

            {categoryBreakdown.filter(c => c.totalAmount > 0).length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No expenses recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* 6-Month Expense History Trend */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
            6-Month Expense Trajectory
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {monthlyTrend.map(m => {
              const maxTrend = Math.max(...monthlyTrend.map(t => t.total), 1);
              const totalPct = Math.round((m.total / maxTrend) * 100);

              return (
                <div key={m.month}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#475569' }}>{m.month}</span>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>
                      {formatLKR(m.total)} (Paid: {formatLKR(m.paid)})
                    </span>
                  </div>
                  <div style={{ display: 'flex', width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.round((m.paid / maxTrend) * 100)}%`,
                      height: '100%',
                      backgroundColor: '#16a34a'
                    }} />
                    <div style={{
                      width: `${Math.round((m.pending / maxTrend) * 100)}%`,
                      height: '100%',
                      backgroundColor: '#ea580c'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '0.75rem', justifyContent: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#16a34a' }} />
              Paid Expenses
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#ea580c' }} />
              Pending Obligations
            </span>
          </div>
        </div>
      </div>

      {/* Recent Expense Activity */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
            Recent Expense Activity
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Latest disbursements & bills
          </span>
        </div>

        {recentExpenses.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            No recent expenses recorded.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px' }}>Expense</th>
                  <th style={{ padding: '10px 14px' }}>Category</th>
                  <th style={{ padding: '10px 14px' }}>Branch</th>
                  <th style={{ padding: '10px 14px' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Paid</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Pending</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map(exp => {
                  const meta = getCategoryMeta(exp.category);
                  const isPastDue = exp.dueDate && new Date(exp.dueDate) < new Date() && exp.pendingAmount > 0;
                  const badge = getStatusBadge(exp.status, isPastDue);

                  return (
                    <tr key={exp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                        {exp.title}
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 400 }}>
                          {exp.expenseNumber}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: meta.bgColor,
                          color: meta.color,
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#334155' }}>
                        {exp.branch?.name || (exp.branchId === 1 ? 'JB Group (Main)' : 'Bella Design')}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b' }}>
                        {new Date(exp.expenseDate).toLocaleDateString('en-GB')}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {formatLKR(exp.totalAmount)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        {formatLKR(exp.paidAmount)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: exp.pendingAmount > 0 ? '#ea580c' : '#64748b' }}>
                        {formatLKR(exp.pendingAmount)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                          {onOpenViewExpense && (
                            <button
                              onClick={() => onOpenViewExpense(exp)}
                              title="View Details"
                              style={{
                                padding: '4px 7px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#fff',
                                color: '#475569',
                                fontSize: '0.72rem',
                                cursor: 'pointer'
                              }}
                            >
                              View
                            </button>
                          )}
                          {onOpenEditExpense && (
                            <button
                              onClick={() => onOpenEditExpense(exp)}
                              title="Edit Expense"
                              style={{
                                padding: '4px 7px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#fff',
                                color: '#475569',
                                fontSize: '0.72rem',
                                cursor: 'pointer'
                              }}
                            >
                              Edit
                            </button>
                          )}
                          {exp.pendingAmount > 0 && onOpenPayExpense && (
                            <button
                              onClick={() => onOpenPayExpense(exp)}
                              style={{
                                padding: '4px 9px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#16a34a',
                                color: '#fff',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => onOpenHistory(exp.id)}
                            style={{
                              padding: '4px 7px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#fff',
                              color: '#475569',
                              fontSize: '0.72rem',
                              cursor: 'pointer'
                            }}
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

