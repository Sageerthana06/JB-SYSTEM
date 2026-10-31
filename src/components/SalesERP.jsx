/**
 * SalesERP Component — JB GROUP / Bella Design ERP
 *
 * =========================================================================
 * COMPONENT ROADMAP & ARCHITECTURE:
 * =========================================================================
 * This is the central sales & order management workstation.
 *
 * Major Sections:
 * 1. Helper Modals & Micro-Components (Lines 40–1900):
 *    - StatusDropdown: Quick status transition popup
 *    - PriceQuotationModal: Set service/tailoring charges & quotation
 *    - OrderCard: Kanban/table card with status badges, tailors, & action buttons
 * 2. Main SalesERP Container (Lines 1900+):
 *    - Revenue & Metric Cards (Daily revenue, Pending approvals, Active orders)
 *    - Search & Filter Controls (Status, Branch, Date range)
 *    - Order Kanban Columns & List View
 *    - Modal Mounts (Order creation, Invoices, Payment slips, WhatsApp alerts)
 * =========================================================================
 */
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Clock,
  AlertCircle,
  Check,
  Download,
  Plus,
  ArrowUpRight,
  Eye,
  CreditCard,
  MessageCircle,
  ChevronDown,
  X,
  FileText,
  ArrowRight,
  Send,
  Scissors
} from 'lucide-react';
import { OrderCreationModal } from './OrderCreationModal';
import { DigitalInvoiceModal } from './DigitalInvoiceModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { CustomerProfileDrawer } from './CustomerProfileDrawer';
import { SelfAttendanceCard } from './SelfAttendanceCard';
import { TaskAssignmentModal } from './TaskAssignmentModal';
import { CustomerFinishedNotificationModal } from './CustomerFinishedNotificationModal';
import { getStatusLabel, getStatusColors, getNextStageInfo, ALLOWED_STAGE_TRANSITIONS, getPriceStatusLabel, getPriceStatusColors, cleanActivityNote, cleanActorName } from '../utils/orderStatus';
import { API_URL, getImageUrl } from '../config/api';

