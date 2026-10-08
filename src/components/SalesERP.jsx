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
  CheckCircle,
  Check,
  Filter,
  Download,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  CreditCard,
  MessageCircle,
  ChevronDown,
  X,
  FileText,
  ArrowRight,
  Send
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { OrderCreationModal } from './OrderCreationModal';
import { DigitalInvoiceModal } from './DigitalInvoiceModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { CustomerProfileDrawer } from './CustomerProfileDrawer';
import { SelfAttendanceCard } from './SelfAttendanceCard';
import { getStatusLabel, getStatusColors, getNextStageInfo, ALL_STATUSES, ALLOWED_STAGE_TRANSITIONS, getPriceStatusLabel, getPriceStatusColors, cleanActivityNote, cleanActorName } from '../utils/orderStatus';
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

  const canChange = isManager || (userRole === 'TAILOR' && targetOrder?.assignedTailorId && targetOrder?.tailorAccepted);

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
  const customerName = order.customer?.name || 'Customer';
  const orderNumber = order.orderNumber || order.id || 'N/A';
  const orderDate = order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A';
  const dressType = order.garmentDetails?.dressType || 'Not Added';
  const quantity = order.garmentDetails?.quantity || 1;
  const occasion = order.garmentDetails?.occasion || 'Not Added';
  const fabric = order.garmentDetails?.fabricType || 'Not Added';
  const fabricColour = order.garmentDetails?.fabricColour || 'Not Added';
  const workDetails = order.garmentDetails?.workDetails || (order.garmentDetails?.workRequired ? 'Required' : 'None');

  let designRef = 'No Reference Image';
  if (order.garmentDetails?.designReferenceImage) {
    designRef = getImageUrl(order.garmentDetails.designReferenceImage);
  }

  return `Hello ${customerName} 👋

Your Bella Design order is now *READY FOR COLLECTION*. ✅

📋 *ORDER DETAILS*

Order No: ${orderNumber}
Order Date: ${orderDate}
Dress Type: ${dressType}
Quantity: ${quantity}
Occasion: ${occasion}
Fabric: ${fabric}
Fabric Colour: ${fabricColour}
Work / Embroidery: ${workDetails}

🖼️ *DESIGN REFERENCE*
${designRef}

📌 *ORDER STATUS: READY FOR COLLECTION*

Your order is ready. You can visit our store and collect your order.

Thank you for choosing *Bella Design / JB GROUP*. 🙏`;
};

