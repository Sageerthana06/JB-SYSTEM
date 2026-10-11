import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL, getImageUrl } from '../config/api';
import {
  Scissors,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  LogOut,
  User,
  Calendar,
  Layers,
  Sparkles,
  Search,
  Check,
  X,
  FileText,
  Ruler,
  Building,
  ShieldCheck,
  MessageCircle,
  Eye,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import {
  getStatusLabel,
  getStatusColors,
  getNextStageInfo
} from '../utils/orderStatus';

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

  return `Dear ${customerName},\n\nYour order ${orderNumber} from JB GROUP is now ready for collection.\n\nThank you for choosing JB GROUP!`;
};

export const TailorDashboard = () => {
  const { user, logout, getAuthHeaders } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'attendance'
  const [stageFilter, setStageFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForSpecs, setSelectedOrderForSpecs] = useState(null);
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Attendance state
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceFeedback, setAttendanceFeedback] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Tailor's own assigned orders
  const fetchMyOrders = async () => {
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
        setError(data.message || 'Failed to fetch your assigned orders.');
      }
    } catch (err) {
      console.error('Tailor orders fetch error:', err);
      setError('Unable to connect to order server. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Tailor's own attendance
  const fetchMyAttendance = async () => {
    try {
      setAttendanceLoading(true);
      const token = localStorage.getItem('jb_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Today
      const todayRes = await fetch(`${API_URL}/api/attendance/my-today`, { headers });
      const todayData = await todayRes.json();
      if (todayData.success && todayData.data) {
        const d = todayData.data;
        d.inTime = d.inTime || d.checkIn;
        d.outTime = d.outTime || d.checkOut;
        if (d.inTime && d.outTime) d.workingHours = ((new Date(d.outTime) - new Date(d.inTime)) / (1000 * 60 * 60)).toFixed(1);
        setTodayAttendance(d);
      } else {
        setTodayAttendance(null);
      }

      // History
      const histRes = await fetch(`${API_URL}/api/attendance/my-history`, { headers });
      const histData = await histRes.json();
      if (histData.success && Array.isArray(histData.records)) {
        const mapped = histData.records.map(r => {
          r.inTime = r.inTime || r.checkIn;
          r.outTime = r.outTime || r.checkOut;
          if (r.inTime && r.outTime) r.workingHours = ((new Date(r.outTime) - new Date(r.inTime)) / (1000 * 60 * 60)).toFixed(1);
          return r;
        });
        setAttendanceHistory(mapped);
      }
    } catch (err) {
      console.error('Tailor attendance fetch error:', err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    fetchMyOrders();
    fetchMyAttendance();
  }, [user?.id]);

  // Clock In Action
  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      setAttendanceFeedback(null);
      const token = localStorage.getItem('jb_token');
      const res = await fetch(`${API_URL}/api/attendance/clock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data;
        d.inTime = d.inTime || d.checkIn;
        d.outTime = d.outTime || d.checkOut;
        if (d.inTime && d.outTime) d.workingHours = ((new Date(d.outTime) - new Date(d.inTime)) / (1000 * 60 * 60)).toFixed(1);
        setTodayAttendance(d);
        setAttendanceFeedback({ type: 'success', message: '✓ Clocked in successfully! Have a productive day.' });
        fetchMyAttendance();
      } else {
        setAttendanceFeedback({ type: 'error', message: data.message || 'Clock-in failed.' });
      }
    } catch (err) {
      setAttendanceFeedback({ type: 'error', message: 'Network error recording clock-in.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Check Out Action
  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      setAttendanceFeedback(null);
      const token = localStorage.getItem('jb_token');
      const res = await fetch(`${API_URL}/api/attendance/clock-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data;
        d.inTime = d.inTime || d.checkIn;
        d.outTime = d.outTime || d.checkOut;
        if (d.inTime && d.outTime) d.workingHours = ((new Date(d.outTime) - new Date(d.inTime)) / (1000 * 60 * 60)).toFixed(1);
        setTodayAttendance(d);
        setAttendanceFeedback({ type: 'success', message: '✓ Checked out successfully. Good job today!' });
        fetchMyAttendance();
      } else {
        setAttendanceFeedback({ type: 'error', message: data.message || 'Check-out failed.' });
      }
    } catch (err) {
      setAttendanceFeedback({ type: 'error', message: 'Network error recording check-out.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Accept Order Assignment
  const handleAcceptOrder = async (orderId) => {
    try {
      setUpdatingOrderId(orderId);
      const token = localStorage.getItem('jb_token');
      const res = await fetch(`${API_URL}/api/orders/${orderId}/tailor-accept`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, ...(data.order || {}), tailorAccepted: true, status: 'IN_PROGRESS' } : o)));
      } else {
        alert(data.message || 'Failed to accept order');
      }
    } catch (err) {
      alert('Network error accepting order');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Reject Order Assignment
  const handleRejectOrder = async () => {
    if (!rejectingOrder) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a brief reason for declining this order assignment.');
      return;
    }
    try {
      setSubmittingAction(true);
      const token = localStorage.getItem('jb_token');
      const res = await fetch(`${API_URL}/api/orders/${rejectingOrder.id}/tailor-reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rejectionReason.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.filter(o => o.id !== rejectingOrder.id));
        setRejectingOrder(null);
        setRejectionReason('');
      } else {
        alert(data.message || 'Failed to reject order');
      }
    } catch (err) {
      alert('Network error rejecting order');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Advance Order Workflow Stage (Cutting -> Stitching -> Finishing -> Ready)
  const handleAdvanceStatus = async (orderId, targetStatus) => {
    try {
      setUpdatingOrderId(orderId);
      const token = localStorage.getItem('jb_token');
      const res = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      const data = await res.json();
      if (data.success) {
        const updated = data.order || {};
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, ...updated, status: targetStatus } : o)));

        // If marked READY, open WhatsApp message to notify customer
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
      alert('Network error updating order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Computed Personal KPIs
  const totalAssigned = orders.length;
  const pendingAcceptanceCount = orders.filter(o => !o.tailorAccepted && !['DELIVERED', 'COMPLETED', 'READY'].includes(o.status)).length;
  const inProgressCount = orders.filter(o => o.tailorAccepted && ['IN_PROGRESS', 'CUTTING', 'STITCHING', 'AARI_EMBROIDERY', 'FITTING_ALTERATION', 'FINISHING', 'QUALITY_CHECK'].includes(o.status)).length;
  const readyCompletedCount = orders.filter(o => ['READY', 'DELIVERED', 'COMPLETED'].includes(o.status)).length;

  // Filtered Orders
  const displayedOrders = orders.filter(o => {
    // Stage Filter
    if (stageFilter === 'WAITING_ACCEPTANCE') {
      if (o.tailorAccepted || ['READY', 'DELIVERED', 'COMPLETED'].includes(o.status)) return false;
    } else if (stageFilter === 'IN_PROGRESS') {
      if (!o.tailorAccepted || !['IN_PROGRESS', 'CUTTING', 'STITCHING', 'AARI_EMBROIDERY', 'FITTING_ALTERATION', 'FINISHING', 'QUALITY_CHECK'].includes(o.status)) return false;
    } else if (stageFilter === 'READY') {
      if (!['READY', 'DELIVERED', 'COMPLETED'].includes(o.status)) return false;
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNo = (o.orderNumber || '').toLowerCase().includes(q);
      const matchDress = (o.garmentDetails?.dressType || '').toLowerCase().includes(q);
      const matchCust = (o.customer?.name || '').toLowerCase().includes(q);
      return matchNo || matchDress || matchCust;
    }

    return true;
  });

  const isClockedIn = Boolean(todayAttendance && todayAttendance.inTime && !todayAttendance.outTime);
  const isCompletedToday = Boolean(todayAttendance && todayAttendance.outTime);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1e293b', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <header style={{
        backgroundColor: '#0a192f',
        color: '#ffffff',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '2px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src="/jb_group_logo.png"
            alt="JB GROUP"
            style={{
              height: '38px',
              backgroundColor: '#ffffff',
              borderRadius: '6px',
              padding: '3px'
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '0.5px', color: '#ffffff' }}>
                JB GROUP
              </span>
              <span style={{
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '999px',
                textTransform: 'uppercase'
              }}>
                Craftsman Portal
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Tailoring & Garment Workshop System
            </div>
          </div>
        </div>

        {/* User Info & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '6px 14px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {(user?.name || 'T')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                {user?.name || 'Tailor Craftsman'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
                {user?.branch?.name || 'JB Group (Main)'} • Tailor
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#fca5a5'; }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{ flex: 1, padding: '24px 28px', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* Attendance Banner / Live Clock Strip */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          {/* Welcome & Live Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Scissors size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Welcome back, {user?.name || 'Tailor'}
              </h1>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={13} />
                <span>{currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span>•</span>
                <Clock size={13} />
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Attendance Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {todayAttendance?.inTime && (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                color: '#166534',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle size={15} color="#16a34a" />
                <span>Clocked In: {new Date(todayAttendance.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}

            {todayAttendance?.outTime && (
              <div style={{
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                color: '#334155',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Clock size={15} color="#64748b" />
                <span>Clocked Out: {new Date(todayAttendance.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}

            {!isClockedIn && !isCompletedToday && (
              <button
                onClick={handleClockIn}
                disabled={actionLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(22,163,74,0.3)',
                  transition: 'all 0.15s ease'
                }}
              >
                <CheckCircle size={16} />
                <span>Clock In Now</span>
              </button>
            )}

            {isClockedIn && (
              <button
                onClick={handleCheckOut}
                disabled={actionLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  backgroundColor: '#ea580c',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(234,88,12,0.3)',
                  transition: 'all 0.15s ease'
                }}
              >
                <LogOut size={16} />
                <span>Check Out / Day Done</span>
              </button>
            )}
          </div>
        </div>

        {/* Attendance Feedback Alert */}
        {attendanceFeedback && (
          <div style={{
            padding: '10px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            backgroundColor: attendanceFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: attendanceFeedback.type === 'success' ? '#15803d' : '#dc2626',
            border: `1px solid ${attendanceFeedback.type === 'success' ? '#86efac' : '#fca5a5'}`,
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{attendanceFeedback.message}</span>
            <button
              onClick={() => setAttendanceFeedback(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Personal Overview Stat Cards (No company sales, ONLY tailor's personal workload) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Card 1: Total Assigned */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '18px 20px',
            borderLeft: '4px solid #3b82f6',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
              My Assigned Garments
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
              {totalAssigned}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
              Assigned directly to you
            </div>
          </div>

          {/* Card 2: Waiting Acceptance */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '18px 20px',
            borderLeft: `4px solid ${pendingAcceptanceCount > 0 ? '#f59e0b' : '#94a3b8'}`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
              Waiting My Acceptance
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: pendingAcceptanceCount > 0 ? '#b45309' : '#0f172a', marginTop: '6px' }}>
              {pendingAcceptanceCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: pendingAcceptanceCount > 0 ? '#b45309' : '#64748b', marginTop: '4px', fontWeight: 700 }}>
              {pendingAcceptanceCount > 0 ? 'Requires your acceptance to begin' : 'All assignments accepted'}
            </div>
          </div>

          {/* Card 3: In Production */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '18px 20px',
            borderLeft: '4px solid #8b5cf6',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
              Active Cutting & Stitching
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#6d28d9', marginTop: '6px' }}>
              {inProgressCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
              Garments in progress right now
            </div>
          </div>

          {/* Card 4: Finished / Ready */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '18px 20px',
            borderLeft: '4px solid #10b981',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
              Finished / Ready
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#047857', marginTop: '6px' }}>
              {readyCompletedCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '4px', fontWeight: 700 }}>
              Completed & ready for collection
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              fontSize: '0.925rem',
              fontWeight: 800,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'orders' ? '3px solid #0a192f' : '3px solid transparent',
              color: activeTab === 'orders' ? '#0a192f' : '#64748b',
              marginBottom: '-2px',
              transition: 'all 0.15s ease'
            }}
          >
            <Scissors size={18} />
            <span>My Production Orders ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              fontSize: '0.925rem',
              fontWeight: 800,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'attendance' ? '3px solid #0a192f' : '3px solid transparent',
              color: activeTab === 'attendance' ? '#0a192f' : '#64748b',
              marginBottom: '-2px',
              transition: 'all 0.15s ease'
            }}
          >
            <Clock size={18} />
            <span>My Attendance & Hours Log</span>
          </button>
        </div>

        {/* TAB 1: MY PRODUCTION ORDERS */}
        {activeTab === 'orders' && (
          <div>
            {/* Filter Pills and Search Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '18px'
            }}>
              {/* Stage Pills */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: `All My Orders (${orders.length})` },
                  { id: 'WAITING_ACCEPTANCE', label: `⏳ Waiting Acceptance (${pendingAcceptanceCount})` },
                  { id: 'IN_PROGRESS', label: `✂️ In Progress (${inProgressCount})` },
                  { id: 'READY', label: `✅ Finished / Ready (${readyCompletedCount})` }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setStageFilter(p.id)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      border: stageFilter === p.id ? '2px solid #0a192f' : '1px solid #cbd5e1',
                      backgroundColor: stageFilter === p.id ? '#0a192f' : '#ffffff',
                      color: stageFilter === p.id ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div style={{ position: 'relative', minWidth: '260px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search order no, dress, customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Orders Loading */}
            {loading && (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '48px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <RefreshCw size={28} className="animate-spin" style={{ color: '#0a192f', margin: '0 auto 12px auto' }} />
                <p style={{ color: '#64748b', fontWeight: 600 }}>Loading your assigned orders...</p>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px', textAlign: 'center', border: '1px solid #fca5a5' }}>
                <AlertCircle size={32} color="#dc2626" style={{ margin: '0 auto 12px auto' }} />
                <h3 style={{ fontSize: '1rem', color: '#991b1b', margin: '0 0 6px 0' }}>{error}</h3>
                <button
                  onClick={fetchMyOrders}
                  style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#0a192f', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && displayedOrders.length === 0 && (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '60px 24px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#f1f5f9',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}>
                  <Scissors size={28} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', margin: '0 0 8px 0' }}>
                  No garments match this filter.
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                  When Manager or CEO assigns new garments to you, they will appear right here.
                </p>
              </div>
            )}

            {/* Orders Cards Grid */}
            {!loading && !error && displayedOrders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {displayedOrders.map(order => {
                  const statusColors = getStatusColors(order.status);
                  const isPendingAccept = !order.tailorAccepted;
                  const gDetails = order.garmentDetails || {};
                  const isUpdating = updatingOrderId === order.id;

                  // Determine next workflow action for tailor
                  let nextAction = null;
                  if (order.status === 'IN_PROGRESS' || order.status === 'TAILOR_ASSIGNED' || order.status === 'ORDER_CONFIRMED') {
                    nextAction = { targetStatus: 'CUTTING', label: 'Start Cutting ✂️', bg: '#2563eb', text: '#ffffff' };
                  } else if (order.status === 'CUTTING') {
                    nextAction = { targetStatus: 'STITCHING', label: 'Complete Cutting & Stitch 🧵', bg: '#7c3aed', text: '#ffffff' };
                  } else if (order.status === 'STITCHING') {
                    nextAction = { targetStatus: 'FINISHING', label: 'Move to Finishing / QC ✨', bg: '#d97706', text: '#ffffff' };
                  } else if (order.status === 'FINISHING' || order.status === 'QUALITY_CHECK') {
                    nextAction = { targetStatus: 'READY', label: 'Finish Garment → Mark Ready 🎉', bg: '#16a34a', text: '#ffffff' };
                  }

                  return (
                    <div
                      key={order.id}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '14px',
                        border: isPendingAccept ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                        padding: '20px 22px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Top Order Row */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: '12px',
                        paddingBottom: '14px',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                            {order.orderNumber || `ORD-${order.id}`}
                          </span>
                          <span style={{
                            backgroundColor: statusColors.bg,
                            color: statusColors.text,
                            border: `1px solid ${statusColors.border}`,
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 800
                          }}>
                            {getStatusLabel(order.status)}
                          </span>

                          {isPendingAccept && (
                            <span style={{
                              backgroundColor: '#fffbeb',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 800
                            }}>
                              ⏳ New Assignment Waiting Acceptance
                            </span>
                          )}
                        </div>

                        {/* Customer & Branch info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', color: '#64748b' }}>
                          <span>Customer: <strong style={{ color: '#0f172a' }}>{order.customer?.name || 'Customer'}</strong></span>
                          <span>•</span>
                          <span>Branch: <strong style={{ color: '#0f172a' }}>{order.branch?.name || 'Main Branch'}</strong></span>
                          <span>•</span>
                          <span>Date: {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>

                      {/* Middle Garment Details Row */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '14px',
                        padding: '14px 0',
                        fontSize: '0.85rem'
                      }}>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Garment / Dress Type</div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem', marginTop: '3px' }}>
                            {gDetails.dressType || 'Bespoke Garment'} (Qty: {gDetails.quantity || 1})
                          </div>
                        </div>

                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Fabric & Occasion</div>
                          <div style={{ fontWeight: 600, color: '#334155', marginTop: '3px' }}>
                            {gDetails.fabricType || 'Supplied'} {gDetails.fabricColour ? `(${gDetails.fabricColour})` : ''} • {gDetails.occasion || 'Standard'}
                          </div>
                        </div>

                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Special Work / Alteration</div>
                          <div style={{ fontWeight: 600, color: '#334155', marginTop: '3px' }}>
                            {gDetails.workDetails || (gDetails.workRequired ? 'Work Required' : 'None')}
                          </div>
                        </div>
                      </div>

                      {/* Instructions if any */}
                      {gDetails.specialDesignInstructions && (
                        <div style={{
                          backgroundColor: '#f8fafc',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.82rem',
                          color: '#334155',
                          marginBottom: '14px'
                        }}>
                          <strong>📌 Craftsman Instructions:</strong> {gDetails.specialDesignInstructions}
                        </div>
                      )}

                      {/* Bottom Action Bar */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #f1f5f9'
                      }}>
                        {/* Specs & Measurements Modal Button */}
                        <button
                          onClick={() => setSelectedOrderForSpecs(order)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 14px',
                            borderRadius: '8px',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Ruler size={15} color="#2563eb" />
                          <span>View Body Measurements & Reference Photos 📐</span>
                        </button>

                        {/* Tailor Workflow Controls */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {/* If Waiting for Acceptance: Show Accept and Decline buttons */}
                          {isPendingAccept && (
                            <>
                              <button
                                onClick={() => handleAcceptOrder(order.id)}
                                disabled={isUpdating}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '8px 16px',
                                  borderRadius: '8px',
                                  backgroundColor: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '0.82rem',
                                  fontWeight: 800,
                                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                                  boxShadow: '0 2px 4px rgba(22,163,74,0.2)'
                                }}
                              >
                                <Check size={15} />
                                <span>Accept Order</span>
                              </button>

                              <button
                                onClick={() => setRejectingOrder(order)}
                                disabled={isUpdating}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '8px 14px',
                                  borderRadius: '8px',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fca5a5',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  cursor: isUpdating ? 'not-allowed' : 'pointer'
                                }}
                              >
                                <X size={15} />
                                <span>Decline</span>
                              </button>
                            </>
                          )}

                          {/* If Accepted: Show Next Stage Button */}
                          {!isPendingAccept && nextAction && (
                            <button
                              onClick={() => handleAdvanceStatus(order.id, nextAction.targetStatus)}
                              disabled={isUpdating}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                backgroundColor: nextAction.bg,
                                color: nextAction.text,
                                border: 'none',
                                fontSize: '0.84rem',
                                fontWeight: 800,
                                cursor: isUpdating ? 'not-allowed' : 'pointer',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                              }}
                            >
                              {isUpdating ? <RefreshCw size={15} className="animate-spin" /> : null}
                              <span>{nextAction.label}</span>
                            </button>
                          )}

                          {/* Completed / Ready indicator */}
                          {(order.status === 'READY' || order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              fontWeight: 800,
                              fontSize: '0.82rem'
                            }}>
                              <CheckCircle size={15} /> Garment Finished & Ready
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY ATTENDANCE & HOURS */}
        {activeTab === 'attendance' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Clock-In Card */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Clock size={20} color="#0a192f" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Today's Attendance Clock
                </h3>
              </div>

              <div style={{ textAlign: 'center', padding: '24px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '1px' }}>
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
                  {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>

              <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Status Today:</span>
                  <span style={{ fontWeight: 800, color: todayAttendance?.status === 'Present' ? '#16a34a' : '#64748b' }}>
                    {todayAttendance?.status || 'Not Marked Yet'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Clock-In Time:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {todayAttendance?.inTime ? new Date(todayAttendance.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Check-Out Time:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {todayAttendance?.outTime ? new Date(todayAttendance.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Hours Worked:</span>
                  <span style={{ fontWeight: 800, color: '#2563eb' }}>
                    {todayAttendance?.workingHours ? `${todayAttendance.workingHours} hrs` : '—'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                {!isClockedIn && !isCompletedToday && (
                  <button
                    onClick={handleClockIn}
                    disabled={attendanceLoading}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Clock In for Today
                  </button>
                )}

                {isClockedIn && (
                  <button
                    onClick={handleCheckOut}
                    disabled={attendanceLoading}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: '#ea580c',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Check Out / End Shift
                  </button>
                )}

                {isCompletedToday && (
                  <div style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}>
                    ✓ Shift Completed for Today
                  </div>
                )}
              </div>
            </div>

            {/* Attendance History */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Calendar size={20} color="#0a192f" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    My Past 14-Day Attendance Log
                  </h3>
                </div>
                <button
                  onClick={fetchMyAttendance}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <RefreshCw size={15} />
                </button>
              </div>

              {attendanceHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No past attendance history recorded yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '8px' }}>Date</th>
                        <th style={{ padding: '8px' }}>Status</th>
                        <th style={{ padding: '8px' }}>In Time</th>
                        <th style={{ padding: '8px' }}>Out Time</th>
                        <th style={{ padding: '8px' }}>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.slice(0, 14).map(rec => (
                        <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', fontWeight: 600 }}>{rec.date}</td>
                          <td style={{ padding: '8px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              backgroundColor: rec.status === 'Present' ? '#dcfce7' : '#fee2e2',
                              color: rec.status === 'Present' ? '#15803d' : '#dc2626'
                            }}>
                              {rec.status}
                            </span>
                          </td>
                          <td style={{ padding: '8px', color: '#334155' }}>
                            {rec.inTime ? new Date(rec.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ padding: '8px', color: '#334155' }}>
                            {rec.outTime ? new Date(rec.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ padding: '8px', fontWeight: 700, color: '#2563eb' }}>
                            {rec.workingHours ? `${rec.workingHours} hrs` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: VIEW BODY MEASUREMENTS & DESIGN SPECS */}
      {selectedOrderForSpecs && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  📐 Garment Measurements & Stitching Specs
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Order: <strong>{selectedOrderForSpecs.orderNumber || `ORD-${selectedOrderForSpecs.id}`}</strong> • Dress: <strong>{selectedOrderForSpecs.garmentDetails?.dressType}</strong>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForSpecs(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Measurements Grid */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '10px' }}>
                Body Measurement Points ({selectedOrderForSpecs.garmentDetails?.measurementUnit || 'Inches'})
              </h4>
              {selectedOrderForSpecs.garmentDetails?.measurements && Object.keys(selectedOrderForSpecs.garmentDetails.measurements).length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '10px',
                  backgroundColor: '#f8fafc',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}>
                  {Object.entries(selectedOrderForSpecs.garmentDetails.measurements).map(([k, v]) => (
                    <div key={k} style={{ backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                        {k.replace(/([A-Z])/g, ' $1')}
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                        {v} {selectedOrderForSpecs.garmentDetails?.measurementUnit || 'in'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>
                  Standard sizing or fabric supplied as-is. Check craftsman instructions.
                </div>
              )}
            </div>

            {/* Design Reference Image */}
            {selectedOrderForSpecs.garmentDetails?.designReferenceImage && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '10px' }}>
                  🖼️ Design Reference Photo
                </h4>
                <a
                  href={getImageUrl(selectedOrderForSpecs.garmentDetails.designReferenceImage)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={getImageUrl(selectedOrderForSpecs.garmentDetails.designReferenceImage)}
                    alt="Design Reference"
                    style={{
                      maxHeight: '260px',
                      maxWidth: '100%',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      objectFit: 'contain'
                    }}
                  />
                </a>
              </div>
            )}

            {/* Close Button */}
            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <button
                onClick={() => setSelectedOrderForSpecs(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#0a192f',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Close Specs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DECLINE / REJECT ORDER */}
      {rejectingOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '460px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 8px 0', color: '#dc2626' }}>
              Decline Order Assignment
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.4 }}>
              Decline order <strong>{rejectingOrder.orderNumber}</strong> back to management. Please enter a brief explanation (e.g. over capacity, fabric delay, specialized stitching needed).
            </p>
            <textarea
              rows={3}
              placeholder="Enter reason for declining..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
                marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => { setRejectingOrder(null); setRejectionReason(''); }}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRejectOrder}
                disabled={submittingAction}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '0.82rem' }}
              >
                {submittingAction ? 'Submitting...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
