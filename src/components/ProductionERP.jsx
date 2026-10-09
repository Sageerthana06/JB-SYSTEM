import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Scissors,
  Clock,
  CheckCircle,
  AlertTriangle,
  Truck,
  Ruler,
  Layers,
  Sparkles,
  Filter,
  Search,
  UserCheck,
  Calendar,
  ArrowRight,
  RefreshCw,
  FileText,
  Check,
  X,
  ShieldAlert,
  SlidersHorizontal,
  MessageCircle
} from 'lucide-react';
import {
  getStatusLabel,
  getStatusColors,
  getNextStageInfo,
  isAariRequired,
  isFittingRequired,
  ALL_STATUSES
} from '../utils/orderStatus';
import { DigitalInvoiceModal } from './DigitalInvoiceModal';
import { SelfAttendanceCard } from './SelfAttendanceCard';
import { API_URL, getImageUrl } from '../config/api';

const normalizePhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  const raw = phone.toString().replace(/[^0-9]/g, '');
  if (raw.startsWith('94')) return raw;
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

export const ProductionERP = () => {
  const { activeBranch, getAuthHeaders, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [activeStageFilter, setActiveStageFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState(null);
  const [selectedOrderForSpecs, setSelectedOrderForSpecs] = useState(null);
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const isFullAccess = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes((user?.role || '').toUpperCase());

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/orders`, {
        headers: getAuthHeaders ? getAuthHeaders() : {
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        setError(data.message || 'Failed to fetch production orders');
      }
    } catch (err) {
      console.error('Production fetch error:', err);
      setError('Network error connecting to production server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Accept assigned order (Tailor action: transitions ORDER_CONFIRMED -> CUTTING)
  const handleTailorAccept = async (orderId) => {
    try {
      setSubmittingAction(true);
      const res = await fetch(`${API_URL}/api/orders/${orderId}/tailor-accept`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => (o.id === orderId ? data.order : o)));
      } else {
        alert(data.message || 'Failed to accept order assignment.');
      }
    } catch (err) {
      console.error('Error accepting order:', err);
      alert('Network error while accepting order.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Reject assigned order (Tailor action: returns to CEO for reassignment)
  const handleTailorReject = async () => {
    if (!rejectingOrder) return;
    if (!rejectionReasonText.trim()) {
      alert('Please enter a reason for rejecting the assignment.');
      return;
    }
    try {
      setSubmittingAction(true);
      const res = await fetch(`${API_URL}/api/orders/${rejectingOrder.id}/tailor-reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        },
        body: JSON.stringify({ reason: rejectionReasonText.trim() })
      });
      const data = await res.json();
      if (data.success) {
        // Remove from tailor's current list
        setOrders(prev => prev.filter(o => o.id !== rejectingOrder.id));
        setRejectingOrder(null);
        setRejectionReasonText('');
      } else {
        alert(data.message || 'Failed to reject order assignment.');
      }
    } catch (err) {
      console.error('Error rejecting order:', err);
      alert('Network error while rejecting assignment.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Update order status in PostgreSQL via PATCH /api/orders/:id/status
  const handleAdvanceStatus = async (orderId, targetStatus) => {
    try {
      setUpdatingOrderId(orderId);
      const res = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      const data = await res.json();
      if (data.success) {
        // Update state immediately with the updated order
        const updatedOrderObj = data.order || {};
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, ...updatedOrderObj, status: targetStatus } : o)));
        if (targetStatus === 'READY') {
          const targetOrd = data.order || orders.find(o => o.id === orderId) || {};
          const phone = targetOrd.customer?.primaryPhone || targetOrd.phone;
          if (phone) {
            const waUrl = `https://wa.me/${normalizePhoneForWhatsApp(phone)}?text=${encodeURIComponent(generateOrderReadyWhatsAppMessage(targetOrd))}`;
            window.open(waUrl, '_blank');
          }
        }
      } else {
        alert(data.message || 'Failed to update order status');
      }
    } catch (err) {
      console.error('Error advancing status:', err);
      alert('Network error while updating status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Branch filtering
  const branchFilteredOrders = orders.filter(o => {
    if (activeBranch && activeBranch !== 'ALL') {
      const bName = o.branch?.name || '';
      return bName.toLowerCase().includes(activeBranch.toLowerCase());
    }
    return true;
  });

  // Calculate live production metrics from real orders
  const inProgressCount = branchFilteredOrders.filter(o =>
    !['DELIVERED', 'CANCELLED', 'PENDING_APPROVAL', 'REJECTED'].includes(o.status)
  ).length;

  const deliveredCount = branchFilteredOrders.filter(o =>
    o.status === 'DELIVERED'
  ).length;

  const pendingCount = branchFilteredOrders.filter(o =>
    ['ORDER_CONFIRMED', 'PENDING_PRODUCTION', 'PENDING'].includes(o.status)
  ).length;

  const cuttingCount = branchFilteredOrders.filter(o =>
    o.status === 'CUTTING'
  ).length;

  const stitchingCount = branchFilteredOrders.filter(o =>
    o.status === 'STITCHING'
  ).length;

  const readyCount = branchFilteredOrders.filter(o =>
    o.status === 'READY'
  ).length;

  // Interactive Live Manufacturing Stages definition
  const journeyStages = [
    {
      id: 'STAGE_ALL',
      filterVal: 'ALL',
      name: 'All Orders',
      icon: SlidersHorizontal,
      color: '#3b82f6',
      count: branchFilteredOrders.length
    },
    {
      id: 'STAGE_CONFIRMED',
      filterVal: 'ORDER_CONFIRMED',
      name: 'Confirmed',
      icon: Calendar,
      color: '#0369a1',
      count: branchFilteredOrders.filter(o => o.status === 'ORDER_CONFIRMED' || o.status === 'PENDING').length
    },
    {
      id: 'STAGE_PENDING_PROD',
      filterVal: 'PENDING_PRODUCTION',
      name: 'Pending Prod',
      icon: Clock,
      color: '#78350f',
      count: branchFilteredOrders.filter(o => o.status === 'PENDING_PRODUCTION').length
    },
    {
      id: 'STAGE_CUTTING',
      filterVal: 'CUTTING',
      name: 'Cutting',
      icon: Scissors,
      color: '#1d4ed8',
      count: cuttingCount
    },
    {
      id: 'STAGE_STITCHING',
      filterVal: 'STITCHING',
      name: 'Stitching',
      icon: Layers,
      color: '#d90429',
      count: stitchingCount
    },
    {
      id: 'STAGE_EMBROIDERY',
      filterVal: 'AARI_EMBROIDERY',
      name: 'Aari / Work',
      icon: Sparkles,
      color: '#6d28d9',
      count: branchFilteredOrders.filter(o => o.status === 'AARI_EMBROIDERY' || o.status === 'EMBROIDERY_AARI').length
    },
    {
      id: 'STAGE_FITTING',
      filterVal: 'FITTING_ALTERATION',
      name: 'Fitting',
      icon: Ruler,
      color: '#7e22ce',
      count: branchFilteredOrders.filter(o => o.status === 'FITTING_ALTERATION').length
    },
    {
      id: 'STAGE_FINISHING',
      filterVal: 'FINISHING',
      name: 'Finishing',
      icon: Sparkles,
      color: '#b45309',
      count: branchFilteredOrders.filter(o => o.status === 'FINISHING').length
    },
    {
      id: 'STAGE_QC',
      filterVal: 'QUALITY_CHECK',
      name: 'QC Check',
      icon: CheckCircle,
      color: '#92400e',
      count: branchFilteredOrders.filter(o => o.status === 'QUALITY_CHECK').length
    },
    {
      id: 'STAGE_READY',
      filterVal: 'READY',
      name: 'Ready',
      icon: Check,
      color: '#065f46',
      count: readyCount
    },
    {
      id: 'STAGE_DELIVERED',
      filterVal: 'DELIVERED',
      name: 'Delivered',
      icon: Truck,
      color: '#14532d',
      count: deliveredCount
    }
  ];

  // Filter real garments based on search and active stage filter
  const displayedOrders = branchFilteredOrders.filter(order => {
    // Stage Filter
    if (activeStageFilter !== 'ALL') {
      if (activeStageFilter === 'ORDER_CONFIRMED') {
        if (order.status !== 'ORDER_CONFIRMED' && order.status !== 'PENDING') return false;
      } else if (activeStageFilter === 'AARI_EMBROIDERY') {
        if (order.status !== 'AARI_EMBROIDERY' && order.status !== 'EMBROIDERY_AARI') return false;
      } else if (order.status !== activeStageFilter) {
        return false;
      }
    }

    // Search Query (Order Number, Customer Name, Phone, Dress Type)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNo = (order.orderNumber || '').toLowerCase().includes(q);
      const matchCust = (order.customer?.name || '').toLowerCase().includes(q);
      const matchPhone = (order.customer?.primaryPhone || '').toLowerCase().includes(q);
      const matchDress = (order.garmentDetails?.dressType || '').toLowerCase().includes(q);
      return matchNo || matchCust || matchPhone || matchDress;
    }

    return true;
  });

  return (
    <div className="erp-page-container">
      {/* Top Title & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Production ERP & Live Dress Journey
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Active PostgreSQL workflow: Confirmed → Pending Prod → Cutting → Stitching → (Aari / Fitting) → Finishing → QC → Ready → Delivered
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '420px', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search order, client, garment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            onClick={fetchOrders}
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Today's Attendance Card for Tailor & Staff */}
      <SelfAttendanceCard />

      {/* Tailor Pending Acceptance Banner */}
      {user?.role === 'TAILOR' && orders.some(o => Number(o.assignedTailorId) === Number(user?.id) && !o.tailorAccepted) && (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '2px solid #F59E0B',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B45309' }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#92400E' }}>
                New Orders Waiting for Your Acceptance ({orders.filter(o => Number(o.assignedTailorId) === Number(user?.id) && !o.tailorAccepted).length})
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#B45309' }}>
                Management has assigned new order(s) to you. Review garment specs and accept to start Cutting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Production KPI Metric Cards */}
      <div className="kpi-cards-grid">
        <div className="card" style={{ borderLeft: '4px solid #3b82f6', padding: '16px' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>In Progress</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', margin: '4px 0' }}>{inProgressCount} Units</h3>
          <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 700 }}>Active in Workshops</span>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #1d4ed8', padding: '16px' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>In Cutting</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', margin: '4px 0' }}>{cuttingCount} Units</h3>
          <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 700 }}>Pattern & Cut Stage</span>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--jb-crimson)', padding: '16px' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>In Stitching</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--jb-crimson)', margin: '4px 0' }}>{stitchingCount} Units</h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--jb-crimson)', fontWeight: 700 }}>Tailoring Assembly</span>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #065f46', padding: '16px' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ready for Pickup</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#065f46', margin: '4px 0' }}>{readyCount} Units</h3>
          <span style={{ fontSize: '0.7rem', color: '#065f46', fontWeight: 700 }}>Client Collection Ready</span>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #14532d', padding: '16px' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivered</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#14532d', margin: '4px 0' }}>{deliveredCount} Delivered</h3>
          <span style={{ fontSize: '0.7rem', color: '#14532d', fontWeight: 700 }}>Completed Handover</span>
        </div>
      </div>

      {/* Interactive Live Dress Journey Stepper */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Live Dress Journey Stages
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Click any stage to filter orders in that manufacturing step
            </p>
          </div>

          {activeStageFilter !== 'ALL' && (
            <button
              onClick={() => setActiveStageFilter('ALL')}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Visual Stepper Buttons */}
        <div className="journey-stages-container">
          {journeyStages.map((stage) => {
            const IconComponent = stage.icon;
            const isSelected = activeStageFilter === stage.filterVal;

            return (
              <div
                key={stage.id}
                onClick={() => setActiveStageFilter(stage.filterVal)}
                style={{
                  backgroundColor: isSelected ? 'var(--jb-navy)' : 'var(--bg-main)',
                  color: isSelected ? '#ffffff' : 'var(--text-main)',
                  border: isSelected ? '2px solid var(--jb-crimson)' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 6px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 4px 12px rgba(10, 25, 47, 0.25)' : 'none'
                }}
              >
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: isSelected ? stage.color : 'var(--bg-card)',
                  color: isSelected ? '#ffffff' : stage.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 6px auto'
                }}>
                  <IconComponent size={15} />
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {stage.name}
                </div>
                <span style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-card)',
                  color: isSelected ? '#ffffff' : stage.color,
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '999px'
                }}>
                  {stage.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real Orders Table with Direct Next Stage Action Buttons */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Live Production Queue ({displayedOrders.length})
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Real-time orders from PostgreSQL database. Review garment specifications and advance workflow stages.
            </p>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {displayedOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            No orders found matching the selected filter.
          </div>
        ) : (
          <>
          <div className="production-desktop-table" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 14px' }}>Order Number</th>
                  <th style={{ padding: '12px 14px' }}>Customer</th>
                  <th style={{ padding: '12px 14px' }}>Garment Details</th>
                  <th style={{ padding: '12px 14px' }}>Branch</th>
                  <th style={{ padding: '12px 14px' }}>Current Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Next Stage Action</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {user?.role === 'TAILOR' ? 'Garment Specs' : 'Details / Invoice'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedOrders.map((order) => {
                  const colors = getStatusColors(order.status);
                  const nextInfo = getNextStageInfo(order);
                  const isUpdating = updatingOrderId === order.id;
                  const aariNeeded = isAariRequired(order);
                  const fittingNeeded = isFittingRequired(order);
                  const isAssignedPendingAcceptance = Boolean(order.assignedTailorId && !order.tailorAccepted);
                  const isMyPendingAcceptance = Boolean(
                    user?.role === 'TAILOR'
                      ? (Number(order.assignedTailorId) === Number(user?.id) && !order.tailorAccepted)
                      : (!order.tailorAccepted && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role) && order.assignedTailorId)
                  );

                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {/* Order Number */}
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--jb-navy-light)' }}>
                        <div>{order.orderNumber || `ORD-${order.id}`}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(order.orderDate).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Customer (Name only for Staff & Tailor) */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0a192f', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0 }}>
                            {order.customer?.name ? order.customer.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                              {order.customer?.name || 'Customer'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Garment Details & Requirements Tags */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {order.garmentDetails?.dressType || 'Custom Garment'}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.68rem', backgroundColor: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            Qty: {order.garmentDetails?.quantity || 1}
                          </span>
                          {aariNeeded ? (
                            <span style={{ fontSize: '0.68rem', backgroundColor: '#EDE9FE', color: '#6D28D9', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              ★ Aari Work
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', backgroundColor: '#f8fafc', color: '#94a3b8', padding: '1px 6px', borderRadius: '4px' }}>
                              No Aari
                            </span>
                          )}
                          {fittingNeeded && (
                            <span style={{ fontSize: '0.68rem', backgroundColor: '#FDF4FF', color: '#7E22CE', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              Fitting Needed
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Branch */}
                      <td style={{ padding: '12px 14px' }}>
                        <span className="badge badge-navy" style={{ fontSize: '0.75rem' }}>
                          {order.branch?.name || 'Main Branch'}
                        </span>
                      </td>

                      {/* Current Status Badge */}
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            backgroundColor: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`
                          }}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                        {isAssignedPendingAcceptance && (
                          <div style={{
                            marginTop: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '0.7rem',
                            color: '#b45309',
                            fontWeight: 800,
                            backgroundColor: '#fef3c7',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid #fde68a'
                          }}>
                            ⏳ WAITING ACCEPTANCE
                          </div>
                        )}
                      </td>

                      {/* NEXT STAGE ACTION BUTTON */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {order.status === 'DELIVERED' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#BBF7D0',
                              color: '#14532D',
                              fontSize: '0.75rem',
                              fontWeight: 800
                            }}
                          >
                            <CheckCircle size={14} /> Completed & Delivered
                          </span>
                        ) : isMyPendingAcceptance ? (
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              onClick={() => handleTailorAccept(order.id)}
                              disabled={submittingAction}
                              title="Accept this order and start Cutting"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(16,185,129,0.2)'
                              }}
                            >
                              <Check size={13} /> Accept Order
                            </button>
                            <button
                              onClick={() => {
                                setRejectingOrder(order);
                                setRejectionReasonText('');
                              }}
                              disabled={submittingAction}
                              title="Reject this assignment with reason"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                border: '1px solid #fca5a5',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <X size={13} /> Reject Order
                            </button>
                          </div>
                        ) : isAssignedPendingAcceptance ? (
                          <div style={{
                            fontSize: '0.72rem',
                            color: '#b45309',
                            fontWeight: 700,
                            backgroundColor: '#fffbeb',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #fde68a',
                            display: 'inline-block'
                          }}>
                            ⏳ Waiting Acceptance ({order.assignedTailor?.name || 'Tailor'})
                          </div>
                        ) : nextInfo ? (
                          <button
                            onClick={() => handleAdvanceStatus(order.id, nextInfo.nextStatus)}
                            disabled={isUpdating}
                            title={`Advance order to ${nextInfo.label}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '7px 14px',
                              borderRadius: '8px',
                              backgroundColor: nextInfo.bg,
                              color: nextInfo.text,
                              border: `1.5px solid ${nextInfo.border}`,
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              cursor: isUpdating ? 'wait' : 'pointer',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {isUpdating ? (
                              'Updating...'
                            ) : (
                              <>
                                <span>{nextInfo.buttonText}</span>
                                <ArrowRight size={14} />
                              </>
                            )}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        )}

                        {order.status === 'READY' && order.customer?.primaryPhone && (
                          <div style={{ marginTop: '6px' }}>
                            <a
                              href={`https://wa.me/${normalizePhoneForWhatsApp(order.customer.primaryPhone)}?text=${encodeURIComponent(generateOrderReadyWhatsAppMessage(order))}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={async () => {
                                try {
                                  await fetch(`${API_URL}/api/orders/${order.id}/notify-ready`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
                                    },
                                    body: JSON.stringify({ force: false })
                                  });
                                  setOrders(prev => prev.map(o => o.id === order.id ? { ...o, readyNotificationSent: true, readyNotificationStatus: 'SENT', readyNotificationSentAt: new Date().toISOString() } : o));
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              title={order.readyNotificationSent ? `Delivered at ${order.readyNotificationSentAt ? new Date(order.readyNotificationSentAt).toLocaleString() : 'Earlier'} (Duplicate protected)` : 'Send WhatsApp Ready notification to customer'}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                backgroundColor: order.readyNotificationSent ? '#15803d' : '#22c55e',
                                color: '#ffffff',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              <MessageCircle size={12} />
                              {order.readyNotificationSent ? '✓ WA Delivered' : 'Send WA Ready'}
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Details / Specs / Invoice Trigger */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => setSelectedOrderForSpecs(order)}
                            title="View Garment Specifications"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              backgroundColor: '#eff6ff',
                              color: '#1e40af',
                              border: '1px solid #bfdbfe',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            <Ruler size={13} /> Specs
                          </button>
                          {user?.role !== 'TAILOR' && (
                            <button
                              onClick={() => setSelectedOrderForInvoice(order)}
                              title="View Digital Invoice"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                backgroundColor: '#f1f5f9',
                                color: '#334155',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <FileText size={13} /> Invoice
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

          {/* MOBILE CARDS VIEW (Clean, stacked, touch-friendly for small screens) */}
          <div className="production-mobile-cards">
            {displayedOrders.map((order) => {
              const colors = getStatusColors(order.status);
              const nextInfo = getNextStageInfo(order);
              const isUpdating = updatingOrderId === order.id;
              const aariNeeded = isAariRequired(order);
              const fittingNeeded = isFittingRequired(order);
              const isAssignedPendingAcceptance = Boolean(order.assignedTailorId && !order.tailorAccepted);
              const isMyPendingAcceptance = Boolean(
                user?.role === 'TAILOR'
                  ? (Number(order.assignedTailorId) === Number(user?.id) && !order.tailorAccepted)
                  : (!order.tailorAccepted && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role) && order.assignedTailorId)
              );

              return (
                <div key={order.id} className="erp-mobile-order-card">
                  {/* Card Header: Order Number, Date & Branch */}
                  <div className="erp-mobile-card-row">
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--jb-navy-light)' }}>
                        {order.orderNumber || `ORD-${order.id}`}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        {new Date(order.orderDate).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="badge badge-navy" style={{ fontSize: '0.72rem' }}>
                      {order.branch?.name || 'Main Branch'}
                    </span>
                  </div>

                  {/* Customer Information */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#0a192f', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, flexShrink: 0 }}>
                      {order.customer?.name ? order.customer.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.customer?.name || 'Customer'}
                      </div>
                      {order.customer?.primaryPhone && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {order.customer.primaryPhone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Garment Details & Stage Badges */}
                  <div style={{ backgroundColor: 'var(--bg-main)', padding: '10px 12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                      {order.garmentDetails?.dressType || 'Custom Garment'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--bg-card)', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, border: '1px solid var(--border-color)' }}>
                        Qty: {order.garmentDetails?.quantity || 1}
                      </span>
                      {aariNeeded && (
                        <span style={{ fontSize: '0.7rem', backgroundColor: '#EDE9FE', color: '#6D28D9', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          ★ Aari Work
                        </span>
                      )}
                      {fittingNeeded && (
                        <span style={{ fontSize: '0.7rem', backgroundColor: '#FDF4FF', color: '#7E22CE', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          Fitting Needed
                        </span>
                      )}
                      {order.assignedTailor && (
                        <span style={{ fontSize: '0.7rem', backgroundColor: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          Tailor: {order.assignedTailor.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Current Status Row */}
                  <div className="erp-mobile-card-row">
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status:</span>
                    <div>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        backgroundColor: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`
                      }}>
                        {getStatusLabel(order.status)}
                      </span>
                      {isAssignedPendingAcceptance && (
                        <div style={{
                          marginTop: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.7rem',
                          color: '#b45309',
                          fontWeight: 800,
                          backgroundColor: '#fef3c7',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid #fde68a'
                        }}>
                          ⏳ WAITING ACCEPTANCE
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Touch-Friendly Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    {order.status === 'DELIVERED' ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: '#BBF7D0',
                        color: '#14532D',
                        fontSize: '0.82rem',
                        fontWeight: 800
                      }}>
                        <CheckCircle size={16} /> Completed & Delivered
                      </div>
                    ) : isMyPendingAcceptance ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button
                          onClick={() => handleTailorAccept(order.id)}
                          disabled={submittingAction}
                          className="touch-target-btn"
                          style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none' }}
                        >
                          <Check size={16} /> Accept Order
                        </button>
                        <button
                          onClick={() => {
                            setRejectingOrder(order);
                            setRejectionReasonText('');
                          }}
                          disabled={submittingAction}
                          className="touch-target-btn"
                          style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                        >
                          <X size={16} /> Reject Order
                        </button>
                      </div>
                    ) : isAssignedPendingAcceptance ? (
                      <div style={{
                        fontSize: '0.78rem',
                        color: '#b45309',
                        fontWeight: 700,
                        backgroundColor: '#fffbeb',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #fde68a',
                        textAlign: 'center'
                      }}>
                        ⏳ Waiting Acceptance ({order.assignedTailor?.name || 'Tailor'})
                      </div>
                    ) : nextInfo ? (
                      <button
                        onClick={() => handleAdvanceStatus(order.id, nextInfo.nextStatus)}
                        disabled={isUpdating}
                        className="touch-target-btn"
                        style={{
                          backgroundColor: nextInfo.bg,
                          color: nextInfo.text,
                          border: `1.5px solid ${nextInfo.border}`
                        }}
                      >
                        {isUpdating ? 'Updating...' : (
                          <>
                            <span>Advance: {nextInfo.buttonText}</span>
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    ) : null}

                    {/* WhatsApp Ready Notification Button */}
                    {order.status === 'READY' && order.customer?.primaryPhone && (
                      <a
                        href={`https://wa.me/${normalizePhoneForWhatsApp(order.customer.primaryPhone)}?text=${encodeURIComponent(generateOrderReadyWhatsAppMessage(order))}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={async () => {
                          try {
                            await fetch(`${API_URL}/api/orders/${order.id}/notify-ready`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
                              },
                              body: JSON.stringify({ force: false })
                            });
                            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, readyNotificationSent: true, readyNotificationStatus: 'SENT', readyNotificationSentAt: new Date().toISOString() } : o));
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="touch-target-btn"
                        style={{
                          backgroundColor: order.readyNotificationSent ? '#15803d' : '#22c55e',
                          color: '#ffffff',
                          fontSize: '0.78rem',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          minHeight: '38px'
                        }}
                      >
                        <MessageCircle size={15} />
                        {order.readyNotificationSent ? '✓ WhatsApp Delivered (JB GROUP)' : 'Send WA Ready (JB GROUP)'}
                      </a>
                    )}

                    {/* Secondary Actions: Specs & Invoice */}
                    <div style={{ display: 'grid', gridTemplateColumns: user?.role !== 'TAILOR' ? '1fr 1fr' : '1fr', gap: '8px' }}>
                      <button
                        onClick={() => setSelectedOrderForSpecs(order)}
                        className="touch-target-btn"
                        style={{
                          backgroundColor: '#eff6ff',
                          color: '#1e40af',
                          border: '1px solid #bfdbfe',
                          minHeight: '38px',
                          padding: '6px 12px'
                        }}
                      >
                        <Ruler size={15} /> Garment Specs
                      </button>
                      {user?.role !== 'TAILOR' && (
                        <button
                          onClick={() => setSelectedOrderForInvoice(order)}
                          className="touch-target-btn"
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            minHeight: '38px',
                            padding: '6px 12px'
                          }}
                        >
                          <FileText size={15} /> Digital Invoice
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>

      {/* Garment Specifications Modal (For Tailor & Workshop) */}
      {selectedOrderForSpecs && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(10, 25, 47, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1050,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isFullAccess && selectedOrderForSpecs.customer?.profilePhoto ? (
                  <img
                    src={getImageUrl(selectedOrderForSpecs.customer.profilePhoto)}
                    alt=""
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #cbd5e1', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0a192f', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, flexShrink: 0 }}>
                    {selectedOrderForSpecs.customer?.name ? selectedOrderForSpecs.customer.name.charAt(0).toUpperCase() : 'C'}
                  </div>
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--jb-navy)' }}>
                    Garment Technical Sheet: {selectedOrderForSpecs.orderNumber}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Customer: {selectedOrderForSpecs.customer?.name} • Due: {selectedOrderForSpecs.garmentDetails?.deliveryDate ? new Date(selectedOrderForSpecs.garmentDetails.deliveryDate).toLocaleDateString() : 'Standard'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForSpecs(null)}
                style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            {/* Waiting Acceptance Banner inside Specs Modal */}
            {Boolean(selectedOrderForSpecs.assignedTailorId && !selectedOrderForSpecs.tailorAccepted && (Number(selectedOrderForSpecs.assignedTailorId) === Number(user?.id) || ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role))) && (
              <div style={{
                backgroundColor: '#fffbeb',
                border: '2px solid #f59e0b',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.9rem' }}>
                    ⏳ WAITING ACCEPTANCE
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#b45309' }}>
                    This order is assigned to you. Review garment technical specs and accept to start Cutting.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      handleTailorAccept(selectedOrderForSpecs.id);
                      setSelectedOrderForSpecs(null);
                    }}
                    disabled={submittingAction}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    <Check size={14} /> Accept Order
                  </button>
                  <button
                    onClick={() => {
                      const ord = selectedOrderForSpecs;
                      setSelectedOrderForSpecs(null);
                      setRejectingOrder(ord);
                      setRejectionReasonText('');
                    }}
                    disabled={submittingAction}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <X size={14} /> Reject Order
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Dress Type</span>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                  {selectedOrderForSpecs.garmentDetails?.dressType || 'Custom'} (Qty: {selectedOrderForSpecs.garmentDetails?.quantity || 1})
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Fabric Details</span>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {selectedOrderForSpecs.garmentDetails?.fabricType || 'Standard'} • Color: {selectedOrderForSpecs.garmentDetails?.fabricColour || 'As Requested'}
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Lining & Padding</span>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  Lining: {selectedOrderForSpecs.garmentDetails?.lining ? 'Yes' : 'No'} • Padding: {selectedOrderForSpecs.garmentDetails?.padding ? 'Yes' : 'No'}
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Work / Embroidery</span>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {selectedOrderForSpecs.garmentDetails?.workRequired ? `Yes (${selectedOrderForSpecs.garmentDetails.workDetails || 'Aari'})` : 'No Work Required'}
                </div>
              </div>
            </div>

            {/* Special Instructions */}
            {selectedOrderForSpecs.garmentDetails?.specialDesignInstructions && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Tailor Instructions
                </div>
                <div style={{ fontSize: '0.85rem', color: '#7f1d1d' }}>
                  {selectedOrderForSpecs.garmentDetails.specialDesignInstructions}
                </div>
              </div>
            )}

            {/* Measurements (Required for stitching) */}
            {selectedOrderForSpecs.garmentDetails?.measurements &&
             typeof selectedOrderForSpecs.garmentDetails.measurements === 'object' &&
             Object.keys(selectedOrderForSpecs.garmentDetails.measurements).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 800, color: 'var(--jb-navy)' }}>
                  Customer Measurements ({selectedOrderForSpecs.garmentDetails?.measurementUnit || 'Inches'}{selectedOrderForSpecs.garmentDetails?.fitPreference ? ` • ${selectedOrderForSpecs.garmentDetails.fitPreference} Fit` : ''})
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                  {Object.entries(selectedOrderForSpecs.garmentDetails.measurements).map(([key, val]) => (
                    <div key={key} style={{ backgroundColor: '#f1f5f9', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#64748b', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>{String(val)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Design Reference Photo */}
            {(selectedOrderForSpecs.garmentDetails?.designReferencePhoto || selectedOrderForSpecs.garmentDetails?.designReferenceImage) && (
              <div style={{ marginBottom: '16px' }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 800, color: 'var(--jb-navy)' }}>
                  Primary Design Reference Photo
                </h5>
                <a
                  href={getImageUrl(selectedOrderForSpecs.garmentDetails.designReferencePhoto || selectedOrderForSpecs.garmentDetails.designReferenceImage)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={getImageUrl(selectedOrderForSpecs.garmentDetails.designReferencePhoto || selectedOrderForSpecs.garmentDetails.designReferenceImage)}
                    alt="Design Reference"
                    style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid #cbd5e1', objectFit: 'contain', backgroundColor: '#f8fafc' }}
                  />
                </a>
              </div>
            )}

            {/* Additional Reference Photos */}
            {selectedOrderForSpecs.garmentDetails?.additionalImages && Array.isArray(selectedOrderForSpecs.garmentDetails.additionalImages) && selectedOrderForSpecs.garmentDetails.additionalImages.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 800, color: 'var(--jb-navy)' }}>
                  Additional Design References ({selectedOrderForSpecs.garmentDetails.additionalImages.length})
                </h5>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedOrderForSpecs.garmentDetails.additionalImages.map((imgUrl, i) => (
                    <a key={i} href={getImageUrl(imgUrl)} target="_blank" rel="noopener noreferrer">
                      <img
                        src={getImageUrl(imgUrl)}
                        alt={`Additional ref ${i + 1}`}
                        style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1.5px solid #cbd5e1' }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                onClick={() => setSelectedOrderForSpecs(null)}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Close Technical Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tailor Assignment Rejection Modal */}
      {rejectingOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(10, 25, 47, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
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
              Reject Assignment for {rejectingOrder.orderNumber}?
            </h3>
            <p style={{ margin: '8px 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
              The order will be returned to the CEO/Manager production queue so another tailor can be assigned. Please state the reason (e.g., workload capacity, missing pattern/fabric):
            </p>

            <textarea
              rows={3}
              value={rejectionReasonText}
              onChange={(e) => setRejectionReasonText(e.target.value)}
              placeholder="Enter reason for rejecting this assignment..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                marginBottom: '16px'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setRejectingOrder(null);
                  setRejectionReasonText('');
                }}
                disabled={submittingAction}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleTailorReject}
                disabled={submittingAction || !rejectionReasonText.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {submittingAction ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Invoice Modal */}
      <DigitalInvoiceModal
        order={selectedOrderForInvoice}
        isOpen={Boolean(selectedOrderForInvoice)}
        onClose={() => setSelectedOrderForInvoice(null)}
      />
    </div>
  );
};
