import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
  Users,
  Clock,
  CheckCircle2,
  LogOut,
  AlertCircle,
  HelpCircle,
  Search,
  RefreshCw,
  Building,
  UserCheck,
  Calendar
} from 'lucide-react';

export const CeoAttendanceCenter = () => {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    present: 0,
    checkedOut: 0,
    notMarked: 0,
    absent: 0
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `${API_URL}/api/attendance/ceo-center?date=${selectedDate}`;
      const res = await fetch(url, {
        headers: getAuthHeaders ? getAuthHeaders() : {
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        setError(data.message || 'Failed to load attendance records.');
      }
    } catch (err) {
      console.error('Error fetching CEO attendance:', err);
      setError('Network error loading attendance logs from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate]);

  // Format timestamp to 12-hour format: 07:50 AM
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

  // Extract unique branches for dropdown
  const uniqueBranches = useMemo(() => {
    const set = new Set();
    records.forEach(r => {
      if (r.branch) set.add(r.branch);
    });
    return Array.from(set);
  }, [records]);

  // Filtered attendance list
  const filteredRecords = useMemo(() => {
    return records.filter(item => {
      // Role filter
      if (roleFilter !== 'ALL') {
        if (roleFilter === 'MANAGER' && item.role !== 'MANAGER') return false;
        if (roleFilter === 'STAFF' && item.role !== 'STAFF') return false;
        if (roleFilter === 'TAILOR' && item.role !== 'TAILOR') return false;
      }

      // Branch filter
      if (branchFilter !== 'ALL' && item.branch !== branchFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchEmail = item.email?.toLowerCase().includes(q);
        const matchRole = item.roleLabel?.toLowerCase().includes(q);
        const matchBranch = item.branch?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchRole && !matchBranch) {
          return false;
        }
      }

      return true;
    });
  }, [records, roleFilter, branchFilter, searchQuery]);

  // Status badge styling helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Present':
        return {
          bg: '#ecfdf5',
          color: '#065f46',
          border: '#a7f3d0',
          label: 'Present'
        };
      case 'Checked Out':
        return {
          bg: '#eff6ff',
          color: '#1e40af',
          border: '#bfdbfe',
          label: 'Checked Out'
        };
      case 'Absent':
        return {
          bg: '#fef2f2',
          color: '#991b1b',
          border: '#fecaca',
          label: 'Absent'
        };
      default:
        return {
          bg: '#f8fafc',
          color: '#64748b',
          border: '#e2e8f0',
          label: 'Not Marked'
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Attendance Summary Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        {/* Total Employees */}
        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Employees
            </span>
            <Users size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>
            {summary.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Active registered staff & tailors
          </div>
        </div>

        {/* Present */}
        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Present Today
            </span>
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#065f46', marginTop: '8px' }}>
            {summary.present}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Currently clocked in & active
          </div>
        </div>

        {/* Checked Out */}
        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3730a3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Checked Out
            </span>
            <LogOut size={18} style={{ color: '#6366f1' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#3730a3', marginTop: '8px' }}>
            {summary.checkedOut}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Shift completed for today
          </div>
        </div>

        {/* Absent */}
        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Absent
            </span>
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#991b1b', marginTop: '8px' }}>
            {summary.absent}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Recorded as absent
          </div>
        </div>

        {/* Not Marked */}
        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #94a3b8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Not Marked
            </span>
            <HelpCircle size={18} style={{ color: '#94a3b8' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#475569', marginTop: '8px' }}>
            {summary.notMarked}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Yet to clock in today
          </div>
        </div>
      </div>

      {/* Main Attendance Table Card */}
      <div className="card" style={{ padding: '24px' }}>
        {/* Header & Controls Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Today's Company Attendance Center
              </h3>
              <span style={{
                backgroundColor: '#f1f5f9',
                color: '#475569',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                Read-Only (Monitoring)
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Real-time attendance logs for Managers, Staff, and Tailors across all branches.
            </p>
          </div>

          <button
            onClick={fetchAttendance}
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '7px 14px' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Roster</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 16px',
          backgroundColor: '#f8fafc',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          marginBottom: '20px'
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search employee name, role, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontSize: '0.85rem',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* Filter by Role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Role:</span>
              <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                {[
                  { id: 'ALL', label: 'All Roles' },
                  { id: 'MANAGER', label: 'Manager' },
                  { id: 'STAFF', label: 'Staff' },
                  { id: 'TAILOR', label: 'Tailor' }
                ].map(r => (
                  <button
                    key={r.id}
                    onClick={() => setRoleFilter(r.id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: roleFilter === r.id ? '#0a192f' : '#ffffff',
                      color: roleFilter === r.id ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Branch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Branch:</span>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Branches</option>
                {uniqueBranches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Filter by Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            padding: '16px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px'
          }}>
            <AlertCircle size={20} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{error}</span>
          </div>
        )}

        {/* Table View */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#0a192f' }} />
            <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Loading live attendance records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <UserCheck size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
              No employee attendance records found
            </h4>
            <p style={{ fontSize: '0.825rem' }}>
              No employees matched the selected role, branch, or search criteria.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Employee</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Role</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Branch</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Check-In</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Check-Out</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((emp) => {
                  const badge = getStatusBadge(emp.status);
                  return (
                    <tr
                      key={emp.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Employee Name & Initial Avatar */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            backgroundColor: '#0a192f',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            flexShrink: 0
                          }}>
                            {emp.name ? emp.name.charAt(0).toUpperCase() : 'E'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                              {emp.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {emp.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: emp.role === 'MANAGER' ? '#fef3c7' : (emp.role === 'TAILOR' ? '#e0e7ff' : '#f1f5f9'),
                          color: emp.role === 'MANAGER' ? '#92400e' : (emp.role === 'TAILOR' ? '#3730a3' : '#334155')
                        }}>
                          {emp.roleLabel || emp.role}
                        </span>
                      </td>

                      {/* Branch */}
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Building size={14} style={{ color: 'var(--text-muted)' }} />
                          {emp.branch}
                        </span>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={14} />
                          {emp.dateKey === new Date().toISOString().slice(0, 10) ? 'Today' : (emp.dateKey || emp.date)}
                        </span>
                      </td>

                      {/* Check-In */}
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: emp.checkIn ? '#065f46' : 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={14} style={{ opacity: emp.checkIn ? 1 : 0.4 }} />
                          {formatTime(emp.checkIn)}
                        </span>
                      </td>

                      {/* Check-Out */}
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: emp.checkOut ? '#1e40af' : 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <LogOut size={14} style={{ opacity: emp.checkOut ? 1 : 0.4 }} />
                          {formatTime(emp.checkOut)}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: badge.color
                          }} />
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
