import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
  Award,
  Clock,
  UserCheck,
  Scissors,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Info,
  X,
  Calendar,
  LogOut,
  XCircle,
  ShieldCheck,
  Layers,
  Activity
} from 'lucide-react';
import { CeoAttendanceCenter } from './CeoAttendanceCenter';
import { SelfAttendanceCard } from './SelfAttendanceCard';

export const TailorERP = () => {
  const { activeBranch, getAuthHeaders, user } = useAuth();

  const [tailors, setTailors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTailor, setSelectedTailor] = useState(null);
  const [infoNotice, setInfoNotice] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceFeedback, setAttendanceFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState('performance'); // 'performance' | 'attendance'
  const [productionView, setProductionView] = useState('all'); // 'all' | 'cutting' | 'stitching'
  const [modalFilter, setModalFilter] = useState('all'); // 'all' | 'active' | 'completed' | 'cutting' | 'stitching'

  // Permissions: CEO (SUPER_ADMIN), ADMIN & MANAGER can view & mark; TAILOR/STAFF are view-only
  const canMarkAttendance = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role);
  // Only privileged roles may see company-wide attendance (prevents 403 for TAILOR/STAFF)
  const canViewCompanyAttendance = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role);

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

  const formatDateTime = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '—';
      return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    } catch {
      return '—';
    }
  };


  const handleMarkPresent = async (tailorId) => {
    if (!canMarkAttendance) return;
    try {
      setAttendanceLoading(true);
      setAttendanceFeedback(null);
      const res = await fetch(`${API_URL}/api/attendance/mark-present`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders ? getAuthHeaders() : { 'Authorization': `Bearer ${localStorage.getItem('jb_token')}` })
        },
        body: JSON.stringify({ tailorId })
      });
      const result = await res.json();
      if (result.success) {
        setAttendanceFeedback({ type: 'success', message: result.message || 'Marked Present successfully.' });
        setSelectedTailor(prev => prev ? { ...prev, todayAttendance: result.data, attendance: 'Present' } : null);
        setTailors(prev => prev.map(t => t.id === tailorId ? { ...t, todayAttendance: result.data, attendance: 'Present' } : t));
      } else {
        setAttendanceFeedback({ type: 'error', message: result.message || 'Failed to mark present.' });
      }
    } catch (err) {
      console.error('Error marking present:', err);
      setAttendanceFeedback({ type: 'error', message: 'Network error marking present.' });
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleMarkAbsent = async (tailorId) => {
    if (!canMarkAttendance) return;
    try {
      setAttendanceLoading(true);
      setAttendanceFeedback(null);
      const res = await fetch(`${API_URL}/api/attendance/mark-absent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders ? getAuthHeaders() : { 'Authorization': `Bearer ${localStorage.getItem('jb_token')}` })
        },
        body: JSON.stringify({ tailorId })
      });
      const result = await res.json();
      if (result.success) {
        setAttendanceFeedback({ type: 'success', message: result.message || 'Marked Absent successfully.' });
        setSelectedTailor(prev => prev ? { ...prev, todayAttendance: result.data, attendance: 'Absent' } : null);
        setTailors(prev => prev.map(t => t.id === tailorId ? { ...t, todayAttendance: result.data, attendance: 'Absent' } : t));
      } else {
        setAttendanceFeedback({ type: 'error', message: result.message || 'Failed to mark absent.' });
      }
    } catch (err) {
      console.error('Error marking absent:', err);
      setAttendanceFeedback({ type: 'error', message: 'Network error marking absent.' });
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleCheckOut = async (tailorId) => {
    if (!canMarkAttendance) return;
    try {
      setAttendanceLoading(true);
      setAttendanceFeedback(null);
      const res = await fetch(`${API_URL}/api/attendance/check-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders ? getAuthHeaders() : { 'Authorization': `Bearer ${localStorage.getItem('jb_token')}` })
        },
        body: JSON.stringify({ tailorId })
      });
      const result = await res.json();
      if (result.success) {
        setAttendanceFeedback({ type: 'success', message: result.message || 'Check out recorded successfully.' });
        setSelectedTailor(prev => prev ? { ...prev, todayAttendance: result.data } : null);
        setTailors(prev => prev.map(t => t.id === tailorId ? { ...t, todayAttendance: result.data } : t));
      } else {
        setAttendanceFeedback({ type: 'error', message: result.message || 'Failed to check out.' });
      }
    } catch (err) {
      console.error('Error checking out:', err);
      setAttendanceFeedback({ type: 'error', message: 'Network error checking out.' });
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Fetch real tailor performance metrics from the backend
  const fetchTailorPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/orders/tailors/performance`, {
        headers: getAuthHeaders ? getAuthHeaders() : {
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });

      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setTailors(result.data);
      } else {
        setError(result.message || 'Failed to retrieve tailor performance metrics.');
      }
    } catch (err) {
      console.error('Tailor performance fetch error:', err);
      setError('Unable to load tailor performance data from server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTailorPerformance();
  }, [activeBranch]);

  // Helper to extract view-specific metrics
  const getWorkerMetrics = (tailor, view) => {
    if (!tailor) return {};
    if (view === 'cutting') {
      const cut = tailor.cutting || {};
      return {
        roleTitle: 'Cutting Master',
        assignedGarments: cut.assignedGarments || 0,
        assignedTasks: cut.assignedTasks || 0,
        completedToday: cut.completedToday || 0,
        completedMonth: cut.completedMonth || 0,
        totalCompleted: cut.totalCompleted || 0,
        activeWorkload: cut.activeWorkload || 0,
        activeTasks: cut.activeTasks || 0,
        completionRate: cut.completionRate ?? 0,
        avgDurationFormatted: cut.avgDurationFormatted || '—',
        avgDurationMinutes: cut.avgDurationMinutes || null
      };
    }
    if (view === 'stitching') {
      const stitch = tailor.stitching || {};
      return {
        roleTitle: 'Stitching Tailor',
        assignedGarments: stitch.assignedGarments || 0,
        assignedTasks: stitch.assignedTasks || 0,
        completedToday: stitch.completedToday || 0,
        completedMonth: stitch.completedMonth || 0,
        totalCompleted: stitch.totalCompleted || 0,
        activeWorkload: stitch.activeWorkload || 0,
        activeTasks: stitch.activeTasks || 0,
        completionRate: stitch.completionRate ?? 0,
        avgDurationFormatted: stitch.avgDurationFormatted || '—',
        avgDurationMinutes: stitch.avgDurationMinutes || null
      };
    }
    return {
      roleTitle: tailor.roleLabel || 'Craftsman / Tailor',
      assignedGarments: tailor.garmentsAssigned || 0,
      assignedTasks: tailor.tasksAssigned || 0,
      completedToday: tailor.completedToday || 0,
      completedMonth: tailor.completedMonth || 0,
      totalCompleted: tailor.totalCompleted || 0,
      activeWorkload: tailor.activeWorkload || 0,
      activeTasks: tailor.activeTasksCount || 0,
      completionRate: tailor.completionRate ?? 0,
      avgDurationFormatted: tailor.avgDurationFormatted || '—',
      avgDurationMinutes: tailor.avgDurationMinutes || null
    };
  };

  // Filter tailors based on active branch selection
  const branchFilteredTailors = tailors.filter((tailor) => {
    if (!activeBranch || activeBranch === 'ALL') return true;
    const bName = (tailor.branch || '').toLowerCase();
    return bName.includes(activeBranch.toLowerCase());
  });

  // Filter candidates for current production stage view
  const getWorkersForView = (workers, view) => {
    if (view === 'cutting') {
      const list = workers.filter(w => w.role === 'CUTTING' || (w.cutting && (w.cutting.assignedTasks > 0 || w.cutting.totalCompleted > 0 || w.cutting.activeWorkload > 0)));
      return list.length > 0 ? list : workers;
    }
    if (view === 'stitching') {
      const list = workers.filter(w => w.role === 'TAILOR' || (w.stitching && (w.stitching.assignedTasks > 0 || w.stitching.totalCompleted > 0 || w.stitching.activeWorkload > 0)));
      return list.length > 0 ? list : workers;
    }
    return workers;
  };

  const candidateTailors = getWorkersForView(branchFilteredTailors, productionView);

  // Dynamic ranking based on the active view's real numbers
  const sortedTailors = [...candidateTailors].sort((a, b) => {
    const aMet = getWorkerMetrics(a, productionView);
    const bMet = getWorkerMetrics(b, productionView);
    if (bMet.completedMonth !== aMet.completedMonth) return bMet.completedMonth - aMet.completedMonth;
    if (bMet.completedToday !== aMet.completedToday) return bMet.completedToday - aMet.completedToday;
    if (bMet.activeWorkload !== aMet.activeWorkload) return bMet.activeWorkload - aMet.activeWorkload;
    if (bMet.completionRate !== aMet.completionRate) return bMet.completionRate - aMet.completionRate;
    return (a.name || '').localeCompare(b.name || '');
  });

  const displayTailors = sortedTailors.map((t, index) => ({
    ...t,
    rank: index + 1
  }));

  // Live selected tailor details & filtered tasks for details modal
  const currentTailor = tailors.find(t => t.id === selectedTailor?.id) || selectedTailor;
  const tailorAllTasks = currentTailor?.allTasks || [];
  const activeTasksCount = tailorAllTasks.filter(t => t.isTaskActive).length;
  const completedTasksCount = tailorAllTasks.filter(t => t.isTaskCompleted).length;
  const cuttingTasksCount = tailorAllTasks.filter(t => t.taskType === 'CUTTING').length;
  const stitchingTasksCount = tailorAllTasks.filter(t => t.taskType === 'STITCHING').length;

  const displayedTasks = tailorAllTasks.filter(task => {
    if (modalFilter === 'active') return task.isTaskActive;
    if (modalFilter === 'completed') return task.isTaskCompleted;
    if (modalFilter === 'cutting') return task.taskType === 'CUTTING';
    if (modalFilter === 'stitching') return task.taskType === 'STITCHING';
    return true;
  });

  // Helper for generating initials for neutral avatar
  const getInitials = (name = '') => {
    if (!name) return 'CR';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Tailor Performance & Leaderboard ERP
            </h2>
            <span className="badge badge-navy" style={{ fontSize: '0.75rem' }}>
              Live Database
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Verified craftsman productivity rankings, completed garments, and active workload derived directly from production records.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {canViewCompanyAttendance && (
            <button
              className="btn-secondary"
              onClick={() => setActiveTab('attendance')}
              style={{
                backgroundColor: activeTab === 'attendance' ? '#0a192f' : undefined,
                color: activeTab === 'attendance' ? '#ffffff' : undefined
              }}
            >
              <Clock size={16} /> Attendance Center
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={() => setInfoNotice({
              title: 'Commission Disbursement Status',
              message: 'Commission ledger and disbursement rules are not yet stored in the database. Financial commission metrics are hidden to prevent unverified calculations.'
            })}
          >
            <Award size={16} /> Commission Status
          </button>
          <button
            className="btn-secondary"
            onClick={fetchTailorPerformance}
            title="Refresh Data"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Info Notice Banner / Modal */}
      {infoNotice && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid var(--jb-blue-accent)',
          borderRadius: '8px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Info size={20} style={{ color: 'var(--jb-blue-accent)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{infoNotice.title}</div>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>{infoNotice.message}</div>
            </div>
          </div>
          <button
            onClick={() => setInfoNotice(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Today's Self Attendance Card (for Tailor, Manager, Staff) */}
      <SelfAttendanceCard />

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '12px',
        borderBottom: '2px solid var(--border-color)',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => setActiveTab('performance')}
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
            borderBottom: activeTab === 'performance' ? '3px solid #0a192f' : '3px solid transparent',
            color: activeTab === 'performance' ? '#0a192f' : 'var(--text-muted)',
            marginBottom: '-2px',
            transition: 'all 0.15s ease'
          }}
        >
          <Award size={18} />
          <span>Tailor Performance & Leaderboard</span>
        </button>

        {canViewCompanyAttendance && (
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
              color: activeTab === 'attendance' ? '#0a192f' : 'var(--text-muted)',
              marginBottom: '-2px',
              transition: 'all 0.15s ease'
            }}
          >
            <Clock size={18} />
            <span>Attendance Center</span>
            <span style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: activeTab === 'attendance' ? '#0a192f' : '#f1f5f9',
              color: activeTab === 'attendance' ? '#ffffff' : '#64748b',
              fontWeight: 800
            }}>
              CEO Monitor
            </span>
          </button>
        )}
      </div>

      {/* CEO Attendance Center View — only for privileged roles */}
      {activeTab === 'attendance' && canViewCompanyAttendance && (
        <CeoAttendanceCenter />
      )}

      {/* Tailor Performance View */}
      {activeTab === 'performance' && (
        <>
      {/* 3-Way Production Stage Switcher (All Production | Cutting Master | Stitching Tailor) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: 'var(--bg-card)',
        padding: '12px 16px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Production View:
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setProductionView('all')}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: productionView === 'all' ? '2px solid #0a192f' : '1px solid var(--border-color)',
                backgroundColor: productionView === 'all' ? '#0a192f' : 'transparent',
                color: productionView === 'all' ? '#ffffff' : 'var(--text-main)',
                transition: 'all 0.15s ease'
              }}
            >
              <Layers size={15} /> All Production
            </button>

            <button
              type="button"
              onClick={() => setProductionView('cutting')}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: productionView === 'cutting' ? '2px solid #0284c7' : '1px solid var(--border-color)',
                backgroundColor: productionView === 'cutting' ? '#0284c7' : 'transparent',
                color: productionView === 'cutting' ? '#ffffff' : 'var(--text-main)',
                transition: 'all 0.15s ease'
              }}
            >
              <Scissors size={15} /> Cutting Master Performance
            </button>

            <button
              type="button"
              onClick={() => setProductionView('stitching')}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: productionView === 'stitching' ? '2px solid #10b981' : '1px solid var(--border-color)',
                backgroundColor: productionView === 'stitching' ? '#10b981' : 'transparent',
                color: productionView === 'stitching' ? '#ffffff' : 'var(--text-main)',
                transition: 'all 0.15s ease'
              }}
            >
              <Activity size={15} /> Stitching Tailor Performance
            </button>
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {productionView === 'cutting'
            ? 'Tracking fabric cutting throughput, patterns, and cutting master metrics.'
            : productionView === 'stitching'
            ? 'Tracking sewing assembly throughput, stitching, and tailor metrics.'
            : 'Combined cutting and stitching production statistics across all craftsmen.'}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card" style={{ padding: '48px', textAlign: 'center', marginBottom: '24px' }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--jb-navy)', margin: '0 auto 12px auto' }} />
          <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
            Loading verified tailor performance records from database...
          </p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="card" style={{ padding: '32px', textAlign: 'center', borderTop: '4px solid var(--status-danger)', marginBottom: '24px' }}>
          <AlertCircle size={32} style={{ color: 'var(--status-danger)', margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
            Unable to Load Tailor Performance
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>{error}</p>
          <button className="btn-secondary" onClick={fetchTailorPerformance}>
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && displayTailors.length === 0 && (
        <div className="card" style={{ padding: '56px 24px', textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            color: 'var(--text-muted)'
          }}>
            <Scissors size={28} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
            No verified {productionView === 'cutting' ? 'cutting master' : productionView === 'stitching' ? 'stitching tailor' : 'craftsman'} performance data available.
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 20px auto' }}>
            {activeBranch !== 'ALL'
              ? `No active task assignments or completed garments found for ${activeBranch}. Switch to "All Branches" or assign tasks to craftsmen.`
              : 'When production tasks are assigned and completed in the production workflow, their verified output rankings will appear here automatically.'}
          </p>
          <button className="btn-secondary" onClick={fetchTailorPerformance}>
            <RefreshCw size={14} /> Refresh Roster
          </button>
        </div>
      )}

      {/* Real Leaderboard Podium Cards */}
      {!loading && !error && displayTailors.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '18px',
          marginBottom: '28px'
        }}>
          {displayTailors.slice(0, 3).map((tailor) => {
            const isRank1 = tailor.rank === 1;
            const metrics = getWorkerMetrics(tailor, productionView);
            return (
              <div
                key={tailor.id}
                className="card"
                style={{
                  position: 'relative',
                  borderTop: isRank1 ? '4px solid var(--jb-crimson)' : '4px solid var(--jb-navy)',
                  overflow: 'hidden'
                }}
              >
                {/* Rank Ribbon */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  backgroundColor: isRank1 ? 'var(--jb-crimson)' : 'var(--jb-navy)',
                  color: '#ffffff',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Award size={14} /> Rank #{tailor.rank}
                </div>

                {/* Craftsman Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                  {/* Neutral Initials Avatar */}
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: isRank1 ? 'var(--jb-crimson)' : 'var(--jb-navy)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '1.2rem',
                    letterSpacing: '0.5px',
                    border: '2px solid var(--border-color)',
                    flexShrink: 0
                  }}>
                    {getInitials(tailor.name)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
                      {tailor.name}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {metrics.roleTitle}
                    </p>
                    <span className="badge badge-navy" style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                      {tailor.branch}
                    </span>
                  </div>
                </div>

                {/* Verified Output Metrics */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  backgroundColor: 'var(--bg-main)',
                  padding: '12px',
                  borderRadius: '10px',
                  marginBottom: '14px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                      Garments Completed
                    </span>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)' }}>
                      {metrics.completedToday} Today / {metrics.completedMonth} Month
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {metrics.totalCompleted} Total Garments
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                      Active Workload
                    </span>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--jb-crimson)' }}>
                      {metrics.activeWorkload} Garments
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {metrics.activeTasks} Active Tasks
                    </span>
                  </div>
                </div>

                {/* Performance Footnote & Efficiency */}
                <div style={{
                  backgroundColor: 'var(--bg-main)',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Completion Rate:</span>
                    <span style={{ fontWeight: 700, color: metrics.completionRate >= 80 ? 'var(--status-success)' : 'var(--text-main)' }}>
                      {metrics.completionRate}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Avg Duration:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {metrics.avgDurationFormatted}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Attendance:</span>
                    {tailor.todayAttendance?.status === 'Present' ? (
                      <span style={{ color: 'var(--status-success)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} /> Present
                        {tailor.todayAttendance.checkIn && ` (${formatTime(tailor.todayAttendance.checkIn)})`}
                      </span>
                    ) : tailor.todayAttendance?.status === 'Absent' ? (
                      <span style={{ color: 'var(--status-danger)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <XCircle size={12} /> Absent
                      </span>
                    ) : (
                      <span style={{ fontStyle: 'italic', fontWeight: 600 }}>Not Marked</span>
                    )}
                  </div>
                </div>

                {/* Bottom Status & View Tailor Details Trigger */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.775rem', fontWeight: 700 }}>
                  <span className="badge badge-success">
                    Grade {tailor.productivityGrade}
                  </span>
                  <button
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    onClick={() => setSelectedTailor(tailor)}
                  >
                    <UserCheck size={13} /> View Tailor
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Complete Craftsman Ledger Table */}
      {!loading && !error && displayTailors.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {productionView === 'cutting'
                  ? 'Cutting Master Production Roster'
                  : productionView === 'stitching'
                  ? 'Stitching Tailor Production Roster'
                  : 'All Craftsman Production & Productivity Roster'}
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Showing {displayTailors.length} verified record{displayTailors.length === 1 ? '' : 's'} calculated from live task assignments.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>Rank</th>
                  <th style={{ padding: '12px 16px' }}>Craftsman</th>
                  <th style={{ padding: '12px 16px' }}>Branch</th>
                  <th style={{ padding: '12px 16px' }}>Assigned Garments (Tasks)</th>
                  <th style={{ padding: '12px 16px' }}>Completed Today</th>
                  <th style={{ padding: '12px 16px' }}>Monthly Total</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Active Workload</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Completion Rate</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Avg Duration</th>
                  <th style={{ padding: '12px 16px' }}>Attendance</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayTailors.map((t) => {
                  const metrics = getWorkerMetrics(t, productionView);
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 900, color: t.rank === 1 ? 'var(--jb-crimson)' : 'var(--text-main)' }}>
                        #{t.rank}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--jb-navy)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            flexShrink: 0
                          }}>
                            {getInitials(t.name)}
                          </div>
                          <div>
                            <div>{t.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                              {metrics.roleTitle}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge badge-navy">{t.branch}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-main)' }}>
                        <strong>{metrics.assignedGarments}</strong> Garments{' '}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ({metrics.assignedTasks} Tasks)
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {metrics.completedToday} Garments
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {metrics.completedMonth} Garments
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className={metrics.activeWorkload > 0 ? 'badge badge-warning' : 'badge badge-navy'}>
                          {metrics.activeWorkload} Garments ({metrics.activeTasks} Tasks)
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>
                        <span style={{
                          color: metrics.completionRate >= 80 ? 'var(--status-success)' : metrics.completionRate >= 50 ? 'var(--text-main)' : 'var(--text-muted)'
                        }}>
                          {metrics.completionRate}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {metrics.avgDurationFormatted}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {t.todayAttendance?.status === 'Present' ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={12} /> Present
                            {t.todayAttendance.checkIn && (
                              <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                                ({formatTime(t.todayAttendance.checkIn)})
                              </span>
                            )}
                          </span>
                        ) : t.todayAttendance?.status === 'Absent' ? (
                          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <XCircle size={12} /> Absent
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Not Marked
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          onClick={() => setSelectedTailor(t)}
                        >
                          <UserCheck size={13} /> View Tailor
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* Tailor Details Modal (CEO / Manager / Tailor) */}
      {selectedTailor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="card" style={{ maxWidth: '960px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--jb-navy)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                  border: '2px solid var(--border-color)'
                }}>
                  {getInitials(currentTailor.name)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      {currentTailor.name}
                    </h3>
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                      Grade {currentTailor.productivityGrade}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {currentTailor.roleLabel || currentTailor.role}
                    </span>
                    <span className="badge badge-navy" style={{ fontSize: '0.65rem' }}>
                      {currentTailor.branch}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedTailor(null);
                  setAttendanceFeedback(null);
                }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Inline Action Alert */}
            {attendanceFeedback && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: attendanceFeedback.type === 'success' ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
                color: attendanceFeedback.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)',
                border: `1px solid ${attendanceFeedback.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)'}`
              }}>
                {attendanceFeedback.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span>{attendanceFeedback.message}</span>
              </div>
            )}

            {/* Craftsman Performance Breakdown Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px',
              marginBottom: '20px'
            }}>
              {/* All Production Overview Card */}
              <div style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px',
                borderTop: '3px solid #0a192f'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Layers size={14} /> Total Production
                  </span>
                  <span className="badge badge-navy" style={{ fontSize: '0.65rem' }}>Combined</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Assigned</span>
                    <strong>{currentTailor.garmentsAssigned || 0} Garments</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({currentTailor.tasksAssigned || 0} Tasks)</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Completed</span>
                    <strong>{currentTailor.completedToday || 0} Today</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{currentTailor.completedMonth || 0} Month ({currentTailor.totalCompleted || 0} Total)</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Active Workload</span>
                    <strong style={{ color: 'var(--jb-crimson)' }}>{currentTailor.activeWorkload || 0} Garments</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({currentTailor.activeTasksCount || 0} Active Tasks)</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Rate / Avg Time</span>
                    <strong style={{ color: (currentTailor.completionRate || 0) >= 80 ? 'var(--status-success)' : 'var(--text-main)' }}>{currentTailor.completionRate || 0}%</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{currentTailor.avgDurationFormatted || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Cutting Master Card */}
              <div style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px',
                borderTop: '3px solid #0284c7'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Scissors size={14} style={{ color: '#0284c7' }} /> Cutting Workload
                  </span>
                  <span style={{ fontSize: '0.65rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    Cutting Master
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Assigned</span>
                    <strong>{currentTailor.cutting?.assignedGarments || 0} Garments</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({currentTailor.cutting?.assignedTasks || 0} Tasks)</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Completed</span>
                    <strong>{currentTailor.cutting?.completedToday || 0} Today</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{currentTailor.cutting?.completedMonth || 0} Month ({currentTailor.cutting?.totalCompleted || 0} Total)</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Active Workload</span>
                    <strong style={{ color: 'var(--jb-crimson)' }}>{currentTailor.cutting?.activeWorkload || 0} Garments</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({currentTailor.cutting?.activeTasks || 0} Active Tasks)</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Rate / Avg Time</span>
                    <strong style={{ color: (currentTailor.cutting?.completionRate || 0) >= 80 ? 'var(--status-success)' : 'var(--text-main)' }}>{currentTailor.cutting?.completionRate || 0}%</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{currentTailor.cutting?.avgDurationFormatted || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Stitching Tailor Card */}
              <div style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px',
                borderTop: '3px solid #10b981'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Activity size={14} style={{ color: '#10b981' }} /> Stitching Workload
                  </span>
                  <span style={{ fontSize: '0.65rem', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    Stitching Tailor
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Assigned</span>
                    <strong>{currentTailor.stitching?.assignedGarments || 0} Garments</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({currentTailor.stitching?.assignedTasks || 0} Tasks)</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Completed</span>
                    <strong>{currentTailor.stitching?.completedToday || 0} Today</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{currentTailor.stitching?.completedMonth || 0} Month ({currentTailor.stitching?.totalCompleted || 0} Total)</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Active Workload</span>
                    <strong style={{ color: 'var(--jb-crimson)' }}>{currentTailor.stitching?.activeWorkload || 0} Garments</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({currentTailor.stitching?.activeTasks || 0} Active Tasks)</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Rate / Avg Time</span>
                    <strong style={{ color: (currentTailor.stitching?.completionRate || 0) >= 80 ? 'var(--status-success)' : 'var(--text-main)' }}>{currentTailor.stitching?.completionRate || 0}%</strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{currentTailor.stitching?.avgDurationFormatted || '—'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* TODAY'S ATTENDANCE CARD (Bordered Card)                   */}
            {/* ======================================================== */}
            <div style={{
              border: '1.5px solid var(--border-color)',
              borderRadius: '12px',
              padding: '18px 20px',
              backgroundColor: 'var(--bg-main)',
              marginBottom: '20px',
              boxShadow: 'var(--shadow-card)'
            }}>
              {/* Card Title & Date Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '14px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: 'var(--jb-crimson)' }} />
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                    Today's Attendance
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-card)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontWeight: 600
                  }}>
                    {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>PostgreSQL</span>
                  <span className="badge badge-navy" style={{ fontSize: '0.65rem' }}>Live DB</span>
                </div>
              </div>

              {/* Status and Times Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                marginBottom: '16px'
              }}>
                {/* Status Box */}
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Status
                  </div>
                  <div>
                    {selectedTailor.todayAttendance?.status === 'Present' ? (
                      <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <CheckCircle size={14} /> Present
                      </span>
                    ) : selectedTailor.todayAttendance?.status === 'Absent' ? (
                      <span className="badge badge-danger" style={{ fontSize: '0.85rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <XCircle size={14} /> Absent
                      </span>
                    ) : (
                      <span className="badge badge-navy" style={{ fontSize: '0.85rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={14} /> Not Marked
                      </span>
                    )}
                  </div>
                </div>

                {/* Check-in Time Box */}
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Check-in Time
                    </span>
                    {selectedTailor.todayAttendance?.checkIn && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--status-success)', fontWeight: 700 }}>Auto-saved</span>
                    )}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} style={{ color: selectedTailor.todayAttendance?.checkIn ? 'var(--status-success)' : 'var(--text-muted)' }} />
                    {selectedTailor.todayAttendance?.checkIn ? formatTime(selectedTailor.todayAttendance.checkIn) : '—'}
                  </div>
                </div>

                {/* Check-out Time Box */}
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Check-out Time
                    </span>
                    {selectedTailor.todayAttendance?.checkOut && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--jb-blue-accent)', fontWeight: 700 }}>Auto-saved</span>
                    )}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <LogOut size={16} style={{ color: selectedTailor.todayAttendance?.checkOut ? 'var(--jb-blue-accent)' : 'var(--text-muted)' }} />
                    {selectedTailor.todayAttendance?.checkOut ? formatTime(selectedTailor.todayAttendance.checkOut) : '—'}
                  </div>
                </div>
              </div>

              {/* DB Metadata */}
              {selectedTailor.todayAttendance?.markedBy && (
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} style={{ color: 'var(--text-muted)' }} />
                  <span>Marked by: <strong>{selectedTailor.todayAttendance.markedBy}</strong></span>
                  {selectedTailor.todayAttendance.date && <span>• Date: {selectedTailor.todayAttendance.date}</span>}
                </div>
              )}

              {/* Attendance Actions */}
              {Number(selectedTailor.id) === Number(user?.id) ? (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    My Self-Attendance:
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Clock In button */}
                    <button
                      type="button"
                      disabled={Boolean(selectedTailor.todayAttendance?.checkIn) || attendanceLoading}
                      onClick={async () => {
                        try {
                          setAttendanceLoading(true);
                          const res = await fetch(`${API_URL}/api/attendance/clock-in`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(getAuthHeaders ? getAuthHeaders() : { 'Authorization': `Bearer ${localStorage.getItem('jb_token')}` })
                            }
                          });
                          const data = await res.json();
                          if (data.success) {
                            setSelectedTailor(prev => ({ ...prev, todayAttendance: data.data, attendance: 'Present' }));
                            setTailors(prev => prev.map(t => t.id === selectedTailor.id ? { ...t, todayAttendance: data.data, attendance: 'Present' } : t));
                            setAttendanceFeedback({ type: 'success', message: 'You have clocked in successfully!' });
                          } else {
                            setAttendanceFeedback({ type: 'error', message: data.message || 'Failed to clock in.' });
                          }
                        } catch {
                          setAttendanceFeedback({ type: 'error', message: 'Network error clocking in.' });
                        } finally {
                          setAttendanceLoading(false);
                        }
                      }}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.825rem',
                        cursor: selectedTailor.todayAttendance?.checkIn || attendanceLoading ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: selectedTailor.todayAttendance?.checkIn ? 0.45 : 1,
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)'
                      }}
                    >
                      <CheckCircle size={15} />
                      {selectedTailor.todayAttendance?.checkIn ? 'Clocked In ✓' : 'Clock In'}
                    </button>

                    {/* Clock Out button */}
                    <button
                      type="button"
                      disabled={!selectedTailor.todayAttendance?.checkIn || Boolean(selectedTailor.todayAttendance?.checkOut) || attendanceLoading}
                      onClick={async () => {
                        try {
                          setAttendanceLoading(true);
                          const res = await fetch(`${API_URL}/api/attendance/clock-out`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(getAuthHeaders ? getAuthHeaders() : { 'Authorization': `Bearer ${localStorage.getItem('jb_token')}` })
                            }
                          });
                          const data = await res.json();
                          if (data.success) {
                            setSelectedTailor(prev => ({ ...prev, todayAttendance: data.data, attendance: 'Checked Out' }));
                            setTailors(prev => prev.map(t => t.id === selectedTailor.id ? { ...t, todayAttendance: data.data, attendance: 'Checked Out' } : t));
                            setAttendanceFeedback({ type: 'success', message: 'You have clocked out successfully!' });
                          } else {
                            setAttendanceFeedback({ type: 'error', message: data.message || 'Failed to clock out.' });
                          }
                        } catch {
                          setAttendanceFeedback({ type: 'error', message: 'Network error clocking out.' });
                        } finally {
                          setAttendanceLoading(false);
                        }
                      }}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'var(--jb-navy)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.825rem',
                        cursor: (!selectedTailor.todayAttendance?.checkIn || Boolean(selectedTailor.todayAttendance?.checkOut) || attendanceLoading) ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: (!selectedTailor.todayAttendance?.checkIn || Boolean(selectedTailor.todayAttendance?.checkOut)) ? 0.45 : 1,
                        boxShadow: '0 2px 4px rgba(11, 31, 58, 0.2)'
                      }}
                    >
                      <LogOut size={15} />
                      {selectedTailor.todayAttendance?.checkOut ? 'Clocked Out ✓' : 'Clock Out'}
                    </button>
                  </div>
                </div>
              ) : canMarkAttendance ? (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Attendance Actions:
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Mark Present button */}
                    <button
                      type="button"
                      disabled={attendanceLoading}
                      onClick={() => handleMarkPresent(selectedTailor.id)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: selectedTailor.todayAttendance?.status === 'Present' ? 'var(--status-success)' : '#10b981',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.825rem',
                        cursor: attendanceLoading ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
                        opacity: attendanceLoading ? 0.7 : 1
                      }}
                    >
                      <CheckCircle size={15} />
                      {selectedTailor.todayAttendance?.status === 'Present' ? 'Marked Present ✓' : 'Mark Present'}
                    </button>

                    {/* Mark Absent button */}
                    <button
                      type="button"
                      disabled={attendanceLoading}
                      onClick={() => handleMarkAbsent(selectedTailor.id)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1.5px solid var(--status-danger)',
                        backgroundColor: selectedTailor.todayAttendance?.status === 'Absent' ? 'var(--status-danger)' : 'transparent',
                        color: selectedTailor.todayAttendance?.status === 'Absent' ? '#ffffff' : 'var(--status-danger)',
                        fontWeight: 700,
                        fontSize: '0.825rem',
                        cursor: attendanceLoading ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: attendanceLoading ? 0.7 : 1
                      }}
                    >
                      <XCircle size={15} />
                      {selectedTailor.todayAttendance?.status === 'Absent' ? 'Marked Absent ✓' : 'Mark Absent'}
                    </button>

                    {/* Check Out button (enabled ONLY after Present) */}
                    <button
                      type="button"
                      disabled={
                        attendanceLoading ||
                        selectedTailor.todayAttendance?.status !== 'Present' ||
                        !!selectedTailor.todayAttendance?.checkOut
                      }
                      onClick={() => handleCheckOut(selectedTailor.id)}
                      title={
                        selectedTailor.todayAttendance?.status !== 'Present'
                          ? 'Enabled only after tailor is marked Present'
                          : selectedTailor.todayAttendance?.checkOut
                            ? 'Already checked out for today'
                            : 'Record Check Out time'
                      }
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'var(--jb-navy)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.825rem',
                        cursor: (selectedTailor.todayAttendance?.status !== 'Present' || !!selectedTailor.todayAttendance?.checkOut || attendanceLoading)
                          ? 'not-allowed'
                          : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: (selectedTailor.todayAttendance?.status !== 'Present' || !!selectedTailor.todayAttendance?.checkOut) ? 0.45 : 1,
                        boxShadow: '0 2px 4px rgba(11, 31, 58, 0.2)'
                      }}
                    >
                      <LogOut size={15} />
                      {selectedTailor.todayAttendance?.checkOut
                        ? 'Checked Out ✓'
                        : 'Check Out'}
                    </button>
                  </div>
                  {selectedTailor.todayAttendance?.status !== 'Present' && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                      * Check Out button is enabled only after tailor is marked Present.
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Craftsman Task History & Assignments Table */}
            <div style={{ marginTop: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Craftsman Task History & Assignments
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Verified order task assignments, start/completion dates, and durations from live production workflow.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setModalFilter('all')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      border: modalFilter === 'all' ? '1.5px solid #0a192f' : '1px solid var(--border-color)',
                      backgroundColor: modalFilter === 'all' ? '#0a192f' : 'var(--bg-main)',
                      color: modalFilter === 'all' ? '#ffffff' : 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    All ({tailorAllTasks.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalFilter('active')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      border: modalFilter === 'active' ? '1.5px solid var(--jb-navy)' : '1px solid var(--border-color)',
                      backgroundColor: modalFilter === 'active' ? 'var(--jb-navy)' : 'var(--bg-main)',
                      color: modalFilter === 'active' ? '#ffffff' : 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    Active ({activeTasksCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalFilter('completed')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      border: modalFilter === 'completed' ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                      backgroundColor: modalFilter === 'completed' ? '#10b981' : 'var(--bg-main)',
                      color: modalFilter === 'completed' ? '#ffffff' : 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    Completed ({completedTasksCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalFilter('cutting')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      border: modalFilter === 'cutting' ? '1.5px solid #0284c7' : '1px solid var(--border-color)',
                      backgroundColor: modalFilter === 'cutting' ? '#0284c7' : 'var(--bg-main)',
                      color: modalFilter === 'cutting' ? '#ffffff' : 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    Cutting ({cuttingTasksCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalFilter('stitching')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      border: modalFilter === 'stitching' ? '1.5px solid #059669' : '1px solid var(--border-color)',
                      backgroundColor: modalFilter === 'stitching' ? '#059669' : 'var(--bg-main)',
                      color: modalFilter === 'stitching' ? '#ffffff' : 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    Stitching ({stitchingTasksCount})
                  </button>
                </div>
              </div>

              {displayedTasks.length > 0 ? (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>Order #</th>
                        <th style={{ padding: '10px 12px' }}>Garment / Customer</th>
                        <th style={{ padding: '10px 12px' }}>Task Type</th>
                        <th style={{ padding: '10px 12px' }}>Assigned Date</th>
                        <th style={{ padding: '10px 12px' }}>Start Date</th>
                        <th style={{ padding: '10px 12px' }}>Completion Date</th>
                        <th style={{ padding: '10px 12px' }}>Duration</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTasks.map((task) => (
                        <tr key={task.taskId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-main)' }}>
                            {task.orderNumber}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{task.dressType}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {task.customerName} • <strong>Qty: {task.quantity}</strong>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {task.taskType === 'CUTTING' ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#e0f2fe',
                                color: '#0369a1',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700
                              }}>
                                <Scissors size={12} /> Cutting
                              </span>
                            ) : task.taskType === 'STITCHING' ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#dcfce7',
                                color: '#15803d',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700
                              }}>
                                <Activity size={12} /> Stitching
                              </span>
                            ) : (
                              <span className="badge badge-navy" style={{ fontSize: '0.72rem' }}>
                                {task.taskName || task.taskType}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                            {formatDateTime(task.assignedAt)}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                            {task.startedAt ? formatDateTime(task.startedAt) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                            {task.completedAt ? formatDateTime(task.completedAt) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-main)' }}>
                            {task.durationFormatted}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {task.status === 'COMPLETED' ? (
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                Completed
                              </span>
                            ) : task.status === 'IN_PROGRESS' ? (
                              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                                In Progress
                              </span>
                            ) : task.status === 'CANCELLED' ? (
                              <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                                Cancelled
                              </span>
                            ) : (
                              <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>
                                {task.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '28px',
                  backgroundColor: 'var(--bg-main)',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-color)',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem'
                }}>
                  No {modalFilter !== 'all' ? modalFilter : ''} tasks recorded for this craftsman yet.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ marginTop: '20px', textAlign: 'right', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setSelectedTailor(null);
                  setAttendanceFeedback(null);
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
