import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';
import { formatLKR, getCategoryMeta, getStatusBadge } from './expenseConstants';
import { X, Calendar, User, CreditCard, FileText, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';

export const ExpensePaymentHistoryModal = ({ isOpen, onClose, expenseId }) => {
  const { getAuthHeaders } = useAuth();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (!isOpen || !expenseId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/expenses/${expenseId}`, {
      headers: { ...getAuthHeaders() }
    })
      .then(async res => {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const txt = await res.text();
          throw new Error(`API error (${res.status}): Server returned ${contentType || 'non-JSON'}`);
        }
        return res.json();
      })
      .then(data => {
        if (!data.success) throw new Error(data.message || 'Failed to fetch expense');
        if (isMounted) {
          setExpense(data.data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message || 'Error loading payment history');
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [isOpen, expenseId]);

  if (!isOpen) return null;

  const categoryMeta = expense ? getCategoryMeta(expense.category) : null;
  const statusBadge = (expense && getStatusBadge(expense.status, expense.dueDate && new Date(expense.dueDate) < new Date() && expense.pendingAmount > 0)) || { label: 'PENDING', bg: '#fefce8', color: '#ca8a04', border: '#fef08a' };

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
      zIndex: 9999,
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
        border: '1px solid #e2e8f0',
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
          backgroundColor: '#f8fafc'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              Expense Payment Audit Trail
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Historical payment disbursements and voucher records
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Loading payment history...
            </div>
          )}

          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              borderRadius: '8px',
              fontSize: '0.85rem'
            }}>
              {error}
            </div>
          )}

          {!loading && expense && (
            <>
              {/* Summary Card */}
              <div style={{
                padding: '18px 20px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '16px'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Expense Details
                  </span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {expense.expenseNumber}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                    {expense.title}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Total Amount
                  </span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {formatLKR(expense.totalAmount)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
                    Paid to Date
                  </span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                    {formatLKR(expense.paidAmount)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
                    Pending Balance
                  </span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
                    {formatLKR(expense.pendingAmount)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Current Status
                  </span>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      backgroundColor: statusBadge.bg,
                      color: statusBadge.color,
                      border: `1px solid ${statusBadge.border}`
                    }}>
                      {statusBadge.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payments List */}
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>
                  Payment Disbursements ({expense.payments.length})
                </h3>

                {expense.payments.length === 0 ? (
                  <div style={{
                    padding: '32px',
                    textAlign: 'center',
                    backgroundColor: '#fffbeb',
                    borderRadius: '8px',
                    border: '1px solid #fef3c7',
                    color: '#92400e',
                    fontSize: '0.88rem'
                  }}>
                    No payments recorded yet for this expense. Total pending: {formatLKR(expense.pendingAmount)}.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {expense.payments.map((p, idx) => (
                      <div
                        key={p.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#f0fdf4',
                            color: '#16a34a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 800
                          }}>
                            #{idx + 1}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                              {p.paymentNumber} • {formatLKR(p.amount)}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '12px', marginTop: '2px' }}>
                              <span>Date: {new Date(p.paymentDate).toLocaleDateString('en-GB')}</span>
                              <span>Method: {p.paymentMethod}</span>
                              {p.paidBy && <span>Paid By: {p.paidBy}</span>}
                              {p.paidTo && <span>To: {p.paidTo}</span>}
                            </div>
                            {p.notes && (
                              <div style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic', marginTop: '4px' }}>
                                Notes: {p.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        {p.receiptImage && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(p.receiptImage)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#f8fafc',
                              color: '#0284c7',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <ExternalLink size={14} /> View Receipt
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Receipt Image Preview Modal */}
              {previewImage && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10000,
                  padding: '20px'
                }}>
                  <div style={{ position: 'relative', maxWidth: '85vw', maxHeight: '85vh' }}>
                    <button
                      onClick={() => setPreviewImage(null)}
                      style={{
                        position: 'absolute',
                        top: '-14px',
                        right: '-14px',
                        background: '#ffffff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <X size={18} />
                    </button>
                    <img
                      src={previewImage}
                      alt="Receipt Voucher"
                      style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#f8fafc'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpensePaymentHistoryModal;