const generateQuotationWhatsAppMessage = (order) => {
  if (!order) return '';
  const customerName = order.customer?.name || 'Customer';
  const orderNumber = order.orderNumber || order.id || 'N/A';
  const dressType = order.garmentDetails?.dressType || 'Bespoke Garment';
  const quantity = order.garmentDetails?.quantity || 1;
  const total = Number(order.totalAmount || 0);
  const advanceReq = Number(order.advanceRequired || order.advancePayment || 0);
  const balance = Math.max(0, total - advanceReq);
  const deliveryDate = order.garmentDetails?.deliveryDate ? new Date(order.garmentDetails.deliveryDate).toLocaleDateString() : 'Standard';

  return `Hello ${customerName} 👋

Thank you for choosing *Bella Design / JB GROUP*! ✨

Here is the Price Quotation for your bespoke tailoring order:

📋 *ORDER QUOTATION — ${orderNumber}*
👗 *Item:* ${dressType} (Qty: ${quantity})
💰 *Total Price:* LKR ${total.toLocaleString()}
💵 *Advance Required:* LKR ${advanceReq.toLocaleString()}
💳 *Balance on Delivery:* LKR ${balance.toLocaleString()}
📅 *Estimated Delivery:* ${deliveryDate}

Please review and confirm to begin production. You can also view details and confirm via our Customer Portal.

Thank you! 🙏
*JB GROUP — Bella Design*`;
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
        onPriceSaved && onPriceSaved(data.order);
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
  onTailorAccept,
  onOpenTailorReject,
  onConfirmCustomerPrice,
  onVerifyPaymentSlip,
  onRejectPaymentSlip
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
  const isMyAssignedPending = Boolean(user?.role === 'TAILOR' && Number(order.assignedTailorId) === Number(user?.id) && !order.tailorAccepted);
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
          {isFullAccess && order.customer?.primaryPhone && (
            <a
              href={`https://wa.me/${normalizePhoneForWhatsApp(order.customer.primaryPhone)}?text=${encodeURIComponent(generateOrderReadyWhatsAppMessage(order))}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                backgroundColor: '#22C55E', color: '#fff',
                padding: '6px 12px', borderRadius: '6px',
                fontSize: '0.85rem', fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
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
                  <div style={{ marginTop: '8px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Assign Responsible Tailor (1 Order = 1 Tailor):
                    </label>
                    {!order.priceAcceptedByCustomer ? (
                      <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', fontSize: '0.8rem', color: '#92400e' }}>
                        <div style={{ fontWeight: 800, marginBottom: '2px' }}>⏳ Tailor Assignment Locked</div>
                        <div>Customer has not accepted the price quote yet (Current price status: <strong>{getPriceStatusLabel(order.priceStatus || 'PENDING')}</strong>). Tailor assignment will automatically unlock once the customer confirms the price.</div>
                      </div>
                    ) : (
                      <div>
                        {/* Tailor waiting acceptance banner for logged-in tailor */}
                        {isMyAssignedPending && (
                          <div style={{
                            backgroundColor: '#fffbeb',
                            border: '2px solid #f59e0b',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            marginBottom: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}>
                            <div>
                              <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.88rem' }}>
                                ⏳ WAITING ACCEPTANCE
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#b45309' }}>
                                You are assigned as the tailor. Please accept to proceed to Cutting or reject with a reason.
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => onTailorAccept && onTailorAccept(order.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 14px',
                                  borderRadius: '6px',
                                  backgroundColor: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '0.8rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                <Check size={13} /> Accept Order
                              </button>
                              <button
                                onClick={() => onOpenTailorReject && onOpenTailorReject(order)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fca5a5',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                <X size={13} /> Reject Order
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Previous rejection banner if applicable */}
                        {order.tailorRejectedAt && order.tailorRejectionReason && !order.assignedTailorId && (
                          <div style={{
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            marginBottom: '10px',
                            fontSize: '0.8rem',
                            color: '#991b1b'
                          }}>
                            <strong>✕ Previously Rejected by Tailor:</strong> {order.tailorRejectionReason} {order.tailorRejectedAt && `(${new Date(order.tailorRejectedAt).toLocaleDateString()})`}
                          </div>
                        )}

                        {canAssignTailor ? (
                          <div>
                            {!isPriceConfirmed ? (
                              <div style={{
                                backgroundColor: '#fffbeb',
                                border: '1px solid #fde68a',
                                borderRadius: '10px',
                                padding: '12px 14px',
                                marginBottom: '12px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 800, fontSize: '0.85rem' }}>
                                  <Clock size={16} /> Assign Tailor Locked — Customer Confirmation Required
                                </div>
                                <p style={{ margin: '4px 0 10px 0', fontSize: '0.78rem', color: '#92400e', lineHeight: 1.4 }}>
                                  Tailor cannot be assigned before the customer confirms the price quote. Once the customer accepts (via Customer Portal, WhatsApp, or in-store), tailor assignment will unlock.
                                </p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {Number(order.totalAmount || 0) > 0 ? (
                                    <button
                                      onClick={() => onConfirmCustomerPrice && onConfirmCustomerPrice(order.id)}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        padding: '6px 14px', borderRadius: '6px',
                                        backgroundColor: '#16a34a', color: '#ffffff',
                                        border: 'none', fontSize: '0.78rem', fontWeight: 800,
                                        cursor: 'pointer', boxShadow: '0 2px 4px rgba(22,163,74,0.2)'
                                      }}
                                    >
                                      <Check size={14} /> Mark Customer Confirmed (Phone / In-Store)
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => onOpenPricing && onOpenPricing(order)}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        padding: '6px 14px', borderRadius: '6px',
                                        backgroundColor: '#0052cc', color: '#ffffff',
                                        border: 'none', fontSize: '0.78rem', fontWeight: 800,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <DollarSign size={14} /> Set Order Price First
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={{
                                backgroundColor: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: '8px',
                                padding: '6px 12px',
                                marginBottom: '10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.8rem',
                                color: '#166534',
                                fontWeight: 700
                              }}>
                                <CheckCircle size={15} color="#16a34a" />
                                <span>Price Confirmed by Customer — Ready for Tailor Assignment</span>
                              </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', opacity: !isPriceConfirmed ? 0.6 : 1 }}>
                              <select
                                value={localTailorId}
                                disabled={!isPriceConfirmed}
                                onChange={(e) => setLocalTailorId(e.target.value)}
                                style={{
                                  padding: '7px 12px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-color)',
                                  fontSize: '0.84rem',
                                  fontWeight: 600,
                                  backgroundColor: !isPriceConfirmed ? '#f1f5f9' : '#ffffff',
                                  cursor: !isPriceConfirmed ? 'not-allowed' : 'pointer'
                                }}
                              >
                                <option value="">-- Select Tailor --</option>
                                {tailorsList?.map(t => (
                                  <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                                ))}
                              </select>
                              <button
                                onClick={() => onAssignTailor && onAssignTailor(order.id, localTailorId)}
                                disabled={!isPriceConfirmed || !localTailorId || Number(localTailorId) === Number(order.assignedTailorId)}
                                style={{
                                  padding: '7px 14px',
                                  borderRadius: '8px',
                                  backgroundColor: (isPriceConfirmed && localTailorId && Number(localTailorId) !== Number(order.assignedTailorId)) ? 'var(--jb-crimson)' : '#e2e8f0',
                                  color: (isPriceConfirmed && localTailorId && Number(localTailorId) !== Number(order.assignedTailorId)) ? '#ffffff' : '#94a3b8',
                                  border: 'none',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  cursor: (isPriceConfirmed && localTailorId && Number(localTailorId) !== Number(order.assignedTailorId)) ? 'pointer' : 'not-allowed'
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
                                  backgroundColor: order.tailorAccepted ? '#dcfce7' : '#fef3c7',
                                  color: order.tailorAccepted ? '#15803d' : '#b45309'
                                }}>
                                  {order.tailorAccepted ? '✓ Accepted by Tailor' : '⏳ Waiting for Acceptance'}
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
                                backgroundColor: order.tailorAccepted ? '#dcfce7' : '#fef3c7',
                                color: order.tailorAccepted ? '#15803d' : '#b45309'
                              }}>
                                {order.tailorAccepted ? '✓ Accepted by Tailor' : '⏳ Waiting for Acceptance'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
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

export const SalesERP = () => {
  const { activeBranch, setActiveBranch, getAuthHeaders, user } = useAuth();
  const isFullAccess = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'].includes((user?.role || '').toUpperCase());
  const canSwitchBranch = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'].includes((user?.role || '').toUpperCase());
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
  const [pricingOrder, setPricingOrder] = useState(null);
  const [trendReferenceDate, setTrendReferenceDate] = useState('');

  // Approval and tailor assignment state
  const [tailorsList, setTailorsList] = useState([]);
  const [selectedTailorForOrder, setSelectedTailorForOrder] = useState({});
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [tailorRejectingOrder, setTailorRejectingOrder] = useState(null);
  const [tailorRejectionReasonText, setTailorRejectionReasonText] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const branchParam = activeBranch && activeBranch !== 'ALL' ? `?branchId=${activeBranch}` : '';
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
    try {
      const params = new URLSearchParams();
      if (activeBranch && activeBranch !== 'ALL') {
        params.append('branchId', activeBranch);
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
      const data = await res.json();
      if (data.success && data.summary) {
        setDashboardSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    }
  };

  const refreshAll = () => {
    fetchOrders();
    fetchTailors();
    fetchDashboardSummary(trendReferenceDate);
  };

  useEffect(() => {
    refreshAll();
  }, [activeBranch, trendReferenceDate, user]);

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
      } else {
        alert(data.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Error updating status');
    }
  };

  // Compute metrics from real PostgreSQL data
  const now = trendReferenceDate ? new Date(trendReferenceDate) : new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  const todayOrdersList = orders.filter(o => {
    const d = new Date(o.orderDate || o.createdAt);
    return d >= startOfToday && d < endOfToday;
  });
  const todayOrders = dashboardSummary ? dashboardSummary.todayOrders : todayOrdersList.length;
  const todaySales = dashboardSummary ? dashboardSummary.todaySales : todayOrdersList.reduce((sum, o) => sum + (Number(o.advancePayment) || 0), 0);

  const yesterdayOrdersList = orders.filter(o => {
    const d = new Date(o.orderDate || o.createdAt);
    return d >= startOfYesterday && d < startOfToday;
  });
  const yesterdayOrders = dashboardSummary ? dashboardSummary.yesterdayOrders : yesterdayOrdersList.length;
  const yesterdaySales = dashboardSummary ? dashboardSummary.yesterdaySales : yesterdayOrdersList.reduce((sum, o) => sum + (Number(o.advancePayment) || 0), 0);

  const monthlyOrdersList = orders.filter(o => {
    const d = new Date(o.orderDate || o.createdAt);
    return d >= startOfMonth;
  });
  const monthlyOrders = dashboardSummary ? dashboardSummary.monthlyOrders : monthlyOrdersList.length;
  const monthlySales = dashboardSummary ? dashboardSummary.monthlySales : monthlyOrdersList.reduce((sum, o) => sum + (Number(o.advancePayment) || 0), 0);

  const pricedOrders = orders.filter(o => Number(o.totalAmount) > 0);
  const pricedOrdersCount = dashboardSummary ? dashboardSummary.pricedOrdersCount : pricedOrders.length;
  const aov = dashboardSummary ? dashboardSummary.averageOrderValue : (pricedOrdersCount > 0 ? Math.round(pricedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0) / pricedOrdersCount) : 0);

  const dueOrders = orders.filter(o => Number(o.totalAmount) > 0 && Number(o.balanceAmount) > 0);
  const paymentsDueCount = dashboardSummary ? dashboardSummary.paymentsDueCount : dueOrders.length;
  const paymentsDueAmount = dashboardSummary ? dashboardSummary.paymentsDueAmount : dueOrders.reduce((sum, o) => sum + Number(o.balanceAmount), 0);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const revenueTrendData = dashboardSummary?.weeklySales || (() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const dStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
      const dEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1, 0, 0, 0, 0);
      const dayOrds = orders.filter(o => {
        const d = new Date(o.orderDate || o.createdAt);
        return d >= dStart && d < dEnd;
      });
      const yr = dStart.getFullYear();
      const mo = String(dStart.getMonth() + 1).padStart(2, '0');
      const dt = String(dStart.getDate()).padStart(2, '0');
      arr.push({
        date: `${yr}-${mo}-${dt}`,
        formattedDate: `${dt} ${monthNames[dStart.getMonth()]}`,
        day: dayNames[dStart.getDay()],
        revenue: dayOrds.reduce((sum, o) => sum + (Number(o.advancePayment) || 0), 0),
        orderValue: dayOrds.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
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
            LKR {todaySales.toLocaleString()}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: yesterdaySales > 0 ? (todaySales >= yesterdaySales ? '#10b981' : '#ef4444') : '#64748b', marginTop: '6px', fontWeight: 700 }}>
            {yesterdaySales > 0 ? (
              <>
                <ArrowUpRight size={14} style={{ transform: todaySales < yesterdaySales ? 'rotate(90deg)' : 'none' }} />
                <span>{todaySales >= yesterdaySales ? '+' : ''}{Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100)}% vs yesterday (LKR {yesterdaySales.toLocaleString()})</span>
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
            LKR {monthlySales.toLocaleString()}
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
            LKR {aov.toLocaleString()}
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
            LKR {paymentsDueAmount.toLocaleString()}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: paymentsDueAmount > 0 ? '#dc2626' : '#10b981', marginTop: '6px', fontWeight: 700 }}>
            {paymentsDueCount === 0 ? 'All orders settled' : `${paymentsDueCount} Unpaid / Partial Order${paymentsDueCount === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      {/* Custom Clean Executive Charts Row */}
      <div className="sales-charts-row">
        {/* Weekly Revenue Trend Bar Visualizer */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Last 7 Days Sales (LKR)
                </h4>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: activeBranch === '1' ? '#0052cc' : activeBranch === '2' ? '#d90429' : '#0f172a',
                  backgroundColor: activeBranch === '1' ? '#eff6ff' : activeBranch === '2' ? '#fff1f2' : '#f8fafc',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: `1px solid ${activeBranch === '1' ? '#bfdbfe' : activeBranch === '2' ? '#fecdd3' : '#e2e8f0'}`
                }}>
                  {activeBranch === '1' ? '🏢 JB Group (Main)' : activeBranch === '2' ? '🪡 Bella Design' : '✨ All Branches'}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#15803d',
                  backgroundColor: '#f0fdf4',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid #bbf7d0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }}></span>
                  100% Real Database Data
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Daily sales performance & real order volume by date
              </p>
            </div>

            {/* Branch and Date Controls for CEO and Manager only */}
            {canSwitchBranch ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Branch Switcher Pills */}
                <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveBranch('ALL')}
                    style={{
                      padding: '4px 9px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: activeBranch === 'ALL' ? '#ffffff' : 'transparent',
                      color: activeBranch === 'ALL' ? '#0f172a' : '#64748b',
                      boxShadow: activeBranch === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBranch('1')}
                    style={{
                      padding: '4px 9px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: activeBranch === '1' ? '#ffffff' : 'transparent',
                      color: activeBranch === '1' ? '#0052cc' : '#64748b',
                      boxShadow: activeBranch === '1' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    JB Group
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBranch('2')}
                    style={{
                      padding: '4px 9px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: activeBranch === '2' ? '#ffffff' : 'transparent',
                      color: activeBranch === '2' ? '#d90429' : '#64748b',
                      boxShadow: activeBranch === '2' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Bella Design
                  </button>
                </div>

                {/* Date Picker Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="date"
                    value={trendReferenceDate || (now.toISOString().split('T')[0])}
                    onChange={(e) => setTrendReferenceDate(e.target.value)}
                    title="Select reference date for 7-day trend"
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      borderRadius: '7px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  />
                  {trendReferenceDate && (
                    <button
                      type="button"
                      onClick={() => setTrendReferenceDate('')}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      Today
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <span className="badge badge-navy">Weekly Trend</span>
            )}
          </div>

          {/* 7-Day Summary Header Bar */}
          {(() => {
            const periodTotalRev = revenueTrendData.reduce((sum, d) => sum + (d.revenue || 0), 0);
            const periodTotalOrd = revenueTrendData.reduce((sum, d) => sum + (d.orders || 0), 0);
            const firstDate = revenueTrendData[0]?.formattedDate || '';
            const lastDate = revenueTrendData[revenueTrendData.length - 1]?.formattedDate || '';

            return (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-main)',
                padding: '8px 12px',
                borderRadius: '8px',
                marginBottom: '14px',
                fontSize: '0.75rem',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Period: <strong>{firstDate} – {lastDate}</strong>
                </span>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <span>
                    7-Day Sales: <strong style={{ color: periodTotalRev > 0 ? '#16a34a' : 'var(--text-main)', fontSize: '0.85rem' }}>LKR {periodTotalRev.toLocaleString()}</strong>
                  </span>
                  <span>
                    Orders: <strong>{periodTotalOrd}</strong>
                  </span>
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '220px', padding: '16px 8px 0 8px', borderBottom: '2px solid var(--border-color)', gap: '8px' }}>
            {(() => {
              const maxRev = Math.max(...revenueTrendData.map(d => d.revenue || 0), 1000);
              return revenueTrendData.map((d, i) => {
                const isToday = i === revenueTrendData.length - 1;
                const hasRev = (d.revenue || 0) > 0;
                const heightPercent = hasRev ? Math.min(100, Math.max(16, ((d.revenue || 0) / maxRev) * 100)) : 4;
                const formattedRev = hasRev
                  ? ((d.revenue || 0) >= 1000 ? `${((d.revenue || 0) / 1000).toFixed(0)}k` : `${d.revenue || 0}`)
                  : (d.orders > 0 ? `${d.orders} ord` : '0');
                const dateLabel = d.formattedDate || (d.date ? new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '');

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: hasRev ? 800 : 600,
                      color: hasRev ? (isToday ? 'var(--jb-blue-accent)' : '#1e3a8a') : '#94a3b8'
                    }}>
                      {hasRev ? `LKR ${formattedRev}` : formattedRev}
                    </span>

                    <div
                      style={{
                        width: '100%',
                        maxWidth: '38px',
                        height: hasRev ? `${heightPercent}%` : '4px',
                        background: hasRev
                          ? (isToday
                              ? 'linear-gradient(180deg, #0052cc 0%, #003399 100%)'
                              : 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)')
                          : '#e2e8f0',
                        borderRadius: hasRev ? '8px 8px 0 0' : '2px',
                        boxShadow: hasRev && isToday ? '0 4px 12px rgba(0, 82, 204, 0.35)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease'
                      }}
                      title={`${d.day} (${dateLabel}): LKR ${(d.revenue || 0).toLocaleString()} across ${d.orders || 0} order${(d.orders || 0) === 1 ? '' : 's'}`}
                      onMouseEnter={(e) => {
                        if (hasRev) {
                          e.currentTarget.style.transform = 'scaleY(1.05)';
                          e.currentTarget.style.filter = 'brightness(1.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (hasRev) {
                          e.currentTarget.style.transform = 'scaleY(1)';
                          e.currentTarget.style.filter = 'brightness(1)';
                        }
                      }}
                    />

                    <div style={{ textAlign: 'center', marginTop: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span style={{
                        fontSize: '0.78rem',
                        fontWeight: isToday ? 900 : 800,
                        color: isToday ? 'var(--jb-blue-accent)' : 'var(--text-main)',
                        display: 'block'
                      }}>
                        {d.day}
                      </span>
                      <span style={{
                        fontSize: '0.67rem',
                        fontWeight: 700,
                        color: isToday ? '#0052cc' : '#64748b',
                        backgroundColor: isToday ? '#eff6ff' : '#f1f5f9',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap'
                      }}>
                        {dateLabel}
                      </span>
                      <span style={{
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        color: d.orders > 0 ? '#16a34a' : '#94a3b8',
                        backgroundColor: d.orders > 0 ? '#f0fdf4' : 'transparent',
                        padding: d.orders > 0 ? '1px 4px' : '0',
                        borderRadius: '4px'
                      }}>
                        {d.orders || 0} ord
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
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
                          const isMyAssignedPending = Boolean(user?.role === 'TAILOR' && Number(targetOrder.assignedTailorId) === Number(user?.id) && !targetOrder.tailorAccepted);
                          const canAssign = Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role));

                          if (isMyAssignedPending) {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #fde68a',
                                  width: 'fit-content'
                                }}>
                                  ⏳ WAITING ACCEPTANCE
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button
                                    onClick={() => handleTailorAccept(ord.id)}
                                    disabled={isProcessingApproval}
                                    title="Accept Order"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: '#16a34a',
                                      color: '#ffffff',
                                      border: 'none',
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 3px rgba(22, 163, 74, 0.3)'
                                    }}
                                  >
                                    <Check size={12} /> Accept Order
                                  </button>
                                  <button
                                    onClick={() => {
                                      setTailorRejectingOrder(targetOrder);
                                      setTailorRejectionReasonText('');
                                    }}
                                    disabled={isProcessingApproval}
                                    title="Reject Order"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: '#fee2e2',
                                      color: '#dc2626',
                                      border: '1px solid #fca5a5',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <X size={12} /> Reject Order
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          if (targetOrder.assignedTailor) {
                            return (
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.82rem' }}>
                                  {targetOrder.assignedTailor.name}
                                </div>
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: targetOrder.tailorAccepted ? '#16a34a' : '#b45309'
                                }}>
                                  {targetOrder.tailorAccepted ? '✓ Accepted' : '⏳ Waiting Acceptance'}
                                </span>
                                {canAssign && (
                                  <div style={{ marginTop: '4px' }}>
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value) handleAssignTailor(ord.id, e.target.value);
                                      }}
                                      style={{
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.7rem',
                                        backgroundColor: '#f8fafc',
                                        color: '#475569'
                                      }}
                                    >
                                      <option value="">Reassign...</option>
                                      {tailorsList.filter(t => t.id !== targetOrder.assignedTailorId).map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div>
                              {targetOrder.tailorRejectedAt && targetOrder.tailorRejectionReason && (
                                <div style={{ fontSize: '0.68rem', color: '#dc2626', marginBottom: '4px', fontWeight: 600 }}>
                                  ✕ Rejected: {targetOrder.tailorRejectionReason}
                                </div>
                              )}
                              {canAssign ? (
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <select
                                    value={selectedTailorForOrder[ord.id] || ''}
                                    onChange={(e) => setSelectedTailorForOrder(prev => ({ ...prev, [ord.id]: e.target.value }))}
                                    style={{
                                      padding: '4px 6px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color)',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      backgroundColor: '#ffffff',
                                      color: '#0f172a'
                                    }}
                                  >
                                    <option value="">Select Tailor...</option>
                                    {tailorsList.map(t => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => {
                                      const tid = selectedTailorForOrder[ord.id];
                                      if (tid) handleAssignTailor(ord.id, tid);
                                    }}
                                    disabled={!selectedTailorForOrder[ord.id]}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: selectedTailorForOrder[ord.id] ? 'var(--jb-crimson)' : '#e2e8f0',
                                      color: selectedTailorForOrder[ord.id] ? '#ffffff' : '#94a3b8',
                                      border: 'none',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      cursor: selectedTailorForOrder[ord.id] ? 'pointer' : 'not-allowed',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    Assign
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Unassigned</span>
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
                              const canAdvanceStage = Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role) || (user?.role === 'TAILOR' && Number(targetOrder.assignedTailorId) === Number(user?.id) && targetOrder.tailorAccepted));
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

                          {/* Assigned tailor acceptance quick actions in row */}
                          {user?.role === 'TAILOR' && Number(targetOrder.assignedTailorId) === Number(user?.id) && !targetOrder.tailorAccepted && (
                            <>
                              <button
                                onClick={() => handleTailorAccept(ord.id)}
                                disabled={isProcessingApproval}
                                title="Accept Order"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  padding: '4px 8px', borderRadius: '6px',
                                  backgroundColor: '#16a34a', color: '#fff',
                                  border: 'none', fontSize: '0.75rem', fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                <Check size={12} /> Accept
                              </button>
                              <button
                                onClick={() => {
                                  setTailorRejectingOrder(targetOrder);
                                  setTailorRejectionReasonText('');
                                }}
                                disabled={isProcessingApproval}
                                title="Reject Order"
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

                          {/* WhatsApp button */}
                          {(ord.status === 'READY' || ord.status === 'DELIVERED') && ord.phone && (
                            <a
                              href={`https://wa.me/${normalizePhoneForWhatsApp(ord.phone)}?text=${encodeURIComponent(generateOrderReadyWhatsAppMessage(targetOrder))}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '4px 8px', borderRadius: '6px',
                                backgroundColor: '#22C55E', color: '#fff',
                                fontSize: '0.75rem', fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              <MessageCircle size={13} /> WhatsApp
                            </a>
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
              const isMyAssignedPending = Boolean(user?.role === 'TAILOR' && Number(targetOrder.assignedTailorId) === Number(user?.id) && !targetOrder.tailorAccepted);
              const canAssign = Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role));
              const nextInfo = getNextStageInfo(targetOrder);
              const canAdvanceStage = Boolean(['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role) || (user?.role === 'TAILOR' && Number(targetOrder.assignedTailorId) === Number(user?.id) && targetOrder.tailorAccepted));

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
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Tailor: </span>
                      {isPending ? (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending Approval</span>
                      ) : isRejected ? (
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>Order Rejected</span>
                      ) : !targetOrder.priceAcceptedByCustomer ? (
                        <span style={{ color: '#b45309', fontWeight: 700 }}>⏳ Price Pending</span>
                      ) : isMyAssignedPending ? (
                        <span style={{ color: '#b45309', fontWeight: 800 }}>⏳ Waiting Your Acceptance</span>
                      ) : targetOrder.assignedTailor ? (
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {targetOrder.assignedTailor.name} ({targetOrder.tailorAccepted ? '✓ Accepted' : '⏳ Waiting'})
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </div>

                    {/* Tailor Assign Controls for Privileged Roles if needed */}
                    {canAssign && !isPending && !isRejected && targetOrder.priceAcceptedByCustomer && (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                        <select
                          value={selectedTailorForOrder[ord.id] || ''}
                          onChange={(e) => setSelectedTailorForOrder(prev => ({ ...prev, [ord.id]: e.target.value }))}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            backgroundColor: '#ffffff',
                            color: '#0f172a'
                          }}
                        >
                          <option value="">{targetOrder.assignedTailor ? 'Reassign Tailor...' : 'Select Tailor...'}</option>
                          {tailorsList.filter(t => t.id !== targetOrder.assignedTailorId).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const tid = selectedTailorForOrder[ord.id];
                            if (tid) handleAssignTailor(ord.id, tid);
                          }}
                          disabled={!selectedTailorForOrder[ord.id]}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: selectedTailorForOrder[ord.id] ? 'var(--jb-crimson)' : '#e2e8f0',
                            color: selectedTailorForOrder[ord.id] ? '#ffffff' : '#94a3b8',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: selectedTailorForOrder[ord.id] ? 'pointer' : 'not-allowed',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Assign
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

                  {/* Tailor Pending Acceptance Quick Buttons in Card */}
                  {isMyAssignedPending && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '2px' }}>
                      <button
                        onClick={() => handleTailorAccept(ord.id)}
                        disabled={isProcessingApproval}
                        className="touch-target-btn"
                        style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none' }}
                      >
                        <Check size={14} /> Accept Order
                      </button>
                      <button
                        onClick={() => {
                          setTailorRejectingOrder(targetOrder);
                          setTailorRejectionReasonText('');
                        }}
                        disabled={isProcessingApproval}
                        className="touch-target-btn"
                        style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                      >
                        <X size={14} /> Reject Order
                      </button>
                    </div>
                  )}

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

                    {(ord.status === 'READY' || ord.status === 'DELIVERED') && ord.phone && (
                      <a
                        href={`https://wa.me/${normalizePhoneForWhatsApp(ord.phone)}?text=${encodeURIComponent(generateOrderReadyWhatsAppMessage(targetOrder))}`}
                        target="_blank"
                        rel="noreferrer"
                        className="touch-target-btn"
                        style={{
                          backgroundColor: '#22C55E',
                          color: '#fff',
                          fontSize: '0.78rem',
                          padding: '6px 10px',
                          textDecoration: 'none',
                          minHeight: '38px'
                        }}
                      >
                        <MessageCircle size={14} /> WA
                      </a>
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
        onTailorAccept={handleTailorAccept}
        onOpenTailorReject={(ord) => {
          setTailorRejectingOrder(ord);
          setTailorRejectionReasonText('');
        }}
        onConfirmCustomerPrice={handleConfirmCustomerPrice}
        onVerifyPaymentSlip={handleVerifyPaymentSlip}
        onRejectPaymentSlip={handleRejectPaymentSlip}
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
