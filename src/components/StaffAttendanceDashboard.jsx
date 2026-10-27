import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
  Clock,
  CheckCircle2,
  LogOut,
  AlertCircle,
  Calendar,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export const StaffAttendanceDashboard = () => {
  const { user, logout } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [history, setHistory] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's attendance and history
  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('jb_token');

      // Fetch today's status
      const todayRes = await fetch(`${API_URL}/api/attendance/my-today`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const todayData = await todayRes.json();
      if (todayData.success) {
        setTodayAttendance(todayData.data);
      }

      // Fetch history
      const histRes = await fetch(`${API_URL}/api/attendance/my-history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const histData = await histRes.json();
      if (histData.success && Array.isArray(histData.records)) {
        setHistory(histData.records);
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError('Network error loading attendance data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  // Clock In handler
  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccessMsg(null);
      const token = localStorage.getItem('jb_token');

      const res = await fetch(`${API_URL}/api/attendance/clock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (data.success) {
        setTodayAttendance(data.data);
        setSuccessMsg('✓ வருகைப் பதிவு வெற்றிகரமாக பதியப்பட்டது! (Clocked In successfully and sent to Boss).');
        fetchAttendanceData();
      } else {
        setError(data.message || 'Clock In failed.');
      }
    } catch (err) {
      console.error('Clock in error:', err);
      setError('Network error recording attendance.');
    } finally {
      setActionLoading(false);
    }
  };

  // Clock Out handler
  const handleClockOut = async () => {
    if (!window.confirm('இன்றைய பணியை நிறைவு செய்து Clock Out செய்ய விரும்புகிறீர்களா? (Confirm Clock Out for today?)')) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      setSuccessMsg(null);
      const token = localStorage.getItem('jb_token');

      const res = await fetch(`${API_URL}/api/attendance/clock-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (data.success) {
        setTodayAttendance(data.data);
        setSuccessMsg('(Clocked Out successfully and recorded to Boss portal).');
        fetchAttendanceData();
      } else {
        setError(data.message || 'Clock Out failed.');
      }
    } catch (err) {
      console.error('Clock out error:', err);
      setError('Network error recording clock out.');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper formatting functions
  const formatTime = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    } catch {
      return '—';
    }
  };

  // Calculate elapsed time if currently checked in
  const getElapsedDuration = () => {
    if (!todayAttendance || !todayAttendance.checkIn) return null;
    const start = new Date(todayAttendance.checkIn).getTime();
    const end = todayAttendance.checkOut ? new Date(todayAttendance.checkOut).getTime() : currentTime.getTime();
    const diffMs = Math.max(0, end - start);

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  };

  const isClockedIn = Boolean(todayAttendance && todayAttendance.checkIn && !todayAttendance.checkOut);
  const isClockedOut = Boolean(todayAttendance && todayAttendance.checkIn && todayAttendance.checkOut);
  const isNotMarked = !todayAttendance || (!todayAttendance.checkIn && !todayAttendance.checkOut);

  // Compute month summary stats
  const presentDaysCount = history.filter(h => h.status === 'Present' || h.status === 'Checked Out').length;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f1f5f9',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#0f172a'
    }}>
      {/* Top Navigation Bar */}
      <header style={{
        backgroundColor: '#0B1F3A',
        color: '#ffffff',
        padding: '14px 24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: '#D90429',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '1.2rem',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(217, 4, 41, 0.4)'
          }}>
            JB
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.5px' }}>
              JB GROUP & BELLA DESIGN
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Staff Attendance Portal .
            </div>
          </div>
        </div>

        {/* Staff Profile and Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(255,255,255,0.08)', padding: '6px 14px', borderRadius: '30px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#2563EB',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem'
            }}>
              P
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
                {user?.name || 'Pratheep'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                Role: <strong>STAFF</strong> • {user?.branchId === 2 ? 'Bella Design' : 'JB Group (Main)'}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>

        {/* Alerts / Feedback */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '12px 18px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.9rem',
            marginBottom: '20px',
            border: '1px solid #fecaca'
          }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#dcfce7',
            color: '#16a34a',
            padding: '12px 18px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.9rem',
            marginBottom: '20px',
            border: '1px solid #bbf7d0'
          }}>
            <CheckCircle2 size={20} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Live Date & Time Header Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>
              <Calendar size={16} color="#0284c7" />
              <span>
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
              Welcome, {user?.name || 'Pratheep'}! 👋
            </h2>
            <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '2px' }}>
              Your attendance status is directly connected to the Boss / CEO live roster.
            </div>
          </div>

          {/* Digital Clock */}
          <div style={{
            backgroundColor: '#0B1F3A',
            color: '#38bdf8',
            padding: '12px 20px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
            border: '1px solid rgba(56, 189, 248, 0.2)'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
              Live System Time
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '1px' }}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
          </div>
        </div>

        {/* HERO ATTENDANCE ACTION CARD */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '32px 24px',
          marginBottom: '24px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
          border: `2px solid ${isClockedIn ? '#10b981' : isClockedOut ? '#3b82f6' : '#cbd5e1'}`,
          textAlign: 'center'
        }}>

          {/* Status Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 18px', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 800, marginBottom: '18px', backgroundColor: isClockedIn ? '#dcfce7' : isClockedOut ? '#dbeafe' : '#f1f5f9', color: isClockedIn ? '#15803d' : isClockedOut ? '#1d4ed8' : '#475569' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isClockedIn ? '#10b981' : isClockedOut ? '#3b82f6' : '#94a3b8',
              display: 'inline-block',
              boxShadow: isClockedIn ? '0 0 8px #10b981' : 'none'
            }} />
            {isClockedIn ? 'CLOCKED IN — ACTIVE SHIFT' : isClockedOut ? 'SHIFT COMPLETED TODAY ' : 'NOT CLOCKED IN YET)'}
          </div>

          {/* Time details */}
          <div style={{ marginBottom: '24px' }}>
            {isClockedIn && (
              <div>
                <div style={{ fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                  Clocked In at: <strong style={{ color: '#0f172a' }}>{formatTime(todayAttendance.checkIn)}</strong>
                </div>
                <div style={{ marginTop: '10px', fontSize: '2rem', fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>
                  ⏱️ {getElapsedDuration()}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                  Live working hours recorded for today
                </div>
              </div>
            )}

            {isClockedOut && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Clock In</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{formatTime(todayAttendance.checkIn)}</div>
                  </div>
                  <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '32px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Clock Out</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{formatTime(todayAttendance.checkOut)}</div>
                  </div>
                  <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '32px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Hours</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb' }}>{getElapsedDuration()}</div>
                  </div>
                </div>
              </div>
            )}

            {isNotMarked && (
              <div style={{ color: '#64748b', fontSize: '0.95rem' }}>
                Click the button below to record your check-in time for today.
              </div>
            )}
          </div>

          {/* MAIN ACTION BUTTON */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            {isNotMarked && (
              <button
                type="button"
                onClick={handleClockIn}
                disabled={actionLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '16px 36px',
                  borderRadius: '12px',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  cursor: actionLoading ? 'wait' : 'pointer',
                  boxShadow: '0 10px 15px -3px rgba(22, 163, 74, 0.4)',
                  transition: 'transform 0.15s ease, background-color 0.2s'
                }}
              >
                <Clock size={24} />
                {actionLoading ? 'Recording Attendance...' : 'Clock In / வருகைப் பதிவு (Check In)'}
              </button>
            )}

            {isClockedIn && (
              <button
                type="button"
                onClick={handleClockOut}
                disabled={actionLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '16px 36px',
                  borderRadius: '12px',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  cursor: actionLoading ? 'wait' : 'pointer',
                  boxShadow: '0 10px 15px -3px rgba(220, 38, 38, 0.4)',
                  transition: 'transform 0.15s ease, background-color 0.2s'
                }}
              >
                <LogOut size={24} />
                {actionLoading ? 'Clocking Out...' : 'Clock Out / பணி நிறைவு (Check Out)'}
              </button>
            )}

            {isClockedOut && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                padding: '12px 24px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.95rem',
                border: '1px solid #bfdbfe'
              }}>
                <CheckCircle2 size={20} color="#2563eb" />
                Shift Finished • Attendance Synced with Boss
              </div>
            )}
          </div>
        </div>

        {/* BOSS TRANSMISSION ASSURANCE BANNER */}
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            backgroundColor: '#dbeafe',
            padding: '10px',
            borderRadius: '10px',
            color: '#1d4ed8',
            display: 'flex'
          }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#1e3a8a', fontSize: '0.95rem' }}>
              Direct Transmission to Boss (CEO Live Attendance Center)
            </div>
            <div style={{ color: '#3b82f6', fontSize: '0.8rem', marginTop: '2px' }}>
              Whenever you Clock In or Clock Out, your timestamps are saved directly into the PostgreSQL database and immediately visible to the Boss / MD on the central dashboard.
            </div>
          </div>
        </div>

        {/* MONTH STATS & RECENT HISTORY */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              Recent Attendance History
            </h3>
            <button
              onClick={fetchAttendanceData}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Present Days</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#16a34a', marginTop: '4px' }}>{presentDaysCount} Days</div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Assigned Branch</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {user?.branchId === 2 ? 'Bella Design' : 'JB Group (Main)'}
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status Today</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: isClockedIn ? '#16a34a' : isClockedOut ? '#2563eb' : '#64748b', marginTop: '4px' }}>
                {isClockedIn ? 'Present (Active)' : isClockedOut ? 'Checked Out' : 'Not Marked'}
              </div>
            </div>
          </div>

          {/* History Table */}
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '0.85rem' }}>
              No attendance logs found yet. Clock in to record your first entry.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#475569' }}>Date</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#475569' }}>Clock In</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#475569' }}>Clock Out</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#475569' }}>Status</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#475569' }}>Boss Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, idx) => (
                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                        {item.date}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#16a34a', fontWeight: 700 }}>
                        {formatTime(item.checkIn)}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#2563eb', fontWeight: 700 }}>
                        {formatTime(item.checkOut)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor: item.status === 'Present' ? '#dcfce7' : item.status === 'Checked Out' ? '#dbeafe' : '#fee2e2',
                          color: item.status === 'Present' ? '#15803d' : item.status === 'Checked Out' ? '#1e40af' : '#dc2626'
                        }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#059669', fontWeight: 700 }}>
                        ✓ Transmitted to Boss
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
};
