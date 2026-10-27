import React, { useState, useEffect } from 'react';
import { X, CreditCard, AlertCircle } from 'lucide-react';
import { API_URL } from '../config/api';
import { ImageUploadCapture } from './common/ImageUploadCapture';
import { validateImageFileClient } from '../utils/imageUploadHelper';

export const RecordPaymentModal = ({ order, isOpen, onClose, onPaymentRecorded }) => {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (order) {
      const balance = Math.max(0, Number(order.totalAmount || 0) - Number(order.advancePayment || 0));
      // Default to full balance or empty
      setAmount(balance > 0 ? String(balance) : '');
      setTransactionRef('');
      setNotes('');
      setSlipFile(null);
      setSlipPreview(null);
      setError(null);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const total = Number(order.totalAmount || 0);
  const alreadyPaid = Number(order.advancePayment || 0);
  const currentBalance = Math.max(0, total - alreadyPaid);

  const numAmount = parseFloat(amount) || 0;
  const newBalance = Math.max(0, currentBalance - numAmount);
  const willBePaidInFull = numAmount >= currentBalance;

  const handlePayFull = () => {
    setAmount(String(currentBalance));
    setError(null);
  };

  const handleSlipChange = (file) => {
    if (file) {
      const validation = validateImageFileClient(file);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }
      setSlipFile(file);
      setSlipPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleRemoveSlip = () => {
    setSlipFile(null);
    setSlipPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (numAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }

    if (numAmount > currentBalance) {
      setError(`Payment amount cannot exceed balance due (LKR ${currentBalance.toLocaleString()}).`);
      return;
    }

    try {
      setLoading(true);

      let uploadedSlipUrl = null;
      if (slipFile) {
        const formData = new FormData();
        formData.append('paymentSlip', slipFile);
        const uploadRes = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
          },
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          uploadedSlipUrl = uploadData.imageUrl || uploadData.photoUrl;
        } else {
          setError(uploadData.message || 'Failed to upload payment slip photo.');
          setLoading(false);
          return;
        }
      }

      const res = await fetch(`${API_URL}/api/orders/${order.id}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        },
        body: JSON.stringify({
          amount: numAmount,
          paymentMethod,
          transactionRef: transactionRef.trim() || undefined,
          notes: notes.trim() || undefined,
          slipImage: uploadedSlipUrl
        })
      });

      const data = await res.json();
      if (data.success && data.order) {
        if (onPaymentRecorded) {
          onPaymentRecorded(data.order);
        }
        onClose();
      } else {
        setError(data.message || 'Failed to record payment.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('Network error recording payment. Please check server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay-responsive" style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div className="modal-card-responsive" style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex'
              }}>
                <CreditCard size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                Record Order Payment
              </h3>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
              Order No: <strong>{order.orderNumber || `ORD-${order.id}`}</strong> • {order.customer?.name || 'Customer'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="payment-modal-body" style={{ padding: '24px' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '18px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Balance Overview Grid */}
          <div className="payment-balance-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '10px',
            marginBottom: '20px'
          }}>
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 10px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Total
              </span>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                LKR {total.toLocaleString()}
              </div>
            </div>

            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 10px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Paid
              </span>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                LKR {alreadyPaid.toLocaleString()}
              </div>
            </div>

            <div style={{
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '10px',
              padding: '12px 10px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#e11d48', textTransform: 'uppercase' }}>
                Balance Due
              </span>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: '#be123c', marginTop: '2px' }}>
                LKR {currentBalance.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Payment Amount Input */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                Payment Amount (LKR)
              </label>
              {currentBalance > 0 && (
                <button
                  type="button"
                  onClick={handlePayFull}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Pay Full Balance (LKR {currentBalance.toLocaleString()})
                </button>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#64748b'
              }}>
                LKR
              </span>
              <input
                type="number"
                min="1"
                max={currentBalance}
                step="any"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="Enter amount"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 50px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Payment Method */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
              Payment Method
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {['Cash', 'Card', 'Bank Transfer', 'Online'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: paymentMethod === method ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: paymentMethod === method ? '#eff6ff' : '#ffffff',
                    color: paymentMethod === method ? '#1d4ed8' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Reference / Slip No & Note */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Ref / Slip No. (Optional)
              </label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g. Bank ref #, Txn ID"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.85rem',
                  color: '#0f172a',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Paid in shop"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.85rem',
                  color: '#0f172a',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Payment Slip / Receipt Photo Upload Box with Camera & Upload options */}
          <ImageUploadCapture
            label="Payment Slip / Receipt Photo (Optional)"
            sublabel="Capture or upload bank deposit slip, card receipt, or transfer proof (Max 20 MB)"
            previewUrl={slipPreview}
            file={slipFile}
            onFileSelected={handleSlipChange}
            onFileRemoved={handleRemoveSlip}
            onError={(err) => setError(err)}
            cameraTitle="Take Payment Slip Photo"
            compact={true}
            style={{ marginBottom: '18px' }}
          />

          {/* Live Outcome Preview */}
          {numAmount > 0 && numAmount <= currentBalance && (
            <div style={{
              backgroundColor: willBePaidInFull ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${willBePaidInFull ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: willBePaidInFull ? '#166534' : '#92400e', fontWeight: 600 }}>
                  Remaining Balance:
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: willBePaidInFull ? '#15803d' : '#b45309' }}>
                  LKR {newBalance.toLocaleString()}
                </div>
              </div>
              <span style={{
                backgroundColor: willBePaidInFull ? '#dcfce7' : '#fef3c7',
                color: willBePaidInFull ? '#15803d' : '#b45309',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 800
              }}>
                {willBePaidInFull ? '✓ Will become PAID' : 'Will become PARTIALLY PAID'}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || numAmount <= 0 || numAmount > currentBalance}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: loading || numAmount <= 0 || numAmount > currentBalance ? 'not-allowed' : 'pointer',
                opacity: loading || numAmount <= 0 || numAmount > currentBalance ? 0.6 : 1,
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.3)'
              }}
            >
              <CreditCard size={15} />
              {loading ? 'Recording Payment...' : willBePaidInFull ? 'Confirm & Mark as Paid' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
