import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
  Clock,
  Calendar,
  CheckCircle,
  LogOut,
  AlertCircle,
  Timer
} from 'lucide-react';

export const SelfAttendanceCard = () => {
  const { user, getAuthHeaders } = useAuth();
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Live ticking clock in Asia/Colombo time
  const [currentTime, setCurrentTime] = useState(new Date());

  // Self attendance is for ADMIN, MANAGER, STAFF, TAILOR and other operations roles
  const roleUpper = (user?.role || '').toUpperCase();
  const isEmployee = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY', 'CASHIER'].includes(roleUpper);

  // Live clock interval (every 1 second)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchMyTodayAttendance = async () => {
    if (!isEmployee) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/attendance/my-today`, {
        headers: getAuthHeaders ? getAuthHeaders() : {
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setAttendance(data.data);
      }
    } catch (err) {
      console.error('Error fetching self attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTodayAttendance();
  }, [user]);

  if (!isEmployee) return null;

  // Format time strictly in Asia/Colombo timezone
  const formatColomboTime = (isoString, includeSeconds = false) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit',
        minute: '2-digit',
        second: includeSeconds ? '2-digit' : undefined,
        hour12: true
      });
    } catch {
      return '—';
    }
  };

  // Calculate live elapsed duration or total working hours
  const getWorkingDuration = () => {
    if (!attendance || !attendance.checkIn) return '—';
    const start = new Date(attendance.checkIn).getTime();
    const end = attendance.checkOut ? new Date(attendance.checkOut).getTime() : currentTime.getTime();
    if (isNaN(start) || isNaN(end) || end < start) return '—';

    const diffMs = Math.max(0, end - start);
    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (!attendance.checkOut) {
      return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  };

  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      setFeedback(null);
      const res = await fetch(`${API_URL}/api/attendance/clock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders ? getAuthHeaders() : { 'Authorization': `Bearer ${localStorage.getItem('jb_token')}` })
        }
      });
      const data = await res.json();
      if (data.success) {
        setAttendance(data.data);
        setFeedback({ type: 'success', message: 'Clocked In successfully! Attendance recorded permanently.' });
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to clock in.' });
      }
    } catch (err) {
      console.error('Clock-in error:', err);
      setFeedback({ type: 'error', message: 'Network error clocking in.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!window.confirm('Are you sure you want to clock out and complete your attendance shift for today?')) {
      return;
    }

    try {
      setActionLoading(true);
      setFeedback(null);
      const res = await fetch(`${API_URL}/api/attendance/clock-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders ? getAuthHeaders() : { 'Authorization': `Bearer ${localStorage.getItem('jb_token')}` })
        }
      });
      const data = await res.json();
      if (data.success) {
        setAttendance(data.data);
        setFeedback({
          type: 'success',
          message: `Clocked Out successfully! Total working duration: ${data.data.workingHours || getWorkingDuration()}`
        });
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to clock out.' });
      }
    } catch (err) {
      console.error('Clock-out error:', err);
      setFeedback({ type: 'error', message: 'Network error clocking out.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Determine current status
  const isClockedIn = Boolean(attendance?.checkIn && !attendance?.checkOut);
  const isCheckedOut = Boolean(attendance?.checkIn && attendance?.checkOut);
  const statusLabel = isCheckedOut ? 'Checked Out' : isClockedIn ? 'Present (Active)' : 'Not Marked';

  const todayColomboFormatted = currentTime.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Colombo',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const colomboTimeFormatted = currentTime.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1.5px solid var(--border-color)',
        borderRadius: '14px',
        padding: '18px 22px',
        marginBottom: '22px',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '14px',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              padding: '10px',
              borderRadius: '10px',
              backgroundColor: isCheckedOut ? '#eff6ff' : isClockedIn ? '#ecfdf5' : '#f8fafc',
              color: isCheckedOut ? 'var(--jb-blue-accent)' : isClockedIn ? '#059669' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Clock size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                {user?.role === 'ADMIN' ? 'Admin Attendance & Shift Tracking' : "Today's Attendance"}
              </h4>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  backgroundColor: isCheckedOut ? '#dbeafe' : isClockedIn ? '#dcfce7' : '#f1f5f9',
                  color: isCheckedOut ? '#1e40af' : isClockedIn ? '#166534' : '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isCheckedOut ? '#3b82f6' : isClockedIn ? '#10b981' : '#94a3b8'
                  }}
                />
                {statusLabel}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              {user?.name || 'User'} • Role: <strong>{user?.role || 'Admin'}</strong> • Branch: {attendance?.branch || 'JB Group (Main)'}
            </p>
          </div>
        </div>

        {/* Live Colombo Clock & Calendar Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--text-main)'
            }}
          >
            <Calendar size={14} style={{ color: 'var(--jb-crimson)' }} />
            <span>{todayColomboFormatted}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0b1f3a',
              color: '#38bdf8',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 800,
              fontFamily: 'monospace',
              letterSpacing: '0.5px'
            }}
            title="Exact time in Asia/Colombo (UTC+05:30)"
          >
            <Timer size={14} />
            <span>{colomboTimeFormatted}</span>
          </div>
        </div>
      </div>

      {/* Action feedback banner */}
      {feedback && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '0.825rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: feedback.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`
          }}
        >
          {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Grid: Check-in, Check-out, Total Working Hours & Action Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '14px',
          alignItems: 'center'
        }}
      >
        {/* Check-in box */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Check-In Time
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: attendance?.checkIn ? '#059669' : 'var(--text-main)', marginTop: '2px' }}>
            {formatColomboTime(attendance?.checkIn)}
          </div>
        </div>

        {/* Check-out box */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Check-Out Time
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: attendance?.checkOut ? '#1d4ed8' : 'var(--text-main)', marginTop: '2px' }}>
            {formatColomboTime(attendance?.checkOut)}
          </div>
        </div>

        {/* Total Working Hours Box */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: isClockedIn ? '#ecfdf5' : 'var(--bg-main)',
            border: `1px solid ${isClockedIn ? '#a7f3d0' : 'var(--border-color)'}`
          }}
        >
          <div style={{ fontSize: '0.7rem', color: isClockedIn ? '#047857' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            {isClockedIn ? 'Live Active Shift' : 'Total Working Hours'}
          </div>
          <div
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: isClockedIn ? '#059669' : isCheckedOut ? '#2563eb' : 'var(--text-main)',
              fontFamily: 'monospace',
              marginTop: '2px'
            }}
          >
            {getWorkingDuration()}
          </div>
        </div>

        {/* Action Buttons: Check In & Check Out */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Check In Button */}
          <button
            type="button"
            disabled={Boolean(attendance?.checkIn) || actionLoading || loading}
            onClick={handleClockIn}
            title={attendance?.checkIn ? 'Already checked in for today' : 'Click to Check In'}
            style={{
              flex: '1 1 120px',
              minHeight: '44px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: attendance?.checkIn || actionLoading ? 'not-allowed' : 'pointer',
              opacity: attendance?.checkIn ? 0.45 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.2s'
            }}
          >
            <CheckCircle size={16} />
            {attendance?.checkIn ? 'Checked In ✓' : 'Check In'}
          </button>

          {/* Check Out Button */}
          <button
            type="button"
            disabled={!isClockedIn || Boolean(attendance?.checkOut) || actionLoading || loading}
            onClick={handleClockOut}
            title={!attendance?.checkIn ? 'You must Check In first' : isCheckedOut ? 'Already checked out for today' : 'Click to Check Out'}
            style={{
              flex: '1 1 120px',
              minHeight: '44px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--jb-navy)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: (!isClockedIn || Boolean(attendance?.checkOut) || actionLoading) ? 'not-allowed' : 'pointer',
              opacity: (!isClockedIn || Boolean(attendance?.checkOut)) ? 0.45 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(11, 31, 58, 0.25)',
              transition: 'all 0.2s'
            }}
          >
            <LogOut size={16} />
            {attendance?.checkOut ? 'Checked Out ✓' : 'Check Out'}
          </button>
        </div>
      </div>
    </div>
  );
};
