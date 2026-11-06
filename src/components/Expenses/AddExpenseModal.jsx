import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';
import { EXPENSE_CATEGORIES, formatLKR } from './expenseConstants';
import { X, Upload, CheckCircle, AlertCircle, Calendar, DollarSign, Tag, Building, CreditCard, User, FileText } from 'lucide-react';

export const AddExpenseModal = ({ isOpen, onClose, onExpenseAdded, initialCategory, defaultBranchId }) => {
  const { user, getAuthHeaders } = useAuth();
  const role = String(user?.role || '').toUpperCase();
  const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);
  const managerBranch = user?.branchId ? Number(user.branchId) : 1;

  const todayStr = new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(initialCategory || 'OTHER_EXPENSES');
  const [amount, setAmount] = useState('');
  const [branchId, setBranchId] = useState(isExecutive ? (defaultBranchId !== 'ALL' ? defaultBranchId : 1) : managerBranch);
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState('');
  const [isPaidNow, setIsPaidNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidBy, setPaidBy] = useState(user?.name || '');
  const [paidTo, setPaidTo] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptImage, setReceiptImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Receipt image must be smaller than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please provide an expense title.');
      return;
    }
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        amount: num,
        branchId: isExecutive ? parseInt(branchId, 10) : managerBranch,
        expenseDate,
        dueDate: dueDate || null,
        paymentStatus: isPaidNow ? 'PAID_NOW' : 'PENDING',
        paymentMethod: isPaidNow ? paymentMethod : null,
        paidBy: isPaidNow ? paidBy.trim() : null,
        paidTo: paidTo.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
        receiptImage: receiptImage || null,
        approvalStatus: 'APPROVED'
      };

      const response = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const txt = await response.text();
        throw new Error(`API error (${response.status}): Server returned ${contentType || 'non-JSON'}`);
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to record expense');
      }

      onExpenseAdded(data.data);
      onClose();
    } catch (err) {
      setError(err.message || 'Error recording expense');
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
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '650px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Header */}
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
              Record Business Expense
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Add an operational expense, utility bill, or extra cash disbursement
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              borderRadius: '8px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid #fecaca'
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Expense Title / Purpose *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. November Showroom Rent, CEB Electricity Bill, Office Printer Paper"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Row 2: Category & Branch */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Expense Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  backgroundColor: '#ffffff'
                }}
              >
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Branch *
              </label>
              {isExecutive ? (
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value={1}>Branch 1 – JB Group (Main)</option>
                  <option value={2}>Branch 2 – Bella Design</option>
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={managerBranch === 1 ? 'Branch 1 – JB Group (Main)' : 'Branch 2 – Bella Design'}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b'
                  }}
                />
              )}
            </div>
          </div>

          {/* Row 3: Amount & Payment Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Total Amount (LKR) *
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: '#64748b'
                }}>
                  LKR
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 52px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#0f172a'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Payment Status *
              </label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIsPaidNow(true)}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: isPaidNow ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    backgroundColor: isPaidNow ? '#f0fdf4' : '#ffffff',
                    color: isPaidNow ? '#15803d' : '#64748b'
                  }}
                >
                  ✓ Paid Now
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaidNow(false)}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: !isPaidNow ? '2px solid #ca8a04' : '1px solid #cbd5e1',
                    backgroundColor: !isPaidNow ? '#fefce8' : '#ffffff',
                    color: !isPaidNow ? '#a16207' : '#64748b'
                  }}
                >
                  ⏳ Pending / Bill
                </button>
              </div>
            </div>
          </div>

          {/* Row 4: Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Expense / Invoice Date *
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
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Due Date {!isPaidNow && <span style={{ color: '#dc2626' }}>*</span>}
              </label>
              <input
                type="date"
                required={!isPaidNow}
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

          {/* Conditional Paid Now Details */}
          {isPaidNow && (
            <div style={{
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Payment Execution Details
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="CASH">Cash Drawer</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Company Cheque</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="ONLINE">Online Payment</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Paid By
                  </label>
                  <input
                    type="text"
                    placeholder="Staff / Cashier Name"
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Paid To / Vendor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Landlord, CEB, Dialog"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Description & Receipt Upload */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Description / Memo
              </label>
              <textarea
                rows={3}
                placeholder="Details of expense, meter readings, reference vouchers..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  resize: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Receipt / Bill Image (Max 5MB)
              </label>
              <div style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                position: 'relative',
                height: '84px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleImageChange}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                {receiptImage ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a' }}>
                    <CheckCircle size={18} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Receipt Attached</span>
                  </div>
                ) : (
                  <>
                    <Upload size={18} color="#64748b" />
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                      Click or drag receipt photo
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px',
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '0.88rem',
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
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.25)'
              }}
            >
              {loading ? 'Recording...' : 'Save Expense Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

