import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';
import { getCategoryMeta, formatLKR, getStatusBadge } from './expenseConstants';
import {
  Plus,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  CreditCard,
  User,
  FileText,
  ExternalLink,
  History,
  Trash2,
  Eye,
  Edit,
  Building,
  Zap,
  Droplet,
  Wifi,
  Phone,
  Users,
  Truck,
  Briefcase,
  Wrench,
  Hammer,
  Heart,
  ShoppingBag,
  Send,
  AlertTriangle,
  PlusCircle,
  Receipt
} from 'lucide-react';

const ICON_MAP = {
  Building,
  Zap,
  Droplet,
  Wifi,
  Phone,
  Users,
  Truck,
  Briefcase,
  Wrench,
  Hammer,
  Heart,
  ShoppingBag,
  Send,
  AlertTriangle,
  PlusCircle,
  Receipt
};

export const ExpenseCategorySectionView = ({
  categoryKey,
  branchScope,
  onOpenAddExpense,
  onOpenPayExpense,
  onOpenHistory,
  onOpenViewExpense,
  onOpenEditExpense,
  onExpenseDeleted
}) => {
  const { getAuthHeaders, user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const meta = getCategoryMeta(categoryKey);
  const IconComponent = ICON_MAP[meta.iconName] || Receipt;

  const fetchExpenses = () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (branchScope) params.set('branchId', branchScope);
    params.set('category', categoryKey);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());

    fetch(`${API_BASE}/expenses?${params.toString()}`, {
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
        if (!data.success) throw new Error(data.message || 'Failed to load expenses');
        setExpenses(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Error loading category expenses');
        setLoading(false);
      });
  };

  const handleDeleteExpense = async (exp) => {
    if (Number(exp.paidAmount) > 0) {
      alert(`Cannot delete or cancel expense ${exp.expenseNumber} because LKR ${Number(exp.paidAmount).toLocaleString()} has already been paid. Financial safety rule.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to cancel and delete expense voucher ${exp.expenseNumber} (${exp.title})?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/expenses/${exp.id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to cancel expense');
      }
      fetchExpenses();
      if (onExpenseDeleted) onExpenseDeleted();
    } catch (err) {
      alert(err.message || 'Error deleting expense voucher');
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [categoryKey, branchScope, statusFilter]);

  // Aggregate stats
  const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.totalAmount) || 0), 0);
  const paidAmount = expenses.reduce((sum, e) => sum + (Number(e.paidAmount) || 0), 0);
  const pendingAmount = expenses.reduce((sum, e) => sum + (Number(e.pendingAmount) || 0), 0);
  const overdueCount = expenses.filter(e => {
    return e.dueDate && new Date(e.dueDate) < new Date() && Number(e.pendingAmount) > 0;
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Category Banner */}
      <div style={{
        padding: '24px',
        borderRadius: '16px',
        backgroundColor: meta.bgColor,
        border: `1px solid ${meta.borderColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            backgroundColor: meta.color,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 8px 16px -4px ${meta.color}40`
          }}>
            <IconComponent size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                {meta.label}
              </h1>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                color: meta.color,
                border: `1px solid ${meta.borderColor}`
              }}>
                Category Section
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
              {meta.desc}
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenAddExpense(categoryKey)}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: meta.color,
            color: '#ffffff',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: `0 4px 8px -2px ${meta.color}50`
          }}
        >
          <Plus size={18} /> Add {meta.label} Expense
        </button>
      </div>

      {/* KPI Cards for This Category */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          padding: '18px 20px',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Incurred
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
            {formatLKR(totalAmount)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {expenses.length} expense record{expenses.length === 1 ? '' : 's'}
          </span>
        </div>

        <div style={{
          padding: '18px 20px',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          border: '1px solid #bbf7d0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
            Total Paid
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>
            {formatLKR(paidAmount)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>
            Confirmed settlements
          </span>
        </div>

        <div style={{
          padding: '18px 20px',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          border: '1px solid #fed7aa',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase' }}>
            Total Pending
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ea580c', marginTop: '6px' }}>
            {formatLKR(pendingAmount)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#ea580c' }}>
            Awaiting payment
          </span>
        </div>

        <div style={{
          padding: '18px 20px',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          border: overdueCount > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: overdueCount > 0 ? '#dc2626' : '#64748b', textTransform: 'uppercase' }}>
            Overdue Bills
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: overdueCount > 0 ? '#dc2626' : '#64748b', marginTop: '6px' }}>
            {overdueCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: overdueCount > 0 ? '#dc2626' : '#64748b' }}>
            {overdueCount > 0 ? 'Past payment due date' : 'All bills up to date'}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        padding: '14px 18px',
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by title, provider, voucher number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchExpenses()}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '0.88rem',
              color: '#0f172a'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>Status:</span>
          {['ALL', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: statusFilter === st ? '1px solid #0284c7' : '1px solid #cbd5e1',
                backgroundColor: statusFilter === st ? '#eff6ff' : '#ffffff',
                color: statusFilter === st ? '#0284c7' : '#64748b'
              }}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table / List View */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            Loading {meta.label} expenses...
          </div>
        ) : error ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>
            {error}
          </div>
        ) : expenses.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <FileText size={36} color="#cbd5e1" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#0f172a' }}>
              No {meta.label} records found
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              Click "Add {meta.label} Expense" to record a bill or payment.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Expense Details</th>
                  <th style={{ padding: '12px 16px' }}>Branch</th>
                  <th style={{ padding: '12px 16px' }}>Dates</th>
                  <th style={{ padding: '12px 16px' }}>Paid By / To</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Paid</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Pending</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => {
                  const isPastDue = exp.dueDate && new Date(exp.dueDate) < new Date() && exp.pendingAmount > 0;
                  const badge = getStatusBadge(exp.status, isPastDue);

                  return (
                    <tr
                      key={exp.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Expense Details */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>
                          {exp.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {exp.expenseNumber} • Method: {exp.paymentMethod || 'Unpaid'}
                        </div>
                        {exp.description && (
                          <div style={{ fontSize: '0.74rem', color: '#475569', fontStyle: 'italic', marginTop: '3px' }}>
                            {exp.description}
                          </div>
                        )}
                      </td>

                      {/* Branch */}
                      <td style={{ padding: '14px 16px', color: '#334155', fontWeight: 600 }}>
                        {exp.branch?.name || (exp.branchId === 1 ? 'JB Group (Main)' : 'Bella Design')}
                      </td>

                      {/* Dates */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ color: '#0f172a' }}>
                          Date: {new Date(exp.expenseDate).toLocaleDateString('en-GB')}
                        </div>
                        {exp.dueDate && (
                          <div style={{ fontSize: '0.75rem', color: isPastDue ? '#dc2626' : '#64748b', fontWeight: isPastDue ? 700 : 400 }}>
                            Due: {new Date(exp.dueDate).toLocaleDateString('en-GB')} {isPastDue && '(Overdue)'}
                          </div>
                        )}
                      </td>

                      {/* Paid By / Paid To */}
                      <td style={{ padding: '14px 16px' }}>
                        {exp.paidTo && (
                          <div style={{ color: '#0f172a', fontWeight: 600 }}>
                            To: {exp.paidTo}
                          </div>
                        )}
                        {exp.paidBy && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            By: {exp.paidBy}
                          </div>
                        )}
                      </td>

                      {/* Total */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {formatLKR(exp.totalAmount)}
                      </td>

                      {/* Paid */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        {formatLKR(exp.paidAmount)}
                      </td>

                      {/* Pending */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: exp.pendingAmount > 0 ? '#ea580c' : '#64748b' }}>
                        {formatLKR(exp.pendingAmount)}
                      </td>

                      {/* Status */}
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

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                          {onOpenViewExpense && (
                            <button
                              onClick={() => onOpenViewExpense(exp)}
                              title="View Voucher Details"
                              style={{
                                padding: '5px 7px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#475569',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Eye size={13} />
                            </button>
                          )}

                          {onOpenEditExpense && (
                            <button
                              onClick={() => onOpenEditExpense(exp)}
                              title="Edit Voucher"
                              style={{
                                padding: '5px 7px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#475569',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Edit size={13} />
                            </button>
                          )}

                          {exp.pendingAmount > 0 && (
                            <button
                              onClick={() => onOpenPayExpense(exp)}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <CreditCard size={13} /> Pay
                            </button>
                          )}

                          <button
                            onClick={() => onOpenHistory(exp.id)}
                            title="View Payment History"
                            style={{
                              padding: '5px 7px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#475569',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <History size={13} />
                          </button>

                          {Number(exp.paidAmount) === 0 && (
                            <button
                              onClick={() => handleDeleteExpense(exp)}
                              title="Cancel & Delete Voucher"
                              style={{
                                padding: '5px 7px',
                                borderRadius: '6px',
                                border: '1px solid #fecaca',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}

                          {exp.receiptImage && (
                            <button
                              onClick={() => setSelectedReceipt(exp.receiptImage)}
                              title="View Receipt"
                              style={{
                                padding: '5px 7px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#f8fafc',
                                color: '#0284c7',
                                cursor: 'pointer'
                              }}
                            >
                              <ExternalLink size={13} />
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

      {/* Receipt Preview Modal */}
      {selectedReceipt && (
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
              onClick={() => setSelectedReceipt(null)}
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
              ✕
            </button>
            <img
              src={selectedReceipt}
              alt="Receipt Attachment"
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

