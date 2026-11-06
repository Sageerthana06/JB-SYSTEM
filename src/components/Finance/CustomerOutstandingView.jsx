import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, getBranchName, formatDateColombo } from './financeUtils';
import {
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  Phone,
  Mail,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  AlertTriangle
} from 'lucide-react';

export const CustomerOutstandingView = ({ branchScope, user, getAuthHeaders }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [agingFilter, setAgingFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomerIds, setExpandedCustomerIds] = useState(new Set());

  const fetchReceivables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchScope) params.append('branchId', branchScope);
      if (agingFilter && agingFilter !== 'all') params.append('aging', agingFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`${API_BASE}/finance/reports/customer-outstanding?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to fetch customer outstanding');
      }
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, agingFilter, searchQuery, getAuthHeaders]);

  useEffect(() => {
    fetchReceivables();
  }, [fetchReceivables]);

  const toggleExpand = (customerId) => {
    setExpandedCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const aging = data?.agingSummary || {};
  const customers = data?.customers || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Customer Outstanding & Aging (Accounts Receivable)
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Track outstanding order balances owed by clients across Branch 1 & Branch 2
          </p>
        </div>

        <button
          onClick={fetchReceivables}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '10px',
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

      {/* 5 Aging KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        {/* Total Outstanding */}
        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #DC2626' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Outstanding (AR)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#DC2626', marginTop: '4px' }}>
            {formatLKR(data?.totalOutstanding || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {data?.totalCustomers || 0} clients with balance due
          </div>
        </div>

        {/* Current: 0-30 days */}
        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Current (0–30 Days)
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
            {formatLKR(aging.current?.amount || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {aging.current?.count || 0} orders
          </div>
        </div>

        {/* Overdue 31-60 days */}
        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #D97706' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Overdue (31–60 Days)
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
            {formatLKR(aging.overdue_30?.amount || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {aging.overdue_30?.count || 0} orders
          </div>
        </div>

        {/* Overdue 61-90 days */}
        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #EA580C' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Overdue (61–90 Days)
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#EA580C', marginTop: '4px' }}>
            {formatLKR(aging.overdue_60?.amount || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {aging.overdue_60?.count || 0} orders
          </div>
        </div>

        {/* Overdue 90+ days */}
        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #991B1B' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Critical Overdue (90+ Days)
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#991B1B', marginTop: '4px' }}>
            {formatLKR(aging.overdue_90_plus?.amount || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {aging.overdue_90_plus?.count || 0} orders
          </div>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search customer, phone, or order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem',
                width: '100%',
                background: 'var(--bg-main)'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Aging' },
              { id: 'current', label: '0–30 Days' },
              { id: 'overdue_30', label: '31–60 Days' },
              { id: 'overdue_60', label: '61–90 Days' },
              { id: 'overdue_90_plus', label: '90+ Days' }
            ].map(b => (
              <button
                key={b.id}
                onClick={() => setAgingFilter(b.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: agingFilter === b.id ? '1px solid #2563EB' : '1px solid var(--border-color)',
                  background: agingFilter === b.id ? '#EFF6FF' : 'var(--bg-main)',
                  color: agingFilter === b.id ? '#1E40AF' : 'var(--text-main)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.78rem'
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Showing <strong>{customers.length}</strong> clients
        </div>
      </div>

      {/* Customer Outstanding Table */}
      <div className="card" style={{ padding: '20px', borderRadius: '14px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <RefreshCw className="animate-spin text-blue-600" size={32} />
          </div>
        ) : error ? (
          <div style={{ padding: '20px', backgroundColor: '#FEF2F2', borderLeft: '4px solid var(--jb-crimson)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991B1B', fontWeight: 600 }}>
              <AlertCircle size={20} /> {error}
            </div>
          </div>
        ) : customers.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>No Outstanding Receivables Found</h3>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>
              All client orders matching this criteria have been fully settled.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ width: '32px' }}></th>
                  <th style={{ padding: '12px 10px' }}>Customer Name</th>
                  <th style={{ padding: '12px 10px' }}>Contact Phone</th>
                  <th style={{ padding: '12px 10px' }}>Branch</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Total Outstanding</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>Unpaid Orders</th>
                  <th style={{ padding: '12px 10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => {
                  const isExpanded = expandedCustomerIds.has(c.customerId);
                  return (
                    <React.Fragment key={c.customerId}>
                      <tr
                        onClick={() => toggleExpand(c.customerId)}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          backgroundColor: isExpanded ? 'var(--bg-main)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '12px 6px', textAlign: 'center' }}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: 700, color: 'var(--text-main)' }}>
                          {c.customerName}
                        </td>
                        <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Phone size={13} /> {c.phone}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                          {c.branchName}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 900, color: '#DC2626', fontSize: '0.95rem' }}>
                          {formatLKR(c.totalOutstanding)}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          <span style={{ background: '#FEE2E2', color: '#991B1B', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                            {c.orders.length} order(s)
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ color: '#2563EB', fontWeight: 600, fontSize: '0.78rem' }}>
                            {isExpanded ? 'Hide Details' : 'View Orders'}
                          </span>
                        </td>
                      </tr>

                      {/* Expandable Order Breakdown */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: '12px 24px', backgroundColor: 'var(--bg-main)' }}>
                            <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#fff', border: '1px solid var(--border-color)' }}>
                              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                Unpaid Orders for {c.customerName}:
                              </h4>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '6px 8px' }}>Order #</th>
                                    <th style={{ padding: '6px 8px' }}>Order Date</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Order Total</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Verified Paid</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Balance Due</th>
                                    <th style={{ padding: '6px 8px' }}>Aging</th>
                                    <th style={{ padding: '6px 8px' }}>Stage</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.orders.map(o => (
                                    <tr key={o.orderId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                      <td style={{ padding: '8px', fontWeight: 700, color: '#2563EB' }}>{o.orderNumber}</td>
                                      <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{formatDateColombo(o.orderDate)}</td>
                                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatLKR(o.orderTotal)}</td>
                                      <td style={{ padding: '8px', textAlign: 'right', color: '#059669' }}>{formatLKR(o.paidAmount)}</td>
                                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: '#DC2626' }}>{formatLKR(o.balanceDue)}</td>
                                      <td style={{ padding: '8px' }}>
                                        <span style={{
                                          fontSize: '0.7rem',
                                          fontWeight: 700,
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          backgroundColor: o.daysOutstanding > 60 ? '#FEE2E2' : (o.daysOutstanding > 30 ? '#FEF3C7' : '#D1FAE5'),
                                          color: o.daysOutstanding > 60 ? '#991B1B' : (o.daysOutstanding > 30 ? '#92400E' : '#065F46')
                                        }}>
                                          {o.daysOutstanding} days overdue
                                        </span>
                                      </td>
                                      <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{o.orderStatus}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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

export default CustomerOutstandingView;

