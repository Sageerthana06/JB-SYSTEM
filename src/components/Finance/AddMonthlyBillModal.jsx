import React, { useState } from 'react';
import { API_BASE } from '../../config/api';
import { X, Calendar, Upload, AlertCircle, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { getColomboTodayDateString } from './financeUtils';

const BILL_CATEGORIES = [
  { value: 'RENT', label: '1. Shop / Office Rent' },
  { value: 'ELECTRICITY', label: '2. Electricity / Current Bill' },
  { value: 'WATER', label: '3. Water Utility Bill' },
  { value: 'INTERNET', label: '4. Internet & Fiber Bill' },
  { value: 'TELEPHONE', label: '5. Telephone & Mobile Bill' },
  { value: 'SECURITY', label: '6. Security & Surveillance Charges' },
  { value: 'MAINTENANCE', label: '7. Workshop & Equipment Maintenance' },
  { value: 'CLEANING', label: '8. Cleaning & Janitorial Charges' },
  { value: 'OTHER', label: '9. Other Monthly Bills' }
];

export const AddMonthlyBillModal = ({ isOpen, onClose, user, branchScope, getAuthHeaders, onSuccess }) => {
  const role = String(user?.role || '').toUpperCase();
  const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);
  const managerBranch = user?.branchId ? Number(user.branchId) : 1;

  // Defaults
  const todayStr = getColomboTodayDateString();
  const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM

  const [branchId, setBranchId] = useState(isExecutive ? (branchScope === 'ALL' ? 1 : Number(branchScope)) : managerBranch);
  const [billName, setBillName] = useState('');
  const [category, setCategory] = useState('RENT');
  const [providerName, setProviderName] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [actualAmount, setActualAmount] = useState('');
  const [billingMonth, setBillingMonth] = useState(currentMonthStr);
  const [billDate, setBillDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState('');
  const [billReference, setBillReference] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    setCategory(cat);
    // Provide sensible default bill name
    const catObj = BILL_CATEGORIES.find(c => c.value === cat);
    if (catObj && !billName) {
      setBillName(`${catObj.label.split('. ')[1]} - ${billingMonth}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const expAmt = Number(expectedAmount);
    if (isNaN(expAmt) || expAmt <= 0) {
      setError('Expected monthly amount must be greater than zero.');
      return;
    }
    if (!billName.trim()) {
      setError('Please provide a bill title or name.');
      return;
    }
    if (!dueDate) {
      setError('Please select a payment due date.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        branchId: Number(branchId),
        billName: billName.trim(),
        category,
        providerName: providerName.trim() || null,
        expectedAmount: expAmt,
        actualAmount: actualAmount ? Number(actualAmount) : null,
        billingMonth,
        billDate,
        dueDate,
        billReference: billReference.trim() || null,
        receiptImage: receiptImage || null,
        notes: notes.trim() || null
      };

      const res = await fetch(`${API_BASE}/finance/bills`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to create monthly bill');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
      <div className="card" style={{
        maxWidth: '580px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        borderRadius: '16px',
        padding: '24px',
        background: '#fff',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Add Monthly Recurring Bill
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Schedule Rent, Electricity, Water, Internet, or Maintenance commitment
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Safety Note Alert */}
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          color: '#1E40AF',
          fontSize: '0.78rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '14px'
        }}>
          <ShieldAlert size={16} color="#2563EB" />
          <span>
            <strong>Safety Rule:</strong> Creating a monthly bill schedules a payable obligation. It does <strong>not</strong> deduct money from Cash or Bank accounts until confirmed payment.
          </span>
        </div>

        {error && (
          <div style={{ padding: '12px', borderRadius: '8px', background: '#FEE2E2', color: '#B91C1C', marginBottom: '14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Branch & Month */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Branch *
              </label>
              {isExecutive ? (
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(Number(e.target.value))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: '#fff' }}
                >
                  <option value={1}>JB Group (Main) — Branch 1</option>
                  <option value={2}>Bella Design — Branch 2</option>
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={managerBranch === 2 ? 'Bella Design (Branch 2)' : 'JB Group Main (Branch 1)'}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: '#F3F4F6' }}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Billing Month (YYYY-MM) *
              </label>
              <input
                type="month"
                required
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Category & Bill Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Bill Category *
              </label>
              <select
                value={category}
                onChange={handleCategoryChange}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: '#fff' }}
              >
                {BILL_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Bill Name / Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Showroom Premises Rent"
                value={billName}
                onChange={(e) => setBillName(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Provider & Reference */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Provider / Supplier / Landlord
              </label>
              <input
                type="text"
                placeholder="e.g. CEB / Building Owner"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Account / Meter / Reference #
              </label>
              <input
                type="text"
                placeholder="e.g. CEB-0482910"
                value={billReference}
                onChange={(e) => setBillReference(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Amounts: Expected vs Actual */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Monthly Expected Amount (LKR) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={expectedAmount}
                onChange={(e) => setExpectedAmount(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Actual Bill Amount (LKR, if known)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Defaults to expected"
                value={actualAmount}
                onChange={(e) => setActualAmount(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Bill Date & Due Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Bill Date
              </label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Payment Due Date *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #DC2626', fontSize: '0.85rem', fontWeight: 600 }}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
              Notes / Instructions
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Pay before 15th to avoid disconnection..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>

          {/* Bill Photo / PDF Upload */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
              Bill Document / Invoice Scan (Optional)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              style={{ fontSize: '0.8rem' }}
            />
            {receiptImage && (
              <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Document attached
              </div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '9px 18px', borderRadius: '8px', background: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 22px',
                borderRadius: '8px',
                background: '#0B1F3A',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Scheduling...
                </>
              ) : (
                'Schedule Bill'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

