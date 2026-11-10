import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  CreditCard,
  Calendar,
  Layers,
  FileCheck
} from 'lucide-react';

const formatLKR = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const SalesPaymentSummarySection = ({ branchId, refreshTrigger }) => {
  const { getAuthHeaders } = useAuth();
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (branchId && branchId !== 'ALL') {
        params.set('branchId', branchId);
      }
      params.set('period', period);

      const headers = getAuthHeaders ? getAuthHeaders() : {
        'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
      };

      const res = await fetch(`${API_URL}/api/orders/payment-summary?${params.toString()}`, { headers });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Server returned HTTP ${res.status} non-JSON`);
      }
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `HTTP ${res.status}`);
      }

      setData(json.summary);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Error loading payment summary');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [branchId, period, refreshTrigger]);

  const summary = data || {
    totalOrderValue: 0,
    totalCustomerPaymentsReceived: 0,
    totalCustomerPaymentsApplied: 0,
    totalCustomerOverpayments: 0,
    totalCustomerPendingBalance: 0,
    netCustomerPendingBalance: 0,
    averageOrderValue: 0,
    fullyPaidOrdersCount: 0,
    partiallyPaidOrdersCount: 0,
    unpaidOrdersCount: 0,
    totalOutstandingOrdersCount: 0,
    overpaidOrdersCount: 0,
    pricedOrdersCount: 0,
    processedOrdersCount: 0
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '14px',
        border: '1px solid var(--border-color, #e2e8f0)',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      {/* Header with Title and Period Filter Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border-color, #f1f5f9)',
          paddingBottom: '14px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <DollarSign size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
              Sales & Payment Summary
            </h3>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.7rem',
                fontWeight: 700,
                backgroundColor: '#f1f5f9',
                color: '#475569'
              }}
            >
              LIVE POSTGRESQL RECONCILIATION
            </span>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
            Real-time tracking of order values, actual customer receipts, and pending receivables (Asia/Colombo).
          </p>
        </div>

        {/* Date Filter Pills & Refresh Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#f8fafc',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}
          >
            {[
              { id: 'today', label: 'Today' },
              { id: 'this_month', label: 'This Month' },
              { id: 'this_year', label: 'This Year' },
              { id: 'all', label: 'All Time' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPeriod(tab.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.78rem',
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
            onClick={fetchSummary}
            disabled={loading}
            title="Refresh Sales Payment Summary"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#475569',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            borderRadius: '8px',
            border: '1px solid #fecaca',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* The 7 Live Database Values */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}
      >
        {/* 1. Total Order Value */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #3b82f6',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Total Order Value
            </span>
            <span style={{ color: '#3b82f6' }}><CreditCard size={15} /></span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1e293b' }}>
            LKR {formatLKR(summary.totalOrderValue)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
            {summary.processedOrdersCount} active priced order{summary.processedOrdersCount === 1 ? '' : 's'}
          </div>
        </div>

        {/* 2. Total Customer Payments Received */}
        <div
          style={{
            backgroundColor: '#f0fdf4',
            borderRadius: '10px',
            border: '1px solid #bbf7d0',
            borderLeft: '4px solid #16a34a',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
              Payments Received
            </span>
            <span style={{ color: '#16a34a' }}><CheckCircle2 size={15} /></span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#15803d' }}>
            LKR {formatLKR(summary.totalCustomerPaymentsReceived)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
            <span>Verified settlements</span>
            {summary.totalCustomerOverpayments > 0 && (
              <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem' }}>
                +LKR {formatLKR(summary.totalCustomerOverpayments)} credit
              </span>
            )}
          </div>
        </div>

        {/* 3. Total Customer Pending Balance */}
        <div
          style={{
            backgroundColor: summary.totalCustomerPendingBalance > 0 ? '#fff7ed' : '#f0fdf4',
            borderRadius: '10px',
            border: `1px solid ${summary.totalCustomerPendingBalance > 0 ? '#fed7aa' : '#bbf7d0'}`,
            borderLeft: `4px solid ${summary.totalCustomerPendingBalance > 0 ? '#ea580c' : '#16a34a'}`,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: summary.totalCustomerPendingBalance > 0 ? '#9a3412' : '#166534', textTransform: 'uppercase' }}>
              Pending Balance
            </span>
            <span style={{ color: summary.totalCustomerPendingBalance > 0 ? '#ea580c' : '#16a34a' }}>
              <Clock size={15} />
            </span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: summary.totalCustomerPendingBalance > 0 ? '#c2410c' : '#15803d' }}>
            LKR {formatLKR(summary.totalCustomerPendingBalance)}
          </div>
          <div style={{ fontSize: '0.72rem', color: summary.totalCustomerPendingBalance > 0 ? '#9a3412' : '#166534' }}>
            {summary.totalCustomerOverpayments > 0
              ? `Gross: LKR ${formatLKR(summary.totalCustomerPendingBalance)} · Net Due: LKR ${formatLKR(summary.netCustomerPendingBalance != null ? summary.netCustomerPendingBalance : (summary.totalCustomerPendingBalance - summary.totalCustomerOverpayments))}`
              : 'Order Total − Payments Received'}
          </div>
        </div>

        {/* 4. Fully Paid Orders Count */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #10b981',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Fully Paid Orders
            </span>
            <span
              style={{
                backgroundColor: '#d1fae5',
                color: '#065f46',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.68rem',
                fontWeight: 700
              }}
            >
              SETTLED
            </span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#059669' }}>
            {summary.fullyPaidOrdersCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Zero remaining balance
          </div>
        </div>

        {/* 5. Partially Paid Orders Count */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #f59e0b',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Partially Paid Orders
            </span>
            <span
              style={{
                backgroundColor: '#fef3c7',
                color: '#92400e',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.68rem',
                fontWeight: 700
              }}
            >
              PARTIAL
            </span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#d97706' }}>
            {summary.partiallyPaidOrdersCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Advance paid, balance pending
          </div>
        </div>

        {/* 6. Unpaid Orders Count */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #ef4444',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Unpaid Orders
            </span>
            <span
              style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.68rem',
                fontWeight: 700
              }}
            >
              UNPAID
            </span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#dc2626' }}>
            {summary.unpaidOrdersCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Zero payments received
          </div>
        </div>

        {/* 7. Total Outstanding Orders Count */}
        <div
          style={{
            backgroundColor: '#faf5ff',
            borderRadius: '10px',
            border: '1px solid #e9d5ff',
            borderLeft: '4px solid #8b5cf6',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase' }}>
              Total Outstanding Orders
            </span>
            <span
              style={{
                backgroundColor: '#f3e8ff',
                color: '#6b21a8',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.68rem',
                fontWeight: 700
              }}
            >
              COLLECTION
            </span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#7c3aed' }}>
            {summary.totalOutstandingOrdersCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b21a8' }}>
            {summary.partiallyPaidOrdersCount} Partial + {summary.unpaidOrdersCount} Unpaid
          </div>
        </div>
      </div>

      {/* Formula & Count Reconciliation Footnote */}
      <div
        style={{
          padding: '10px 14px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '0.78rem',
          color: '#475569'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>Balance Formula:</span>
          {summary.totalCustomerOverpayments > 0 ? (
            <>
              <span>Order Value (LKR {formatLKR(summary.totalOrderValue)})</span>
              <span>−</span>
              <span>Applied Payments (LKR {formatLKR(summary.totalCustomerPaymentsApplied != null ? summary.totalCustomerPaymentsApplied : (summary.totalOrderValue - summary.totalCustomerPendingBalance))})</span>
              <span>=</span>
              <span style={{ fontWeight: 800, color: summary.totalCustomerPendingBalance > 0 ? '#c2410c' : '#15803d' }}>
                Pending Balance (LKR {formatLKR(summary.totalCustomerPendingBalance)})
              </span>
              <span style={{ color: '#94a3b8', margin: '0 4px' }}>|</span>
              <span style={{ color: '#0369a1', fontWeight: 600 }}>
                Total Cash Received: LKR {formatLKR(summary.totalCustomerPaymentsReceived)} (incl. LKR {formatLKR(summary.totalCustomerOverpayments)} customer credit)
              </span>
              <span style={{ color: '#94a3b8', margin: '0 4px' }}>|</span>
              <span style={{ color: '#15803d', fontWeight: 700 }}>
                Net Due: LKR {formatLKR(summary.netCustomerPendingBalance != null ? summary.netCustomerPendingBalance : (summary.totalOrderValue - summary.totalCustomerPaymentsReceived))}
              </span>
            </>
          ) : (
            <>
              <span>Order Value (LKR {formatLKR(summary.totalOrderValue)})</span>
              <span>−</span>
              <span>Received (LKR {formatLKR(summary.totalCustomerPaymentsReceived)})</span>
              <span>=</span>
              <span style={{ fontWeight: 800, color: summary.totalCustomerPendingBalance > 0 ? '#c2410c' : '#15803d' }}>
                Pending Balance (LKR {formatLKR(summary.totalCustomerPendingBalance)})
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>Order Counts:</span>
          <span>{summary.fullyPaidOrdersCount} Paid + {summary.totalOutstandingOrdersCount} Outstanding = {summary.processedOrdersCount} Orders Total</span>
        </div>
      </div>
    </div>
  );
};

