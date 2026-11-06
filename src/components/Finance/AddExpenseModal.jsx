import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';
import { X, DollarSign, Upload, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { formatLKR, getColomboTodayDateString } from './financeUtils';

const DEFAULT_EXPENSE_CATEGORIES = [
  { code: 'EXP_TRANSPORT', name: 'Transport & Travel Expenses' },
  { code: 'EXP_FOOD', name: 'Food & Refreshments' },
  { code: 'EXP_EMERGENCY', name: 'Emergency Expenses' },
  { code: 'EXP_OFFICE', name: 'Office & Stationery Expenses' },
  { code: 'EXP_WELFARE', name: 'Staff Welfare & Support' },
  { code: 'EXP_MAINTENANCE', name: 'Equipment & Machine Maintenance' },
  { code: 'EXP_REPAIRS', name: 'Repairs & Fixes' },
  { code: 'EXP_FABRIC_PURCHASE', name: 'Material & Fabric Purchases' },
  { code: 'EXP_PACKAGING', name: 'Delivery & Packaging Expenses' },
  { code: 'EXP_MISC', name: 'Miscellaneous Expenses' },
  { code: 'EXP_GENERAL', name: 'General & Administrative Overhead' }
];

export const AddExpenseModal = ({ isOpen, onClose, user, branchScope, getAuthHeaders, onSuccess }) => {
  const role = String(user?.role || '').toUpperCase();
  const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);
  const managerBranch = user?.branchId ? Number(user.branchId) : 1;

  const [branchId, setBranchId] = useState(isExecutive ? (branchScope === 'ALL' ? 1 : Number(branchScope)) : managerBranch);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [paidBy, setPaidBy] = useState(user?.name || '');
  const [paidTo, setPaidTo] = useState('');
  const [expenseDate, setExpenseDate] = useState(getColomboTodayDateString());
  const [referenceNo, setReferenceNo] = useState('');
  const [reason, setReason] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);

  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch accounts and categories on mount or branch change
  useEffect(() => {
    if (!isOpen) return;

    const fetchPrerequisites = async () => {
      setLoadingAccounts(true);
      try {
        const [accRes, catRes] = await Promise.all([
          fetch(`${API_BASE}/finance/accounts?branchId=${branchId}`, { headers: getAuthHeaders() }),
          fetch(`${API_BASE}/finance/categories`, { headers: getAuthHeaders() })
        ]);

        const accJson = await accRes.json();
        const catJson = await catRes.json();

        if (accJson.success) {
          setAccounts(accJson.accounts || []);
          if (accJson.accounts?.length > 0) {
            // Default to primary or first active cash account
            const primary = accJson.accounts.find(a => a.isPrimary) || accJson.accounts[0];
            setAccountId(primary.id);
          }
        }

        if (catJson.success && catJson.categories?.length > 0) {
          const expCats = catJson.categories.filter(c => c.categoryType === 'EXPENSE');
          setCategories(expCats.length > 0 ? expCats : DEFAULT_EXPENSE_CATEGORIES);
          if (expCats.length > 0) setCategoryId(expCats[0].id);
        } else {
          setCategories(DEFAULT_EXPENSE_CATEGORIES);
        }
      } catch (err) {
        console.error('Error fetching expense prerequisites:', err);
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchPrerequisites();
  }, [isOpen, branchId, getAuthHeaders]);

  if (!isOpen) return null;

  const handleImageUpload = (e) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const numAmt = Number(amount);
    if (!numAmt || numAmt <= 0) {
      setError('Please enter a valid expense amount.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide an expense title.');
      return;
    }
    if (!accountId) {
      setError('Please select an active Cash Drawer or Bank Account.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        branchId: Number(branchId),
        type: 'EXPENSE',
        categoryId: Number(categoryId),
        accountId: Number(accountId),
        amount: numAmt,
        paymentMethod,
        referenceNo: referenceNo.trim() || null,
        description: `${title.trim()}${paidTo ? ` - Paid to: ${paidTo.trim()}` : ''}`,
        notes: reason.trim() ? `${reason.trim()}${paidBy ? ` (Recorded by: ${paidBy})` : ''}` : null,
        receiptImage: receiptImage || null,
        expenseDate: expenseDate || new Date().toISOString()
      };

      const res = await fetch(`${API_BASE}/finance/transactions`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to record expense');
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
        maxWidth: '560px',
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
              Add Other / Extra Expense
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Record transport, refreshments, emergency, or workshop operating expense
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px', borderRadius: '8px', background: '#FEE2E2', color: '#B91C1C', marginBottom: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Branch & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                Expense Date *
              </label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
              Expense Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Workshop sewing machine grease & oil replacement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
            />
          </div>

          {/* Category & Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: '#fff' }}
              >
                {categories.map(c => (
                  <option key={c.id || c.code} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Amount (LKR) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* Account & Payment Method */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Payment Account (Cash Drawer / Bank) *
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={loadingAccounts}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: '#fff' }}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.accountName} ({a.accountType}) — {formatLKR(a.currentBalance || 0)}
                  </option>
                ))}
                {accounts.length === 0 && (
                  <option value="">No active accounts in this branch</option>
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: '#fff' }}
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CREDIT_CARD">POS Card</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          {/* Paid To & Reference */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Paid To (Vendor / Person)
              </label>
              <input
                type="text"
                placeholder="e.g. Colombo Hardware Stores"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Reference / Bill #
              </label>
              <input
                type="text"
                placeholder="e.g. REC-88319"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Reason / Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
              Reason / Description
            </label>
            <textarea
              rows={2}
              placeholder="Provide context or explanation for CEO / Management audit..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>

          {/* Receipt Image */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
              Receipt / Bill Image (Optional)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleImageUpload}
              style={{ fontSize: '0.8rem' }}
            />
            {receiptImage && (
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Receipt attached successfully
              </div>
            )}
          </div>

          {/* Submit Buttons */}
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
                background: 'var(--jb-crimson)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Recording...
                </>
              ) : (
                'Save Expense'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

