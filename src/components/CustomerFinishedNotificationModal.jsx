import React, { useState } from 'react';
import { X, MessageCircle, AlertCircle, CheckCircle, ShieldCheck, Phone, User, Hash, Clock, Send, AlertTriangle } from 'lucide-react';
import { API_URL } from '../config/api';

const normalizePhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  const raw = phone.toString().replace(/[^0-9]/g, '');
  if (raw.startsWith('94')) return raw;
  if (raw.startsWith('00')) return raw.slice(2);
  if (raw.startsWith('0')) return '94' + raw.slice(1);
  return raw;
};

export const CustomerFinishedNotificationModal = ({
  order,
  isOpen,
  onClose,
  onSuccess,
  user
}) => {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const [allowResend, setAllowResend] = useState(false);

  if (!isOpen || !order) return null;

  const userRole = (user?.role || '').toUpperCase();
  const isAuthorized = ['SUPER_ADMIN', 'CEO', 'ADMIN', 'MANAGER'].includes(userRole);
  const isReady = order.status === 'READY';

  const customerName = order.customer?.name || order.customerName || 'Customer';
  const rawPhone = order.customer?.primaryPhone || order.phone || '';
  const cleanedDigits = rawPhone.replace(/[^0-9]/g, '');
  const isPhoneValid = Boolean(rawPhone && cleanedDigits.length >= 7);
  const orderNumber = order.orderNumber || (order.id ? `ORD-${order.id}` : 'N/A');

  const approvedMessage = `Dear ${customerName},\n\nYour order ${orderNumber} from JB GROUP is now ready for collection.\n\nThank you for choosing JB GROUP!`;

  const alreadySent = Boolean(order.readyNotificationSent);
  const previousSentAt = order.readyNotificationSentAt ? new Date(order.readyNotificationSentAt).toLocaleString() : null;
  const previousSentBy = order.readyNotificationSentBy || 'Authorized Manager';

  const handleSend = async () => {
    if (!isAuthorized) {
      setError('Access denied. Only authorized Managers, Admins, and CEO can send customer finished notifications.');
      return;
    }

    if (!isReady) {
      setError(`Cannot send notification. Order must pass final completion & quality-check (Status: READY). Current status: ${order.status}`);
      return;
    }

    if (!isPhoneValid) {
      setError('Cannot send notification. A valid customer phone number is required.');
      return;
    }

    if (alreadySent && !allowResend) {
      setError('Notification was already sent previously. Check "Allow resend" to send again.');
      return;
    }

    try {
      setSending(true);
      setError(null);
      setSuccessInfo(null);

      const token = localStorage.getItem('jb_token');
      const res = await fetch(`${API_URL}/api/orders/${order.id}/notify-ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ force: allowResend })
      });

      const data = await res.json();

      if (res.status === 409 || data.duplicatePrevented) {
        setError(data.message || 'Notification was already sent previously. Duplicate prevented.');
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.message || `Failed to dispatch customer notification (Status ${res.status}).`);
        return;
      }

      // Successful notification recorded
      setSuccessInfo('✓ Customer finished notification successfully recorded and logged!');

      // Open WhatsApp with approved message
      const targetPhone = normalizePhoneForWhatsApp(rawPhone);
      const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(data.whatsAppMessage || approvedMessage)}`;
      window.open(waUrl, '_blank');

      if (onSuccess) {
        onSuccess(data.order || {
          ...order,
          readyNotificationSent: true,
          readyNotificationSentAt: data.sentAt,
          readyNotificationSentBy: data.sentBy,
          readyNotificationStatus: 'SENT'
        }, data);
      }

      setTimeout(() => {
        onClose();
      }, 1400);

    } catch (err) {
      console.error('Customer Finished Notification Error:', err);
      setError('Network or server error while sending notification. Please check connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          backgroundColor: '#0a192f',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              backgroundColor: 'rgba(34, 197, 94, 0.2)',
              color: '#4ade80',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MessageCircle size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                Send Customer Finished Message
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Manager controlled collection notification • JB GROUP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: 'calc(85vh - 140px)', overflowY: 'auto' }}>
          {/* Permission / Authorization Warning */}
          {!isAuthorized && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '12px 14px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#991b1b',
              fontSize: '0.85rem'
            }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>Unauthorized Role:</strong> Only Manager, Admin, and CEO/SUPER_ADMIN roles can send customer notifications.
              </div>
            </div>
          )}

          {/* Readiness / Quality Check Notice */}
          {!isReady && (
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              padding: '12px 14px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              color: '#92400e',
              fontSize: '0.84rem'
            }}>
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Order Not Ready for Collection:</strong> This order is currently in stage{' '}
                <span style={{ fontWeight: 800 }}>{order.status}</span>. Customer Finished notifications can only be sent once cutting, stitching, alterations, and quality checks are fully completed (Status: <strong>READY</strong>).
              </div>
            </div>
          )}

          {/* Already Sent Duplicate Warning */}
          {alreadySent && (
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              padding: '12px 14px',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              color: '#166534',
              fontSize: '0.84rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#16a34a" />
                <span style={{ fontWeight: 800 }}>Notification Already Delivered</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#15803d' }}>
                Sent on <strong>{previousSentAt || 'Earlier'}</strong> by <strong>{previousSentBy}</strong>. Duplicate protection is active.
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={allowResend}
                  onChange={(e) => setAllowResend(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#16a34a' }}
                />
                <span>Allow resending finished notification to customer</span>
              </label>
            </div>
          )}

          {/* Customer & Order Metadata Preview */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                <User size={13} /> Customer Name
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                {customerName}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                <Hash size={13} /> Order Number
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                {orderNumber}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                <Phone size={13} /> Customer Phone Number
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: isPhoneValid ? '#0f172a' : '#dc2626' }}>
                  {rawPhone || 'Not Provided'}
                </span>
                {!isPhoneValid && (
                  <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                    Invalid Phone
                  </span>
                )}
                {isPhoneValid && (
                  <span style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                    WA: +{normalizePhoneForWhatsApp(rawPhone)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Message Preview */}
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>APPROVED MESSAGE PREVIEW</span>
              <span style={{ color: '#16a34a' }}>WhatsApp Template</span>
            </div>
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '10px',
              padding: '14px 16px',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              color: '#14532d',
              whiteSpace: 'pre-line',
              lineHeight: 1.5
            }}>
              {approvedMessage}
            </div>
          </div>

          {/* Feedback & Error states */}
          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '10px 14px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#b91c1c',
              fontSize: '0.82rem'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              padding: '10px 14px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#15803d',
              fontSize: '0.82rem'
            }}>
              <CheckCircle size={16} style={{ flexShrink: 0 }} />
              <span>{successInfo}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: sending ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={!isAuthorized || !isReady || !isPhoneValid || (alreadySent && !allowResend) || sending}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: (!isAuthorized || !isReady || !isPhoneValid || (alreadySent && !allowResend))
                ? '#94a3b8'
                : '#16a34a',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: (!isAuthorized || !isReady || !isPhoneValid || (alreadySent && !allowResend) || sending)
                ? 'not-allowed'
                : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: (!isAuthorized || !isReady || !isPhoneValid || (alreadySent && !allowResend))
                ? 'none'
                : '0 2px 8px rgba(22, 163, 74, 0.35)'
            }}
          >
            {sending ? (
              <>
                <Clock size={16} className="animate-spin" />
                <span>Sending Notification...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>{alreadySent ? 'Resend Customer Finished Message' : 'Send Customer Finished Message'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
