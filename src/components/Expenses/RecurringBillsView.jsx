import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';
import { getCategoryMeta, formatLKR, getStatusBadge } from './expenseConstants';
import {
  Calendar,
  RefreshCw,
  PlusCircle,
  CreditCard,
  History,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Building,
  Edit,
  ArrowRight
} from 'lucide-react';

export const RecurringBillsView = ({
  branchScope,
  onOpenPayExpense,
  onOpenHistory,
  onOpenEditExpense
}) => {
  const { getAuthHeaders } = useAuth();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchRecurringBills = () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (branchScope) params.set('branchId', branchScope);
    params.set('billingMonth', selectedMonth);

    fetch(`${API_BASE}/expenses/recurring?${params.toString()}`, {
      headers: { ...getAuthHeaders() }
    })
      .then(async res => {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const txt = await res.text();
          throw new Error(`API error (${res.status}): Server returned non-JSON`);
        }
        return res.json();
      })
      .then(data => {
        if (!data.success) throw new Error(data.message || 'Failed to fetch recurring bills');
        setBills(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Error loading recurring bills');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRecurringBills();
  }, [branchScope, selectedMonth]);

  const handleGenerateBills = async () => {
    if (!window.confirm(`Generate recurring monthly utility & rent commitments for ${selectedMonth}? Previous month's unpaid balances will be automatically carried over.`)) {
      return;
    }

    setGenerating(true);
    setError(null);
    setMessage(null);

    try {
      const payload = { billingMonth: selectedMonth };
      if (branchScope !== 'ALL') {
        payload.branchId = Number(branchScope);
      }

      const res = await fetch(`${API_BASE}/expenses/recurring/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to generate recurring bills');
      }

      setMessage(data.message || 'Recurring commitments generated successfully.');
      fetchRecurringBills();
    } catch (err) {
      setError(err.message || 'Error generating commitments');
    } finally {
      setGenerating(false);
    }
  };

  // Calculations
  const totalExpected = bills.reduce((sum, b) => sum + (Number(b.expectedAmount) || 0), 0);
  const totalPreviousBalance = bills.reduce((sum, b) => sum + (Number(b.previousBalance) || 0), 0);
  const totalIncurred = bills.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
  const totalPaid = bills.reduce((sum, b) => sum + (Number(b.paidAmount) || 0), 0);
  const totalPending = bills.reduce((sum, b) => sum + (Number(b.pendingAmount) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & Generation Bar */}
      <div style={{
        padding: '20px 24px',
        borderRadius: '16px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={26} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              Monthly Recurring Commitments & Utility Bills
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Track Shop Rent, Ceylon Electricity Board, Water Board, Fiber Internet, and Telephone bills with automatic unpaid balance carryover.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
              Billing Month:
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#0f172a'
              }}
            />
          </div>

          <button
            onClick={fetchRecurringBills}
            disabled={loading}
            title="Refresh"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleGenerateBills}
            disabled={generating}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: generating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
            }}
          >
            <PlusCircle size={16} />
            {generating ? 'Generating...' : `Generate ${selectedMonth} Commitments`}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#15803d',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          padding: '18px',
          borderRadius: '14px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Base Expected (Monthly)
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
            {formatLKR(totalExpected)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            Standard recurring rates
          </div>
        </div>

        <div style={{
          padding: '18px',
          borderRadius: '14px',
          backgroundColor: '#ffffff',
          border: '1px solid #fed7aa',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase' }}>
            Arrears Carried Over
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#c2410c', marginTop: '6px' }}>
            {formatLKR(totalPreviousBalance)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#ea580c', marginTop: '4px' }}>
            Previous unpaid balances
          </div>
        </div>

        <div style={{
          padding: '18px',
          borderRadius: '14px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Billed Obligation
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
            {formatLKR(totalIncurred)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            Base + carried arrears
          </div>
        </div>

        <div style={{
          padding: '18px',
          borderRadius: '14px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
            Settled (Paid)
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#15803d', marginTop: '6px' }}>
            {formatLKR(totalPaid)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '4px' }}>
            Disbursements recorded
          </div>
        </div>

        <div style={{
          padding: '18px',
          borderRadius: '14px',
          backgroundColor: totalPending > 0 ? '#fff7ed' : '#f8fafc',
          border: `1px solid ${totalPending > 0 ? '#fdba74' : '#e2e8f0'}`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: totalPending > 0 ? '#ea580c' : '#64748b', textTransform: 'uppercase' }}>
            Remaining Unpaid
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: totalPending > 0 ? '#c2410c' : '#0f172a', marginTop: '6px' }}>
            {formatLKR(totalPending)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#ea580c', marginTop: '4px' }}>
            Pending settlement
          </div>
        </div>
      </div>

      {/* Commitments Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
            Recurring Commitments for {selectedMonth} ({bills.length} bills)
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            Loading recurring bills...
          </div>
        ) : bills.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <Calendar size={36} color="#cbd5e1" style={{ marginBottom: '8px' }} />
            <p style={{ margin: 0, fontWeight: 700, color: '#334155' }}>
              No recurring commitments found for {selectedMonth}.
            </p>
            <p style={{ margin: '4px 0 16px 0', fontSize: '0.85rem' }}>
              Click "Generate {selectedMonth} Commitments" above to initialize utility and rent bills.
            </p>
            <button
              onClick={handleGenerateBills}
              disabled={generating}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Generate Commitments Now
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Category & Title</th>
                  <th style={{ padding: '12px 16px' }}>Branch</th>
                  <th style={{ padding: '12px 16px' }}>Due Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Expected</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Previous Arrears</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Billed</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Paid</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Pending</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(b => {
                  const meta = getCategoryMeta(b.category);
                  const isPastDue = b.dueDate && new Date(b.dueDate) < new Date() && b.pendingAmount > 0;
                  const badge = getStatusBadge(b.status, isPastDue);

                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: meta.bgColor,
                            color: meta.color,
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            border: `1px solid ${meta.borderColor}`
                          }}>
                            {meta.label}
                          </span>
                        </div>
                        <div style={{ fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                          {b.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {b.expenseNumber} • Vendor: {b.paidTo || 'N/A'}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#334155' }}>
                        {b.branch?.name || (b.branchId === 1 ? 'JB Group (Main)' : 'Bella Design')}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        {b.dueDate ? (
                          <div style={{ color: isPastDue ? '#dc2626' : '#0f172a', fontWeight: isPastDue ? 700 : 400 }}>
                            {new Date(b.dueDate).toLocaleDateString('en-GB')}
                            {isPastDue && ' (Overdue)'}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#475569' }}>
                        {formatLKR(b.expectedAmount)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: b.previousBalance > 0 ? '#ea580c' : '#94a3b8' }}>
                        {b.previousBalance > 0 ? `+ ${formatLKR(b.previousBalance)}` : '0.00'}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {formatLKR(b.totalAmount)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        {formatLKR(b.paidAmount)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: b.pendingAmount > 0 ? '#ea580c' : '#64748b' }}>
                        {formatLKR(b.pendingAmount)}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-block',
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

                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          {b.pendingAmount > 0 && onOpenPayExpense && (
                            <button
                              onClick={() => onOpenPayExpense(b)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <CreditCard size={13} /> Pay
                            </button>
                          )}

                          {onOpenHistory && (
                            <button
                              onClick={() => onOpenHistory(b.id)}
                              title="History"
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#475569',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <History size={13} />
                            </button>
                          )}

                          {onOpenEditExpense && (
                            <button
                              onClick={() => onOpenEditExpense(b)}
                              title="Edit"
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#475569',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <Edit size={13} />
                            </button>
                          )}
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

export default RecurringBillsView;

