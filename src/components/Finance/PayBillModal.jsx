import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';
import { X, DollarSign, AlertCircle, CheckCircle2, RefreshCw, Wallet } from 'lucide-react';
import { formatLKR, getColomboTodayDateString } from './financeUtils';

export const PayBillModal = ({ isOpen, onClose, bill, getAuthHeaders, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentDate, setPaymentDate] = useState(getColomboTodayDateString());
  const [receiptImage, setReceiptImage] = useState(null);
  const [notes, setNotes] = useState('');

  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const expected = bill ? (Number(bill.actualAmount) || Number(bill.expectedAmount) || 0) : 0;
  const paid = bill ? (Number(bill.paidAmount) || 0) : 0;
  const balanceDue = Math.max(0, Math.round((expected - paid) * 100) / 100);

  useEffect(() => {
    if (!isOpen || !bill) return;

    setAmount(balanceDue.toFixed(2));
    setError(null);

    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const res = await fetch(`${API_BASE}/finance/accounts?branchId=${bill.branchId}`, {
          headers: getAuthHeaders()
        });
        const json = await res.json();
        if (json.success && json.accounts) {
          setAccounts(json.accounts);
          if (json.accounts.length > 0) {
            const primary = json.accounts.find(a => a.isPrimary) || json.accounts[0];
            setPaymentAccountId(primary.id);
          }
        }
      } catch (err) {
        console.error('Error fetching accounts for bill payment:', err);
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, [isOpen, bill, balanceDue, getAuthHeaders]);

  if (!isOpen || !bill) return null;

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const payAmt = Number(amount);
    if (isNaN(payAmt) || payAmt <= 0) {
      setError('Please enter a valid disbursement amount.');
      return;
    }
    if (payAmt > balanceDue + 0.01) {
      setError(`Amount exceeds remaining balance of ${formatLKR(balanceDue)}`);
      return;
    }
    if (!paymentAccountId) {
      setError('Please select an active Cash Drawer or Bank Account to disburse funds.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        amount: payAmt,
        paymentAccountId: Number(paymentAccountId),
        paymentMethod,
        paymentDate,
        receiptImage: receiptImage || null,
        notes: notes.trim() || null
      };

      const res = await fetch(`${API_BASE}/finance/bills/${bill.id}/pay`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to process payment');
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
        maxWidth: '520px',
        width: '100%',
        borderRadius: '16px',
        padding: '24px',
        background: '#fff',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Pay Monthly Bill
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Disburse confirmed payment from Cash Drawer or Bank Account
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Bill Summary Banner */}
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          backgroundColor: '#F8FAFC',
          border: '1px solid var(--border-color)',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{bill.billName}</span>
            <span style={{ color: 'var(--text-muted)' }}>{bill.billNumber}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>Branch: <strong>{bill.branchName}</strong></span>
            <span>Billing Month: <strong>{bill.billingMonth}</strong></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
            <span>Total: <strong>{formatLKR(expected)}</strong></span>
            <span>Paid: <strong>{formatLKR(paid)}</strong></span>
            <span style={{ color: '#DC2626', fontWeight: 800 }}>Due: {formatLKR(balanceDue)}</span>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#FEE2E2', color: '#B91C1C', marginBottom: '14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Amount to pay */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
              Payment Amount (LKR) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={balanceDue}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1.1rem', fontWeight: 800, color: '#0B1F3A' }}
            />
          </div>

          {/* Payment Account */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
              Disburse From (Cash Register / Bank Account) *
            </label>
            <select
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
              disabled={loadingAccounts}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: '#fff' }}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.accountName} ({a.accountType}) — Available: {formatLKR(a.currentBalance || 0)}
                </option>
              ))}
              {accounts.length === 0 && (
                <option value="">No active accounts in {bill.branchName}</option>
              )}
            </select>
          </div>

          {/* Method & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                <option value="ONLINE">Online Portal</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Receipt / Voucher Scan */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
              Payment Receipt / Voucher (Optional)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              style={{ fontSize: '0.8rem' }}
            />
            {receiptImage && (
              <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Voucher attached
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main)' }}>
              Payment Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Paid via Commercial Bank online transfer Ref #88190"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
            />
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
                background: '#059669',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Processing...
                </>
              ) : (
                'Confirm Disbursement'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

