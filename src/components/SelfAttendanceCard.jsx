import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
  Clock,
  Calendar,
  CheckCircle,
  LogOut,
  AlertCircle,
  RefreshCw,
  UserCheck,
  ShieldAlert
} from 'lucide-react';

export const SelfAttendanceCard = () => {
  const { user, getAuthHeaders } = useAuth();
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  // Self attendance is for TAILOR, STAFF, MANAGER (and production craft roles)
  const roleUpper = (user?.role || '').toUpperCase();
  const isEmployee = ['TAILOR', 'STAFF', 'MANAGER', 'CUTTING', 'EMBROIDERY', 'CASHIER'].includes(roleUpper);

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

  const formatTime = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '—';
    }
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
        setFeedback({ type: 'success', message: 'You have clocked in successfully!' });
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
        setFeedback({ type: 'success', message: 'You have clocked out successfully!' });
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
  const statusLabel = isCheckedOut ? 'Checked Out' : isClockedIn ? 'Present' : 'Not Marked';

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
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
          gap: '10px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          marginBottom: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: isCheckedOut ? '#eff6ff' : isClockedIn ? '#ecfdf5' : '#f8fafc',
              color: isCheckedOut ? 'var(--jb-blue-accent)' : isClockedIn ? '#059669' : 'var(--text-muted)'
            }}
          >
            <Clock size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Today's Attendance
              </h4>
              <span
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: isCheckedOut ? '#dbeafe' : isClockedIn ? '#dcfce7' : '#f1f5f9',
                  color: isCheckedOut ? '#1e40af' : isClockedIn ? '#166534' : '#64748b'
                }}
              >
                {statusLabel}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Self-service clock-in & clock-out for {user?.name || 'Staff'} ({user?.role})
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={14} style={{ color: 'var(--jb-crimson)' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {todayFormatted}
          </span>
        </div>
      </div>

      {/* Action feedback message */}
      {feedback && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            marginBottom: '14px',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: feedback.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`
          }}
        >
          {feedback.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Grid: Check-in Time, Check-out Time & Clock Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          alignItems: 'center'
        }}
      >
        {/* Check-in box */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Check-In Time
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
            {formatTime(attendance?.checkIn)}
          </div>
        </div>

        {/* Check-out box */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Check-Out Time
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
            {formatTime(attendance?.checkOut)}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Clock In button */}
          <button
            type="button"
            disabled={Boolean(attendance?.checkIn) || actionLoading || loading}
            onClick={handleClockIn}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: attendance?.checkIn || actionLoading ? 'not-allowed' : 'pointer',
              opacity: attendance?.checkIn ? 0.45 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
            }}
          >
            <CheckCircle size={15} />
            {attendance?.checkIn ? 'Clocked In ✓' : 'Clock In'}
          </button>

          {/* Clock Out button */}
          <button
            type="button"
            disabled={!isClockedIn || Boolean(attendance?.checkOut) || actionLoading || loading}
            onClick={handleClockOut}
            title={!attendance?.checkIn ? 'You must clock in first' : isCheckedOut ? 'Already clocked out' : 'Record check-out time'}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--jb-navy)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: (!isClockedIn || Boolean(attendance?.checkOut) || actionLoading) ? 'not-allowed' : 'pointer',
              opacity: (!isClockedIn || Boolean(attendance?.checkOut)) ? 0.45 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(11, 31, 58, 0.2)'
            }}
          >
            <LogOut size={15} />
            {attendance?.checkOut ? 'Clocked Out ✓' : 'Clock Out'}
          </button>
        </div>
      </div>
    </div>
  );
};