const StatusDropdown = ({ currentStatus, onStatusChange, targetOrder, userRole }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const colors = getStatusColors(currentStatus);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isManager = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'].includes(userRole);
  const allowedNext = ALLOWED_STAGE_TRANSITIONS[currentStatus] || [];

  const options = [currentStatus, ...allowedNext];
  if (isManager && !['PENDING_APPROVAL', 'REJECTED', 'DELIVERED', 'CANCELLED'].includes(currentStatus)) {
    if (!options.includes('ON_HOLD')) options.push('ON_HOLD');
    if (!options.includes('CANCELLED')) options.push('CANCELLED');
  }

  const canChange = isManager || (userRole === 'TAILOR' && (targetOrder?.assignedTailorId || (targetOrder?.tasks && targetOrder.tasks.length > 0)));

  if (!canChange || options.length <= 1) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '0.72rem',
        fontWeight: 800,
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        whiteSpace: 'nowrap'
      }}>
        {getStatusLabel(targetOrder || currentStatus)}
      </span>
    );
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '0.72rem',
          fontWeight: 800,
          backgroundColor: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          boxShadow: isOpen ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <span>{getStatusLabel(currentStatus)}</span>
        <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          zIndex: 9999,
          minWidth: '180px',
          maxHeight: '260px',
          overflowY: 'auto',
          padding: '4px'
        }}>
          {options.map(st => {
            const isSelected = st === currentStatus;
            const itemColors = getStatusColors(st);
            return (
              <button
                type="button"
                key={st}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (st !== currentStatus) {
                    onStatusChange(st);
                  }
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: isSelected ? 800 : 600,
                  color: isSelected ? itemColors.text : 'var(--text-main)',
                  backgroundColor: isSelected ? itemColors.bg : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.12s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: itemColors.text,
                    display: 'inline-block'
                  }} />
                  <span>{getStatusLabel(st)}</span>
                </div>
                {isSelected && <Check size={13} color={itemColors.text} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const normalizePhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  const raw = String(phone).replace(/\D/g, '');
  if (raw.startsWith('00')) return raw.slice(2);
  if (raw.startsWith('0')) return '94' + raw.slice(1);
  return raw;
};

const generateOrderReadyWhatsAppMessage = (order) => {
  if (!order) return '';
  const customerName = order.customer?.name || order.customerName || 'Customer';
  const orderNumber = order.orderNumber || (order.id ? `ORD-${order.id}` : 'N/A');

  return `Dear ${customerName},

Your order ${orderNumber} from JB GROUP is now ready for collection.

Thank you for choosing JB GROUP!`;
};

const generateQuotationWhatsAppMessage = (order) => {
  if (!order) return '';
  const customerName = order.customer?.name || order.customerName || 'Customer';
  const orderNumber = order.orderNumber || order.id || 'N/A';
  const dressType = order.garmentDetails?.dressType || 'Bespoke Garment';
  const quantity = order.garmentDetails?.quantity || 1;
  const total = Number(order.totalAmount || 0);
  const advanceReq = Number(order.advanceRequired || order.advancePayment || 0);
  const balance = Math.max(0, total - advanceReq);
  const deliveryDate = order.garmentDetails?.deliveryDate ? new Date(order.garmentDetails.deliveryDate).toLocaleDateString() : 'Standard';

  return `Hello ${customerName} 👋

Thank you for choosing *JB GROUP*! ✨

Here is the Price Quotation for your bespoke tailoring order:

📋 *ORDER QUOTATION — ${orderNumber}*
👗 *Item:* ${dressType} (Qty: ${quantity})
💰 *Total Price:* LKR ${total.toLocaleString()}
💵 *Advance Required:* LKR ${advanceReq.toLocaleString()}
💳 *Balance on Delivery:* LKR ${balance.toLocaleString()}
📅 *Estimated Delivery:* ${deliveryDate}

Please review and confirm to begin production. You can also view details and confirm via our Customer Portal.

Thank you! 🙏
*JB GROUP*`;
};

const PriceSettingModal = ({ order, isOpen, onClose, onPriceSaved, user }) => {
  const [serviceCharge, setServiceCharge] = useState(0);
  const [additionalWorkCharge, setAdditionalWorkCharge] = useState(0);
  const [materialCharge, setMaterialCharge] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [advanceRequired, setAdvanceRequired] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingMode, setSubmittingMode] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (order) {
      setServiceCharge(Number(order.serviceCharge || order.totalAmount || 0));
      setAdditionalWorkCharge(Number(order.additionalWorkCharge || 0));
      setMaterialCharge(Number(order.materialCharge || 0));
      setDiscountAmount(Number(order.discountAmount || 0));
      setAdvanceRequired(Number(order.advanceRequired || order.advancePayment || 0));
      setNotes('');
      setFormError('');
      setIsSubmitting(false);
      setSubmittingMode('');
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const numService = Math.max(0, parseFloat(serviceCharge) || 0);
  const numWork = Math.max(0, parseFloat(additionalWorkCharge) || 0);
  const numMaterial = Math.max(0, parseFloat(materialCharge) || 0);
  const numDiscount = Math.max(0, parseFloat(discountAmount) || 0);
  const numAdvance = Math.max(0, parseFloat(advanceRequired) || 0);

  const grossTotal = Math.max(0, numService + numWork + numMaterial - numDiscount);
  const balanceDue = Math.max(0, grossTotal - numAdvance);

  const handleSavePrice = async (directAccept = false) => {
    setFormError('');

    if (grossTotal <= 0 && numService <= 0) {
      setFormError('Main tailoring service charge is required.');
      return;
    }

    if (numAdvance > grossTotal) {
      setFormError(`Advance required (LKR ${numAdvance.toLocaleString()}) cannot exceed total price (LKR ${grossTotal.toLocaleString()}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmittingMode(directAccept ? 'direct' : 'quote');

      const res = await fetch(`${API_URL}/api/orders/${order.id}/price`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        },
        body: JSON.stringify({
          serviceCharge: numService,
          additionalWorkCharge: numWork,
          materialCharge: numMaterial,
          discountAmount: numDiscount,
          advanceRequired: numAdvance,
          notes: notes.trim() || undefined,
          directAccept
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(directAccept ? 'Price accepted and order confirmed for production!' : 'Price quotation updated and sent to customer successfully.');
        if (onPriceSaved) onPriceSaved(data.order);
        onClose();
      } else {
        const errorMsg = data.message ? (data.error ? `${data.message} (${data.error})` : data.message) : 'Failed to save price quotation';
        setFormError(errorMsg);
        alert(errorMsg);
      }
    } catch (err) {
      console.error('Error saving order price:', err);
      const networkMsg = 'Network error saving price quotation. Please check server connection.';
      setFormError(networkMsg);
      alert(networkMsg);
    } finally {
      setIsSubmitting(false);
      setSubmittingMode('');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '540px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={20} color="#0052cc" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 850, color: '#0f172a' }}>
                Quotation &amp; Pricing — {order.orderNumber}
              </h3>
            </div>
            <span style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
              {order.customer?.name || 'Customer'} • {order.garmentDetails?.dressType || 'Bespoke Garment'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="#64748b" />
          </button>
        </div>

        {/* Pricing Operator Badge */}
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
          <span style={{ color: '#1e40af', fontWeight: 700 }}>
            Pricing Authority: <strong>CEO / Manager</strong>
          </span>
          <span style={{ color: '#1d4ed8', fontWeight: 700 }}>
            {user?.name || 'Operator'} ({user?.role || 'ADMIN/MANAGER'})
          </span>
        </div>

        {/* Error message */}
        {formError && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleSavePrice(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Tailoring / Main Service Charge (LKR)*:
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={serviceCharge}
                onChange={(e) => { setServiceCharge(e.target.value); setFormError(''); }}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Aari / Work Charge (LKR):
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={additionalWorkCharge}
                onChange={(e) => { setAdditionalWorkCharge(e.target.value); setFormError(''); }}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Material Charge (LKR):
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={materialCharge}
                onChange={(e) => { setMaterialCharge(e.target.value); setFormError(''); }}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Discount (LKR):
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={discountAmount}
                onChange={(e) => { setDiscountAmount(e.target.value); setFormError(''); }}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Advance Required (LKR):
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={advanceRequired}
                onChange={(e) => { setAdvanceRequired(e.target.value); setFormError(''); }}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                disabled={isSubmitting}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Pricing Notes / Terms (optional):
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Includes lining, extra pearls & premium stitching"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Live Calculations Summary Box */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>Total Final Price:</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
                LKR {grossTotal.toLocaleString()}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>Balance on Delivery:</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: balanceDue > 0 ? '#b91c1c' : '#16a34a' }}>
                LKR {balanceDue.toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSavePrice(true)}
              disabled={isSubmitting || grossTotal <= 0}
              title="Confirm price immediately and mark as accepted (ready for tailor assignment)"
              style={{
                padding: '9px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: '#16a34a', color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                cursor: (isSubmitting || grossTotal <= 0) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Check size={16} /> {isSubmitting && submittingMode === 'direct' ? 'Confirming...' : 'Direct Confirm & Accept'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || grossTotal <= 0}
              title="Save price and send quotation to customer portal"
              style={{
                padding: '9px 18px', borderRadius: '8px', border: 'none',
                backgroundColor: '#0052cc', color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                cursor: (isSubmitting || grossTotal <= 0) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Send size={15} /> {isSubmitting && submittingMode === 'quote' ? 'Saving...' : 'Save & Send Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ViewOrderModal = ({
  order,
  onClose,
  onOpenInvoice,
  onStatusChange,
  onRecordPayment,
  onApproveOrder,
  onOpenRejectModal,
  onAssignTailor,
  tailorsList,
  onOpenPricing,
  user,
  onOpenTaskModal,
  onTailorAccept: _onTailorAccept,
  onOpenTailorReject: _onOpenTailorReject,
  onConfirmCustomerPrice,
  onVerifyPaymentSlip,
  onRejectPaymentSlip,
  onOpenFinishedNotification
}) => {
  const pdfRef = useRef();
  const [downloading, setDownloading] = useState(false);
  const [localTailorId, setLocalTailorId] = useState('');
  const [viewingSlipModalImage, setViewingSlipModalImage] = useState(null);
  const [rejectingSlipPaymentId, setRejectingSlipPaymentId] = useState(null);
  const [slipRejectReason, setSlipRejectReason] = useState('');

  useEffect(() => {
    setLocalTailorId(order?.assignedTailorId || '');
  }, [order?.assignedTailorId]);

  if (!order) return null;

  const nextInfo = getNextStageInfo(order);
  const canAssignTailor = Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'].includes(user?.role));
  const isFullAccess = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'].includes((user?.role || '').toUpperCase());
  const isPriceConfirmed = Boolean(
    order.priceAcceptedByCustomer ||
    order.priceStatus === 'ACCEPTED' ||
    ['ORDER_CONFIRMED', 'PENDING_PRODUCTION', 'CUTTING', 'STITCHING', 'EMBROIDERY_AARI', 'AARI_EMBROIDERY', 'FITTING_ALTERATION', 'FINISHING', 'QUALITY_CHECK', 'READY', 'DELIVERED'].includes(order.status)
  );

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const element = pdfRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const data = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(data, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Order_${order.orderNumber}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      alert('Unable to generate PDF. Please check console.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0' }}>
      <div className="view-order-modal-container">
        <div className="view-order-modal-header-actions">
          {isFullAccess && (
            <button
              onClick={() => onOpenInvoice && onOpenInvoice(order)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                backgroundColor: '#0284c7', color: '#fff',
                border: 'none', padding: '6px 12px', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
              }}
            >
              <FileText size={14} /> Digital Invoice
            </button>
          )}
          {isFullAccess && order.status === 'READY' && (
            <button
              type="button"
              onClick={() => onOpenFinishedNotification && onOpenFinishedNotification(order)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                backgroundColor: order.readyNotificationSent ? '#15803d' : '#16a34a', color: '#fff',
                padding: '6px 14px', borderRadius: '6px',
                fontSize: '0.85rem', fontWeight: 700,
                border: 'none', cursor: 'pointer'
              }}
            >
              <MessageCircle size={14} /> {order.readyNotificationSent ? '✓ Finished Msg Sent' : 'Send Customer Finished Message'}
            </button>
          )}
          <button
            onClick={downloadPDF}
            disabled={downloading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--jb-navy-light)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
          >
            <Download size={14} /> {downloading ? 'Exporting...' : 'Download PDF'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} color="var(--text-muted)" />
          </button>
        </div>

        {/* WhatsApp Order Ready Notification Banner (Manager / Admin / CEO only) */}
        {isFullAccess && order.status === 'READY' && (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '2px solid #22c55e',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 2px 8px rgba(34, 197, 94, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', maxWidth: '650px' }}>
              <div style={{
                backgroundColor: '#dcfce7',
                color: '#16a34a',
                padding: '10px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px'
              }}>
                <MessageCircle size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#14532d' }}>
                    JB GROUP Customer Finished Notification
                  </h4>
                  {order.readyNotificationSent ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      backgroundColor: '#bbf7d0', color: '#14532d',
                      padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800,
                      border: '1px solid #86efac'
                    }}>
                      ✓ Finished Message Sent ({order.readyNotificationStatus || 'SENT'})
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      backgroundColor: '#fef3c7', color: '#b45309',
                      padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800,
                      border: '1px solid #fde68a'
                    }}>
                      ● Customer Finished Message Pending
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#166534', lineHeight: 1.4 }}>
                  Customer: <strong>{order.customer?.name}</strong> | Phone: <strong>{order.customer?.primaryPhone || 'None'}</strong>
                  {order.readyNotificationSent && order.readyNotificationSentAt && (
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#15803d', marginTop: '2px' }}>
                      Sent at: {new Date(order.readyNotificationSentAt).toLocaleString()} by <strong>{order.readyNotificationSentBy || 'Authorized Manager'}</strong> (Duplicate protection active)
                    </span>
                  )}
                </p>
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  fontSize: '0.78rem',
                  color: '#1e293b',
                  whiteSpace: 'pre-line',
                  fontFamily: 'monospace'
                }}>
                  {generateOrderReadyWhatsAppMessage(order)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => onOpenFinishedNotification && onOpenFinishedNotification(order)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: order.readyNotificationSent ? '#15803d' : '#16a34a',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                }}
              >
                <MessageCircle size={16} />
                {order.readyNotificationSent ? 'Resend Customer Finished Message' : 'Send Customer Finished Message'}
              </button>
            </div>
          </div>
        )}

        {/* Customer Payment Slip Pending Verification Banner */}
        {isFullAccess && order.payments?.some(p => p.status === 'PENDING_VERIFICATION') && (
          <div style={{
            backgroundColor: '#eff6ff',
            border: '2px solid #3b82f6',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ color: '#1e3a8a', fontSize: '1rem' }}>Customer Payment Slip Awaiting Verification</strong>
                  <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '999px' }}>
                    ACTION REQUIRED
                  </span>
                </div>
                <p style={{ color: '#1d4ed8', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
                  Customer submitted payment slip receipt (LKR {Number(order.payments.find(p => p.status === 'PENDING_VERIFICATION')?.amount || 0).toLocaleString()}). Please review below to verify and credit the payment.
                </p>
              </div>
            </div>
            {(() => {
              const pendingPayment = order.payments.find(p => p.status === 'PENDING_VERIFICATION');
              if (!pendingPayment) return null;
              return (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onVerifyPaymentSlip && onVerifyPaymentSlip(order.id, pendingPayment.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '8px 16px', borderRadius: '8px',
                      backgroundColor: '#16a34a', color: '#fff',
                      border: 'none', fontWeight: 800, fontSize: '0.85rem',
                      cursor: 'pointer', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                    }}
                  >
                    <Check size={16} /> Verify &amp; Credit Payment
                  </button>
                  {pendingPayment.slipImage && (
                    <button
                      onClick={() => setViewingSlipModalImage(getImageUrl(pendingPayment.slipImage))}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', borderRadius: '8px',
                        backgroundColor: '#2563eb', color: '#fff',
                        border: 'none', fontWeight: 800, fontSize: '0.85rem',
                        cursor: 'pointer', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                      }}
                    >
                      <Eye size={16} /> View Slip
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* CEO / Manager Approval Banner */}
        {order.status === 'PENDING_APPROVAL' && (
          <div style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#b45309" />
                <strong style={{ color: '#92400e', fontSize: '1rem' }}>Pending CEO / Manager Approval</strong>
              </div>
              <p style={{ color: '#b45309', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
                Customer order submitted from portal. Review dress details and approve to begin production.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => onApproveOrder && onApproveOrder(order.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', borderRadius: '8px',
                  backgroundColor: '#16a34a', color: '#fff',
                  border: 'none', fontWeight: 800, fontSize: '0.85rem',
                  cursor: 'pointer', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                }}
              >
                <Check size={16} /> Approve Order
              </button>
              <button
                onClick={() => onOpenRejectModal && onOpenRejectModal(order)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', borderRadius: '8px',
                  backgroundColor: '#dc2626', color: '#fff',
                  border: 'none', fontWeight: 800, fontSize: '0.85rem',
                  cursor: 'pointer', boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                }}
              >
                <X size={16} /> Reject Order
              </button>
            </div>
          </div>
        )}

        {/* Rejection Alert */}
        {order.status === 'REJECTED' && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: 800, fontSize: '0.95rem' }}>
              <AlertCircle size={18} /> Order Rejected
            </div>
            <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              <strong>Rejection Reason:</strong> {order.rejectionReason || 'No reason provided.'}
            </p>
            {order.rejectedBy && (
              <div style={{ color: '#991b1b', fontSize: '0.78rem', marginTop: '4px' }}>
                Rejected by: {order.rejectedBy} {order.rejectedAt && `on ${new Date(order.rejectedAt).toLocaleString()}`}
              </div>
            )}
          </div>
        )}

        <div ref={pdfRef} style={{ padding: '20px', backgroundColor: '#fff' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid var(--border-color)', paddingBottom: '16px' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--jb-navy-light)', margin: 0 }}>JB GROUP</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Bella Design Business Management System</p>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '24px', borderBottom: '2px solid var(--border-color)', paddingBottom: '12px' }}>
            Order Details - {order.orderNumber}
          </h2>

          <div className="view-order-modal-grid">

            {/* Order Details */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--jb-navy-light)', marginBottom: '12px' }}>Order Information</h3>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div><strong>Order Number:</strong> {order.orderNumber}</div>
                <div><strong>Order Source:</strong> {order.orderSource === 'ONLINE' ? 'Online Portal' : 'Shop / Walk-In'}</div>
                <div><strong>Booking Date:</strong> {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : '—'}</div>
                <div><strong>Delivery Date:</strong> {order.garmentDetails?.deliveryDate ? new Date(order.garmentDetails.deliveryDate).toLocaleDateString() : 'Standard'}</div>
                <div><strong>Dress Type:</strong> {order.garmentDetails?.dressType || 'Not Added'}</div>
                <div><strong>Quantity:</strong> {order.garmentDetails?.quantity || 1}</div>
                <div><strong>Occasion:</strong> {order.garmentDetails?.occasion || 'General'}</div>
                <div><strong>Branch:</strong> {order.branch?.name || 'Main Branch'}</div>
                <div><strong>Current Production Status:</strong> <span className="badge badge-navy">{getStatusLabel(order.status)}</span></div>
                {isFullAccess && (
                  <>
                    <div><strong>Customer Type:</strong> {order.previousOrderId ? 'Returning Customer' : 'New Customer'}</div>
                    <div><strong>Previous Order Number:</strong> {order.previousOrderId ? (order.previousOrder?.orderNumber || 'Yes (ID: ' + order.previousOrderId + ')') : 'None'}</div>
                  </>
                )}
              </div>
            </div>

            {/* Customer Details */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--jb-navy-light)', marginBottom: '12px' }}>Customer Information</h3>
              {isFullAccess ? (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    {order.customer?.profilePhoto ? (
                      <img
                        src={getImageUrl(order.customer.profilePhoto)}
                        alt="Customer Profile"
                        style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }}
                      />
                    ) : (
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', border: '2px dashed var(--border-color)' }}>
                        No Photo
                      </div>
                    )}
                    <div>
                      <strong>{order.customer?.name || 'Not Added'}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{order.customer?.primaryPhone || 'Not Added'}</div>
                    </div>
                  </div>
                  <div><strong>Customer ID:</strong> {order.customer?.id || order.customerId || '—'}</div>
                  <div><strong>Phone:</strong> {order.customer?.primaryPhone || 'Not Added'}</div>
                  <div><strong>Alternative Contact:</strong> {order.customer?.alternativePhone || 'Not Added'}</div>
                  <div><strong>Address / Area:</strong> {order.customer?.address || 'Not Added'}</div>
                  <div><strong>Branch:</strong> {order.branch?.name || 'Main Branch'}</div>
                </div>
              ) : (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0a192f', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 800 }}>
                      {order.customer?.name ? order.customer.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Customer Name</div>
                      <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{order.customer?.name || 'Customer'}</strong>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>
                    Contact & address details restricted by RBAC security.
                  </div>
                </div>
              )}
            </div>

            {/* Garment Details */}
            <div style={{ gridColumn: 'span 2' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--jb-navy-light)', marginBottom: '12px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>Garment Details</h3>
              {order.garmentDetails ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  <div><strong>Dress Type:</strong> {order.garmentDetails.dressType || 'Not Added'}</div>
                  <div><strong>Quantity:</strong> {order.garmentDetails.quantity || 'Not Added'}</div>
                  <div><strong>Occasion:</strong> {order.garmentDetails.occasion || 'Not Added'}</div>
                  <div><strong>Fabric Supplied By:</strong> {order.garmentDetails.fabricSuppliedBy || 'Not Added'}</div>
                  <div><strong>Fabric Type:</strong> {order.garmentDetails.fabricType || 'Not Added'}</div>
                  <div><strong>Fabric Colour:</strong> {order.garmentDetails.fabricColour || 'Not Added'}</div>
                  <div><strong>Lining:</strong> {order.garmentDetails.liningRequired ? 'Required' : 'Not Required'}</div>
                  <div><strong>Padding / Cup:</strong> {order.garmentDetails.paddingCupRequired ? 'Required' : 'Not Required'}</div>
                  <div><strong>Work / Embroidery:</strong> {order.garmentDetails.workRequired ? 'Required' : 'Not Required'}</div>
                  <div><strong>Accessories:</strong> {order.garmentDetails.accessoriesSupplied || 'Not Added'}</div>
                  <div style={{ gridColumn: 'span 2' }}><strong>Instructions:</strong> {order.garmentDetails.specialDesignInstructions || 'Not Added'}</div>
                  <div style={{ gridColumn: 'span 2' }}><strong>Work Details:</strong> {order.garmentDetails.workDetails || 'Not Added'}</div>
                </div>
              ) : (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Garment details not found.</div>
              )}

              {/* Bespoke Measurements Breakdown */}
              {order.garmentDetails?.measurements && typeof order.garmentDetails.measurements === 'object' && Object.keys(order.garmentDetails.measurements).length > 0 && (
                <div style={{ marginTop: '16px', backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--jb-navy)' }}>
                      Tailoring Measurements ({order.garmentDetails.measurementUnit || 'Inches'}{order.garmentDetails.fitPreference ? ` • ${order.garmentDetails.fitPreference} Fit` : ''})
                    </strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                    {Object.entries(order.garmentDetails.measurements).map(([key, val]) => (
                      <div key={key} style={{ backgroundColor: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748b', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}:</span>{' '}
                        <strong style={{ color: '#0f172a' }}>{String(val)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reference Image */}
            <div style={{ gridColumn: 'span 2' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--jb-navy-light)', marginBottom: '12px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>Design Reference</h3>
              {(order.garmentDetails?.designReferenceImage || order.garmentDetails?.designReferencePhoto) ? (
                <div>
                  <a href={getImageUrl(order.garmentDetails.designReferenceImage || order.garmentDetails.designReferencePhoto)} target="_blank" rel="noopener noreferrer">
                    <img src={getImageUrl(order.garmentDetails.designReferenceImage || order.garmentDetails.designReferencePhoto)} alt="Design Reference" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                  </a>
                </div>
              ) : (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No Reference Image</div>
              )}

              {/* Additional Reference Photos */}
              {order.garmentDetails?.additionalImages && Array.isArray(order.garmentDetails.additionalImages) && order.garmentDetails.additionalImages.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Additional Reference Photos ({order.garmentDetails.additionalImages.length}):</span>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {order.garmentDetails.additionalImages.map((imgUrl, idx) => (
                      <a key={idx} href={getImageUrl(imgUrl)} target="_blank" rel="noopener noreferrer">
                        <img src={getImageUrl(imgUrl)} alt={`Additional ref ${idx + 1}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Production & Payment */}
            <div style={{ gridColumn: isFullAccess ? 'auto' : 'span 2' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--jb-navy-light)', marginBottom: '12px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>Production & Tailor Assignment</h3>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div><strong>Current Stage:</strong> <span className="badge badge-navy">{getStatusLabel(order.status)}</span></div>
                {order.approvedBy && (
                  <div style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
                    ✓ Approved by {cleanActorName(order.approvedBy)} {order.approvedAt && `(${new Date(order.approvedAt).toLocaleDateString()})`}
                  </div>
                )}
                {order.status !== 'PENDING_APPROVAL' && order.status !== 'REJECTED' && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Multi-Stage Production Tasks Card */}
                    <div style={{ backgroundColor: '#f5f3ff', padding: '14px', borderRadius: '10px', border: '1px solid #ddd6fe' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#5b21b6' }}>
                            ✂️ Production Tasks Assignment
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#6d28d9' }}>
                            Assign Cutting, Stitching, Aari, Finishing &amp; QC to craftsmen (No tailor acceptance required)
                          </div>
                        </div>
                        {canAssignTailor && (
                          <button
                            onClick={() => onOpenTaskModal && onOpenTaskModal(order)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              backgroundColor: '#6d28d9',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(109, 40, 217, 0.2)'
                            }}
                          >
                            <Scissors size={14} />
                            <span>{order.tasks && order.tasks.length > 0 ? 'Manage Tasks' : 'Assign Tasks'}</span>
                          </button>
                        )}
                      </div>

                      {order.tasks && order.tasks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {order.tasks.map(t => (
                            <div key={t.id} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              backgroundColor: '#ffffff',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              fontSize: '0.78rem'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 800, color: '#1e293b' }}>{t.taskName}</span>
                                <span style={{ color: '#64748b' }}>→ {t.assignedTailor?.name || 'Unassigned'}</span>
                              </div>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '999px',
                                fontWeight: 800,
                                fontSize: '0.7rem',
                                backgroundColor: t.status === 'COMPLETED' ? '#dcfce7' : (t.status === 'IN_PROGRESS' ? '#dbeafe' : '#fef3c7'),
                                color: t.status === 'COMPLETED' ? '#15803d' : (t.status === 'IN_PROGRESS' ? '#1d4ed8' : '#b45309')
                              }}>
                                {t.status === 'COMPLETED' ? '✓ Completed' : (t.status === 'IN_PROGRESS' ? '⚡ In Progress' : '● Assigned')}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.76rem', color: '#7c3aed', fontStyle: 'italic' }}>
                          No task breakdown created yet. Click "Assign Tasks" to assign separate production stages to tailors.
                        </div>
                      )}
                    </div>

                    {/* Single Tailor Assignment (Legacy Support) */}
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                        Primary Tailor:
                      </label>
                      {canAssignTailor ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <select
                              value={localTailorId}
                              onChange={(e) => setLocalTailorId(e.target.value)}
                              style={{
                                padding: '7px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.84rem',
                                fontWeight: 600,
                                backgroundColor: '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="">-- Select Tailor --</option>
                              {tailorsList?.map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                              ))}
                            </select>
                            <button
                              onClick={() => onAssignTailor && onAssignTailor(order.id, localTailorId)}
                              disabled={!localTailorId || Number(localTailorId) === Number(order.assignedTailorId)}
                              style={{
                                padding: '7px 14px',
                                borderRadius: '8px',
                                backgroundColor: (localTailorId && Number(localTailorId) !== Number(order.assignedTailorId)) ? 'var(--jb-crimson)' : '#e2e8f0',
                                color: (localTailorId && Number(localTailorId) !== Number(order.assignedTailorId)) ? '#ffffff' : '#94a3b8',
                                border: 'none',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: (localTailorId && Number(localTailorId) !== Number(order.assignedTailorId)) ? 'pointer' : 'not-allowed'
                              }}
                            >
                              {order.assignedTailorId ? 'Reassign Tailor' : 'Assign Tailor'}
                            </button>
                            {order.assignedTailor && (
                              <span style={{
                                fontSize: '0.78rem',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                backgroundColor: '#dcfce7',
                                color: '#15803d'
                              }}>
                                ✓ Assigned
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700 }}>
                            {order.assignedTailor?.name || 'Not assigned'}
                          </span>
                          {order.assignedTailor && (
                            <span style={{
                              fontSize: '0.78rem',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              backgroundColor: '#dcfce7',
                              color: '#15803d'
                            }}>
                              ✓ Assigned
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {nextInfo && order.status !== 'PENDING_APPROVAL' && (
                  <div style={{ marginTop: '4px' }}>
                    <button
                      onClick={() => onStatusChange && onStatusChange(order.id, nextInfo.nextStatus)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '6px 12px', borderRadius: '8px',
                        backgroundColor: nextInfo.bg,
                        color: nextInfo.text,
                        border: `1.5px solid ${nextInfo.border}`,
                        fontSize: '0.8rem', fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      <span>{nextInfo.buttonText}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
                <div><strong>Assigned Tailor:</strong> {order.assignedTailor?.name || 'Not yet assigned'}</div>
                {isFullAccess && order.assignedBy && (
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Assigned by: <strong>{order.assignedBy}</strong>
                    {order.assignedAt && ` · ${new Date(order.assignedAt).toLocaleString()}`}
                  </div>
                )}
                {isFullAccess && order.tailorAccepted && order.tailorAcceptedAt && (
                  <div style={{ fontSize: '0.82rem', color: '#16a34a' }}>
                    ✓ Tailor accepted on {new Date(order.tailorAcceptedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* ── Order Timeline (CEO / Manager only) ── */}
            {isFullAccess && (
              <div style={{ gridColumn: 'span 2' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--jb-navy-light)', marginBottom: '16px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  Order Timeline &amp; Audit Trail
                </h3>
                <div style={{ position: 'relative', paddingLeft: '24px' }}>
                  {/* Vertical connector line */}
                  <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', backgroundColor: '#e2e8f0', borderRadius: '2px' }} />

                  {/* Created */}
                  <div style={{ position: 'relative', marginBottom: '18px' }}>
                    <div style={{ position: 'absolute', left: '-17px', top: '3px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#3b82f6', border: '2px solid #fff', boxShadow: '0 0 0 2px #bfdbfe', zIndex: 1 }} />
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>Order Created</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{order.orderDate ? new Date(order.orderDate).toLocaleString() : '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Customer: {order.customer?.name || '—'}</div>
                  </div>

                  {/* Approved */}
                  {order.approvedBy && (
                    <div style={{ position: 'relative', marginBottom: '18px' }}>
                      <div style={{ position: 'absolute', left: '-17px', top: '3px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#16a34a', border: '2px solid #fff', boxShadow: '0 0 0 2px #bbf7d0', zIndex: 1 }} />
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>Approved</div>
                      <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>by {cleanActorName(order.approvedBy)}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{order.approvedAt ? new Date(order.approvedAt).toLocaleString() : '—'}</div>
                    </div>
                  )}

                  {/* Rejected */}
                  {order.rejectedBy && (
                    <div style={{ position: 'relative', marginBottom: '18px' }}>
                      <div style={{ position: 'absolute', left: '-17px', top: '3px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#dc2626', border: '2px solid #fff', boxShadow: '0 0 0 2px #fecaca', zIndex: 1 }} />
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#dc2626' }}>Rejected</div>
                      <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>by {order.rejectedBy}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{order.rejectedAt ? new Date(order.rejectedAt).toLocaleString() : '—'}</div>
                      {order.rejectionReason && <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '2px' }}>Reason: {order.rejectionReason}</div>}
                    </div>
                  )}

                  {/* Price Confirmed */}
                  {order.priceAcceptedByCustomer && (
                    <div style={{ position: 'relative', marginBottom: '18px' }}>
                      <div style={{ position: 'absolute', left: '-17px', top: '3px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#059669', border: '2px solid #fff', boxShadow: '0 0 0 2px #a7f3d0', zIndex: 1 }} />
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#059669' }}>Price Confirmed by Customer</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {order.priceAcceptedAt ? new Date(order.priceAcceptedAt).toLocaleString() : 'Confirmed'}
                        {order.totalAmount ? ` · Total LKR ${Number(order.totalAmount).toLocaleString()}` : ''}
                      </div>
                    </div>
                  )}

                  {/* Tailor Assigned */}
                  {order.assignedBy && (
                    <div style={{ position: 'relative', marginBottom: '18px' }}>
                      <div style={{ position: 'absolute', left: '-17px', top: '3px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#d97706', border: '2px solid #fff', boxShadow: '0 0 0 2px #fde68a', zIndex: 1 }} />
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>Tailor Assigned</div>
                      <div style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600 }}>by {order.assignedBy}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{order.assignedAt ? new Date(order.assignedAt).toLocaleString() : '—'}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Tailor: {order.assignedTailor?.name || '—'}</div>
                    </div>
                  )}

                  {/* Tailor Accepted */}
                  {order.tailorAccepted && order.tailorAcceptedAt && (
                    <div style={{ position: 'relative', marginBottom: '18px' }}>
                      <div style={{ position: 'absolute', left: '-17px', top: '3px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#059669', border: '2px solid #fff', boxShadow: '0 0 0 2px #a7f3d0', zIndex: 1 }} />
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>Tailor Accepted — Production Started</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{new Date(order.tailorAcceptedAt).toLocaleString()}</div>
                    </div>
                  )}

                  {/* Production History Stages */}
                  {order.productionHistory && order.productionHistory.length > 0 && (
                    order.productionHistory
                      .filter(h => !['PENDING_APPROVAL', 'APPROVED', 'PENDING_PRODUCTION'].includes(h.stage))
                      .map((h, idx) => {
                        const stageColors = {
                          CUTTING:            { dot: '#2563eb', glow: '#bfdbfe' },
                          STITCHING:          { dot: '#7c3aed', glow: '#ddd6fe' },
                          EMBROIDERY_AARI:    { dot: '#db2777', glow: '#fbcfe8' },
                          AARI_EMBROIDERY:    { dot: '#db2777', glow: '#fbcfe8' },
                          FITTING_ALTERATION: { dot: '#0891b2', glow: '#a5f3fc' },
                          FINISHING:          { dot: '#ea580c', glow: '#fed7aa' },
                          QUALITY_CHECK:      { dot: '#ca8a04', glow: '#fef08a' },
                          READY:              { dot: '#16a34a', glow: '#bbf7d0' },
                          DELIVERED:          { dot: '#0f172a', glow: '#cbd5e1' },
                          ON_HOLD:            { dot: '#f97316', glow: '#fed7aa' },
                          CANCELLED:          { dot: '#dc2626', glow: '#fecaca' },
                          ORDER_CONFIRMED:    { dot: '#3b82f6', glow: '#bfdbfe' },
                        }[h.stage] || { dot: '#64748b', glow: '#e2e8f0' };
                        return (
                          <div key={idx} style={{ position: 'relative', marginBottom: '18px' }}>
                            <div style={{ position: 'absolute', left: '-17px', top: '3px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: stageColors.dot, border: '2px solid #fff', boxShadow: `0 0 0 2px ${stageColors.glow}`, zIndex: 1 }} />
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{getStatusLabel(h.stage)}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{h.startedAt ? new Date(h.startedAt).toLocaleString() : '—'}</div>
                            {h.notes && <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px', fontStyle: 'italic' }}>{cleanActivityNote(h.notes)}</div>}
                            {h.assignedTo && <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>Worker: {h.assignedTo.name} ({h.assignedTo.role})</div>}
                          </div>
                        );
                      })
                  )}

                  {/* Pending state with no history */}
                  {order.status === 'PENDING_APPROVAL' && !order.approvedBy && !order.rejectedBy && (
                    <div style={{ position: 'relative', marginBottom: '18px' }}>
                      <div style={{ position: 'absolute', left: '-17px', top: '3px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#f59e0b', border: '2px solid #fff', boxShadow: '0 0 0 2px #fde68a', zIndex: 1 }} />
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#b45309' }}>Awaiting CEO / Manager Review</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>No approval action taken yet</div>
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* Finance / Quotation & Payment: CEO & MANAGER ONLY */}
            {isFullAccess && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--jb-navy-light)', margin: 0 }}>Quotation & Payment</h3>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <strong>Quotation Status:</strong>{' '}
                    <span style={{
                      padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800,
                      ...getPriceStatusColors(order.priceStatus || (Number(order.totalAmount) > 0 ? 'ACCEPTED' : 'PENDING'))
                    }}>
                      {getPriceStatusLabel(order.priceStatus || (Number(order.totalAmount) > 0 ? 'ACCEPTED' : 'PENDING'))}
                    </span>
                    {order.priceAcceptedByCustomer && (
                      <span style={{ fontSize: '0.76rem', color: '#16a34a', marginLeft: '6px', fontWeight: 700 }}>
                        ✓ Accepted by Customer
                      </span>
                    )}
                    {order.priceStatus === 'DECLINED' && order.priceDeclineReason && (
                      <div style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '3px' }}>
                        Customer declined reason: "{order.priceDeclineReason}"
                      </div>
                    )}
                  </div>
                  <div><strong>Total Quoted:</strong> {order.totalAmount !== null && order.totalAmount !== undefined && Number(order.totalAmount) > 0 ? `LKR ${Number(order.totalAmount).toLocaleString()}` : 'PRICE PENDING'}</div>
                  {Number(order.serviceCharge || 0) > 0 && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Tailoring: LKR {Number(order.serviceCharge).toLocaleString()} | Work: LKR {Number(order.additionalWorkCharge || 0).toLocaleString()} | Material: LKR {Number(order.materialCharge || 0).toLocaleString()}
                    </div>
                  )}
                  <div><strong>Paid Amount:</strong> {order.advancePayment !== null && order.advancePayment !== undefined ? `LKR ${Number(order.advancePayment).toLocaleString()}` : '0'}</div>
                  <div><strong>Balance:</strong> {order.balanceAmount !== null && order.balanceAmount !== undefined ? `LKR ${Number(order.balanceAmount).toLocaleString()}` : '0'}</div>
                  <div><strong>Payment Status:</strong> {
                    Number(order.totalAmount || 0) === 0 ? (
                      <span className="badge badge-secondary" style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 800 }}>
                        PRICE PENDING / UNPRICED
                      </span>
                    ) : Number(order.balanceAmount || 0) <= 0 ? (
                      <span className="badge badge-success">✓ Paid in Full</span>
                    ) : Number(order.advancePayment || 0) > 0 ? (
                      <span className="badge badge-warning">Partially Paid (Due: LKR {Number(order.balanceAmount).toLocaleString()})</span>
                    ) : (
                      <span className="badge badge-danger">Payment Due (LKR {Number(order.balanceAmount).toLocaleString()})</span>
                    )
                  }</div>

                  {/* Action Buttons Panel */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role)) && order.status !== 'PENDING_APPROVAL' && order.status !== 'REJECTED' && (
                      <button
                        onClick={() => onOpenPricing && onOpenPricing(order)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '6px 14px', borderRadius: '8px',
                          backgroundColor: '#eff6ff', color: '#0052cc',
                          border: '1px solid #bfdbfe', fontSize: '0.8rem', fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        <DollarSign size={14} /> {order.priceStatus === 'PENDING' ? 'Set Price' : 'Edit Price'}
                      </button>
                    )}

                    {/* Send Quote WhatsApp button */}
                    {order.customer?.primaryPhone && Number(order.totalAmount || 0) > 0 && (
                      <a
                        href={`https://wa.me/${normalizePhoneForWhatsApp(order.customer.primaryPhone)}?text=${encodeURIComponent(generateQuotationWhatsAppMessage(order))}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '6px 14px', borderRadius: '8px',
                          backgroundColor: '#22c55e', color: '#ffffff',
                          border: 'none', fontSize: '0.8rem', fontWeight: 800,
                          textDecoration: 'none'
                        }}
                      >
                        <MessageCircle size={14} /> Send Quote WhatsApp
                      </a>
                    )}

                    {/* Mark Customer Confirmed Button */}
                    {!isPriceConfirmed && Number(order.totalAmount || 0) > 0 && (
                      <button
                        onClick={() => onConfirmCustomerPrice && onConfirmCustomerPrice(order.id)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '6px 14px', borderRadius: '8px',
                          backgroundColor: '#16a34a', color: '#ffffff',
                          border: 'none', fontSize: '0.8rem', fontWeight: 800,
                          cursor: 'pointer', boxShadow: '0 2px 4px rgba(22,163,74,0.2)'
                        }}
                      >
                        <Check size={14} /> Mark Customer Confirmed
                      </button>
                    )}

                    {Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'Manager'].includes(user?.role)) && Number(order.totalAmount || 0) > 0 && Number(order.balanceAmount || 0) > 0 && (
                      <button
                        onClick={() => onRecordPayment && onRecordPayment(order)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                        }}
                      >
                        <CreditCard size={14} /> Record Payment
                      </button>
                    )}

                    <button
                      onClick={() => onOpenInvoice && onOpenInvoice(order)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '6px 12px', borderRadius: '8px',
                        backgroundColor: '#f8fafc', color: '#334155',
                        border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <FileText size={14} /> Digital Invoice
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Payment Proofs & Verification Section */}
            {isFullAccess && order.payments && order.payments.length > 0 && (
              <div style={{
                gridColumn: 'span 2',
                marginTop: '16px',
                backgroundColor: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={18} color="var(--jb-navy-light)" />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--jb-navy-light)', margin: 0 }}>
                      Customer Payment Proofs &amp; Records ({order.payments.length})
                    </h3>
                  </div>
                  {order.payments.some(p => p.status === 'PENDING_VERIFICATION') && (
                    <span style={{
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <Clock size={13} /> Action Required: Verification Pending
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {order.payments.map((p, idx) => {
                    const isPending = p.status === 'PENDING_VERIFICATION';
                    const isRejected = p.status === 'REJECTED';
                    const isVerified = p.status === 'VERIFIED' || (!p.status && !p.slipImage);

                    return (
                      <div
                        key={p.id || idx}
                        style={{
                          backgroundColor: isPending ? '#fffdf7' : (isRejected ? '#fef2f2' : '#f8fafc'),
                          border: `1.5px solid ${isPending ? '#f59e0b' : (isRejected ? '#fecaca' : '#e2e8f0')}`,
                          borderRadius: '10px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          transition: 'all 0.15s ease',
                          boxShadow: isPending ? '0 2px 8px rgba(245, 158, 11, 0.12)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                            {/* Receipt Image Thumbnail */}
                            {p.slipImage ? (
                              <div
                                onClick={() => setViewingSlipModalImage(getImageUrl(p.slipImage))}
                                style={{
                                  width: '72px',
                                  height: '72px',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  border: '2px solid #cbd5e1',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  position: 'relative',
                                  backgroundColor: '#f1f5f9',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                                }}
                                title="Click to view full receipt in lightbox"
                              >
                                <img
                                  src={getImageUrl(p.slipImage)}
                                  alt="Payment Slip Proof"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <div style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  backgroundColor: 'rgba(0,0,0,0.65)',
                                  color: '#ffffff',
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  textAlign: 'center',
                                  padding: '2px 0'
                                }}>
                                  View Proof
                                </div>
                              </div>
                            ) : (
                              <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '8px',
                                backgroundColor: '#e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#64748b',
                                flexShrink: 0
                              }}>
                                <CreditCard size={24} />
                              </div>
                            )}

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                                  LKR {Number(p.amount || 0).toLocaleString()}
                                </strong>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  backgroundColor: isPending ? '#fef3c7' : (isRejected ? '#fee2e2' : '#dcfce7'),
                                  color: isPending ? '#b45309' : (isRejected ? '#dc2626' : '#15803d'),
                                  border: `1px solid ${isPending ? '#fde68a' : (isRejected ? '#fca5a5' : '#bbf7d0')}`
                                }}>
                                  {isPending ? '⏳ PENDING VERIFICATION' : (isRejected ? '✕ REJECTED' : '✓ VERIFIED')}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                                  via {p.paymentMethod || 'Bank Deposit'}
                                </span>
                              </div>

                              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                {p.transactionRef && (
                                  <span>
                                    <strong>Ref:</strong> <code style={{ backgroundColor: '#e2e8f0', padding: '1px 5px', borderRadius: '4px' }}>{p.transactionRef}</code>
                                  </span>
                                )}
                                <span>
                                  <strong>Submitted:</strong> {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                                </span>
                                {p.recordedBy && (
                                  <span>
                                    <strong>By:</strong> {cleanActorName(p.recordedBy)}
                                  </span>
                                )}
                              </div>

                              {p.notes && (
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                                  Note: {cleanActivityNote(p.notes)}
                                </div>
                              )}

                              {isVerified && p.verifiedBy && (
                                <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600, marginTop: '4px' }}>
                                  ✓ Verified by {cleanActorName(p.verifiedBy)} {p.verifiedAt && `on ${new Date(p.verifiedAt).toLocaleString()}`}
                                </div>
                              )}

                              {isRejected && (
                                <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 700, marginTop: '4px' }}>
                                  ✕ Rejected {p.verifiedBy && `by ${cleanActorName(p.verifiedBy)}`} {p.rejectionReason && `— Reason: ${p.rejectionReason}`}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons for Pending Verification */}
                          {isPending && isFullAccess && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => onVerifyPaymentSlip && onVerifyPaymentSlip(order.id, p.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '7px 14px',
                                  borderRadius: '6px',
                                  backgroundColor: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '0.82rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                                }}
                              >
                                <Check size={15} /> Verify &amp; Credit Payment
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingSlipPaymentId(p.id);
                                  setSlipRejectReason('');
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '7px 12px',
                                  borderRadius: '6px',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fca5a5',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                <X size={15} /> Reject Slip
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Inline Reject Reason Box if this slip is being rejected */}
                        {rejectingSlipPaymentId === p.id && (
                          <div style={{
                            marginTop: '6px',
                            padding: '12px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #fca5a5',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#991b1b' }}>
                              Reason for rejecting slip:
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Receipt image unclear / amount mismatch / duplicate"
                              value={slipRejectReason}
                              onChange={(e) => setSlipRejectReason(e.target.value)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.82rem'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => setRejectingSlipPaymentId(null)}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#f8fafc',
                                  color: '#475569',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  if (onRejectPaymentSlip) {
                                    onRejectPaymentSlip(order.id, p.id, slipRejectReason);
                                    setRejectingSlipPaymentId(null);
                                  }
                                }}
                                style={{
                                  padding: '5px 14px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  backgroundColor: '#dc2626',
                                  color: '#ffffff',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                Confirm Rejection
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Sticky Bottom Action Bar */}
        {isFullAccess && (
          <div className="mobile-sticky-action-bar">
            {order.status === 'PENDING_APPROVAL' ? (
              <>
                <button
                  onClick={() => onApproveOrder && onApproveOrder(order.id)}
                  style={{
                    flex: 1, minHeight: '44px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#16a34a', color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Check size={16} /> Approve
                </button>
                <button
                  onClick={() => onOpenRejectModal && onOpenRejectModal(order)}
                  style={{
                    flex: 1, minHeight: '44px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#dc2626', color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} /> Reject
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onOpenPricing && onOpenPricing(order)}
                  style={{
                    flex: 1, minHeight: '44px', borderRadius: '8px', border: '1px solid #bfdbfe',
                    backgroundColor: '#eff6ff', color: '#0052cc', fontWeight: 800, fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <DollarSign size={15} /> {Number(order.totalAmount || 0) > 0 ? 'Edit Price' : 'Set Price'}
                </button>
                {!isPriceConfirmed && Number(order.totalAmount || 0) > 0 && (
                  <button
                    onClick={() => onConfirmCustomerPrice && onConfirmCustomerPrice(order.id)}
                    style={{
                      flex: 1, minHeight: '44px', borderRadius: '8px', border: 'none',
                      backgroundColor: '#16a34a', color: '#fff', fontWeight: 800, fontSize: '0.8rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Check size={15} /> Confirm Price
                  </button>
                )}
                {order.customer?.primaryPhone && Number(order.totalAmount || 0) > 0 && (
                  <a
                    href={`https://wa.me/${normalizePhoneForWhatsApp(order.customer.primaryPhone)}?text=${encodeURIComponent(generateQuotationWhatsAppMessage(order))}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      minHeight: '44px', padding: '0 12px', borderRadius: '8px',
                      backgroundColor: '#22c55e', color: '#fff', fontWeight: 800, fontSize: '0.8rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      textDecoration: 'none'
                    }}
                  >
                    <MessageCircle size={15} /> Quote WA
                  </a>
                )}
                <button
                  onClick={() => onOpenInvoice && onOpenInvoice(order)}
                  style={{
                    minHeight: '44px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc', color: '#334155', fontWeight: 700, fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <FileText size={15} /> Invoice
                </button>
                {order.payments?.some(p => p.status === 'PENDING_VERIFICATION') && (
                  <button
                    onClick={() => {
                      const p = order.payments.find(pay => pay.status === 'PENDING_VERIFICATION');
                      if (p && onVerifyPaymentSlip) onVerifyPaymentSlip(order.id, p.id);
                    }}
                    style={{
                      minHeight: '44px', padding: '0 12px', borderRadius: '8px', border: 'none',
                      backgroundColor: '#16a34a', color: '#fff', fontWeight: 800, fontSize: '0.8rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Check size={15} /> Verify Slip
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Payment Slip Lightbox Preview Modal */}
        {viewingSlipModalImage && (
          <div
            onClick={() => setViewingSlipModalImage(null)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3000,
              padding: '20px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                maxWidth: '92vw',
                maxHeight: '92vh',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{
                padding: '12px 18px',
                backgroundColor: 'var(--jb-navy)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <strong style={{ fontSize: '0.95rem' }}>Customer Payment Slip Proof</strong>
                <button
                  onClick={() => setViewingSlipModalImage(null)}
                  style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto', maxHeight: '76vh' }}>
                <img
                  src={viewingSlipModalImage}
                  alt="Customer Payment Receipt"
                  style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: '6px' }}
                />
              </div>
              <div style={{ padding: '10px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Verify that deposit amount, date, and account details match the order.
                </span>
                <a
                  href={viewingSlipModalImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#0284c7',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  Open Original <ArrowUpRight size={14} />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const COLOMBO_OFFSET_MS = 330 * 60 * 1000;
const SALES_EXCLUDED_STATUSES = new Set(['CANCELLED', 'REJECTED', 'PRICE_DECLINED']);

const toColomboDateKey = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const shifted = new Date(parsed.getTime() + COLOMBO_OFFSET_MS);
  const yr = shifted.getUTCFullYear();
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dt = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yr}-${mo}-${dt}`;
};

const shiftColomboDateKey = (dateKey, offsetDays) => {
  const [yr, mo, dt] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(yr, mo - 1, dt + offsetDays));
  const rYr = shifted.getUTCFullYear();
  const rMo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const rDt = String(shifted.getUTCDate()).padStart(2, '0');
  return `${rYr}-${rMo}-${rDt}`;
};

const getColomboDayMeta = (dateKey) => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [yr, mo, dt] = dateKey.split('-').map(Number);
  const utcDate = new Date(Date.UTC(yr, mo - 1, dt));
  return {
    day: dayNames[utcDate.getUTCDay()],
    formattedDate: `${String(dt).padStart(2, '0')} ${monthNames[utcDate.getUTCMonth()]}`
  };
};

const toMoneyCents = (val) => Math.round((Number(val) || 0) * 100);
const fromMoneyCents = (cents) => Number((cents / 100).toFixed(2));

const formatExactLKR = (value) => {
  const num = Number(value) || 0;
  const hasCents = Math.round(num * 100) % 100 !== 0;
  return num.toLocaleString('en-LK', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0
  });
};

const computeNiceChartMax = (maxVal) => {
  const numericMax = Number(maxVal) || 0;
  if (numericMax <= 0) return 2000;
  const rawStep = numericMax / 4;
  if (rawStep <= 1) return 4;
  const exp = Math.floor(Math.log10(rawStep));
  const mag = Math.pow(10, exp);
  const norm = rawStep / mag;
  const candidates = exp >= 2
    ? [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    : [1, 2, 3, 4, 5, 6, 8, 10];
  const niceNorm = candidates.find(c => c >= norm - 1e-9) || 10;
  return niceNorm * mag * 4;
};

export const SalesERP = () => {
  const { activeBranch, setActiveBranch, getAuthHeaders, user, setActiveTab } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  const isSuperOrAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
  const isFullAccess = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'].includes(userRole);
  const canSwitchBranch = isSuperOrAdmin;
  const effectiveBranch = (userRole === 'MANAGER' && user?.branchId) ? String(user.branchId) : activeBranch;
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);
  const [profileCustomerId, setProfileCustomerId] = useState(null);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);
  const [activeBarIdx, setActiveBarIdx] = useState(null);
  const summaryReqSeqRef = useRef(0);
  const [pricingOrder, setPricingOrder] = useState(null);
  const [taskModalOrder, setTaskModalOrder] = useState(null);
  const [finishedNotificationOrder, setFinishedNotificationOrder] = useState(null);
  const [trendReferenceDate, setTrendReferenceDate] = useState('');

  // Approval and tailor assignment state
  const [tailorsList, setTailorsList] = useState([]);
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [tailorRejectingOrder, setTailorRejectingOrder] = useState(null);
  const [tailorRejectionReasonText, setTailorRejectionReasonText] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const branchParam = effectiveBranch && effectiveBranch !== 'ALL' ? `?branchId=${effectiveBranch}` : '';
      const res = await fetch(`${API_URL}/api/orders${branchParam}`, {
        headers: getAuthHeaders ? getAuthHeaders() : {
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      } else {
        setError(data.message || 'Unable to load orders. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('Unable to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTailors = async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/tailors/list`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tailors)) {
        setTailorsList(data.tailors);
      }
    } catch (err) {
      console.error('Error fetching tailors:', err);
    }
  };

  const fetchDashboardSummary = async (customDate = trendReferenceDate) => {
    const reqId = ++summaryReqSeqRef.current;
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const params = new URLSearchParams();
      if (effectiveBranch && effectiveBranch !== 'ALL') {
        params.append('branchId', effectiveBranch);
      }
      if (customDate) {
        params.append('date', customDate);
      }
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_URL}/api/orders/dashboard-summary${queryString}`, {
        headers: getAuthHeaders ? getAuthHeaders() : {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (reqId !== summaryReqSeqRef.current) return;
      if (res.ok && data?.success && data?.summary) {
        setDashboardSummary(data.summary);
        setSummaryError(null);
      } else {
        setDashboardSummary(null);
        setSummaryError(data?.message || 'Unable to load 7-day sales summary. Please retry.');
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
      if (reqId === summaryReqSeqRef.current) {
        setDashboardSummary(null);
        setSummaryError('Network error loading 7-day sales summary. Please retry.');
      }
    } finally {
      if (reqId === summaryReqSeqRef.current) {
        setSummaryLoading(false);
      }
    }
  };

  const refreshAll = () => {
    fetchOrders();
    fetchTailors();
    fetchDashboardSummary(trendReferenceDate);
  };

  useEffect(() => {
    refreshAll();
  }, [effectiveBranch, trendReferenceDate, user]);

  const handleApproveOrder = async (orderId) => {
    try {
      setIsProcessingApproval(true);
      const res = await fetch(`${API_URL}/api/orders/${orderId}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...(data.order || {}), status: 'ORDER_CONFIRMED' } : o));
        if (viewingOrder?.id === orderId) {
          setViewingOrder(prev => ({ ...prev, ...(data.order || {}), status: 'ORDER_CONFIRMED' }));
        }
        refreshAll();
      } else {
        alert(data.message || 'Failed to approve order');
      }
    } catch (err) {
      console.error('Approval error:', err);
      alert('Network error approving order');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleRejectOrder = async (orderId, reason) => {
    if (!reason || !reason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    try {
      setIsProcessingApproval(true);
      const res = await fetch(`${API_URL}/api/orders/${orderId}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        },
        body: JSON.stringify({ reason: reason.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...(data.order || {}), status: 'REJECTED' } : o));
        if (viewingOrder?.id === orderId) {
          setViewingOrder(prev => ({ ...prev, ...(data.order || {}), status: 'REJECTED' }));
        }
        setRejectingOrder(null);
        setRejectionReasonText('');
        refreshAll();
      } else {
        alert(data.message || 'Failed to reject order');
      }
    } catch (err) {
      console.error('Rejection error:', err);
      alert('Network error rejecting order');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleConfirmCustomerPrice = async (orderId) => {
    try {
      setIsProcessingApproval(true);
      const res = await fetch(`${API_URL}/api/orders/${orderId}/confirm-price`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? {
          ...o,
          ...(data.order || {}),
          priceAcceptedByCustomer: true,
          priceStatus: 'ACCEPTED'
        } : o));
        if (viewingOrder?.id === orderId) {
          setViewingOrder(prev => ({
            ...prev,
            ...(data.order || {}),
            priceAcceptedByCustomer: true,
            priceStatus: 'ACCEPTED'
          }));
        }
        refreshAll();
      } else {
        alert(data.message || 'Failed to record customer price confirmation.');
      }
    } catch (err) {
      console.error('Confirm customer price error:', err);
      alert('Network error recording price confirmation.');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleAssignTailor = async (orderId, tailorId) => {
    if (!tailorId) return;
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/assign-tailor`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        },
        body: JSON.stringify({ tailorId: parseInt(tailorId) })
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...(data.order || {}) } : o));
        if (viewingOrder?.id === orderId) {
          setViewingOrder(prev => ({ ...prev, ...(data.order || {}) }));
        }
        setSelectedTailorForOrder(prev => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
        refreshAll();
      } else {
        alert(data.message || 'Failed to assign tailor');
      }
    } catch (err) {
      console.error('Assign tailor error:', err);
      alert('Network error assigning tailor');
    }
  };

  const handleTailorAccept = async (orderId) => {
    try {
      setIsProcessingApproval(true);
      const res = await fetch(`${API_URL}/api/orders/${orderId}/tailor-accept`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...(data.order || {}), tailorAccepted: true, status: 'CUTTING' } : o));
        if (viewingOrder?.id === orderId) {
          setViewingOrder(prev => ({ ...prev, ...(data.order || {}), tailorAccepted: true, status: 'CUTTING' }));
        }
        refreshAll();
      } else {
        alert(data.message || 'Failed to accept order assignment.');
      }
    } catch (err) {
      console.error('Error accepting tailor order:', err);
      alert('Network error while accepting order.');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleTailorReject = async (orderId, reason) => {
    if (!reason || !reason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    try {
      setIsProcessingApproval(true);
      const res = await fetch(`${API_URL}/api/orders/${orderId}/tailor-reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        },
        body: JSON.stringify({ reason: reason.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? {
          ...o,
          ...(data.order || {}),
          assignedTailorId: null,
          assignedTailor: null,
          tailorAccepted: false,
          tailorRejectedAt: new Date().toISOString(),
          tailorRejectionReason: reason.trim()
        } : o));
        if (viewingOrder?.id === orderId) {
          setViewingOrder(prev => ({
            ...prev,
            ...(data.order || {}),
            assignedTailorId: null,
            assignedTailor: null,
            tailorAccepted: false,
            tailorRejectedAt: new Date().toISOString(),
            tailorRejectionReason: reason.trim()
          }));
        }
        setTailorRejectingOrder(null);
        setTailorRejectionReasonText('');
        refreshAll();
      } else {
        alert(data.message || 'Failed to reject assignment.');
      }
    } catch (err) {
      console.error('Error rejecting tailor assignment:', err);
      alert('Network error while rejecting assignment.');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleVerifyPaymentSlip = async (orderId, paymentId) => {
    try {
      setIsProcessingApproval(true);
      const res = await fetch(`${API_URL}/api/orders/${orderId}/payments/${paymentId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        if (data.order) {
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...data.order } : o));
          if (viewingOrder?.id === orderId) {
            setViewingOrder(prev => ({ ...prev, ...data.order }));
          }
        }
        refreshAll();
        alert(data.message || 'Payment verified and credited successfully!');
      } else {
        alert(data.message || 'Failed to verify payment slip.');
      }
    } catch (err) {
      console.error('Verify payment slip error:', err);
      alert('Network error verifying payment slip.');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleRejectPaymentSlip = async (orderId, paymentId, reason) => {
    try {
      setIsProcessingApproval(true);
      const res = await fetch(`${API_URL}/api/orders/${orderId}/payments/${paymentId}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        },
        body: JSON.stringify({ reason: reason ? reason.trim() : 'Payment slip rejected by manager' })
      });
      const data = await res.json();
      if (data.success) {
        if (data.order) {
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...data.order } : o));
          if (viewingOrder?.id === orderId) {
            setViewingOrder(prev => ({ ...prev, ...data.order }));
          }
        } else {
          setOrders(prev => prev.map(o => {
            if (o.id !== orderId) return o;
            const updatedPayments = (o.payments || []).map(p => p.id === paymentId ? { ...p, status: 'REJECTED', rejectionReason: reason } : p);
            return { ...o, payments: updatedPayments };
          }));
          if (viewingOrder?.id === orderId) {
            setViewingOrder(prev => ({
              ...prev,
              payments: (prev.payments || []).map(p => p.id === paymentId ? { ...p, status: 'REJECTED', rejectionReason: reason } : p)
            }));
          }
        }
        refreshAll();
        alert('Payment slip has been rejected.');
      } else {
        alert(data.message || 'Failed to reject payment slip.');
      }
    } catch (err) {
      console.error('Reject payment slip error:', err);
      alert('Network error rejecting payment slip.');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // When order modal closes, refetch orders and dashboard summary
  const handleModalClose = () => {
    setIsOrderModalOpen(false);
    refreshAll();
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        // Update local state to reflect change immediately without full reload
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...(data.order || {}), status: newStatus } : o));
        if (viewingOrder?.id === orderId) {
          setViewingOrder(prev => ({ ...prev, ...(data.order || {}), status: newStatus }));
        }
      } else {
        alert(data.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Error updating status');
    }
  };

  // Compute metrics from real PostgreSQL data using Asia/Colombo (UTC+05:30) date boundaries
  const defaultColomboTodayKey = toColomboDateKey(new Date());
  const refDateKey = (trendReferenceDate && /^\d{4}-\d{2}-\d{2}$/.test(trendReferenceDate))
    ? trendReferenceDate
    : defaultColomboTodayKey;
  const yesterdayDateKey = shiftColomboDateKey(refDateKey, -1);
  const monthPrefixKey = refDateKey.slice(0, 7);

  const validClientOrders = orders.filter(
    o => !SALES_EXCLUDED_STATUSES.has(String(o.status || '').toUpperCase())
  );

  const clientRevenueCentsByDate = new Map();
  const clientOrdersByDate = new Map();

  for (const o of validClientOrders) {
    const oDateKey = toColomboDateKey(o.orderDate || o.createdAt);
    if (oDateKey) {
      if (!clientOrdersByDate.has(oDateKey)) {
        clientOrdersByDate.set(oDateKey, []);
      }
      clientOrdersByDate.get(oDateKey).push(o);
    }

    let orderVerifiedPaidCents = 0;
    if (Array.isArray(o.payments)) {
      for (const p of o.payments) {
        const pStatus = p.status ? String(p.status).trim().toUpperCase() : 'VERIFIED';
        if (pStatus !== 'VERIFIED') continue;
        const pCents = toMoneyCents(p.amount);
        if (pCents <= 0) continue;
        orderVerifiedPaidCents += pCents;
        const pDateKey = toColomboDateKey(p.createdAt);
        if (pDateKey) {
          clientRevenueCentsByDate.set(pDateKey, (clientRevenueCentsByDate.get(pDateKey) || 0) + pCents);
        }
      }
    }

    const residualAdvCents = Math.max(0, toMoneyCents(o.advancePayment) - orderVerifiedPaidCents);
    if (residualAdvCents > 0 && oDateKey) {
      clientRevenueCentsByDate.set(oDateKey, (clientRevenueCentsByDate.get(oDateKey) || 0) + residualAdvCents);
    }
  }

  const todayOrdersList = clientOrdersByDate.get(refDateKey) || [];
  const todayOrders = dashboardSummary ? dashboardSummary.todayOrders : todayOrdersList.length;
  const todaySales = dashboardSummary
    ? dashboardSummary.todaySales
    : fromMoneyCents(clientRevenueCentsByDate.get(refDateKey) || 0);

  const yesterdayOrdersList = clientOrdersByDate.get(yesterdayDateKey) || [];
  const yesterdayOrders = dashboardSummary ? dashboardSummary.yesterdayOrders : yesterdayOrdersList.length;
  const yesterdaySales = dashboardSummary
    ? dashboardSummary.yesterdaySales
    : fromMoneyCents(clientRevenueCentsByDate.get(yesterdayDateKey) || 0);

  let fallbackMonthlyOrders = 0;
  for (const [dk, list] of clientOrdersByDate.entries()) {
    if (dk.startsWith(monthPrefixKey) && dk <= refDateKey) {
      fallbackMonthlyOrders += list.length;
    }
  }
  let fallbackMonthlySalesCents = 0;
  for (const [dk, cents] of clientRevenueCentsByDate.entries()) {
    if (dk.startsWith(monthPrefixKey) && dk <= refDateKey) {
      fallbackMonthlySalesCents += cents;
    }
  }
  const monthlyOrders = dashboardSummary ? dashboardSummary.monthlyOrders : fallbackMonthlyOrders;
  const monthlySales = dashboardSummary ? dashboardSummary.monthlySales : fromMoneyCents(fallbackMonthlySalesCents);

  const getOrderValueCents = (o) => (toMoneyCents(o.agreedTotal) > 0 ? toMoneyCents(o.agreedTotal) : toMoneyCents(o.totalAmount));

  const pricedOrders = validClientOrders.filter(o => getOrderValueCents(o) > 0);
  const pricedOrdersCount = dashboardSummary ? dashboardSummary.pricedOrdersCount : pricedOrders.length;
  const aov = dashboardSummary
    ? dashboardSummary.averageOrderValue
    : (pricedOrdersCount > 0
        ? Math.round(fromMoneyCents(pricedOrders.reduce((sum, o) => sum + getOrderValueCents(o), 0)) / pricedOrdersCount)
        : 0);

  const dueOrders = validClientOrders.filter(o => getOrderValueCents(o) > 0 && toMoneyCents(o.balanceAmount) > 0);
  const paymentsDueCount = dashboardSummary ? dashboardSummary.paymentsDueCount : dueOrders.length;
  const paymentsDueAmount = dashboardSummary
    ? dashboardSummary.paymentsDueAmount
    : fromMoneyCents(dueOrders.reduce((sum, o) => sum + toMoneyCents(o.balanceAmount), 0));

  const revenueTrendData = dashboardSummary?.weeklySales || (() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const dk = shiftColomboDateKey(refDateKey, -i);
      const { day, formattedDate } = getColomboDayMeta(dk);
      const dayOrds = clientOrdersByDate.get(dk) || [];
      arr.push({
        date: dk,
        formattedDate,
        day,
        revenue: fromMoneyCents(clientRevenueCentsByDate.get(dk) || 0),
        orderValue: fromMoneyCents(dayOrds.reduce((sum, o) => sum + getOrderValueCents(o), 0)),
        orders: dayOrds.length
      });
    }
    return arr;
  })();

  const garmentTypes = orders.reduce((acc, order) => {
    const type = order.garmentDetails?.dressType || 'Other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const totalOrdersWithGarments = Object.values(garmentTypes).reduce((a, b) => a + b, 0);
  const colors = ['#2563EB', '#3B82F6', '#1D4ED8', '#60A5FA', '#1E40AF', '#93C5FD', '#1E3A8A'];

  const garmentCategoryData = Object.keys(garmentTypes).map((type, idx) => ({
    name: type,
    value: totalOrdersWithGarments > 0 ? Math.round((garmentTypes[type] / totalOrdersWithGarments) * 100) : 0,
    color: colors[idx % colors.length]
  }));

  const pendingApprovalCount = orders.filter(o => o.status === 'PENDING_APPROVAL').length;
  const pendingSlipOrders = orders.filter(o => o.payments && o.payments.some(p => p.status === 'PENDING_VERIFICATION'));
  const pendingSlipCount = pendingSlipOrders.length;

  const recentOrders = orders.map(ord => ({
    id: ord.id,
    orderNumber: ord.orderNumber || `ORD-${ord.id}`,
    customer: ord.customer?.name || 'Unknown Customer',
    phone: ord.customer?.primaryPhone || null,
    branch: ord.branch?.name || null,
    item: ord.garmentDetails?.dressType || 'Not specified',
    quantity: ord.garmentDetails?.quantity || null,
    total: ord.totalAmount ?? null,
    paid: ord.advancePayment ?? null,
    pending: ord.balanceAmount ?? null,
    status: ord.status || null,
    date: ord.orderDate ? new Date(ord.orderDate).toLocaleString() : '—',
    rawOrder: ord
  }));

  const filteredOrders = recentOrders.filter(ord => {
    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'Payment Slips') {
      return ord.rawOrder?.payments && ord.rawOrder.payments.some(p => p.status === 'PENDING_VERIFICATION');
    }
    if (selectedFilter === 'Pending Approval') return ord.status === 'PENDING_APPROVAL';
    if (selectedFilter === 'Confirmed') return ord.status === 'ORDER_CONFIRMED' || ord.status === 'PENDING';
    if (selectedFilter === 'In Production') {
      return ['PENDING_PRODUCTION', 'CUTTING', 'STITCHING', 'AARI_EMBROIDERY', 'EMBROIDERY_AARI', 'FITTING_ALTERATION', 'FINISHING', 'QUALITY_CHECK'].includes(ord.status);
    }
    if (selectedFilter === 'Ready for Collection') return ord.status === 'READY';
    if (selectedFilter === 'Delivered') return ord.status === 'DELIVERED';
    if (selectedFilter === 'Rejected') return ord.status === 'REJECTED';
    return true;
  });

  // Restrict executive Sales & Financial Dashboard strictly to CEO and Manager
  if (!isFullAccess) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '14px', margin: '24px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
          Access Restricted
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto' }}>
          This executive sales, revenue, and customer payments dashboard is reserved strictly for CEO and Management.
        </p>
      </div>
    );
  }

  return (
    <div className="erp-page-container">
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Sales Dashboard
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Real-time order flow, revenue metrics, outstanding payments, and sales analytics
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {isFullAccess && (
            <button
              className="btn-secondary"
              onClick={() => setActiveTab && setActiveTab('payroll')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                color: 'var(--jb-blue-accent)',
                borderColor: 'rgba(37, 99, 235, 0.3)',
                fontWeight: 700
              }}
              title="Navigate to Weekly Tailor Salary ERP"
            >
              <CreditCard size={16} /> Weekly Tailor Salary
            </button>
          )}
          <button className="btn-secondary">
            <Download size={16} /> Export Orders
          </button>
          <button className="btn-primary" onClick={() => setIsOrderModalOpen(true)}>
            <Plus size={16} /> New Order
          </button>
        </div>
      </div>

      {/* Self Attendance Card for Staff & Managers */}
      <SelfAttendanceCard />

      {/* Customer Payment Slip Verification Alert Banner for CEO / Manager */}
      {isFullAccess && pendingSlipCount > 0 && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '2px solid #3b82f6',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: '#dbeafe',
              color: '#1d4ed8',
              padding: '10px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CreditCard size={22} />
            </div>
            <div>
              <strong style={{ color: '#1e3a8a', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Customer Payment Slip{pendingSlipCount > 1 ? 's' : ''} Awaiting Verification</span>
                <span style={{
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '999px'
                }}>
                  {pendingSlipCount} NEW
                </span>
              </strong>
              <p style={{ color: '#1d4ed8', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
                {pendingSlipCount === 1 ? 'A customer has' : `${pendingSlipCount} customers have`} uploaded advance payment slip receipt(s). Review proofs to verify and credit the balance.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedFilter('Payment Slips')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
            }}
          >
            <Eye size={16} /> Review Payment Slips ({pendingSlipCount})
          </button>
        </div>
      )}

      {/* Executive Sales & Approval KPI Cards */}
      <div className="kpi-cards-grid">
        {/* Card 0: Pending Approval */}
        <div
          className="card"
          onClick={() => setSelectedFilter('Pending Approval')}
          style={{
            borderLeft: `4px solid ${pendingApprovalCount > 0 ? '#f59e0b' : '#3b82f6'}`,
            cursor: 'pointer',
            backgroundColor: selectedFilter === 'Pending Approval' ? '#fffbeb' : 'var(--bg-card)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pending Approval
            </span>
            <div style={{
              backgroundColor: pendingApprovalCount > 0 ? '#fef3c7' : '#e0e7ff',
              color: pendingApprovalCount > 0 ? '#b45309' : '#3b82f6',
              padding: '6px',
              borderRadius: '8px'
            }}>
              <Clock size={18} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: pendingApprovalCount > 0 ? '#b45309' : 'var(--text-main)', marginTop: '8px' }}>
            {pendingApprovalCount} {pendingApprovalCount === 1 ? 'Order' : 'Orders'}
          </h3>
          <div style={{
            fontSize: '0.75rem',
            color: pendingApprovalCount > 0 ? '#b45309' : '#64748b',
            marginTop: '6px',
            fontWeight: 700
          }}>
            {pendingApprovalCount > 0 ? 'Requires CEO / Manager Action' : 'All Customer Orders Approved'}
          </div>
        </div>

        {/* Card 1: Today's Sales */}
        <div className="card" style={{ borderLeft: '4px solid var(--jb-blue-accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Today's Sales
            </span>
            <div style={{ backgroundColor: '#e0e7ff', color: 'var(--jb-blue-accent)', padding: '6px', borderRadius: '8px' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '8px' }}>
            LKR {formatExactLKR(todaySales)}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: yesterdaySales > 0 ? (todaySales >= yesterdaySales ? '#10b981' : '#ef4444') : '#64748b', marginTop: '6px', fontWeight: 700 }}>
            {yesterdaySales > 0 ? (
              <>
                <ArrowUpRight size={14} style={{ transform: todaySales < yesterdaySales ? 'rotate(90deg)' : 'none' }} />
                <span>{todaySales >= yesterdaySales ? '+' : ''}{Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100)}% vs yesterday (LKR {formatExactLKR(yesterdaySales)})</span>
              </>
            ) : (
              <span>LKR 0 sales yesterday</span>
            )}
          </div>
        </div>

        {/* Card 2: Today's Orders */}
        <div className="card" style={{ borderLeft: '4px solid var(--jb-navy-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Today's Orders
            </span>
            <div style={{ backgroundColor: '#e0e7ff', color: 'var(--jb-navy-light)', padding: '6px', borderRadius: '8px' }}>
              <ShoppingCart size={18} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '8px' }}>
            {todayOrders} {todayOrders === 1 ? 'Order' : 'Orders'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 600 }}>
            {yesterdayOrders > 0 ? (
              <span>{todayOrders >= yesterdayOrders ? `+${todayOrders - yesterdayOrders}` : `${todayOrders - yesterdayOrders}`} vs yesterday ({yesterdayOrders} orders)</span>
            ) : (
              <span>{todayOrders} order(s) created today</span>
            )}
          </div>
        </div>

        {/* Card 3: Monthly Sales */}
        <div className="card" style={{ borderLeft: '4px solid var(--jb-navy-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Monthly Sales
            </span>
            <div style={{ backgroundColor: '#e0e7ff', color: 'var(--jb-navy-light)', padding: '6px', borderRadius: '8px' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '8px' }}>
            LKR {formatExactLKR(monthlySales)}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 600 }}>
            {monthlyOrders} {monthlyOrders === 1 ? 'order' : 'orders'} recorded this month
          </div>
        </div>

        {/* Card 4: Average Order Value */}
        <div className="card" style={{ borderLeft: '4px solid var(--jb-navy-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Average Order Value
            </span>
            <div style={{ backgroundColor: '#e0e7ff', color: 'var(--jb-navy-light)', padding: '6px', borderRadius: '8px' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '8px' }}>
            LKR {formatExactLKR(aov)}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 600 }}>
            Based on {pricedOrdersCount} priced {pricedOrdersCount === 1 ? 'order' : 'orders'}
          </div>
        </div>

        {/* Card 5: Customer Payments Due */}
        <div className="card" style={{ borderLeft: `4px solid ${paymentsDueAmount > 0 ? '#ef4444' : '#10b981'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Customer Payments Due
            </span>
            <div style={{ backgroundColor: paymentsDueAmount > 0 ? '#fee2e2' : '#dcfce7', color: paymentsDueAmount > 0 ? '#dc2626' : '#16a34a', padding: '6px', borderRadius: '8px' }}>
              <AlertCircle size={18} />
            </div>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: paymentsDueAmount > 0 ? '#dc2626' : '#10b981', marginTop: '8px' }}>
            LKR {formatExactLKR(paymentsDueAmount)}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: paymentsDueAmount > 0 ? '#dc2626' : '#10b981', marginTop: '6px', fontWeight: 700 }}>
            {paymentsDueCount === 0 ? 'All orders settled' : `${paymentsDueCount} Unpaid / Partial Order${paymentsDueCount === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      {/* Custom Clean Executive Charts Row */}
      <div className="sales-charts-row">
        {/* Last 7 Days Daily Sales Bar Chart */}
        <div className="card jb-sales-barchart-card" data-testid="sales-barchart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Last 7 Days Sales (LKR)
                </h4>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: effectiveBranch === '1' ? '#2563eb' : effectiveBranch === '2' ? '#dc2626' : 'var(--text-main)',
                  backgroundColor: effectiveBranch === '1' ? 'rgba(37, 99, 235, 0.1)' : effectiveBranch === '2' ? 'rgba(220, 38, 38, 0.1)' : 'var(--bg-main)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: `1px solid ${effectiveBranch === '1' ? 'rgba(37, 99, 235, 0.3)' : effectiveBranch === '2' ? 'rgba(220, 38, 38, 0.3)' : 'var(--border-color)'}`
                }}>
                  {effectiveBranch === '1' ? '🏢 JB Group (Main)' : effectiveBranch === '2' ? '🪡 Bella Design' : '✨ All Branches'}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#15803d',
                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }}></span>
                  100% Real Database Data
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Daily verified LKR sales &amp; order volume across the last 7 days (Asia/Colombo)
              </p>
            </div>

            {/* Branch and Date Controls for CEO and Manager only */}
            {canSwitchBranch ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="jb-barchart-controls-bar" role="group" aria-label="Branch filter">
                  <button
                    type="button"
                    data-testid="chart-branch-all"
                    onClick={() => setActiveBranch('ALL')}
                    className={`jb-barchart-branch-btn ${activeBranch === 'ALL' ? 'active' : ''}`}
                  >
                    All Branches
                  </button>
                  <button
                    type="button"
                    data-testid="chart-branch-1"
                    onClick={() => setActiveBranch('1')}
                    className={`jb-barchart-branch-btn ${activeBranch === '1' ? 'active-jb' : ''}`}
                  >
                    JB Group
                  </button>
                  <button
                    type="button"
                    data-testid="chart-branch-2"
                    onClick={() => setActiveBranch('2')}
                    className={`jb-barchart-branch-btn ${activeBranch === '2' ? 'active-bella' : ''}`}
                  >
                    Bella Design
                  </button>
                </div>

                {/* Date Picker Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="date"
                    data-testid="chart-date-input"
                    value={trendReferenceDate || refDateKey}
                    onChange={(e) => setTrendReferenceDate(e.target.value)}
                    title="Select reference date for 7-day sales bar chart (Asia/Colombo)"
                    className="jb-barchart-date-input"
                  />
                  {trendReferenceDate && (
                    <button
                      type="button"
                      data-testid="chart-date-today-btn"
                      onClick={() => setTrendReferenceDate('')}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      Today
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <span className="badge badge-navy">Last 7 Days</span>
            )}
          </div>

          {summaryLoading ? (
            <div data-testid="sales-chart-loading" className="jb-barchart-wrapper" aria-busy="true">
              <div className="jb-barchart-summary-strip">
                <span style={{ color: 'var(--text-muted)' }}>Loading 7-day PostgreSQL sales data...</span>
              </div>
              <div className="jb-barchart-grid">
                <div className="jb-yaxis-headroom">
                  <div className="jb-yaxis-zone" />
                </div>
                <div className="jb-plot-headroom">
                  <div className="jb-plot-zone">
                    <div className="jb-bars-row">
                      {[38, 62, 26, 78, 48, 34, 68].map((pct, idx) => (
                        <div key={idx} className="jb-bar-slot">
                          <div
                            className="jb-barchart-skeleton-bar"
                            style={{ height: `${pct}%`, animationDelay: `${idx * 0.08}s` }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : summaryError ? (
            <div
              data-testid="sales-chart-error"
              style={{
                padding: '28px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '10px',
                minHeight: '220px'
              }}
            >
              <AlertCircle size={24} style={{ color: '#dc2626' }} />
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {summaryError}
              </div>
              <button
                type="button"
                data-testid="sales-chart-retry-btn"
                onClick={() => fetchDashboardSummary(trendReferenceDate)}
                className="btn-primary"
                style={{ padding: '7px 16px', fontSize: '0.78rem' }}
              >
                Retry Loading Sales Data
              </button>
            </div>
          ) : (
            (() => {
              const periodTotalRev = fromMoneyCents(
                revenueTrendData.reduce((sum, d) => sum + toMoneyCents(d.revenue), 0)
              );
              const periodTotalOrd = revenueTrendData.reduce((sum, d) => sum + (Number(d.orders) || 0), 0);
              const periodTotalOrderVal = fromMoneyCents(
                revenueTrendData.reduce((sum, d) => sum + toMoneyCents(d.orderValue), 0)
              );
              const firstDate = revenueTrendData[0]?.formattedDate || '';
              const lastDate = revenueTrendData[revenueTrendData.length - 1]?.formattedDate || '';

              const rawMaxRev = Math.max(...revenueTrendData.map(d => Number(d.revenue) || 0), 0);
              const yAxisMax = computeNiceChartMax(rawMaxRev);
              const yTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
                pct: ratio * 100,
                value: Math.round(yAxisMax * ratio)
              }));

              return (
                <div className="jb-barchart-wrapper" data-testid="sales-barchart">
                  {/* 7-Day Summary Header Strip */}
                  <div className="jb-barchart-summary-strip" data-testid="sales-barchart-summary">
                    <span style={{ color: 'var(--text-muted)' }}>
                      Period: <strong style={{ color: 'var(--text-main)' }}>{firstDate} – {lastDate}</strong>
                    </span>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span data-testid="sales-barchart-total-sales">
                        7-Day Sales:{' '}
                        <strong style={{ color: periodTotalRev > 0 ? '#16a34a' : 'var(--text-main)', fontSize: '0.86rem' }}>
                          LKR {formatExactLKR(periodTotalRev)}
                        </strong>
                      </span>
                      <span data-testid="sales-barchart-total-orders">
                        Orders: <strong style={{ color: 'var(--text-main)' }}>{periodTotalOrd}</strong>
                      </span>
                      {periodTotalOrderVal > 0 && periodTotalOrderVal !== periodTotalRev && (
                        <span style={{ color: 'var(--text-muted)' }} data-testid="sales-barchart-order-value">
                          Order Value: <strong style={{ color: 'var(--text-main)' }}>LKR {formatExactLKR(periodTotalOrderVal)}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contextual Banner for Unpaid Orders (LKR 0 collected) or Empty Branch Period */}
                  {periodTotalRev === 0 && periodTotalOrd > 0 && (
                    <div className="jb-barchart-ZeroBanner" data-testid="sales-chart-unpaid-note">
                      <span>
                        <strong>LKR 0 collected sales</strong> — {periodTotalOrd} {periodTotalOrd === 1 ? 'order' : 'orders'} created in this period (billed value LKR {formatExactLKR(periodTotalOrderVal)}) currently {periodTotalOrd === 1 ? 'has' : 'have'} no verified customer payments.
                      </span>
                    </div>
                  )}
                  {periodTotalRev === 0 && periodTotalOrd === 0 && (
                    <div className="jb-barchart-ZeroBanner" data-testid="sales-chart-empty-note">
                      <span>
                        No orders or sales recorded for this branch during {firstDate} – {lastDate}.
                      </span>
                    </div>
                  )}

                  {/* Calibrated 7-Day Vertical Bar Chart */}
                  <div className="jb-barchart-grid" role="img" aria-label={`Last 7 days sales bar chart from ${firstDate} to ${lastDate}`}>
                    {/* Left Y-Axis Scale (LKR) */}
                    <div className="jb-yaxis-headroom">
                      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right', paddingRight: '2px', marginTop: '-22px', marginBottom: '8px' }}>
                        LKR
                      </div>
                      <div className="jb-yaxis-zone">
                        {yTicks.map((t) => (
                          <span
                            key={t.pct}
                            className="jb-yaxis-tick"
                            style={{ bottom: `${t.pct}%` }}
                          >
                            {formatExactLKR(t.value)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right Plot Area (Gridlines + 7 Daily Bars) */}
                    <div className="jb-plot-headroom">
                      <div className="jb-plot-zone">
                        {yTicks.map((t) => (
                          <div
                            key={t.pct}
                            className={`jb-gridline ${t.pct === 0 ? 'zero' : ''}`}
                            style={{ bottom: `${t.pct}%` }}
                          />
                        ))}

                        <div className="jb-bars-row">
                          {revenueTrendData.map((d, i) => {
                            const isToday = i === revenueTrendData.length - 1;
                            const rev = Number(d.revenue) || 0;
                            const ordCount = Number(d.orders) || 0;
                            const ordVal = Number(d.orderValue) || 0;
                            const hasRev = rev > 0;
                            const rawPct = hasRev ? Math.min(100, (rev / yAxisMax) * 100) : 0;
                            const dateLabel = d.formattedDate || d.date || '';
                            const isHovered = activeBarIdx === i;

                            return (
                              <div
                                key={d.date || i}
                                className="jb-bar-slot"
                                data-testid={`sales-bar-slot-${i}`}
                                data-date={d.date}
                                data-revenue={rev}
                                data-orders={ordCount}
                                tabIndex={0}
                                onMouseEnter={() => setActiveBarIdx(i)}
                                onMouseLeave={() => setActiveBarIdx(prev => (prev === i ? null : prev))}
                                onFocus={() => setActiveBarIdx(i)}
                                onBlur={() => setActiveBarIdx(prev => (prev === i ? null : prev))}
                                onClick={() => setActiveBarIdx(prev => (prev === i ? null : i))}
                              >
                                <div className="jb-bar-track" />

                                {/* Exact LKR Sales Value Label Above Bar */}
                                <span
                                  className={`jb-bar-value-label ${isToday ? 'is-today' : ''} ${!hasRev ? 'is-zero' : ''}`}
                                  data-testid={`sales-bar-value-${i}`}
                                  style={{
                                    bottom: hasRev ? `calc(max(${rawPct}%, 8px) + 6px)` : '9px'
                                  }}
                                >
                                  <span className="jb-bar-curr">LKR</span>
                                  <span>{formatExactLKR(rev)}</span>
                                </span>

                                {/* Daily Sales Vertical Bar */}
                                <div
                                  className={`jb-bar-fill ${hasRev ? 'has-sales' : 'zero-sales'} ${isToday ? 'is-today' : ''} ${!hasRev && ordCount > 0 ? 'has-unpaid-orders' : ''}`}
                                  data-testid={`sales-bar-fill-${i}`}
                                  style={hasRev ? { height: `${rawPct}%`, minHeight: '8px' } : undefined}
                                />

                                {/* Interactive Hover / Focus / Tap Tooltip */}
                                {isHovered && (
                                  <div className="jb-bar-tooltip" role="tooltip">
                                    <div style={{ fontWeight: 800, marginBottom: '2px', color: '#93c5fd' }}>
                                      {d.day}, {dateLabel} ({d.date})
                                    </div>
                                    <div>
                                      Sales: <strong>LKR {formatExactLKR(rev)}</strong>
                                    </div>
                                    <div>
                                      Orders: <strong>{ordCount} {ordCount === 1 ? 'order' : 'orders'}</strong>
                                    </div>
                                    {ordVal > 0 && ordVal !== rev && (
                                      <div style={{ color: '#cbd5e1' }}>
                                        Order Value: LKR {formatExactLKR(ordVal)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* X-Axis Row Aligned Beneath Plot Area */}
                    <div className="jb-xaxis-spacer" />
                    <div className="jb-xaxis-row">
                      {revenueTrendData.map((d, i) => {
                        const isToday = i === revenueTrendData.length - 1;
                        const ordCount = Number(d.orders) || 0;
                        const dateLabel = d.formattedDate || d.date || '';

                        return (
                          <div key={d.date || i} className="jb-xaxis-cell" data-testid={`sales-bar-xaxis-${i}`}>
                            <span className={`jb-xaxis-day ${isToday ? 'is-today' : ''}`}>
                              {d.day}
                            </span>
                            <span className={`jb-xaxis-date ${isToday ? 'is-today' : ''}`}>
                              {dateLabel}
                            </span>
                            <span
                              className={`jb-xaxis-orders ${ordCount > 0 ? 'has-orders' : ''}`}
                              data-testid={`sales-bar-orders-${i}`}
                            >
                              <span className="jb-ord-full">{ordCount} {ordCount === 1 ? 'order' : 'orders'}</span>
                              <span className="jb-ord-short">{ordCount} ord</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Garment Category Distribution */}
        <div className="card">
          <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' }}>
            Sales by Garment Type
          </h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Sales breakdown by product type
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {garmentCategoryData.map((cat, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-main)' }}>{cat.name}</span>
                  <span style={{ color: cat.color }}>{cat.value}%</span>
                </div>
                <div style={{ width: '100%', height: '10px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${cat.value}%`, height: '100%', backgroundColor: cat.color, borderRadius: '999px', transition: 'width 0.5s ease' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Sales Orders Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Recent Orders
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Latest orders from all branches
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'All', label: 'All Orders' },
              { id: 'Payment Slips', label: 'Payment Slips', count: pendingSlipCount },
              { id: 'Pending Approval', label: 'Pending Approval', count: pendingApprovalCount },
              { id: 'Confirmed', label: 'Confirmed' },
              { id: 'In Production', label: 'In Production' },
              { id: 'Ready for Collection', label: 'Ready for Collection' },
              { id: 'Delivered', label: 'Delivered' },
              { id: 'Rejected', label: 'Rejected' }
            ].map(tab => {
              const isSelected = selectedFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedFilter(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: isSelected ? '1.5px solid var(--jb-navy-light)' : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? '#e0e7ff' : 'var(--bg-main)',
                    color: isSelected ? 'var(--jb-navy-light)' : 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span style={{
                      backgroundColor: isSelected ? '#3b82f6' : '#f59e0b',
                      color: '#ffffff',
                      borderRadius: '999px',
                      padding: '1px 6px',
                      fontSize: '0.68rem',
                      fontWeight: 900
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--jb-crimson)', backgroundColor: 'var(--jb-crimson-light)', borderRadius: '8px' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontWeight: 700 }}>Unable to load orders. Please try again.</h3>
            <p style={{ fontSize: '0.85rem' }}>{error}</p>
          </div>
        ) : loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No orders found.
          </div>
        ) : (
          <>
          <div className="sales-desktop-table" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>Order No.</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Source</th>
                  <th style={{ padding: '12px 16px' }}>Branch</th>
                  <th style={{ padding: '12px 16px' }}>Garment / Item</th>
                  <th style={{ padding: '12px 16px' }}>Assigned Tailor</th>
                  <th style={{ padding: '12px 16px' }}>Order Total</th>
                  <th style={{ padding: '12px 16px' }}>Payment / Balance</th>
                  <th style={{ padding: '12px 16px' }}>Order Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((ord) => {
                  const targetOrder = ord.rawOrder || orders.find(o => o.id === ord.id) || ord;
                  const isPending = ord.status === 'PENDING_APPROVAL';
                  const isRejected = ord.status === 'REJECTED';

                  return (
                    <tr key={ord.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isPending ? '#fffdf7' : 'transparent' }}>
                      <td data-label="Order No." style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--jb-navy-light)' }}>
                        {ord.orderNumber || `ORD-${ord.id}`}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>ID: #{ord.id}</div>
                      </td>
                      <td data-label="Customer" style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {isFullAccess && targetOrder.customer?.profilePhoto ? (
                            <img
                              src={getImageUrl(targetOrder.customer.profilePhoto)}
                              alt=""
                              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #cbd5e1', flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0a192f', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0 }}>
                              {ord.customer && ord.customer !== 'Unknown Customer' ? ord.customer.charAt(0).toUpperCase() : 'U'}
                            </div>
                          )}
                          <div>
                            {isFullAccess ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const cId = targetOrder.customerId || targetOrder.customer?.id || ord.rawOrder?.customerId || ord.rawOrder?.customer?.id;
                                  if (cId) {
                                    setProfileCustomerId(cId);
                                    setIsProfileDrawerOpen(true);
                                  }
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  color: '#1e40af',
                                  textDecoration: 'underline',
                                  textUnderlineOffset: '3px',
                                  fontSize: '0.875rem'
                                }}
                                title="Click to view Customer Profile and Order History"
                              >
                                {ord.customer}
                              </button>
                            ) : (
                              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                                {ord.customer}
                              </span>
                            )}
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>{ord.date}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Source" style={{ padding: '12px 16px' }}>
                        {targetOrder.orderSource === 'ONLINE' ? (
                          <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#0052cc', border: '1px solid #bfdbfe' }}>Online Portal</span>
                        ) : (
                          <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }}>Shop / Walk-In</span>
                        )}
                      </td>
                      <td data-label="Branch" style={{ padding: '12px 16px' }}>
                        {ord.branch ? <span className="badge badge-navy">{ord.branch}</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Not Assigned</span>}
                      </td>
                      <td data-label="Garment / Item" style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {ord.item}
                        {ord.quantity && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>
                            Qty: {ord.quantity}
                          </span>
                        )}
                      </td>

                      {/* Tailor Assignment Column */}
                      <td data-label="Assigned Tailor" style={{ padding: '12px 16px' }}>
                        {isPending ? (
                          <span style={{ color: '#94a3b8', fontSize: '0.76rem', fontStyle: 'italic' }}>Pending Approval</span>
                        ) : isRejected ? (
                          <span style={{ color: '#ef4444', fontSize: '0.76rem' }}>Order Rejected</span>
                        ) : (() => {
                          const canAssign = Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role));
                          const hasTasks = targetOrder.tasks && targetOrder.tasks.length > 0;
                          const completedTasks = hasTasks ? targetOrder.tasks.filter(t => t.status === 'COMPLETED').length : 0;

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {hasTasks ? (
                                <div>
                                  <div style={{ fontWeight: 800, color: '#0369a1', fontSize: '0.8rem' }}>
                                    ✂️ Tasks: {completedTasks}/{targetOrder.tasks.length} Done
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                    {targetOrder.tasks.slice(0, 2).map(t => `${t.taskName}: ${t.assignedTailor?.name?.split(' ')[0] || 'Unassigned'}`).join(' • ')}
                                    {targetOrder.tasks.length > 2 && '...'}
                                  </div>
                                </div>
                              ) : targetOrder.assignedTailor ? (
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.82rem' }}>
                                    {targetOrder.assignedTailor.name}
                                  </div>
                                  <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    color: '#16a34a'
                                  }}>
                                    ✓ Assigned
                                  </span>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                              )}

                              {canAssign && (
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '2px' }}>
                                  <button
                                    onClick={() => setTaskModalOrder(targetOrder)}
                                    title="Assign or reassign production tasks to craftsmen"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: '#f5f3ff',
                                      color: '#6d28d9',
                                      border: '1px solid #ddd6fe',
                                      fontSize: '0.7rem',
                                      fontWeight: 800,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Scissors size={11} />
                                    <span>{hasTasks ? 'Manage Tasks' : 'Assign Tasks'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {isFullAccess ? (
                          <>
                            <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                              {ord.total !== null && Number(ord.total) > 0 ? `LKR ${Number(ord.total).toLocaleString()}` : 'PRICE PENDING'}
                            </div>
                            <div style={{ marginTop: '3px' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                ...getPriceStatusColors(targetOrder.priceStatus || (Number(ord.total) > 0 ? 'ACCEPTED' : 'PENDING'))
                              }}>
                                {getPriceStatusLabel(targetOrder.priceStatus || (Number(ord.total) > 0 ? 'ACCEPTED' : 'PENDING'))}
                              </span>
                            </div>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isFullAccess ? (() => {
                          const total = ord.total !== null && ord.total !== undefined ? Number(ord.total) : 0;
                          const paid = ord.paid !== null && ord.paid !== undefined ? Number(ord.paid) : 0;
                          const balance = total > 0 ? Math.max(0, total - paid) : 0;

                          if (total <= 0) {
                            return (
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a'
                              }}>
                                PRICE PENDING
                              </span>
                            );
                          }

                          if (paid >= total && total > 0) {
                            return (
                              <div>
                                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  ✓ PAID
                                </span>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  LKR {total.toLocaleString()}
                                </div>
                              </div>
                            );
                          }

                          // Balance > 0
                          const isPartiallyPaid = paid > 0;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              <span className={`badge ${isPartiallyPaid ? 'badge-warning' : 'badge-danger'}`} style={{
                                backgroundColor: isPartiallyPaid ? '#fef3c7' : '#fee2e2',
                                color: isPartiallyPaid ? '#b45309' : '#dc2626',
                                border: `1px solid ${isPartiallyPaid ? '#fde68a' : '#fca5a5'}`
                              }}>
                                {isPartiallyPaid ? 'PARTIALLY PAID' : 'UNPAID'}
                              </span>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-main)', fontWeight: 600 }}>
                                Due: LKR {balance.toLocaleString()}
                              </div>
                              {paid > 0 && (
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                  Paid: LKR {paid.toLocaleString()}
                                </div>
                              )}
                              <button
                                onClick={() => setPaymentOrder(targetOrder)}
                                title="Record Payment"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: '#10b981',
                                  color: '#fff',
                                  border: 'none',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  marginTop: '2px'
                                }}
                              >
                                <CreditCard size={12} />
                                Record Payment
                              </button>
                              {targetOrder.payments?.some(p => p.status === 'PENDING_VERIFICATION') && (
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  backgroundColor: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #93c5fd',
                                  borderRadius: '6px',
                                  padding: '2px 7px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  marginTop: '3px'
                                }}>
                                  <span>🔔 Slip Uploaded</span>
                                  <button
                                    type="button"
                                    onClick={() => setViewingOrder(targetOrder)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#1d4ed8',
                                      textDecoration: 'underline',
                                      cursor: 'pointer',
                                      padding: 0,
                                      fontWeight: 800,
                                      fontSize: '0.72rem',
                                      marginLeft: '3px'
                                    }}
                                  >
                                    Review
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })() : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td data-label="Order Status" style={{ padding: '12px 16px' }}>
                        {isPending ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            fontSize: '0.75rem',
                            fontWeight: 800
                          }}>
                            Pending Approval
                          </span>
                        ) : isRejected ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            fontSize: '0.75rem',
                            fontWeight: 800
                          }}>
                            Rejected
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                            <StatusDropdown
                              currentStatus={ord.status}
                              targetOrder={targetOrder}
                              userRole={user?.role}
                              onStatusChange={(newStatus) => handleStatusChange(ord.id, newStatus)}
                            />
                            {(() => {
                              const canAdvanceStage = Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role) || (user?.role === 'TAILOR' && (Number(targetOrder.assignedTailorId) === Number(user?.id) || (targetOrder?.tasks && targetOrder.tasks.some(t => Number(t.assignedTailorId) === Number(user?.id))))));
                              if (!canAdvanceStage) return null;
                              const nextInfo = getNextStageInfo(targetOrder);
                              if (!nextInfo) return null;
                              return (
                                <button
                                  onClick={() => handleStatusChange(ord.id, nextInfo.nextStatus)}
                                  title={`Advance order to ${nextInfo.label}`}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '3px 8px', borderRadius: '6px',
                                    backgroundColor: nextInfo.bg,
                                    color: nextInfo.text,
                                    border: `1px solid ${nextInfo.border}`,
                                    fontSize: '0.72rem', fontWeight: 800,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  <span>{nextInfo.buttonText}</span>
                                  <ArrowRight size={12} />
                                </button>
                              );
                            })()}

                            {isFullAccess && ord.status === 'READY' && (
                              <button
                                type="button"
                                onClick={() => setFinishedNotificationOrder(targetOrder)}
                                title={targetOrder.readyNotificationSent ? `Finished notification sent by ${targetOrder.readyNotificationSentBy || 'Manager'}` : 'Send Customer Finished Message'}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  padding: '4px 8px', borderRadius: '6px',
                                  backgroundColor: targetOrder.readyNotificationSent ? '#15803d' : '#16a34a',
                                  color: '#fff',
                                  fontSize: '0.72rem', fontWeight: 800,
                                  whiteSpace: 'nowrap',
                                  border: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                <MessageCircle size={12} />
                                <span>{targetOrder.readyNotificationSent ? '✓ Finished Sent' : 'Send Customer Finished Message'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td data-label="Action" style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {isPending && Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role)) && (
                            <>
                              <button
                                onClick={() => handleApproveOrder(ord.id)}
                                title="Approve Customer Order"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  padding: '4px 8px', borderRadius: '6px',
                                  backgroundColor: '#16a34a', color: '#fff',
                                  border: 'none', fontSize: '0.75rem', fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                <Check size={12} /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingOrder(targetOrder);
                                  setRejectionReasonText('');
                                }}
                                title="Reject Customer Order"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  padding: '4px 8px', borderRadius: '6px',
                                  backgroundColor: '#dc2626', color: '#fff',
                                  border: 'none', fontSize: '0.75rem', fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                <X size={12} /> Reject
                              </button>
                            </>
                          )}



                          <button className="btn-secondary" onClick={() => setViewingOrder(orders.find(o => o.id === ord.id))} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                            <Eye size={14} /> View
                          </button>

                          {targetOrder.payments?.some(p => p.status === 'PENDING_VERIFICATION') && isFullAccess && (
                            <button
                              onClick={() => setViewingOrder(targetOrder)}
                              title="Review Customer Payment Slip"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                padding: '4px 8px', borderRadius: '6px',
                                backgroundColor: '#f59e0b', color: '#fff',
                                border: 'none', fontSize: '0.75rem', fontWeight: 800,
                                cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(245, 158, 11, 0.4)'
                              }}
                            >
                              <CreditCard size={12} /> Review Slip
                            </button>
                          )}

                          {user?.role !== 'TAILOR' && (
                            <button
                              onClick={() => setSelectedInvoiceOrder(targetOrder)}
                              title="View & Send Digital Invoice"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '4px 8px', borderRadius: '6px',
                                backgroundColor: '#0284c7', color: '#fff',
                                border: 'none',
                                fontSize: '0.75rem', fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <FileText size={13} /> Invoice
                            </button>
                          )}

                          {Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role)) && !isPending && !isRejected && (
                            <button
                              onClick={() => setPricingOrder(targetOrder)}
                              title="Set / Edit Quotation Price"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                padding: '4px 8px', borderRadius: '6px',
                                backgroundColor: '#eff6ff', color: '#0052cc',
                                border: '1px solid #bfdbfe',
                                fontSize: '0.75rem', fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <DollarSign size={13} /> Price
                            </button>
                          )}

                          {/* Manager-controlled Finished Notification */}
                          {isFullAccess && ord.status === 'READY' && (
                            <button
                              type="button"
                              onClick={() => setFinishedNotificationOrder(targetOrder)}
                              title={
                                targetOrder.readyNotificationSent
                                  ? `Finished notification sent by ${targetOrder.readyNotificationSentBy || 'Manager'} at ${targetOrder.readyNotificationSentAt ? new Date(targetOrder.readyNotificationSentAt).toLocaleString() : 'Earlier'} (Duplicate protected)`
                                  : 'Send Customer Finished Message'
                              }
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '4px 8px', borderRadius: '6px',
                                backgroundColor: targetOrder.readyNotificationSent ? '#15803d' : '#16a34a',
                                color: '#fff',
                                fontSize: '0.72rem', fontWeight: 700,
                                border: 'none', cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <MessageCircle size={12} />
                              <span>{targetOrder.readyNotificationSent ? '✓ Finished' : 'Send Finished Msg'}</span>
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

          {/* Responsive Mobile Order Cards View (< 860px) */}
          <div className="sales-mobile-cards">
            {filteredOrders.map((ord) => {
              const targetOrder = ord.rawOrder || orders.find(o => o.id === ord.id) || ord;
              const isPending = ord.status === 'PENDING_APPROVAL';
              const isRejected = ord.status === 'REJECTED';
              const total = ord.total !== null && ord.total !== undefined ? Number(ord.total) : 0;
              const paid = ord.paid !== null && ord.paid !== undefined ? Number(ord.paid) : 0;
              const balance = total > 0 ? Math.max(0, total - paid) : 0;
              const isPartiallyPaid = paid > 0 && paid < total;
              const isPaid = paid >= total && total > 0;
              const canAssign = Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role));
              const nextInfo = getNextStageInfo(targetOrder);
              const canAdvanceStage = Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role) || (user?.role === 'TAILOR' && (Number(targetOrder.assignedTailorId) === Number(user?.id) || (targetOrder?.tasks && targetOrder.tasks.some(t => Number(t.assignedTailorId) === Number(user?.id))))));

              return (
                <div key={`mob-${ord.id}`} className="erp-mobile-order-card" style={{ backgroundColor: isPending ? '#fffdf7' : 'var(--bg-card)' }}>
                  {/* Card Header: Order No & Branch */}
                  <div className="erp-mobile-card-row">
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--jb-navy-light)' }}>
                        {ord.orderNumber || `ORD-${ord.id}`}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        ID: #{ord.id} • {ord.date}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {ord.orderSource === 'ONLINE' ? (
                        <span className="badge" style={{ fontSize: '0.72rem', backgroundColor: '#eff6ff', color: '#0052cc', border: '1px solid #bfdbfe' }}>Online Portal</span>
                      ) : (
                        <span className="badge" style={{ fontSize: '0.72rem', backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }}>Shop / Walk-In</span>
                      )}
                      {ord.branch ? (
                        <span className="badge badge-navy" style={{ fontSize: '0.72rem' }}>{ord.branch}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Unassigned</span>
                      )}
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isFullAccess && targetOrder.customer?.profilePhoto ? (
                      <img
                        src={getImageUrl(targetOrder.customer.profilePhoto)}
                        alt=""
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #cbd5e1', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#0a192f', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, flexShrink: 0 }}>
                        {ord.customer && ord.customer !== 'Unknown Customer' ? ord.customer.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isFullAccess ? (
                        <button
                          type="button"
                          onClick={() => {
                            const cId = targetOrder.customerId || targetOrder.customer?.id || ord.rawOrder?.customerId || ord.rawOrder?.customer?.id;
                            if (cId) {
                              setProfileCustomerId(cId);
                              setIsProfileDrawerOpen(true);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontWeight: 800,
                            color: '#1e40af',
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px',
                            fontSize: '0.9rem',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {ord.customer}
                        </button>
                      ) : (
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ord.customer}
                        </div>
                      )}
                      {ord.phone && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {ord.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Garment Details & Tailor Assignment */}
                  <div style={{ backgroundColor: 'var(--bg-main)', padding: '10px 12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                        {ord.item}
                      </span>
                      {ord.quantity && (
                        <span style={{ fontSize: '0.72rem', backgroundColor: 'var(--bg-card)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontWeight: 600 }}>
                          Qty: {ord.quantity}
                        </span>
                      )}
                    </div>

                    {/* Tailor Status / Assignment */}
                    <div style={{ fontSize: '0.78rem', paddingTop: '4px', borderTop: '1px dashed var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Tailor / Tasks: </span>
                      {isPending ? (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending Approval</span>
                      ) : isRejected ? (
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>Order Rejected</span>
                      ) : targetOrder.tasks && targetOrder.tasks.length > 0 ? (
                        <span style={{ fontWeight: 800, color: '#0369a1' }}>
                          ✂️ {targetOrder.tasks.filter(t => t.status === 'COMPLETED').length}/{targetOrder.tasks.length} Tasks Done
                        </span>
                      ) : targetOrder.assignedTailor ? (
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {targetOrder.assignedTailor.name} (✓ Assigned)
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </div>

                    {/* Task Assignment Button for Privileged Roles */}
                    {canAssign && !isPending && !isRejected && (
                      <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setTaskModalOrder(targetOrder)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#f5f3ff',
                            color: '#6d28d9',
                            border: '1px solid #ddd6fe',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          <Scissors size={13} />
                          <span>{targetOrder.tasks && targetOrder.tasks.length > 0 ? 'Manage Tasks' : 'Assign Tasks'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Financial Details (Full Access Only) */}
                  {isFullAccess && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px 10px', backgroundColor: 'var(--bg-main)', borderRadius: '8px' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Order Total</span>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)', marginTop: '2px' }}>
                          {total > 0 ? `LKR ${total.toLocaleString()}` : 'Price Pending'}
                        </div>
                        <span style={{
                          display: 'inline-block',
                          marginTop: '3px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          ...getPriceStatusColors(targetOrder.priceStatus || (total > 0 ? 'ACCEPTED' : 'PENDING'))
                        }}>
                          {getPriceStatusLabel(targetOrder.priceStatus || (total > 0 ? 'ACCEPTED' : 'PENDING'))}
                        </span>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Payment</span>
                        <div style={{ marginTop: '2px' }}>
                          {total <= 0 ? (
                            <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 700 }}>Pending</span>
                          ) : isPaid ? (
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>✓ PAID FULL</span>
                          ) : (
                            <div>
                              <span className={`badge ${isPartiallyPaid ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                {isPartiallyPaid ? 'PARTIALLY PAID' : 'UNPAID'}
                              </span>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-main)', fontWeight: 700, marginTop: '2px' }}>
                                Due: LKR {balance.toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Customer Payment Slip Alert in Mobile Card */}
                  {isFullAccess && targetOrder.payments?.some(p => p.status === 'PENDING_VERIFICATION') && (
                    <div style={{
                      backgroundColor: '#eff6ff',
                      border: '1.5px solid #3b82f6',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '0.78rem', color: '#1e3a8a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CreditCard size={15} color="#2563eb" /> Slip Uploaded (Pending Review)
                      </span>
                      <button
                        onClick={() => setViewingOrder(targetOrder)}
                        style={{
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '5px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        Review
                      </button>
                    </div>
                  )}

                  {/* Order Status & Direct Progression */}
                  <div className="erp-mobile-card-row">
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status:</span>
                    {isPending ? (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}>
                        Pending Approval
                      </span>
                    ) : isRejected ? (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}>
                        Rejected
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                        <StatusDropdown
                          currentStatus={ord.status}
                          targetOrder={targetOrder}
                          userRole={user?.role}
                          onStatusChange={(newStatus) => handleStatusChange(ord.id, newStatus)}
                        />
                      </div>
                    )}
                  </div>



                  {/* CEO / Manager Approval Actions */}
                  {isPending && Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role)) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '2px' }}>
                      <button
                        onClick={() => handleApproveOrder(ord.id)}
                        className="touch-target-btn"
                        style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none' }}
                      >
                        <Check size={16} /> Approve Order
                      </button>
                      <button
                        onClick={() => {
                          setRejectingOrder(targetOrder);
                          setRejectionReasonText('');
                        }}
                        className="touch-target-btn"
                        style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none' }}
                      >
                        <X size={16} /> Reject Order
                      </button>
                    </div>
                  )}

                  {/* Advance Stage Button (if applicable) */}
                  {!isPending && !isRejected && canAdvanceStage && nextInfo && (
                    <button
                      onClick={() => handleStatusChange(ord.id, nextInfo.nextStatus)}
                      className="touch-target-btn"
                      style={{
                        backgroundColor: nextInfo.bg,
                        color: nextInfo.text,
                        border: `1.5px solid ${nextInfo.border}`,
                        width: '100%'
                      }}
                    >
                      <span>Advance: {nextInfo.buttonText}</span>
                      <ArrowRight size={15} />
                    </button>
                  )}

                  {/* Action Toolbar Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '6px', marginTop: '4px' }}>
                    <button
                      className="btn-secondary touch-target-btn"
                      onClick={() => setViewingOrder(orders.find(o => o.id === ord.id))}
                      style={{ fontSize: '0.78rem', padding: '6px 10px', minHeight: '38px' }}
                    >
                      <Eye size={14} /> View
                    </button>

                    {user?.role !== 'TAILOR' && (
                      <button
                        onClick={() => setSelectedInvoiceOrder(targetOrder)}
                        className="touch-target-btn"
                        style={{
                          backgroundColor: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          fontSize: '0.78rem',
                          padding: '6px 10px',
                          minHeight: '38px'
                        }}
                      >
                        <FileText size={14} /> Invoice
                      </button>
                    )}

                    {isFullAccess && total > 0 && balance > 0 && (
                      <button
                        onClick={() => setPaymentOrder(targetOrder)}
                        className="touch-target-btn"
                        style={{
                          backgroundColor: '#10b981',
                          color: '#fff',
                          border: 'none',
                          fontSize: '0.78rem',
                          padding: '6px 10px',
                          minHeight: '38px'
                        }}
                      >
                        <CreditCard size={14} /> Pay
                      </button>
                    )}

                    {Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role)) && !isPending && !isRejected && (
                      <button
                        onClick={() => setPricingOrder(targetOrder)}
                        className="touch-target-btn"
                        style={{
                          backgroundColor: '#eff6ff',
                          color: '#0052cc',
                          border: '1px solid #bfdbfe',
                          fontSize: '0.78rem',
                          padding: '6px 10px',
                          minHeight: '38px'
                        }}
                      >
                        <DollarSign size={14} /> Price
                      </button>
                    )}

                    {isFullAccess && ord.status === 'READY' && (
                      <button
                        type="button"
                        onClick={() => setFinishedNotificationOrder(targetOrder)}
                        className="touch-target-btn"
                        style={{
                          backgroundColor: targetOrder.readyNotificationSent ? '#15803d' : '#16a34a',
                          color: '#fff',
                          fontSize: '0.78rem',
                          padding: '6px 10px',
                          minHeight: '38px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 700
                        }}
                      >
                        <MessageCircle size={14} />
                        <span>{targetOrder.readyNotificationSent ? '✓ Finished Sent' : 'Send Finished Msg'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>

      {/* Rejection Reason Modal */}
      {rejectingOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#991b1b', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={20} /> Reject Order {rejectingOrder.orderNumber}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 14px 0' }}>
              Please enter a rejection reason. This message will be displayed directly to the customer in their Customer Portal.
            </p>
            <textarea
              rows={3}
              value={rejectionReasonText}
              onChange={(e) => setRejectionReasonText(e.target.value)}
              placeholder="e.g. Fabric out of stock, design requirement cannot be fulfilled by requested date, etc."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setRejectingOrder(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectOrder(rejectingOrder.id, rejectionReasonText)}
                disabled={isProcessingApproval || !rejectionReasonText.trim()}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: rejectionReasonText.trim() ? 'pointer' : 'not-allowed',
                  opacity: rejectionReasonText.trim() ? 1 : 0.6
                }}
              >
                {isProcessingApproval ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tailor Assignment Rejection Modal */}
      {tailorRejectingOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(10, 25, 47, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#dc2626' }}>
              Reject Assignment for {tailorRejectingOrder.orderNumber}?
            </h3>
            <p style={{ margin: '8px 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
              The order will be returned to the CEO/Manager production queue so another tailor can be assigned. Please state the reason (e.g., workload capacity, missing pattern/fabric):
            </p>

            <textarea
              rows={3}
              value={tailorRejectionReasonText}
              onChange={(e) => setTailorRejectionReasonText(e.target.value)}
              placeholder="Enter reason for rejecting this assignment..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setTailorRejectingOrder(null);
                  setTailorRejectionReasonText('');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleTailorReject(tailorRejectingOrder.id, tailorRejectionReasonText)}
                disabled={isProcessingApproval || !tailorRejectionReasonText.trim()}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: tailorRejectionReasonText.trim() ? 'pointer' : 'not-allowed',
                  opacity: tailorRejectionReasonText.trim() ? 1 : 0.6
                }}
              >
                {isProcessingApproval ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      <OrderCreationModal
        isOpen={isOrderModalOpen}
        onClose={handleModalClose}
      />
      <ViewOrderModal
        order={viewingOrder}
        onClose={() => setViewingOrder(null)}
        onOpenInvoice={(ord) => setSelectedInvoiceOrder(ord)}
        onStatusChange={(id, newStatus) => {
          handleStatusChange(id, newStatus);
          setViewingOrder(prev => (prev ? { ...prev, status: newStatus } : null));
        }}
        onRecordPayment={(ord) => setPaymentOrder(ord)}
        onApproveOrder={handleApproveOrder}
        onOpenRejectModal={(ord) => {
          setRejectingOrder(ord);
          setRejectionReasonText('');
        }}
        onAssignTailor={handleAssignTailor}
        tailorsList={tailorsList}
        onOpenPricing={(ord) => setPricingOrder(ord)}
        user={user}
        onOpenTaskModal={(ord) => setTaskModalOrder(ord)}
        onTailorAccept={handleTailorAccept}
        onOpenTailorReject={(ord) => {
          setTailorRejectingOrder(ord);
          setTailorRejectionReasonText('');
        }}
        onConfirmCustomerPrice={handleConfirmCustomerPrice}
        onVerifyPaymentSlip={handleVerifyPaymentSlip}
        onRejectPaymentSlip={handleRejectPaymentSlip}
        onOpenFinishedNotification={(ord) => setFinishedNotificationOrder(ord)}
      />
      <CustomerFinishedNotificationModal
        order={finishedNotificationOrder}
        isOpen={Boolean(finishedNotificationOrder)}
        onClose={() => setFinishedNotificationOrder(null)}
        user={user}
        onSuccess={(updatedOrder) => {
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
          if (viewingOrder && viewingOrder.id === updatedOrder.id) {
            setViewingOrder(prev => ({ ...prev, ...updatedOrder }));
          }
          fetchOrders();
        }}
      />
      <TaskAssignmentModal
        order={taskModalOrder}
        isOpen={Boolean(taskModalOrder)}
        onClose={() => setTaskModalOrder(null)}
        user={user}
        onAssigned={() => {
          fetchOrders();
          refreshAll();
        }}
      />
      <DigitalInvoiceModal
        order={selectedInvoiceOrder}
        isOpen={Boolean(selectedInvoiceOrder)}
        onClose={() => setSelectedInvoiceOrder(null)}
      />
      <RecordPaymentModal
        order={paymentOrder}
        isOpen={Boolean(paymentOrder)}
        onClose={() => setPaymentOrder(null)}
        onPaymentRecorded={(updatedOrder) => {
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
          if (viewingOrder && viewingOrder.id === updatedOrder.id) {
            setViewingOrder(prev => ({ ...prev, ...updatedOrder }));
          }
          if (selectedInvoiceOrder && selectedInvoiceOrder.id === updatedOrder.id) {
            setSelectedInvoiceOrder(prev => ({ ...prev, ...updatedOrder }));
          }
          fetchDashboardSummary();
        }}
      />
      <PriceSettingModal
        order={pricingOrder}
        isOpen={Boolean(pricingOrder)}
        onClose={() => setPricingOrder(null)}
        user={user}
        onPriceSaved={(updatedOrder) => {
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
          if (viewingOrder && viewingOrder.id === updatedOrder.id) {
            setViewingOrder(prev => ({ ...prev, ...updatedOrder }));
          }
          refreshAll();
        }}
      />
      {isFullAccess && (
        <CustomerProfileDrawer
          customerId={profileCustomerId}
          isOpen={isProfileDrawerOpen}
          onClose={() => {
            setIsProfileDrawerOpen(false);
            setProfileCustomerId(null);
          }}
          onOpenInvoice={(order) => {
            setSelectedInvoiceOrder(order);
          }}
        />
      )}
    </div>
  );
};
