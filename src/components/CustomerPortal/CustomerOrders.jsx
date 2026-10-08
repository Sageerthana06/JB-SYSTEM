import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../utils/router';
import { CustomerPortalLayout } from './CustomerPortalLayout';
import {
  ShoppingBag,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  Scissors,
  Download,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Upload,
  CreditCard,
  AlertCircle,
  Eye,
  Check
} from 'lucide-react';
import { getStatusLabel, cleanActivityNote, cleanActorName } from '../../utils/orderStatus';
import { API_URL, getImageUrl } from '../../config/api';

export const CustomerOrders = () => {
  const { getAuthHeaders, token } = useAuth();
  const { navigate } = useRouter();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [processingPriceAction, setProcessingPriceAction] = useState(false);
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Payment slip upload state
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [slipAmount, setSlipAmount] = useState('');
  const [slipMethod, setSlipMethod] = useState('Bank Transfer');
  const [slipTransactionRef, setSlipTransactionRef] = useState('');
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [slipNotes, setSlipNotes] = useState('');
  const [isUploadingSlip, setIsUploadingSlip] = useState(false);
  const [viewingSlipImage, setViewingSlipImage] = useState(null);

  const fetchOrders = (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    fetch(`${API_URL}/api/customer-portal/orders`, {
      headers: getAuthHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.orders) {
          setOrders(data.orders);
        }
      })
      .catch(err => console.error('Error fetching orders:', err))
      .finally(() => {
        setLoading(false);
        if (isManual) setIsRefreshing(false);
      });
  };

  useEffect(() => {
    fetchOrders();
    // Auto-poll orders every 8 seconds so status updates (approval, price quotes) show live
    const pollInterval = setInterval(() => {
      fetchOrders();
    }, 8000);
    return () => clearInterval(pollInterval);
  }, [getAuthHeaders]);

  const handleAcceptPrice = async (orderId) => {
    if (!window.confirm('Accept the quoted price for this order and proceed to production queue?')) return;
    setProcessingPriceAction(true);
    try {
      const res = await fetch(`${API_URL}/api/customer-portal/orders/${orderId}/accept-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(data.order);
        }
        alert('Price accepted successfully! Your order is now confirmed for tailor assignment and production.');
      } else {
        alert(data.message || 'Failed to accept price');
      }
    } catch (err) {
      console.error(err);
      alert('Network error accepting price');
    } finally {
      setProcessingPriceAction(false);
    }
  };

  const handleDeclinePrice = async (orderId) => {
    if (!declineReason.trim()) {
      alert('Please provide a reason for declining the price quotation.');
      return;
    }
    setProcessingPriceAction(true);
    try {
      const res = await fetch(`${API_URL}/api/customer-portal/orders/${orderId}/decline-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ reason: declineReason.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setShowDeclineInput(false);
        setDeclineReason('');
        fetchOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(data.order);
        }
        alert('Price quotation declined. Our management has been notified to review and send a revised quotation.');
      } else {
        alert(data.message || 'Failed to decline price');
      }
    } catch (err) {
      console.error(err);
      alert('Network error declining price');
    } finally {
      setProcessingPriceAction(false);
    }
  };

  const handleUploadPaymentSlip = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const amountVal = parseFloat(slipAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Please enter a valid payment amount greater than zero.');
      return;
    }
    if (!slipFile) {
      alert('Please select or capture a photo of your payment slip / deposit receipt.');
      return;
    }

    setIsUploadingSlip(true);
    try {
      const formData = new FormData();
      formData.append('amount', amountVal);
      formData.append('paymentMethod', slipMethod);
      formData.append('transactionRef', slipTransactionRef);
      formData.append('notes', slipNotes);
      formData.append('file', slipFile);

      const res = await fetch(`${API_URL}/api/customer-portal/orders/${selectedOrder.id}/payment-slip`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setIsSlipModalOpen(false);
        setSlipFile(null);
        setSlipPreview(null);
        setSlipTransactionRef('');
        setSlipNotes('');
        fetchOrders();
        if (data.order) {
          setSelectedOrder(data.order);
        }
        alert('Payment slip submitted successfully! Manager will review and verify your payment shortly.');
      } else {
        alert(data.message || 'Failed to submit payment slip.');
      }
    } catch (err) {
      console.error('Error submitting payment slip:', err);
      alert('Network error submitting payment slip. Please try again.');
    } finally {
      setIsUploadingSlip(false);
    }
  };

  const viewOrderDetails = async (orderId) => {
    setLoadingDetail(true);
    setShowDeclineInput(false);
    setDeclineReason('');
    try {
      const res = await fetch(`${API_URL}/api/customer-portal/orders/${orderId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && data.order) {
        setSelectedOrder(data.order);
      }
    } catch (err) {
      console.error('Error getting order details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const downloadPdf = async (orderId, orderNumber) => {
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Order_${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Error downloading PDF:', err);
    }
  };

  const getStatusBadge = (status, priceStatus, priceAccepted) => {
    if (status === 'APPROVED' && priceStatus === 'SENT' && !priceAccepted) {
      return (
        <span style={{
          padding: '5px 12px',
          borderRadius: '999px',
          backgroundColor: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe',
          fontSize: '0.78rem',
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <Sparkles size={12} />
          Price Quotation Sent — Review Required
        </span>
      );
    }

    const styles = {
      'PENDING_APPROVAL': { bg: '#fef3c7', color: '#b45309', label: 'Order Submitted — Waiting for Approval' },
      'APPROVED': { bg: '#e0f2fe', color: '#0284c7', label: 'Price Confirmation Required' },
      'PRICE_DECLINED': { bg: '#fee2e2', color: '#dc2626', label: 'Price Declined' },
      'REJECTED': { bg: '#fee2e2', color: '#dc2626', label: 'Order Rejected' },
      'ORDER_CONFIRMED': { bg: '#e0f2fe', color: '#0369a1', label: 'Order Confirmed' },
      'PENDING': { bg: '#e0f2fe', color: '#0369a1', label: 'Order Confirmed' },
      'PENDING_PRODUCTION': { bg: '#fef3c7', color: '#b45309', label: 'In Production Queue' },
      'CUTTING': { bg: '#dbeafe', color: '#1d4ed8', label: 'Cutting' },
      'STITCHING': { bg: '#dbeafe', color: '#1d4ed8', label: 'Stitching' },
      'AARI_EMBROIDERY': { bg: '#fae8ff', color: '#86198f', label: 'Embroidery' },
      'EMBROIDERY_AARI': { bg: '#fae8ff', color: '#86198f', label: 'Embroidery' },
      'FITTING_ALTERATION': { bg: '#e0e7ff', color: '#3730a3', label: 'Fitting & Alteration' },
      'FINISHING': { bg: '#fef3c7', color: '#b45309', label: 'Finishing' },
      'QUALITY_CHECK': { bg: '#f1f5f9', color: '#334155', label: 'Quality Check' },
      'READY': { bg: '#dcfce7', color: '#15803d', label: 'Ready for Collection' },
      'DELIVERED': { bg: '#dcfce7', color: '#15803d', label: 'Delivered' },
      'ON_HOLD': { bg: '#fee2e2', color: '#b91c1c', label: 'On Hold' },
      'CANCELLED': { bg: '#f1f5f9', color: '#64748b', label: 'Cancelled' }
    }[status] || { bg: '#f1f5f9', color: '#334155', label: status };

    return (
      <span style={{
        padding: '5px 12px',
        borderRadius: '999px',
        backgroundColor: styles.bg,
        color: styles.color,
        fontSize: '0.78rem',
        fontWeight: 700,
        display: 'inline-block'
      }}>
        {styles.label}
      </span>
    );
  };

  return (
    <CustomerPortalLayout activePage="orders">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.85rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: '0 0 6px 0',
            fontFamily: "'Outfit', sans-serif"
          }}>
            My Orders
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Track live production progress, view dress design details, and download receipts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => fetchOrders(true)}
            disabled={isRefreshing}
            title="Refresh order statuses"
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              fontSize: '0.88rem',
              fontWeight: 700,
              border: '1px solid #cbd5e1',
              cursor: isRefreshing ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={15} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            {isRefreshing ? 'Checking...' : 'Refresh Status'}
          </button>

          <button
            onClick={() => navigate('/customer/new-order')}
            style={{
              padding: '11px 20px',
              borderRadius: '12px',
              backgroundColor: '#0052cc',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 82, 204, 0.3)'
            }}
          >
            + Create New Order
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
          Loading your tailoring orders...
        </div>
      ) : orders.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '60px 20px',
          textAlign: 'center',
          border: '1px solid #e2e8f0'
        }}>
          <ShoppingBag size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            No Orders Yet
          </h3>
          <p style={{ color: '#64748b', maxWidth: '440px', margin: '0 auto 20px auto', fontSize: '0.9rem' }}>
            You haven't placed any custom tailoring requests yet. Click below to start your bespoke dress design.
          </p>
          <button
            onClick={() => navigate('/customer/new-order')}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#0052cc',
              color: '#ffffff',
              fontSize: '0.92rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Create Your First Order
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {orders.map((order) => (
            <div
              key={order.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '18px',
                padding: '22px 26px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#93c5fd';
                e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(0, 82, 204, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.02)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '14px',
                  backgroundColor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0052cc'
                }}>
                  <Scissors size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0052cc' }}>
                      {order.orderNumber}
                    </span>
                    {getStatusBadge(order.status, order.priceStatus, order.priceAcceptedByCustomer)}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                    {order.garmentDetails?.dressType || 'Bespoke Garment'} ({order.garmentDetails?.quantity || 1} pcs)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
                    Placed on {new Date(order.orderDate).toLocaleDateString()}
                    {order.garmentDetails?.occasion && ` • ${order.garmentDetails.occasion}`}
                    {order.priceStatus === 'SENT' && !order.priceAcceptedByCustomer && (
                      <span style={{ color: '#0284c7', fontWeight: 800, marginLeft: '8px' }}>
                        • Quotation: LKR {Number(order.totalAmount || 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {order.priceStatus === 'SENT' && !order.priceAcceptedByCustomer && (
                  <button
                    onClick={() => viewOrderDetails(order.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 16px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)'
                    }}
                  >
                    <Sparkles size={15} />
                    <span>Review Price</span>
                  </button>
                )}

                <button
                  onClick={() => downloadPdf(order.id, order.orderNumber)}
                  title="Download Receipt PDF"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Download size={15} />
                  <span>PDF Receipt</span>
                </button>

                {Number(order.totalAmount) > 0 && order.status !== 'CANCELLED' && order.status !== 'REJECTED' && Number(order.balanceAmount || 0) > 0 && (
                  <button
                    onClick={() => {
                      setSelectedOrder(order);
                      const due = Number(order.balanceAmount || 0);
                      const adv = Number(order.advanceRequired || 0);
                      const prefill = order.advancePayment === 0 && adv > 0 ? adv : due;
                      setSlipAmount(prefill > 0 ? prefill : '');
                      setIsSlipModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 14px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: '#0052cc',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0, 82, 204, 0.25)'
                    }}
                  >
                    <Upload size={14} />
                    <span>{Number(order.advancePayment || 0) === 0 ? 'Pay Advance' : 'Upload Slip'}</span>
                  </button>
                )}

                <button
                  onClick={() => viewOrderDetails(order.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <span>Track Status</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(2, 6, 23, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            position: 'relative'
          }}>
            <button
              onClick={() => setSelectedOrder(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Order {selectedOrder.orderNumber}
                </h2>
                {getStatusBadge(selectedOrder.status, selectedOrder.priceStatus, selectedOrder.priceAcceptedByCustomer)}
              </div>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                Submitted on {new Date(selectedOrder.orderDate).toLocaleString()}
              </p>
            </div>

            {/* Prominent Banners for Pending Approval and Rejection */}
            {selectedOrder.status === 'PENDING_APPROVAL' && (
              <div style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '14px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#b45309',
                  flexShrink: 0
                }}>
                  <Clock size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#92400e', marginBottom: '3px' }}>
                    Order Submitted — Waiting for CEO / Manager Approval
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#b45309', lineHeight: 1.5 }}>
                    Your custom order has been safely received. Our management team is currently reviewing the specifications and preparing your price quotation.
                  </div>
                </div>
              </div>
            )}

            {selectedOrder.status === 'REJECTED' && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '14px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  flexShrink: 0
                }}>
                  <X size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#991b1b', marginBottom: '3px' }}>
                    Order Rejected
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#b91c1c', lineHeight: 1.5 }}>
                    <strong>Reason:</strong> {selectedOrder.rejectionReason || 'No specific reason provided.'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#7f1d1d', marginTop: '6px' }}>
                    Please contact our customer care or create a new order with revised details.
                  </div>
                </div>
              </div>
            )}

            {/* Price Confirmation Card (When price is sent and awaiting customer acceptance) */}
            {selectedOrder.priceStatus === 'SENT' && !selectedOrder.priceAcceptedByCustomer && (
              <div style={{
                backgroundColor: '#f0f9ff',
                border: '2px solid #38bdf8',
                borderRadius: '18px',
                padding: '22px',
                marginBottom: '22px',
                boxShadow: '0 8px 24px -4px rgba(2, 132, 199, 0.12)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                  }}>
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0369a1' }}>
                      Price Quotation Confirmation Required
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: '#0284c7' }}>
                      Quotation issued by Bella Design Management on {selectedOrder.priceSentAt ? new Date(selectedOrder.priceSentAt).toLocaleDateString() : 'Today'}
                    </div>
                  </div>
                </div>

                {/* Price Breakdown Grid */}
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  border: '1px solid #bae6fd',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', fontSize: '0.86rem', marginBottom: '14px' }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Tailoring Service:</div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        LKR {Number(selectedOrder.serviceCharge || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Work (Aari/Embroidery):</div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        LKR {Number(selectedOrder.additionalWorkCharge || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Material / Fabric:</div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        LKR {Number(selectedOrder.materialCharge || 0).toLocaleString()}
                      </div>
                    </div>
                    {Number(selectedOrder.discountAmount || 0) > 0 && (
                      <div>
                        <div style={{ color: '#16a34a', fontSize: '0.78rem' }}>Discount:</div>
                        <div style={{ fontWeight: 700, color: '#16a34a' }}>
                          - LKR {Number(selectedOrder.discountAmount).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{
                    borderTop: '1px dashed #cbd5e1',
                    paddingTop: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Total Agreed Quotation</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                        LKR {Number(selectedOrder.totalAmount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Advance Required to Start</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
                        LKR {Number(selectedOrder.advancePayment || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Balance Due on Collection</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#475569' }}>
                        LKR {Number(selectedOrder.balanceAmount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.82rem', color: '#0369a1', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                  <strong>Important Notice:</strong> Accepting this price confirms your tailoring booking and authorizes our workshop to assign your master tailor and schedule cutting. Advance payment can be made at our shop counter or online.
                </p>

                {/* Decline input if open */}
                {showDeclineInput ? (
                  <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '14px'
                  }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#991b1b', marginBottom: '6px' }}>
                      Reason for declining quotation (Help us revise):
                    </label>
                    <textarea
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="e.g. Budget constraint, please remove optional embroidery, change fabric..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid #fca5a5',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                      <button
                        onClick={() => setShowDeclineInput(false)}
                        disabled={processingPriceAction}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeclinePrice(selectedOrder.id)}
                        disabled={processingPriceAction}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#dc2626',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        {processingPriceAction ? 'Submitting...' : 'Confirm Decline & Request Revision'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleAcceptPrice(selectedOrder.id)}
                      disabled={processingPriceAction}
                      style={{
                        flex: 1,
                        minWidth: '220px',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: '0.92rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <CheckCircle2 size={18} />
                      <span>{processingPriceAction ? 'Processing...' : 'ACCEPT PRICE & CONFIRM ORDER'}</span>
                    </button>

                    <button
                      onClick={() => setShowDeclineInput(true)}
                      disabled={processingPriceAction}
                      style={{
                        padding: '12px 18px',
                        borderRadius: '12px',
                        border: '1px solid #f87171',
                        backgroundColor: '#ffffff',
                        color: '#dc2626',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: 'pointer'
                      }}
                    >
                      Decline Price
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Declined Banner if price was declined */}
            {selectedOrder.priceStatus === 'DECLINED' && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '14px',
                padding: '16px 20px',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>
                  Quotation Declined — Awaiting Revised Quote
                </div>
                <div style={{ fontSize: '0.85rem', color: '#b91c1c' }}>
                  <strong>Your Feedback:</strong> "{selectedOrder.priceDeclineReason || 'Price revision requested'}"
                </div>
                <div style={{ fontSize: '0.8rem', color: '#7f1d1d', marginTop: '6px' }}>
                  Our management has been notified and will send an updated price shortly. Production is safely paused until you confirm.
                </div>
              </div>
            )}

            {/* Price Accepted Banner */}
            {selectedOrder.priceAcceptedByCustomer && (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '14px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CheckCircle2 size={16} />
                </div>
                <div style={{ fontSize: '0.86rem', color: '#166534' }}>
                  <strong>Price Quotation Accepted:</strong> Agreed Total LKR {Number(selectedOrder.agreedTotal || selectedOrder.totalAmount || 0).toLocaleString()}
                  {selectedOrder.priceAcceptedAt && ` on ${new Date(selectedOrder.priceAcceptedAt).toLocaleDateString()}`}.
                </div>
              </div>
            )}

            {/* Live Tailoring Progress Stepper */}
            {selectedOrder.status !== 'REJECTED' && (
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="#0052cc" />
                  <span>Live Tailoring Journey</span>
                </h4>

                {(() => {
                  const stages = [
                    { key: 'PENDING_APPROVAL', label: 'Submitted' },
                    { key: 'APPROVED', label: 'Price Review' },
                    { key: 'ORDER_CONFIRMED', label: 'Confirmed' },
                    { key: 'CUTTING', label: 'Cutting' },
                    { key: 'STITCHING', label: 'Stitching' },
                    { key: 'READY', label: 'Ready' },
                    { key: 'DELIVERED', label: 'Delivered' }
                  ];

                  const stageOrder = [
                    'PENDING_APPROVAL', 'APPROVED', 'ORDER_CONFIRMED', 'PENDING_PRODUCTION',
                    'CUTTING', 'STITCHING', 'AARI_EMBROIDERY', 'EMBROIDERY_AARI',
                    'FITTING_ALTERATION', 'FINISHING', 'QUALITY_CHECK', 'READY', 'DELIVERED'
                  ];

                  const currentIdx = stageOrder.indexOf(selectedOrder.status);

                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', marginBottom: '16px' }}>
                        {/* Connecting Line */}
                        <div style={{
                          position: 'absolute',
                          top: '14px',
                          left: '20px',
                          right: '20px',
                          height: '3px',
                          backgroundColor: '#e2e8f0',
                          zIndex: 1
                        }} />

                        {stages.map((st, i) => {
                          const stIdx = stageOrder.indexOf(st.key);
                          const isDone = currentIdx > stIdx;
                          const isCurrent = selectedOrder.status === st.key ||
                            (st.key === 'APPROVED' && selectedOrder.status === 'APPROVED') ||
                            (st.key === 'STITCHING' && ['AARI_EMBROIDERY', 'EMBROIDERY_AARI', 'FITTING_ALTERATION', 'FINISHING', 'QUALITY_CHECK'].includes(selectedOrder.status)) ||
                            (st.key === 'ORDER_CONFIRMED' && ['PENDING', 'PENDING_PRODUCTION'].includes(selectedOrder.status));

                          const circleColor = isDone ? '#10b981' : (isCurrent ? '#0052cc' : '#cbd5e1');
                          const textColor = isDone ? '#065f46' : (isCurrent ? '#0052cc' : '#94a3b8');

                          return (
                            <div key={st.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: '#ffffff',
                                border: `3px solid ${circleColor}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                color: circleColor,
                                boxShadow: isCurrent ? '0 0 0 4px rgba(0, 82, 204, 0.2)' : 'none',
                                transition: 'all 0.2s ease'
                              }}>
                                {isDone ? '✓' : (i + 1)}
                              </div>
                              <span style={{ fontSize: '0.74rem', fontWeight: isCurrent ? 800 : 600, color: textColor, marginTop: '6px', textAlign: 'center' }}>
                                {st.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Production History Notes if available */}
                      {selectedOrder.productionHistory && selectedOrder.productionHistory.length > 0 && (
                        <div style={{
                          marginTop: '16px',
                          paddingTop: '12px',
                          borderTop: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                            Atelier Activity Log
                          </span>
                          {selectedOrder.productionHistory.map((h, idx) => (
                            <div key={idx} style={{ fontSize: '0.82rem', color: '#334155', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                              <span style={{ color: '#0052cc', fontWeight: 700 }}>•</span>
                              <div>
                                <strong>Stage: {getStatusLabel(h.stage)}</strong>
                                {h.notes && <span style={{ color: '#475569', marginLeft: '6px' }}>— {cleanActivityNote(h.notes)}</span>}
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '8px' }}>
                                  ({new Date(h.startedAt).toLocaleString()})
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Price & Billing Information */}
            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '16px',
              padding: '18px 20px',
              marginBottom: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={18} color="#0052cc" />
                  Billing & Payment Status
                </h4>

                {/* Upload Slip Button */}
                {Number(selectedOrder.totalAmount) > 0 && selectedOrder.status !== 'CANCELLED' && selectedOrder.status !== 'REJECTED' && (
                  <button
                    onClick={() => {
                      const due = Number(selectedOrder.balanceAmount || 0);
                      const adv = Number(selectedOrder.advanceRequired || 0);
                      const prefill = selectedOrder.advancePayment === 0 && adv > 0 ? adv : due;
                      setSlipAmount(prefill > 0 ? prefill : '');
                      setIsSlipModalOpen(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#0052cc',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0, 82, 204, 0.25)'
                    }}
                  >
                    <Upload size={13} />
                    {Number(selectedOrder.advancePayment || 0) === 0 ? 'Pay Advance / Upload Slip' : 'Upload Payment Slip'}
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', fontSize: '0.86rem', marginBottom: (selectedOrder.payments?.length > 0 ? '16px' : '0') }}>
                <div>
                  <strong>Total Quotation:</strong>{' '}
                  {Number(selectedOrder.totalAmount) > 0 ? (
                    <span style={{ color: '#0f172a', fontWeight: 800 }}>
                      LKR {Number(selectedOrder.totalAmount).toLocaleString()}
                    </span>
                  ) : (
                    <span style={{
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: 800,
                      fontSize: '0.78rem'
                    }}>
                      PRICE PENDING
                    </span>
                  )}
                </div>
                <div>
                  <strong>Advance Paid:</strong>{' '}
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>
                    LKR {Number(selectedOrder.advancePayment || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <strong>Balance Due:</strong>{' '}
                  <span style={{ color: Number(selectedOrder.balanceAmount) > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                    LKR {Number(selectedOrder.balanceAmount || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <strong>Payment Status:</strong>{' '}
                  <span style={{
                    color: selectedOrder.paymentStatus === 'Paid' || selectedOrder.paymentStatus === 'PAID' ? '#16a34a' : (selectedOrder.paymentStatus === 'Partially Paid' || selectedOrder.paymentStatus === 'PARTIAL' ? '#0284c7' : '#d97706'),
                    fontWeight: 800
                  }}>
                    {selectedOrder.paymentStatus || 'Unpaid'}
                  </span>
                </div>
              </div>

              {/* Payment Records & Slips History */}
              {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    Payment Proofs & Slips
                  </span>

                  {selectedOrder.payments.map((p, idx) => {
                    const isPending = p.status === 'PENDING_VERIFICATION';
                    const isRejected = p.status === 'REJECTED';
                    const isVerified = p.status === 'VERIFIED' || (!p.status && !p.slipImage);

                    return (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: isPending ? '#fffbeb' : (isRejected ? '#fef2f2' : '#f0fdf4'),
                          border: `1px solid ${isPending ? '#fde68a' : (isRejected ? '#fecaca' : '#bbf7d0')}`,
                          borderRadius: '10px',
                          padding: '12px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Slip Image Thumbnail if available */}
                          {p.slipImage ? (
                            <div
                              onClick={() => setViewingSlipImage(getImageUrl(p.slipImage))}
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: '1px solid #cbd5e1',
                                cursor: 'pointer',
                                flexShrink: 0,
                                position: 'relative'
                              }}
                              title="Click to view full receipt"
                            >
                              <img
                                src={getImageUrl(p.slipImage)}
                                alt="Payment slip"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </div>
                          ) : (
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              backgroundColor: '#e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#64748b'
                            }}>
                              <CreditCard size={18} />
                            </div>
                          )}

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                                LKR {Number(p.amount).toLocaleString()}
                              </strong>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                via {p.paymentMethod || 'Bank Transfer'}
                              </span>
                              {p.transactionRef && (
                                <span style={{ fontSize: '0.72rem', backgroundColor: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                  Ref: {p.transactionRef}
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                              Submitted on {new Date(p.createdAt).toLocaleDateString()}
                              {p.verifiedBy && ` • Verified by ${p.verifiedBy}`}
                            </div>

                            {isRejected && p.rejectionReason && (
                              <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, marginTop: '2px' }}>
                                Reason: {p.rejectionReason}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          {isPending && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              border: '1px solid #fde68a'
                            }}>
                              <Clock size={12} /> Awaiting Manager OK
                            </span>
                          )}

                          {isVerified && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              backgroundColor: '#ecfdf5',
                              color: '#047857',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              border: '1px solid #a7f3d0'
                            }}>
                              <CheckCircle2 size={12} /> Verified & Credited
                            </span>
                          )}

                          {isRejected && (
                            <button
                              onClick={() => {
                                setSlipAmount(p.amount);
                                setIsSlipModalOpen(true);
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                border: '1px solid #fca5a5',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              Re-upload Slip
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Garment Details Card */}
            {selectedOrder.garmentDetails && (
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 14px 0' }}>
                  Dress Specifications
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.86rem' }}>
                  <div><strong>Dress Type:</strong> {selectedOrder.garmentDetails.dressType}</div>
                  <div><strong>Quantity:</strong> {selectedOrder.garmentDetails.quantity}</div>
                  <div><strong>Occasion:</strong> {selectedOrder.garmentDetails.occasion || 'General'}</div>
                  <div><strong>Fabric Supplied:</strong> {selectedOrder.garmentDetails.fabricSuppliedBy || 'Customer'}</div>
                  <div><strong>Fabric Type:</strong> {selectedOrder.garmentDetails.fabricType || 'Standard'}</div>
                  <div><strong>Fabric Colour:</strong> {selectedOrder.garmentDetails.fabricColour || 'Specified with cloth'}</div>
                  <div><strong>Lining:</strong> {selectedOrder.garmentDetails.liningRequired ? 'Yes' : 'No'}</div>
                  <div><strong>Padding / Cups:</strong> {selectedOrder.garmentDetails.paddingCupRequired ? 'Yes' : 'No'}</div>
                  <div><strong>Aari / Embroidery:</strong> {selectedOrder.garmentDetails.workRequired ? 'Yes' : 'No'}</div>
                </div>

                {selectedOrder.garmentDetails.workDetails && (
                  <div style={{ marginTop: '12px', fontSize: '0.86rem', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                    <strong>Embroidery Instructions:</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#475569' }}>{selectedOrder.garmentDetails.workDetails}</p>
                  </div>
                )}

                {selectedOrder.garmentDetails.specialDesignInstructions && (
                  <div style={{ marginTop: '10px', fontSize: '0.86rem', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                    <strong>Special Instructions:</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#475569' }}>{selectedOrder.garmentDetails.specialDesignInstructions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Design Reference Image */}
            {selectedOrder.garmentDetails?.designReferenceImage && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>
                  Design Reference Photo
                </h4>
                <div style={{ textAlign: 'center', backgroundColor: '#f1f5f9', padding: '14px', borderRadius: '14px' }}>
                  <img
                    src={getImageUrl(selectedOrder.garmentDetails.designReferenceImage)}
                    alt="Design Reference"
                    style={{
                      maxHeight: '220px',
                      maxWidth: '100%',
                      borderRadius: '10px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => downloadPdf(selectedOrder.id, selectedOrder.orderNumber)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '11px 18px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                <Download size={16} />
                <span>Download PDF</span>
              </button>

              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  padding: '11px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#0052cc',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Slip Upload Modal */}
      {isSlipModalOpen && selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000001,
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUploadingSlip) {
              setIsSlipModalOpen(false);
              setSlipFile(null);
              setSlipPreview(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid #e2e8f0',
              padding: '24px',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >
            {/* Close button */}
            <button
              type="button"
              disabled={isUploadingSlip}
              onClick={() => {
                setIsSlipModalOpen(false);
                setSlipFile(null);
                setSlipPreview(null);
              }}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                color: '#0052cc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Upload size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                  {Number(selectedOrder.advancePayment || 0) === 0 ? 'Pay Advance / Upload Slip' : 'Upload Payment Slip'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  Order {selectedOrder.orderNumber}
                </p>
              </div>
            </div>

            {/* Order Billing Summary Banner */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              textAlign: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Quoted Total</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#0f172a' }}>
                  LKR {Number(selectedOrder.totalAmount || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Paid So Far</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#16a34a' }}>
                  LKR {Number(selectedOrder.advancePayment || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Balance Due</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: Number(selectedOrder.balanceAmount) > 0 ? '#dc2626' : '#16a34a' }}>
                  LKR {Number(selectedOrder.balanceAmount || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Bank Account Details Card */}
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '18px'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e40af', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CreditCard size={14} /> Official Atelier Bank Account Details
              </div>
              <div style={{ fontSize: '0.8rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                <div><strong>Bank:</strong> Commercial Bank of Ceylon</div>
                <div><strong>Account Name:</strong> JB Group / Bella Designs</div>
                <div><strong>Account No:</strong> 8012 3456 7890</div>
                <div><strong>Branch:</strong> Main Branch</div>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#3b82f6', marginTop: '6px' }}>
                * Transfer the amount via CDM, Online Banking, or Counter deposit, then attach your deposit receipt below.
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleUploadPaymentSlip} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Amount */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  Payment Amount (LKR) *
                </label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {Number(selectedOrder.advanceRequired || 0) > 0 && Number(selectedOrder.advancePayment || 0) === 0 && (
                    <button
                      type="button"
                      onClick={() => setSlipAmount(selectedOrder.advanceRequired)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #bfdbfe',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Advance: LKR {Number(selectedOrder.advanceRequired).toLocaleString()}
                    </button>
                  )}
                  {Number(selectedOrder.balanceAmount || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setSlipAmount(selectedOrder.balanceAmount)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#f8fafc',
                        color: '#0f172a',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Full Balance: LKR {Number(selectedOrder.balanceAmount).toLocaleString()}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={slipAmount}
                  onChange={(e) => setSlipAmount(e.target.value)}
                  placeholder="e.g. 1395"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Payment Method */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  Payment Channel *
                </label>
                <select
                  value={slipMethod}
                  onChange={(e) => setSlipMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT / SLIPS)</option>
                  <option value="Online Banking">Online Banking / Mobile App</option>
                  <option value="CDM Cash Deposit">Cash Deposit Machine (CDM)</option>
                  <option value="Counter Deposit">Bank Counter Cash Deposit</option>
                  <option value="Other">Other Bank Transfer</option>
                </select>
              </div>

              {/* Transaction Ref */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  Transaction Ref / Slip No (Optional)
                </label>
                <input
                  type="text"
                  value={slipTransactionRef}
                  onChange={(e) => setSlipTransactionRef(e.target.value)}
                  placeholder="e.g. TXN-109842 or Deposit Ref"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              {/* File Upload Zone */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  Upload Payment Receipt / Deposit Slip Photo *
                </label>
                
                {slipPreview ? (
                  <div style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '2px solid #0052cc',
                    backgroundColor: '#f8fafc',
                    textAlign: 'center',
                    padding: '12px'
                  }}>
                    <img
                      src={slipPreview}
                      alt="Slip Preview"
                      style={{
                        maxHeight: '180px',
                        maxWidth: '100%',
                        borderRadius: '8px',
                        objectFit: 'contain'
                      }}
                    />
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSlipFile(null);
                          setSlipPreview(null);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #fca5a5',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Remove / Change Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 16px',
                    borderRadius: '12px',
                    border: '2px dashed #93c5fd',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                    textAlign: 'center'
                  }}>
                    <Upload size={28} color="#0052cc" style={{ marginBottom: '8px' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', marginBottom: '3px' }}>
                      Click to browse or take photo of bank receipt
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Supports JPG, PNG, WEBP (Max 5MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      required
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert('File exceeds 5MB size limit.');
                            return;
                          }
                          setSlipFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setSlipPreview(reader.result);
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>

              {/* Customer Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  Notes / Message (Optional)
                </label>
                <input
                  type="text"
                  value={slipNotes}
                  onChange={(e) => setSlipNotes(e.target.value)}
                  placeholder="e.g. Paid from Commercial Bank account"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsSlipModalOpen(false);
                    setSlipFile(null);
                    setSlipPreview(null);
                  }}
                  disabled={isUploadingSlip}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUploadingSlip}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#0052cc',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: isUploadingSlip ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 82, 204, 0.25)'
                  }}
                >
                  {isUploadingSlip ? (
                    <>
                      <RefreshCw size={15} className="spin-animation" />
                      <span>Uploading Slip...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={15} />
                      <span>Submit Payment Slip</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Viewing Slip Images */}
      {viewingSlipImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000005,
            padding: '20px'
          }}
          onClick={() => setViewingSlipImage(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewingSlipImage(null)}
              style={{
                position: 'absolute',
                top: '-42px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.25)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <img
              src={viewingSlipImage}
              alt="Payment Slip Proof"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                borderRadius: '12px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                objectFit: 'contain',
                backgroundColor: '#ffffff'
              }}
            />
          </div>
        </div>
      )}
    </CustomerPortalLayout>
  );
};
