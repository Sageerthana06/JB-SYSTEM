import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';
import { EXPENSE_CATEGORIES, formatLKR } from './expenseConstants';
import { X, Save, AlertCircle, Calendar, DollarSign, Building, Tag, CheckCircle2 } from 'lucide-react';

export const EditExpenseModal = ({ isOpen, onClose, expense, onExpenseUpdated }) => {
  const { getAuthHeaders } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('OFFICE_EXPENSES');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [billingMonth, setBillingMonth] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (expense && isOpen) {
      setTitle(expense.title || '');
      setCategory(expense.category || 'OFFICE_EXPENSES');
      setAmount(String(Number(expense.totalAmount) || ''));
      setDueDate(expense.dueDate ? new Date(expense.dueDate).toISOString().split('T')[0] : '');
      setExpenseDate(expense.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : '');
      setPaidTo(expense.paidTo || '');
      setDescription(expense.description || '');
      setNotes(expense.notes || '');
      setIsRecurring(Boolean(expense.isRecurring));
      setBillingMonth(expense.billingMonth || '');
      setError(null);
      setSuccess(null);
    }
  }, [expense, isOpen]);

  if (!isOpen || !expense) return null;

  const currentPaid = Number(expense.paidAmount) || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Total expense amount must be a positive number.');
      return;
    }

    if (numAmount < currentPaid - 0.01) {
      setError(`Amount cannot be less than already settled amount of ${formatLKR(currentPaid)}.`);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/expenses/${expense.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          title: title.trim(),
          category,
          amount: numAmount,
          dueDate: dueDate || null,
          expenseDate: expenseDate || new Date().toISOString(),
          paidTo: paidTo.trim() || null,
          description: description.trim() || null,
          notes: notes.trim() || null,
          isRecurring,
          billingMonth: isRecurring && billingMonth ? billingMonth : null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update expense');
      }

      setSuccess('Expense updated successfully!');
      setTimeout(() => {
        if (onExpenseUpdated) onExpenseUpdated(data.data);
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'Error updating expense record');
    } finally {
      setLoading(false);
    }
  };

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
        maxWidth: '640px',
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
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              Edit Expense Voucher
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              Voucher #{expense.expenseNumber} • Branch {expense.branchId === 1 ? '1 (JB Group Main)' : '2 (Bella Design)'}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Paid amount banner info */}
          {currentPaid > 0 && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              fontSize: '0.82rem',
              color: '#1e40af',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>
                <strong>Settled Amount:</strong> {formatLKR(currentPaid)} has already been paid for this voucher.
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '4px' }}>
                Total cannot be lower than {formatLKR(currentPaid)}
              </span>
            </div>
          )}

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Expense Title / Purpose *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Showroom Rent for November"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem'
              }}
            />
          </div>

          {/* Category & Amount Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  backgroundColor: '#ffffff'
                }}
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.key} value={cat.key}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Total Amount (LKR) *
              </label>
              <input
                type="number"
                step="0.01"
                min={currentPaid}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  fontWeight: 700
                }}
              />
            </div>
          </div>

          {/* Expense Date & Due Date Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Expense Date *
              </label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Due Date (Optional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem'
                }}
              />
            </div>
          </div>

          {/* Paid To / Beneficiary */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Paid To / Vendor / Beneficiary
            </label>
            <input
              type="text"
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
              placeholder="e.g., Ceylon Electricity Board, Landlord, Sri Lanka Telecom"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem'
              }}
            />
          </div>

          {/* Recurring Option */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
              />
              Mark as Monthly Recurring Bill (Utilities / Rent)
            </label>

            {isRecurring && (
              <input
                type="month"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              />
            )}
          </div>

          {/* Description & Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Description / Notes
            </label>
            <textarea
              rows={2}
              value={notes || description}
              onChange={(e) => {
                setNotes(e.target.value);
                setDescription(e.target.value);
              }}
              placeholder="Additional internal audit notes or voucher references..."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem'
              }}
            />
          </div>

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.25)'
              }}
            >
              <Save size={16} />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditExpenseModal;

