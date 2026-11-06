import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';
import { getCategoryMeta, formatLKR, getStatusBadge } from './expenseConstants';
import {
  X,
  Calendar,
  DollarSign,
  Building,
  User,
  CreditCard,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Receipt,
  Edit,
  ExternalLink
} from 'lucide-react';

export const ViewExpenseModal = ({
  isOpen,
  onClose,
  expenseId,
  onOpenPayExpense,
  onOpenEditExpense
}) => {
  const { getAuthHeaders } = useAuth();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && expenseId) {
      setLoading(true);
      setError(null);
      fetch(`${API_BASE}/expenses/${expenseId}`, {
        headers: { ...getAuthHeaders() }
      })
        .then(res => res.json())
        .then(data => {
          if (!data.success) throw new Error(data.message || 'Failed to fetch expense details');
          setExpense(data.data);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || 'Error fetching expense voucher');
          setLoading(false);
        });
    }
  }, [isOpen, expenseId]);

  if (!isOpen) return null;

  const meta = expense ? getCategoryMeta(expense.category) : null;
  const isPastDue = expense?.dueDate && new Date(expense.dueDate) < new Date() && expense?.pendingAmount > 0;
  const badge = expense ? getStatusBadge(expense.status, isPastDue) : null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={20} color="#dc2626" />
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Expense Voucher Details
              </h2>
            </div>
            {expense && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
                Voucher #{expense.expenseNumber} • {expense.branch?.name || (expense.branchId === 1 ? 'JB Group (Main)' : 'Bella Design')}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Loading voucher details...
            </div>
          )}

          {error && (
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          {expense && !loading && (
            <>
              {/* Category & Status Banner */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: '12px',
                backgroundColor: meta?.bgColor || '#f8fafc',
                border: `1px solid ${meta?.borderColor || '#cbd5e1'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: meta?.color || '#0f172a',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff'
                  }}>
                    {meta?.label || expense.category}
                  </span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    {expense.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    backgroundColor: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.border}`
                  }}>
                    {badge.label}
                  </span>
                </div>
              </div>

              {/* Financial Metrics Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Total Incurred
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                    {formatLKR(expense.totalAmount)}
                  </div>
                </div>

                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
                    Paid Amount
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d', marginTop: '4px' }}>
                    {formatLKR(expense.paidAmount)}
                  </div>
                </div>

                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: expense.pendingAmount > 0 ? '#fff7ed' : '#f8fafc',
                  border: `1px solid ${expense.pendingAmount > 0 ? '#fed7aa' : '#e2e8f0'}`,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: expense.pendingAmount > 0 ? '#ea580c' : '#64748b', textTransform: 'uppercase' }}>
                    Pending Balance
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: expense.pendingAmount > 0 ? '#c2410c' : '#0f172a', marginTop: '4px' }}>
                    {formatLKR(expense.pendingAmount)}
                  </div>
                </div>
              </div>

              {/* Detailed Key-Values */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '14px',
                padding: '16px',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                border: '1px solid #f1f5f9',
                fontSize: '0.85rem'
              }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Expense Incurred Date</div>
                  <div style={{ color: '#0f172a', fontWeight: 700, marginTop: '2px' }}>
                    {new Date(expense.expenseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Settlement Due Date</div>
                  <div style={{ color: isPastDue ? '#dc2626' : '#0f172a', fontWeight: 700, marginTop: '2px' }}>
                    {expense.dueDate ? new Date(expense.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'None specified'}
                    {isPastDue && ' (OVERDUE)'}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Vendor / Beneficiary</div>
                  <div style={{ color: '#0f172a', fontWeight: 700, marginTop: '2px' }}>
                    {expense.paidTo || 'N/A'}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Branch & Recurrence</div>
                  <div style={{ color: '#0f172a', fontWeight: 700, marginTop: '2px' }}>
                    {expense.branch?.name} {expense.isRecurring ? `• Monthly (${expense.billingMonth || 'Recurring'})` : '• One-off'}
                  </div>
                </div>

                {expense.notes && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Internal Notes / Reference</div>
                    <div style={{ color: '#334155', marginTop: '2px', fontStyle: 'italic' }}>
                      {expense.notes}
                    </div>
                  </div>
                )}
              </div>

              {/* Payments History Table */}
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>
                  Payment Disbursements ({expense.payments?.length || 0})
                </h3>
                {expense.payments && expense.payments.length > 0 ? (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>Date</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>Method</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>Reference / Account</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expense.payments.map((p, idx) => (
                          <tr key={p.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px' }}>
                              {new Date(p.paymentDate).toLocaleDateString('en-GB')}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                              {p.paymentMethod}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>
                              {p.referenceNumber || 'N/A'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                              {formatLKR(p.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{
                    padding: '16px',
                    textAlign: 'center',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    color: '#64748b',
                    fontSize: '0.82rem'
                  }}>
                    No payments have been recorded yet for this voucher.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '16px'
        }}>
          <div>
            {expense && onOpenEditExpense && (
              <button
                onClick={() => {
                  onClose();
                  onOpenEditExpense(expense);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Edit size={14} /> Edit Voucher
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {expense && Number(expense.pendingAmount) > 0 && onOpenPayExpense && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPayExpense(expense);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                }}
              >
                <CreditCard size={14} /> Record Payment
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewExpenseModal;

