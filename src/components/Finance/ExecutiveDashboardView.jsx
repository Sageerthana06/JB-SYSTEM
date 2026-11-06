import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, formatCompactLKR, formatDateTimeColombo, getBranchName } from './financeUtils';
import {
  Wallet,
  Building,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export const ExecutiveDashboardView = ({ branchScope, user, getAuthHeaders, onNavigateTab }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/finance/dashboard/executive?branchId=${branchScope}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load executive dashboard');
      }
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, getAuthHeaders]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '380px', gap: '16px' }}>
        <RefreshCw className="animate-spin text-blue-600" size={36} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Loading CEO Executive Financial Telemetry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '24px', borderLeft: '4px solid var(--jb-crimson)', backgroundColor: '#FEF2F2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={24} color="var(--jb-crimson)" />
          <div>
            <h4 style={{ margin: 0, color: '#991B1B', fontWeight: 700 }}>Unable to Load Executive Dashboard</h4>
            <p style={{ margin: '4px 0 0 0', color: '#B91C1C', fontSize: '0.875rem' }}>{error}</p>
          </div>
        </div>
        <button
          onClick={fetchDashboard}
          style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
        >
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  const liquidity = data?.liquidity || {};
  const operating = data?.operatingPerformance || {};
  const pending = data?.pendingActions || {};
  const recent = data?.recentTransactions || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Controls & Status Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Executive Financial Health Overview
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Consolidated financial telemetry for {branchScope === 'ALL' ? 'Both Branches (JB Group Main & Bella Design)' : getBranchName(branchScope)}
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem'
          }}
        >
          <RefreshCw size={15} /> Refresh Data
        </button>
      </div>

      {/* 4 Primary Executive KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Card 1: Total Liquid Assets */}
        <div className="card" style={{ padding: '20px', borderRadius: '14px', background: 'linear-gradient(135deg, #0B1F3A 0%, #123C73 100%)', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.5px', color: '#93C5FD', textTransform: 'uppercase' }}>
              Total Liquid Capital
            </span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)' }}>
              <Wallet size={20} color="#93C5FD" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '8px' }}>
            {formatLKR(liquidity.totalLiquid)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#E2E8F0', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '10px' }}>
            <span>Cash in Drawers: <strong>{formatCompactLKR(liquidity.totalCash)}</strong></span>
            <span>Bank: <strong>{formatCompactLKR(liquidity.totalBank)}</strong></span>
          </div>
        </div>

        {/* Card 2: This Month Revenue */}
        <div className="card" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Month Verified Revenue
            </span>
            <div style={{ padding: '8px', borderRadius: '10px', background: '#D1FAE5', color: '#059669' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '8px' }}>
            {formatLKR(operating.monthRevenue)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            Today's Inflow: <strong style={{ color: '#059669' }}>{formatLKR(operating.todayRevenue)}</strong>
          </div>
        </div>

        {/* Card 3: This Month Operating Expenses */}
        <div className="card" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Month Operating Expenses
            </span>
            <div style={{ padding: '8px', borderRadius: '10px', background: '#FEE2E2', color: '#DC2626' }}>
              <TrendingDown size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '8px' }}>
            {formatLKR(operating.monthExpense)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            Today's Outflow: <strong style={{ color: '#DC2626' }}>{formatLKR(operating.todayExpense)}</strong>
          </div>
        </div>

        {/* Card 4: Month Net Operating Result */}
        <div className="card" style={{ padding: '20px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Month Net Operating
            </span>
            <div style={{
              padding: '8px',
              borderRadius: '10px',
              background: operating.monthNetOperating >= 0 ? '#D1FAE5' : '#FEE2E2',
              color: operating.monthNetOperating >= 0 ? '#059669' : '#DC2626'
            }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{
            fontSize: '1.75rem',
            fontWeight: 900,
            color: operating.monthNetOperating >= 0 ? '#059669' : '#DC2626',
            marginBottom: '8px'
          }}>
            {formatLKR(operating.monthNetOperating)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            Excludes internal transfers & non-cash deposits
          </div>
        </div>
      </div>

      {/* Pending Action Alerts Banner */}
      {(pending.pendingPayrollCount > 0 || pending.pendingAdvancesCount > 0) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderRadius: '12px',
          background: '#FFFBEB',
          border: '1px solid #FCD34D',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={22} color="#D97706" />
            <div>
              <strong style={{ color: '#92400E', fontSize: '0.9rem' }}>Financial Actions Requiring Attention:</strong>
              <span style={{ color: '#B45309', fontSize: '0.85rem', marginLeft: '8px' }}>
                {pending.pendingPayrollCount > 0 && `${pending.pendingPayrollCount} Draft Payroll(s) to disburse`}
                {pending.pendingPayrollCount > 0 && pending.pendingAdvancesCount > 0 && ' • '}
                {pending.pendingAdvancesCount > 0 && `${pending.pendingAdvancesCount} Salary Advance(s) pending (${formatLKR(pending.pendingAdvancesTotal)})`}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {pending.pendingPayrollCount > 0 && (
              <button
                onClick={() => onNavigateTab('payroll')}
                style={{ padding: '6px 12px', borderRadius: '8px', background: '#D97706', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
              >
                Review Payroll
              </button>
            )}
            {pending.pendingAdvancesCount > 0 && (
              <button
                onClick={() => onNavigateTab('advances')}
                style={{ padding: '6px 12px', borderRadius: '8px', background: '#B45309', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
              >
                Review Advances
              </button>
            )}
          </div>
        </div>
      )}

      {/* Account Balances Grid */}
      <div className="card" style={{ padding: '24px', borderRadius: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Active Cash Drawers & Bank Accounts
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Real-time balance breakdown across authorized cash registers and bank accounts
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('accounts')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#2563EB', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            Manage Accounts <ArrowRight size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {(liquidity.accounts || []).map(acc => (
            <div
              key={acc.id}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: acc.type === 'CASH' ? '#FEF3C7' : '#DBEAFE',
                  color: acc.type === 'CASH' ? '#92400E' : '#1E40AF',
                  textTransform: 'uppercase'
                }}>
                  {acc.type}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{acc.branchName}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                {acc.name}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: acc.balance >= 0 ? '#0B1F3A' : '#DC2626' }}>
                {formatLKR(acc.balance)}
              </div>
            </div>
          ))}
          {(!liquidity.accounts || liquidity.accounts.length === 0) && (
            <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No financial accounts found. Click "Manage Accounts" to initialize a Cash Drawer or Bank Account.
            </div>
          )}
        </div>
      </div>

      {/* Recent Ledger Transactions */}
      <div className="card" style={{ padding: '24px', borderRadius: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Recent General Ledger Feed
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Last 10 financial entries recorded in PostgreSQL general ledger
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('transactions')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#2563EB', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            View Full Ledger <ArrowRight size={16} />
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 12px' }}>Txn #</th>
                <th style={{ padding: '10px 12px' }}>Date</th>
                <th style={{ padding: '10px 12px' }}>Branch</th>
                <th style={{ padding: '10px 12px' }}>Type</th>
                <th style={{ padding: '10px 12px' }}>Category</th>
                <th style={{ padding: '10px 12px' }}>Account</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(t => {
                const isInc = t.type === 'INCOME' || t.type === 'TRANSFER_IN';
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#2563EB' }}>{t.transactionNumber}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{formatDateTimeColombo(t.date)}</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{t.branchName || 'JB Group'}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: isInc ? '#D1FAE5' : '#FEE2E2',
                        color: isInc ? '#059669' : '#DC2626'
                      }}>
                        {isInc ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {t.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-main)' }}>{t.category || 'General'}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{t.account || '—'}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: isInc ? '#059669' : '#DC2626' }}>
                      {isInc ? `+${formatLKR(t.amount)}` : `-${formatLKR(t.amount)}`}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: t.status === 'APPROVED' ? '#E0F2FE' : (t.status === 'REVERSED' ? '#F3F4F6' : '#FEF3C7'),
                        color: t.status === 'APPROVED' ? '#0369A1' : (t.status === 'REVERSED' ? '#6B7280' : '#B45309')
                      }}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No recent financial transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboardView;

