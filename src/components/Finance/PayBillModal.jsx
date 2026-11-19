import React, { useState, useEffect } from 'react';
import { API_BASE, getImageUrl } from '../../config/api';
import { X, DollarSign, AlertCircle, CheckCircle2, RefreshCw, Wallet, Trash2, Upload } from 'lucide-react';
import { formatLKR, getColomboTodayDateString } from './financeUtils';
import { compressReceiptImage, uploadReceiptImageFile, formatFileSize, validateReceiptFile } from '../../utils/imageCompressor';

export const PayBillModal = ({ isOpen, onClose, bill, getAuthHeaders, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentDate, setPaymentDate] = useState(getColomboTodayDateString());
  const [receiptImage, setReceiptImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [optimizingImage, setOptimizingImage] = useState(false);
  const [imageStats, setImageStats] = useState(null);
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validation = validateReceiptFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setOptimizingImage(true);
    setError(null);

    try {
      const compressed = await compressReceiptImage(file);
      setSelectedFile(compressed.blob);
      setReceiptImage(compressed.dataUrl);
      setImageStats({
        original: formatFileSize(compressed.originalSize),
        compressed: formatFileSize(compressed.compressedSize),
        reduction: compressed.reductionPercent
      });
    } catch (err) {
      console.error('Voucher image optimization failed:', err);
      setError(err.message || 'Failed to process voucher image.');
    } finally {
      setOptimizingImage(false);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptImage(null);
    setSelectedFile(null);
    setImageStats(null);
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
      let finalReceiptUrl = receiptImage;

      // Upload compressed receipt file via multipart/form-data to /api/upload
      if (selectedFile) {
        try {
          const uploadResult = await uploadReceiptImageFile(selectedFile, getAuthHeaders());
          if (uploadResult?.receiptImage) {
            finalReceiptUrl = uploadResult.receiptImage;
          }
        } catch (uploadErr) {
          console.warn('Multipart voucher upload error:', uploadErr);
          if (uploadErr.message && uploadErr.message.includes('413')) {
            throw uploadErr;
          }
        }
      }

      const payload = {
        amount: payAmt,
        paymentAccountId: Number(paymentAccountId),
        paymentMethod,
        paymentDate,
        receiptImage: finalReceiptUrl || null,
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

      if (res.status === 413) {
        throw new Error('The request payload is too large for the server (HTTP 413). Please choose a smaller image.');
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Server returned ${res.status}: ${text.substring(0, 120)}`);
      }

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

            {optimizingImage ? (
              <div style={{ padding: '12px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.8rem' }}>
                <RefreshCw size={16} className="animate-spin" /> Optimizing payment voucher...
              </div>
            ) : receiptImage ? (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #bbf7d0',
                backgroundColor: '#f0fdf4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={getImageUrl(receiptImage)}
                    alt="Payment Voucher"
                    style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #86efac' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 700, fontSize: '0.8rem' }}>
                      <CheckCircle2 size={14} /> Voucher Attached
                    </div>
                    {imageStats && (
                      <div style={{ fontSize: '0.72rem', color: '#15803d' }}>
                        Optimized: {imageStats.compressed} (saved {imageStats.reduction}%)
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveReceipt}
                  title="Remove voucher"
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#dc2626',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            ) : (
              <div style={{
                position: 'relative',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '14px',
                backgroundColor: '#f8fafc',
                textAlign: 'center',
                cursor: 'pointer'
              }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                  onChange={handleFileUpload}
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <Upload size={20} color="#64748b" />
                  <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
                    Click or drag payment voucher photo
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    Auto-optimized to prevent upload limits (up to 25MB)
                  </span>
                </div>
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

