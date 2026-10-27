import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL, getImageUrl } from '../config/api';
import {
  Scissors,
  Clock,
  CheckCircle,
  RefreshCw,
  LogOut,
  Calendar,
  Layers,
  Search,
  X,
  Ruler,
  PlayCircle,
  CheckCircle2,
  CreditCard
} from 'lucide-react';
import { TailorSalaryPanel } from './TailorSalaryPanel';
import {
  getStatusLabel,
  getStatusColors
} from '../utils/orderStatus';



const TASK_ICONS = {
  CUTTING: '✂️',
  AARI_EMBROIDERY: '✨',
  STITCHING: '🧵',
  FITTING_ALTERATION: '📐',
  FINISHING: '👔',
  QUALITY_CHECK: '🛡️'
};

export const TailorDashboard = () => {
  const { user, logout, getAuthHeaders } = useAuth();
  const [orders, setOrders] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [_error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'orders' | 'attendance'
  const [taskFilter, setTaskFilter] = useState('ALL'); // 'ALL' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'
  const [stageFilter, setStageFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForSpecs, setSelectedOrderForSpecs] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
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

  // Fetch Tailor's assigned production tasks
  const fetchMyTasks = async () => {
    try {
      setLoadingTasks(true);
      const res = await fetch(`${API_URL}/api/orders/tasks/my-tasks`, {
        headers: getAuthHeaders ? getAuthHeaders() : {
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error('Tailor tasks fetch error:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

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
    fetchMyTasks();
    fetchMyOrders();
    fetchMyAttendance();
  }, [user?.id]);

  // Update Task Status (ASSIGNED -> IN_PROGRESS -> COMPLETED) — NO ACCEPTANCE STEP
  const handleUpdateTaskStatus = async (taskId, targetStatus) => {
    try {
      setUpdatingTaskId(taskId);
      const token = localStorage.getItem('jb_token');
      const res = await fetch(`${API_URL}/api/orders/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      const data = await res.json();
      if (data.success) {
        setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...data.task, status: targetStatus } : t)));
        fetchMyOrders(); // refresh order statuses
      } else {
        alert(data.message || 'Failed to update task status');
      }
    } catch {
      alert('Network error updating task status');
    } finally {
      setUpdatingTaskId(null);
    }
  };

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
    } catch {
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
    } catch {
      setAttendanceFeedback({ type: 'error', message: 'Network error recording check-out.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Advance Order Workflow Stage (Direct — no acceptance required)
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
      } else {
        alert(data.message || 'Failed to update order status');
      }
    } catch {
      alert('Network error updating order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Computed Personal KPIs
  const assignedTasksCount = tasks.filter(t => t.status === 'ASSIGNED').length;
  const inProgressTasksCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const completedTasksCount = tasks.filter(t => t.status === 'COMPLETED').length;

  // Filtered Tasks
  const displayedTasks = tasks.filter(t => {
    if (taskFilter !== 'ALL' && t.status !== taskFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNo = (t.order?.orderNumber || '').toLowerCase().includes(q);
      const matchName = (t.taskName || '').toLowerCase().includes(q);
      const matchDress = (t.order?.garmentDetails?.dressType || '').toLowerCase().includes(q);
      const matchCust = (t.order?.customer?.name || '').toLowerCase().includes(q);
      return matchNo || matchName || matchDress || matchCust;
    }
    return true;
  });

  // Filtered Orders
  const displayedOrders = orders.filter(o => {
    if (stageFilter === 'IN_PROGRESS') {
      if (!['IN_PROGRESS', 'CUTTING', 'STITCHING', 'AARI_EMBROIDERY', 'FITTING_ALTERATION', 'FINISHING', 'QUALITY_CHECK'].includes(o.status)) return false;
    } else if (stageFilter === 'READY') {
      if (!['READY', 'DELIVERED', 'COMPLETED'].includes(o.status)) return false;
    }
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem'
            }}>
              {(user?.name || 'T')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff' }}>
                {user?.name || 'Master Craftsman'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                Role: {user?.role || 'TAILOR'} • {user?.branchName || 'Branch 1'}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Log Out"
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              backgroundColor: 'rgba(239,68,68,0.1)',
              transition: 'all 0.15s ease'
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* Welcome & Attendance Strip */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '18px 24px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#fee2e2',
              color: '#ef4444',
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

        {/* Feedback Alert */}
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

        {/* Workload Stat Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Card 1: Assigned Tasks */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '18px 20px',
            borderLeft: '4px solid #7c3aed',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
              Assigned Tasks (Ready)
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#6d28d9', marginTop: '6px' }}>
              {assignedTasksCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#7c3aed', marginTop: '4px', fontWeight: 700 }}>
              Immediate active tasks
            </div>
          </div>

          {/* Card 2: Tasks In Progress */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '18px 20px',
            borderLeft: '4px solid #2563eb',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
              In Progress
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1d4ed8', marginTop: '6px' }}>
              {inProgressTasksCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: '4px', fontWeight: 700 }}>
              Under active production
            </div>
          </div>

          {/* Card 3: Tasks Completed */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '18px 20px',
            borderLeft: '4px solid #10b981',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
              Tasks Completed
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#047857', marginTop: '6px' }}>
              {completedTasksCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '4px', fontWeight: 700 }}>
              Finished craftsmanship
            </div>
          </div>

          {/* Card 4: Total Garments */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '18px 20px',
            borderLeft: '4px solid #f59e0b',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
              Total Garments
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#b45309', marginTop: '6px' }}>
              {orders.length}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '4px', fontWeight: 700 }}>
              Bespoke customer orders
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
            onClick={() => setActiveTab('tasks')}
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
              borderBottom: activeTab === 'tasks' ? '3px solid #7c3aed' : '3px solid transparent',
              color: activeTab === 'tasks' ? '#7c3aed' : '#64748b',
              marginBottom: '-2px',
              transition: 'all 0.15s ease'
            }}
          >
            <Layers size={18} />
            <span>My Assigned Tasks ({tasks.length})</span>
          </button>

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
            <span>Full Garments ({orders.length})</span>
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

          <button
            onClick={() => setActiveTab('salary')}
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
              borderBottom: activeTab === 'salary' ? '3px solid #059669' : '3px solid transparent',
              color: activeTab === 'salary' ? '#059669' : '#64748b',
              marginBottom: '-2px',
              transition: 'all 0.15s ease'
            }}
          >
            <CreditCard size={18} />
            <span>My Salary &amp; Earnings</span>
          </button>
        </div>

        {/* TAB 1: MY ASSIGNED TASKS (TASK ASSIGNMENT ONLY - NO ACCEPTANCE STEP) */}
        {activeTab === 'tasks' && (
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
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', label: `All Tasks (${tasks.length})` },
                  { key: 'ASSIGNED', label: `Assigned — Ready (${assignedTasksCount})` },
                  { key: 'IN_PROGRESS', label: `In Progress (${inProgressTasksCount})` },
                  { key: 'COMPLETED', label: `Completed (${completedTasksCount})` }
                ].map(pill => (
                  <button
                    key={pill.key}
                    onClick={() => setTaskFilter(pill.key)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: taskFilter === pill.key ? '1px solid #7c3aed' : '1px solid #cbd5e1',
                      backgroundColor: taskFilter === pill.key ? '#7c3aed' : '#ffffff',
                      color: taskFilter === pill.key ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search tasks, order #, dress..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Tasks List */}
            {loadingTasks ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
                <div style={{ fontWeight: 700 }}>Loading your assigned production tasks...</div>
              </div>
            ) : displayedTasks.length === 0 ? (
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px dashed #cbd5e1',
                padding: '60px 20px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#f5f3ff',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}>
                  <Layers size={28} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', margin: '0 0 8px 0' }}>
                  No tasks match this filter.
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                  When CEO or Manager assigns production tasks (Cutting, Stitching, Aari, etc.) to you, they will immediately appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {displayedTasks.map(task => {
                  const ord = task.order || {};
                  const gDetails = ord.garmentDetails || {};
                  const isUpdating = updatingTaskId === task.id;
                  const taskIcon = TASK_ICONS[task.taskType] || '✂️';

                  return (
                    <div
                      key={task.id}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '14px',
                        border: task.status === 'ASSIGNED' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                        padding: '20px 22px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Top Row: Task Name & Order # */}
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
                          <span style={{ fontSize: '1.6rem' }}>{taskIcon}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                                {task.taskName}
                              </span>
                              <span style={{
                                backgroundColor: task.status === 'COMPLETED' ? '#dcfce7' : task.status === 'IN_PROGRESS' ? '#dbeafe' : '#f5f3ff',
                                color: task.status === 'COMPLETED' ? '#15803d' : task.status === 'IN_PROGRESS' ? '#1d4ed8' : '#6d28d9',
                                border: `1px solid ${task.status === 'COMPLETED' ? '#bbf7d0' : task.status === 'IN_PROGRESS' ? '#bfdbfe' : '#ddd6fe'}`,
                                padding: '3px 10px',
                                borderRadius: '999px',
                                fontSize: '0.76rem',
                                fontWeight: 800
                              }}>
                                {task.status === 'ASSIGNED' ? '⚡ ASSIGNED (Ready to Start)' : task.status}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                              Order: <strong style={{ color: '#0f172a' }}>{ord.orderNumber || `ORD-${ord.id}`}</strong> • {gDetails.dressType || 'Garment'} • Customer: <strong>{ord.customer?.name || 'Customer'}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Assigner Info */}
                        <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'right' }}>
                          <div>Assigned by: <strong>{task.assignedBy || 'Manager'}</strong></div>
                          <div>{task.assignedAt ? new Date(task.assignedAt).toLocaleDateString() : ''}</div>
                        </div>
                      </div>

                      {/* Middle Details */}
                      <div style={{ padding: '14px 0', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.82rem', color: '#334155' }}>
                        {gDetails.fabricType && (
                          <div>
                            <span style={{ color: '#64748b' }}>Fabric:</span> <strong>{gDetails.fabricType} {gDetails.fabricColour ? `(${gDetails.fabricColour})` : ''}</strong>
                          </div>
                        )}
                        {gDetails.occasion && (
                          <div>
                            <span style={{ color: '#64748b' }}>Occasion:</span> <strong>{gDetails.occasion}</strong>
                          </div>
                        )}
                        {task.notes && (
                          <div style={{ width: '100%', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#1e293b' }}>
                            <strong>📌 Instructions for this Task:</strong> {task.notes}
                          </div>
                        )}
                      </div>

                      {/* Bottom Controls — NO ACCEPT OR REJECT BUTTONS */}
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
                          onClick={() => setSelectedOrderForSpecs(ord)}
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

                        {/* Task Progression Action */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {task.status === 'ASSIGNED' && (
                            <button
                              onClick={() => handleUpdateTaskStatus(task.id, 'IN_PROGRESS')}
                              disabled={isUpdating}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 18px',
                                borderRadius: '8px',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '0.84rem',
                                fontWeight: 800,
                                cursor: isUpdating ? 'not-allowed' : 'pointer',
                                boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
                              }}
                            >
                              {isUpdating ? <RefreshCw size={15} className="animate-spin" /> : <PlayCircle size={15} />}
                              <span>Start Task 🚀</span>
                            </button>
                          )}

                          {task.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => handleUpdateTaskStatus(task.id, 'COMPLETED')}
                              disabled={isUpdating}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 18px',
                                borderRadius: '8px',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '0.84rem',
                                fontWeight: 800,
                                cursor: isUpdating ? 'not-allowed' : 'pointer',
                                boxShadow: '0 2px 6px rgba(22,163,74,0.25)'
                              }}
                            >
                              {isUpdating ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                              <span>Mark Task Completed ✓</span>
                            </button>
                          )}

                          {task.status === 'COMPLETED' && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 14px',
                              borderRadius: '8px',
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              fontWeight: 800,
                              fontSize: '0.82rem'
                            }}>
                              <CheckCircle size={16} />
                              <span>Completed {task.completedAt ? `on ${new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
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

        {/* TAB 2: FULL PRODUCTION ORDERS */}
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
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', label: `All Orders (${orders.length})` },
                  { key: 'IN_PROGRESS', label: `In Production (${orders.filter(o => ['IN_PROGRESS', 'CUTTING', 'STITCHING', 'AARI_EMBROIDERY', 'FITTING_ALTERATION', 'FINISHING', 'QUALITY_CHECK'].includes(o.status)).length})` },
                  { key: 'READY', label: `Ready for Collection (${orders.filter(o => ['READY', 'DELIVERED', 'COMPLETED'].includes(o.status)).length})` }
                ].map(pill => (
                  <button
                    key={pill.key}
                    onClick={() => setStageFilter(pill.key)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: stageFilter === pill.key ? '1px solid #0a192f' : '1px solid #cbd5e1',
                      backgroundColor: stageFilter === pill.key ? '#0a192f' : '#ffffff',
                      color: stageFilter === pill.key ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search order #, customer, dress..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Orders Cards Grid */}
            {!loading && displayedOrders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {displayedOrders.map(order => {
                  const statusColors = getStatusColors(order.status);
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
                        border: '1px solid #e2e8f0',
                        padding: '20px 22px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease'
                      }}
                    >
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
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', color: '#64748b' }}>
                          <span>Customer: <strong style={{ color: '#1e293b' }}>{order.customer?.name || 'Customer'}</strong></span>
                          <span>•</span>
                          <span>Branch: <strong style={{ color: '#1e293b' }}>{order.branch?.name || 'Main'}</strong></span>
                        </div>
                      </div>

                      {/* Middle Details */}
                      <div style={{ padding: '14px 0', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.82rem', color: '#334155' }}>
                        <div>
                          <span style={{ color: '#64748b' }}>Dress Type:</span> <strong>{gDetails.dressType || 'Bespoke Garment'} (Qty: {gDetails.quantity || 1})</strong>
                        </div>
                        {gDetails.fabricType && (
                          <div>
                            <span style={{ color: '#64748b' }}>Fabric:</span> <strong>{gDetails.fabricType} {gDetails.fabricColour ? `(${gDetails.fabricColour})` : ''}</strong>
                          </div>
                        )}
                        {order.tasks && order.tasks.length > 0 && (
                          <div style={{ width: '100%', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Assigned Tasks:</span>
                            {order.tasks.map(t => (
                              <span key={t.id} style={{
                                backgroundColor: t.status === 'COMPLETED' ? '#dcfce7' : t.status === 'IN_PROGRESS' ? '#dbeafe' : '#f5f3ff',
                                color: t.status === 'COMPLETED' ? '#15803d' : t.status === 'IN_PROGRESS' ? '#1d4ed8' : '#6d28d9',
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: 700
                              }}>
                                {t.taskName} ({t.assignedTailor?.name || 'Assigned'}) — {t.status}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bottom Controls */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #f1f5f9'
                      }}>
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

                        {/* Direct Next Action Button — No Accept/Reject Barrier */}
                        {nextAction && (
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
                            <CheckCircle size={15} />
                            <span>{order.status === 'DELIVERED' ? 'Delivered to Customer' : 'Ready for Collection'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ATTENDANCE & HOURS */}
        {activeTab === 'attendance' && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>
              Your Attendance History & Working Log
            </h3>
            {attendanceLoading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                <div>Loading attendance history...</div>
              </div>
            ) : attendanceHistory.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No attendance logs found for your account.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '10px 14px' }}>Date</th>
                      <th style={{ padding: '10px 14px' }}>Check In</th>
                      <th style={{ padding: '10px 14px' }}>Check Out</th>
                      <th style={{ padding: '10px 14px' }}>Working Hours</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHistory.map((rec, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>{rec.date}</td>
                        <td style={{ padding: '10px 14px' }}>{rec.inTime ? new Date(rec.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{rec.outTime ? new Date(rec.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{rec.workingHours ? `${rec.workingHours} hrs` : '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            backgroundColor: rec.status === 'Present' || rec.status === 'Checked Out' ? '#dcfce7' : '#fee2e2',
                            color: rec.status === 'Present' || rec.status === 'Checked Out' ? '#15803d' : '#dc2626',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 700
                          }}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MY SALARY & EARNINGS STATEMENT */}
        {activeTab === 'salary' && (
          <TailorSalaryPanel />
        )}
      </main>

      {/* SPECS & MEASUREMENTS MODAL */}
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
            maxWidth: '700px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              backgroundColor: '#0a192f',
              color: '#fff',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  Garment Technical Specifications & Measurements
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                  {selectedOrderForSpecs.orderNumber || `ORD-${selectedOrderForSpecs.id}`} • {selectedOrderForSpecs.garmentDetails?.dressType}
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForSpecs(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {/* Measurements grid */}
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#0f172a' }}>
                📐 Body Measurements ({selectedOrderForSpecs.garmentDetails?.measurementUnit || 'Inches'})
              </h4>
              {selectedOrderForSpecs.garmentDetails?.measurements ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '10px',
                  backgroundColor: '#f8fafc',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '16px'
                }}>
                  {Object.entries(selectedOrderForSpecs.garmentDetails.measurements).map(([key, val]) => (
                    <div key={key} style={{ padding: '6px 8px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{val || '—'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '16px' }}>No tailoring measurements recorded.</div>
              )}

              {/* Special Design Instructions */}
              {selectedOrderForSpecs.garmentDetails?.specialDesignInstructions && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#0f172a' }}>📌 Special Instructions</h4>
                  <div style={{ padding: '10px 12px', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.82rem', color: '#78350f' }}>
                    {selectedOrderForSpecs.garmentDetails.specialDesignInstructions}
                  </div>
                </div>
              )}

              {/* Reference Photo */}
              {selectedOrderForSpecs.garmentDetails?.designReferenceImage && (
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#0f172a' }}>🖼️ Design Reference Image</h4>
                  <img
                    src={getImageUrl(selectedOrderForSpecs.garmentDetails.designReferenceImage)}
                    alt="Design Reference"
                    style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid #cbd5e1', objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button
                onClick={() => setSelectedOrderForSpecs(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#0a192f', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
