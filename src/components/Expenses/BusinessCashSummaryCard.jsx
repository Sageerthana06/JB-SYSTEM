import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';
import { formatLKR } from './expenseConstants';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  Clock,
  CheckCircle,
  RefreshCw,
  Calendar,
  Building,
  Info,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const BusinessCashSummaryCard = ({ branchScope }) => {
  const { getAuthHeaders, user } = useAuth();
  const [period, setPeriod] = useState('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const role = String(user?.role || '').toUpperCase();
  const isCeo = ['SUPER_ADMIN', 'CEO'].includes(role);

  const fetchCashSummary = () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (branchScope) params.set('branchId', branchScope);
    params.set('period', period);
    if (period === 'custom' && startDate && endDate) {
      params.set('startDate', startDate);
      params.set('endDate', endDate);
    }

    fetch(`${API_BASE}/expenses/cash-summary?${params.toString()}`, {
      headers: { ...getAuthHeaders() }
    })
      .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Server returned ${res.status}: non-JSON response`);
        }
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || `HTTP ${res.status}`);
        }
        return json;
      })
      .then((res) => {
        setData(res.summary);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Error loading Business Cash Summary');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCashSummary();
  }, [branchScope, period]);

  const handleApplyCustomDates = (e) => {
    e.preventDefault();
    if (startDate && endDate) {
      fetchCashSummary();
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '24px',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}
    >
      {/* Header with Title and Date Filter Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '18px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <DollarSign size={20} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              Business Cash Summary
            </h2>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: '#f1f5f9',
                color: '#475569',
                letterSpacing: '0.04em'
              }}
            >
              CASHFLOW INTEGRATION
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Live reconciled operational cashflow: actual customer sales receipts minus settled business expenses and staff salaries.
          </p>
        </div>

        {/* Controls: Date Filter Pills & Refresh */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#f8fafc',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}
          >
            {[
              { id: 'today', label: 'Today' },
              { id: 'this_month', label: 'This Month' },
              { id: 'this_year', label: 'This Year' },
              { id: 'custom', label: 'Custom' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPeriod(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: period === tab.id ? 700 : 500,
                  backgroundColor: period === tab.id ? '#0f172a' : 'transparent',
                  color: period === tab.id ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchCashSummary}
            disabled={loading}
            title="Refresh Cash Summary"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#475569',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s'
            }}
          >
            <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker when Custom tab is selected */}
      {period === 'custom' && (
        <form
          onSubmit={handleApplyCustomDates}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} color="#64748b" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                color: '#1e293b'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                color: '#1e293b'
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '6px 16px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Apply Range
          </button>
        </form>
      )}

      {/* Loading & Error States */}
      {loading && !data && (
        <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="spin-animation" style={{ margin: '0 auto 8px auto' }} />
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Calculating live business cash balances...</p>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            borderRadius: '10px',
            border: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <AlertCircle size={20} />
          <span style={{ fontSize: '0.85rem' }}>{error}</span>
        </div>
      )}

      {/* The 7 Separate Business Cash Balance Cards */}
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px'
            }}
          >
            {/* Card 1: Total Sales Received */}
            <div
              style={{
                backgroundColor: '#f0fdf4',
                borderRadius: '12px',
                border: '1px solid #bbf7d0',
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Total Sales Received
                </span>
                <span
                  style={{
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  INFLOW (+)
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#15803d' }}>
                {formatLKR(data.totalSalesReceived)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#166534' }}>
                Cash: {formatLKR(data.breakdown?.salesByMethod?.cash || 0)} | Bank: {formatLKR(data.breakdown?.salesByMethod?.bank || 0)}
              </div>
            </div>

            {/* Card 2: Pending Customer Payments */}
            <div
              style={{
                backgroundColor: '#eff6ff',
                borderRadius: '12px',
                border: '1px solid #bfdbfe',
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  Pending Customer Payments
                </span>
                <span
                  style={{
                    backgroundColor: '#dbeafe',
                    color: '#1d4ed8',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  RECEIVABLES
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1d4ed8' }}>
                {formatLKR(data.pendingCustomerPayments)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#1e40af', fontStyle: 'italic' }}>
                Unpaid customer orders are not received cash
              </div>
            </div>

            {/* Card 3: Total Expenses */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Total Expenses
                </span>
                <span
                  style={{
                    backgroundColor: '#e2e8f0',
                    color: '#334155',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  COMMITMENTS
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1e293b' }}>
                {formatLKR(data.totalExpenses)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Paid: {formatLKR(data.expensesPaid)} + Pending: {formatLKR(data.pendingExpenses)}
              </div>
            </div>

            {/* Card 4: Expenses Paid */}
            <div
              style={{
                backgroundColor: '#fff7ed',
                borderRadius: '12px',
                border: '1px solid #fed7aa',
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9a3412', textTransform: 'uppercase' }}>
                  Expenses Paid
                </span>
                <span
                  style={{
                    backgroundColor: '#ffedd5',
                    color: '#c2410c',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  OUTFLOW (-)
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#c2410c' }}>
                {formatLKR(data.expensesPaid)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#9a3412' }}>
                Actual settled operating disbursements
              </div>
            </div>

            {/* Card 5: Pending Expenses */}
            <div
              style={{
                backgroundColor: '#fefce8',
                borderRadius: '12px',
                border: '1px solid #fef08a',
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#854d0e', textTransform: 'uppercase' }}>
                  Pending Expenses
                </span>
                <span
                  style={{
                    backgroundColor: '#fef9c3',
                    color: '#a16207',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  UNPAID
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#a16207' }}>
                {formatLKR(data.pendingExpenses)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#854d0e' }}>
                Not subtracted from available cash
              </div>
            </div>

            {/* Card 6: Salaries Paid */}
            <div
              style={{
                backgroundColor: '#faf5ff',
                borderRadius: '12px',
                border: '1px solid #e9d5ff',
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase' }}>
                  Salaries Paid
                </span>
                <span
                  style={{
                    backgroundColor: '#f3e8ff',
                    color: '#7e22ce',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  OUTFLOW (-)
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#7e22ce' }}>
                {formatLKR(data.salariesPaid)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6b21a8' }}>
                Tailor Wages: {formatLKR(data.breakdown?.salaries?.tailorPaid || 0)} | Staff: {formatLKR(data.breakdown?.salaries?.staffPaid || 0)}
              </div>
            </div>

            {/* Card 7: Remaining Cash / Net Cash Movement */}
            <div
              style={{
                backgroundColor: data.isSurplus ? '#042f2e' : '#450a0a',
                borderRadius: '12px',
                border: `1px solid ${data.isSurplus ? '#14b8a6' : '#f87171'}`,
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                color: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: data.isSurplus ? '#99f6e4' : '#fecaca', textTransform: 'uppercase' }}>
                  Remaining Cash
                </span>
                <span
                  style={{
                    backgroundColor: data.isSurplus ? 'rgba(20, 184, 166, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: data.isSurplus ? '#2dd4bf' : '#fca5a5',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontWeight: 800
                  }}
                >
                  {data.isSurplus ? 'NET SURPLUS' : 'DEFICIT'}
                </span>
              </div>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#ffffff' }}>
                {formatLKR(data.remainingCash)}
              </div>
              <div style={{ fontSize: '0.72rem', color: data.isSurplus ? '#ccfbf1' : '#fee2e2' }}>
                {data.balanceLabel}
              </div>
            </div>
          </div>

          {/* Mathematical Reconciliation Banner */}
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '0.82rem',
              color: '#334155'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>Reconciled Formula:</span>
              <span style={{ color: '#15803d', fontWeight: 700 }}>
                {formatLKR(data.totalSalesReceived)} (Sales Inflow)
              </span>
              <span>−</span>
              <span style={{ color: '#c2410c', fontWeight: 700 }}>
                {formatLKR(data.expensesPaid)} (Expenses Outflow)
              </span>
              <span>−</span>
              <span style={{ color: '#7e22ce', fontWeight: 700 }}>
                {formatLKR(data.salariesPaid)} (Salaries Outflow)
              </span>
              <span>=</span>
              <span
                style={{
                  fontWeight: 900,
                  color: data.isSurplus ? '#059669' : '#dc2626',
                  backgroundColor: data.isSurplus ? '#dcfce7' : '#fee2e2',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}
              >
                {formatLKR(data.remainingCash)}
              </span>
            </div>

            {!data.isOpeningBalanceConfigured && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#b45309',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                <Info size={14} />
                <span>Opening balance not configured; represents Net Cash Movement.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

