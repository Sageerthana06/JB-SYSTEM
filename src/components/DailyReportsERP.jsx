import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Building,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Users,
  DollarSign,
  Scissors,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  PackageCheck,
  CreditCard,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  generateDailyOrdersPDF,
  generateDailyAttendancePDF,
  generateDailyPaymentsPDF,
  generateDailyProductionPDF,
  generateDailyBusinessSummaryPDF
} from '../utils/dailyReportsPdf';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Helper: Format date to YYYY-MM-DD in Asia/Colombo
 */
function getColomboTodayString() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

/**
 * Helper: Format currency in LKR
 */
function formatLKR(val) {
  const num = Number(val || 0);
  return `LKR ${num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const DailyReportsERP = () => {
  const { user, token } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  const isExecutive = userRole === 'SUPER_ADMIN' || userRole === 'CEO';

  // Date selection (default today Asia/Colombo)
  const [selectedDate, setSelectedDate] = useState(() => getColomboTodayString());

  // Branch filter: CEO/Admin can toggle All vs Branch; Manager is restricted to their branch
  const [selectedBranch, setSelectedBranch] = useState(() => {
    if (isExecutive) return 'ALL';
    return user?.branchId ? String(user.branchId) : '1';
  });

  // Section view filter: 'all' (all-in-one view), 'orders', 'attendance', 'payments', 'production'
  const [viewFilter, setViewFilter] = useState('all');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [downloadingReport, setDownloadingReport] = useState(null);

  // Fetch report data from backend API
  const fetchReport = async (date = selectedDate, branch = selectedBranch) => {
    if (!hasPermission(user?.role, 'reports.view')) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        date,
        branchId: branch
      });

      const res = await fetch(`${API_URL}/api/reports/daily?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch daily reports (HTTP ${res.status})`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Error loading daily report data');
      }

      setReportData(json);
    } catch (err) {
      console.error('Error fetching daily report:', err);
      setError(err.message || 'Network or server error while generating daily reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchReport(selectedDate, selectedBranch);
    }
  }, [selectedDate, selectedBranch, token]);

  // Date shift helpers
  const handleShiftDate = (days) => {
    try {
      const parts = selectedDate.split('-').map(Number);
      const cur = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      cur.setUTCDate(cur.getUTCDate() + days);
      const y = cur.getUTCFullYear();
      const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
      const d = String(cur.getUTCDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${d}`);
    } catch (e) {
      setSelectedDate(getColomboTodayString());
    }
  };

  // Human-readable date title
  const formattedDateTitle = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const parts = selectedDate.split('-').map(Number);
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      return d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      });
    } catch (e) {
      return selectedDate;
    }
  }, [selectedDate]);

  // PDF Generation handler
  const handleDownloadPDF = async (type = 'summary') => {
    if (!reportData) return;
    setDownloadingReport(type);
    try {
      const meta = reportData.meta || {};
      const branchName = meta.branchName || (selectedBranch === 'ALL' ? 'All Branches (Company-wide)' : `Branch #${selectedBranch}`);
      const userInfo = {
        name: user?.name || meta.generatedBy?.name || 'Staff User',
        role: userRole
      };
      const generatedAt = meta.generatedAt || new Date().toISOString();

      // Micro delay for button spinner rendering
      await new Promise(r => setTimeout(r, 100));

      if (type === 'orders') {
        generateDailyOrdersPDF({
          date: selectedDate,
          branchName,
          records: reportData.orders?.records || [],
          summary: reportData.orders?.summary || {},
          user: userInfo,
          generatedAt
        });
      } else if (type === 'attendance') {
        generateDailyAttendancePDF({
          date: selectedDate,
          branchName,
          records: reportData.attendance?.records || [],
          summary: reportData.attendance?.summary || {},
          user: userInfo,
          generatedAt
        });
      } else if (type === 'payments') {
        generateDailyPaymentsPDF({
          date: selectedDate,
          branchName,
          records: reportData.payments?.records || [],
          summary: reportData.payments?.summary || {},
          user: userInfo,
          generatedAt
        });
      } else if (type === 'production') {
        generateDailyProductionPDF({
          date: selectedDate,
          branchName,
          data: reportData.production?.data || {},
          summary: reportData.production?.summary || {},
          user: userInfo,
          generatedAt
        });
      } else {
        generateDailyBusinessSummaryPDF({
          date: selectedDate,
          branchName,
          data: reportData,
          user: userInfo,
          generatedAt
        });
      }
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Unable to generate PDF document. Please verify server connection.');
    } finally {
      setDownloadingReport(null);
    }
  };

  const branchLabel = reportData?.meta?.branchName || (selectedBranch === 'ALL' ? 'All Branches' : `Branch #${selectedBranch}`);
  const kpis = reportData?.businessSummary?.executiveKpis || {};
  const ordersSummary = reportData?.orders?.summary || {};
  const attendanceSummary = reportData?.attendance?.summary || {};
  const paymentsSummary = reportData?.payments?.summary || {};
  const productionSummary = reportData?.production?.summary || {};

  if (!hasPermission(user?.role, 'reports.view')) {
    return (
      <div className="module-container-responsive" style={{ padding: '48px', textAlign: 'center', color: '#dc2626' }}>
        <AlertCircle size={48} style={{ margin: '0 auto 16px', display: 'block', color: '#dc2626' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>Access Denied</h3>
        <p style={{ color: 'var(--text-muted)' }}>You do not have permission to access Daily Reports.</p>
      </div>
    );
  }

  return (
    <div className="module-container-responsive" style={{ padding: '24px 28px' }}>
      {/* 1. Header Banner & Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'var(--jb-crimson-light)',
            color: 'var(--jb-crimson)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(217, 4, 41, 0.15)'
          }}>
            <FileSpreadsheet size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.68rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Daily Report
              </h1>
              <span className="badge badge-crimson" style={{ fontSize: '0.78rem', letterSpacing: '0.5px' }}>
                JB GROUP / BELLA DESIGN
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: '4px 0 0 0' }}>
              Clean, executive daily operational briefing for {formattedDateTitle}
            </p>
          </div>
        </div>

        {/* Prominent Download PDF Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleDownloadPDF('summary')}
            disabled={loading || !reportData || downloadingReport === 'summary'}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 22px',
              fontWeight: 700,
              fontSize: '0.95rem',
              backgroundColor: 'var(--jb-crimson)',
              borderColor: 'var(--jb-crimson)',
              boxShadow: '0 4px 12px rgba(217, 4, 41, 0.25)',
              borderRadius: '8px'
            }}
          >
            <Download size={16} />
            {downloadingReport === 'summary' ? 'Generating PDF...' : 'Download Daily Report (PDF)'}
          </button>

          <button
            onClick={() => fetchReport(selectedDate, selectedBranch)}
            disabled={loading}
            className="btn btn-secondary"
            title="Refresh Report Data"
            style={{ padding: '11px 15px', borderRadius: '8px' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Controls Bar: Date Selector & Branch Scope */}
      <div className="card" style={{
        padding: '14px 18px',
        marginBottom: '22px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* Date Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={17} style={{ color: 'var(--jb-crimson)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Select Date:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => handleShiftDate(-1)}
              className="btn btn-secondary btn-sm"
              title="Previous Day"
              style={{ padding: '5px 8px' }}
            >
              <ChevronLeft size={14} />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="form-control"
              style={{
                width: '155px',
                padding: '7px 10px',
                fontSize: '0.92rem',
                fontWeight: 600,
                borderRadius: '6px'
              }}
            />

            <button
              onClick={() => handleShiftDate(1)}
              className="btn btn-secondary btn-sm"
              title="Next Day"
              style={{ padding: '5px 8px' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setSelectedDate(getColomboTodayString())}
              className={`btn btn-sm ${selectedDate === getColomboTodayString() ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.82rem', padding: '6px 12px' }}
            >
              Today
            </button>
            <button
              onClick={() => {
                const parts = getColomboTodayString().split('-').map(Number);
                const cur = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
                cur.setUTCDate(cur.getUTCDate() - 1);
                const y = cur.getUTCFullYear();
                const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
                const d = String(cur.getUTCDate()).padStart(2, '0');
                setSelectedDate(`${y}-${m}-${d}`);
              }}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.82rem', padding: '6px 12px' }}
            >
              Yesterday
            </button>
          </div>

          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '6px' }}>
            {formattedDateTitle}
          </span>
        </div>

        {/* Branch Scope */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building size={17} style={{ color: 'var(--jb-crimson)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Branch:</span>
          </div>

          {isExecutive ? (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="form-control"
              style={{
                width: '225px',
                padding: '7px 12px',
                fontSize: '0.92rem',
                fontWeight: 600,
                borderRadius: '6px'
              }}
            >
              <option value="ALL">✨ All Branches (Company-wide)</option>
              <option value="1">🏢 JB Group (Main Branch)</option>
              <option value="2">🪡 Bella Design (Studio)</option>
            </select>
          ) : (
            <div className="badge badge-navy" style={{ padding: '8px 14px', fontSize: '0.88rem', fontWeight: 600 }}>
              🔒 {branchLabel} (Locked Scope)
            </div>
          )}
        </div>
      </div>

      {/* 3. Section Filter Pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'all', label: 'All-in-One View' },
          { id: 'summary', label: 'Executive Briefing' },
          { id: 'orders', label: `Orders (${reportData?.orders?.records?.length || 0})` },
          { id: 'attendance', label: `Attendance (${attendanceSummary.present || 0}/${attendanceSummary.totalStaff || 0})` },
          { id: 'payments', label: `Payments (${reportData?.payments?.records?.length || 0})` },
          { id: 'production', label: `Production WIP (${productionSummary.pendingWipCount || 0})` }
        ].map((tab) => {
          const isActive = viewFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setViewFilter(tab.id)}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                padding: '8px 16px',
                fontSize: '0.9rem',
                fontWeight: isActive ? 700 : 500,
                borderRadius: '20px'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} style={{ color: '#dc2626' }} />
            <div>
              <strong style={{ color: '#991b1b', fontSize: '0.9rem' }}>Error loading daily report</strong>
              <div style={{ color: '#b91c1c', fontSize: '0.82rem' }}>{error}</div>
            </div>
          </div>
          <button onClick={() => fetchReport(selectedDate, selectedBranch)} className="btn btn-secondary btn-sm">
            Retry
          </button>
        </div>
      )}

      {/* Loading Pulse */}
      {loading && (
        <div className="card" style={{ padding: '50px 20px', textAlign: 'center', borderRadius: '10px' }}>
          <div className="spin" style={{ display: 'inline-block', marginBottom: '12px', color: 'var(--jb-crimson)' }}>
            <RefreshCw size={28} />
          </div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700 }}>
            Loading Daily Report...
          </h4>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Fetching verified PostgreSQL transactions for {selectedDate}
          </p>
        </div>
      )}

      {/* Report Content */}
      {!loading && reportData && (
        <>
          {/* ============================================================== */}
          {/* 1. TODAY'S SUMMARY (5 Core KPIs) & 5 VERTICAL EXECUTIVE SECTIONS */}
          {/* ============================================================== */}
          {(viewFilter === 'all' || viewFilter === 'summary') && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '1.32rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Executive Business Summary
                </h2>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Timezone: Asia/Colombo (UTC+05:30)
                </span>
              </div>

              {/* Top 5 Highlight KPI Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '14px',
                marginBottom: '24px'
              }}>
                {/* 1. New Orders */}
                <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #0f172a' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    New Orders
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', margin: '6px 0 2px 0' }}>
                    {kpis.newOrdersCount || 0}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Total: <strong style={{ color: 'var(--text-main)' }}>{formatLKR(kpis.newOrdersValue)}</strong>
                  </div>
                </div>

                {/* 2. Completed Orders */}
                <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #2563eb' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Completed Orders
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#2563eb', margin: '6px 0 2px 0' }}>
                    {(kpis.readyOrders || 0) + (kpis.deliveredOrders || 0)}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Ready: <strong>{kpis.readyOrders || 0}</strong> • Delivered: <strong>{kpis.deliveredOrders || 0}</strong>
                  </div>
                </div>

                {/* 3. Staff Present */}
                <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #16a34a' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Staff Present
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#16a34a', margin: '6px 0 2px 0' }}>
                    {kpis.staffPresent || 0} <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {kpis.totalStaff || 0}</span>
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#16a34a', fontWeight: 600 }}>
                    {kpis.attendanceRate || 0}% Attendance Rate
                  </div>
                </div>

                {/* 4. Money Received */}
                <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #059669' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Money Received
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#059669', margin: '6px 0 2px 0' }}>
                    {formatLKR(kpis.paymentsCollected)}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    {kpis.paymentTransactions || 0} Transactions Logged
                  </div>
                </div>

                {/* 5. Pending Orders */}
                <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #d97706' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Pending Orders
                  </div>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#d97706', margin: '6px 0 2px 0' }}>
                    {kpis.activeWipCount || 0}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Active In Workshop (WIP)
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* MANDATED 5 VERTICAL EXECUTIVE SECTIONS (1 -> 5 STACKED)     */}
              {/* ============================================================ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                
                {/* SECTION 1: ORDERS & SALES OVERVIEW */}
                <div className="card" style={{ padding: 0, borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '5px', height: '22px', backgroundColor: '#d90429', borderRadius: '2px' }}></div>
                      <h3 style={{ margin: 0, fontSize: '1.14rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                        1. ORDERS & SALES OVERVIEW
                      </h3>
                    </div>
                    <span className="badge badge-navy" style={{ fontSize: '0.84rem' }}>
                      {ordersSummary.totalOrders || 0} Orders Logged
                    </span>
                  </div>
                  <div style={{
                    padding: '20px 24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px 32px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Total Orders Logged on Date</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {ordersSummary.totalOrders || 0} Orders
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Total Gross Order Value</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb' }}>
                        {formatLKR(ordersSummary.totalAmount)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Advance Payment Collected</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {formatLKR(ordersSummary.totalAdvance)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Remaining Balance on Orders</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#d97706' }}>
                        {formatLKR(ordersSummary.totalBalance)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Orders Settled in Full (Zero Bal)</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a' }}>
                        {ordersSummary.byPaymentStatus?.Paid || 0} Orders
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Orders with Balances Due</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#dc2626' }}>
                        {(ordersSummary.byPaymentStatus?.Partial || 0) + (ordersSummary.byPaymentStatus?.Unpaid || 0)} Orders
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: CASH & PAYMENT INFLOWS */}
                <div className="card" style={{ padding: 0, borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '5px', height: '22px', backgroundColor: '#d90429', borderRadius: '2px' }}></div>
                      <h3 style={{ margin: 0, fontSize: '1.14rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                        2. CASH & PAYMENT INFLOWS
                      </h3>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '0.84rem' }}>
                      {paymentsSummary.transactionCount || 0} Receipts Logged
                    </span>
                  </div>
                  <div style={{
                    padding: '20px 24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px 32px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Actual Cash / Bank Received Today</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a' }}>
                        {formatLKR(paymentsSummary.totalCollected)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Payment Transactions Count</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {paymentsSummary.transactionCount || 0} Receipts
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Fully Settled Order Transactions</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a' }}>
                        {paymentsSummary.fullySettledCount || 0} Completed
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Partial Installments Received</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#d97706' }}>
                        {paymentsSummary.partialPaymentCount || 0} Installments
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Cash Collections Total</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {formatLKR(paymentsSummary.byMethod?.Cash || 0)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Active Balance on Receiving Orders</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#dc2626' }}>
                        {formatLKR(paymentsSummary.totalOutstandingOnActiveOrders)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: STAFF ATTENDANCE & ROSTER */}
                <div className="card" style={{ padding: 0, borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '5px', height: '22px', backgroundColor: '#d90429', borderRadius: '2px' }}></div>
                      <h3 style={{ margin: 0, fontSize: '1.14rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                        3. STAFF ATTENDANCE & ROSTER
                      </h3>
                    </div>
                    <span className="badge badge-navy" style={{ fontSize: '0.84rem' }}>
                      {attendanceSummary.attendanceRate || 0}% Attendance Rate
                    </span>
                  </div>
                  <div style={{
                    padding: '20px 24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px 32px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Total Active Workforce Assigned</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {attendanceSummary.totalStaff || 0} Employees
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Present / On Duty Today</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a' }}>
                        {attendanceSummary.present || 0} Staff
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Completed Shift & Checked Out</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2563eb' }}>
                        {attendanceSummary.checkedOut || 0} Staff
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Absences Recorded Today</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: (attendanceSummary.absent || 0) > 0 ? '#dc2626' : 'var(--text-main)' }}>
                        {attendanceSummary.absent || 0} Absent
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Unmarked Roster Records</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {attendanceSummary.notMarked || 0} Pending
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Overall Branch Attendance Rate</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a' }}>
                        {attendanceSummary.attendanceRate || 0}% Turnout
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: PRODUCTION & MANUFACTURING PIPELINE */}
                <div className="card" style={{ padding: 0, borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '5px', height: '22px', backgroundColor: '#d90429', borderRadius: '2px' }}></div>
                      <h3 style={{ margin: 0, fontSize: '1.14rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                        4. PRODUCTION & MANUFACTURING PIPELINE
                      </h3>
                    </div>
                    <span className="badge badge-warning" style={{ fontSize: '0.84rem' }}>
                      {productionSummary.pendingWipCount || 0} Active WIP
                    </span>
                  </div>
                  <div style={{
                    padding: '20px 24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px 32px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Craftsman Tasks Finished Today</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a' }}>
                        {productionSummary.completedTasksCount || 0} Tasks
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Orders Cleared by QC to READY</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2563eb' }}>
                        {productionSummary.readyOrdersCount || 0} Ready
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Orders Delivered / Handed to Clients</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f766e' }}>
                        {productionSummary.deliveredOrdersCount || 0} Delivered
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Production Stage Transitions Logged</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {productionSummary.stageTransitionsCount || 0} Movements
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Active Work-in-Progress (Pipeline)</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#d97706' }}>
                        {productionSummary.pendingWipCount || 0} In Progress
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Cutting & Stitching WIP Load</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {(productionSummary.wipByStage?.CUTTING || 0) + (productionSummary.wipByStage?.STITCHING || 0)} Garments
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 5: EXECUTIVE SUMMARY / AUDIT STATEMENT */}
                <div className="card" style={{
                  padding: '22px 24px',
                  borderRadius: '10px',
                  borderLeft: '5px solid #d90429',
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid var(--border-color, #e2e8f0)',
                  borderRight: '1px solid var(--border-color, #e2e8f0)',
                  borderBottom: '1px solid var(--border-color, #e2e8f0)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.14rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                      5. EXECUTIVE SUMMARY / AUDIT STATEMENT
                    </h3>
                    <span className="badge badge-navy" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                      CERTIFIED OPERATIONAL AUDIT
                    </span>
                  </div>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
                    This executive report aggregates certified production and ledger entries for <strong>{selectedDate}</strong> in accordance with JB GROUP PVT LTD / Bella Design operational policies. All financial receipts, attendance clock-ins, and production movements are logged directly from live PostgreSQL database records with strict Asia/Colombo date boundaries.
                  </p>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Official ERP Audit Seal • Generated by {user?.name || 'Authorized User'} ({user?.role || 'Management'}) • Timezone: Asia/Colombo (UTC+05:30) • Status: System Verified
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 2. ORDERS TABLE                                                */}
          {/* ============================================================== */}
          {(viewFilter === 'all' || viewFilter === 'orders') && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Orders Table
                  </h3>
                  <span className="badge badge-navy" style={{ fontSize: '0.75rem' }}>
                    {reportData.orders?.records?.length || 0} Records
                  </span>
                </div>

                <button
                  onClick={() => handleDownloadPDF('orders')}
                  disabled={downloadingReport === 'orders'}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', padding: '6px 12px' }}
                >
                  <Download size={13} />
                  {downloadingReport === 'orders' ? 'Exporting...' : 'Download Orders PDF'}
                </button>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '8px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Order Number</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Customer Name</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Garment Specs</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Order Status</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700, textAlign: 'right' }}>Amount (LKR)</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Payment Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!reportData.orders?.records || reportData.orders.records.length === 0) ? (
                        <tr>
                          <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No orders booked on this date.
                          </td>
                        </tr>
                      ) : (
                        reportData.orders.records.map((ord, idx) => (
                          <tr key={ord.id} style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff'
                          }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-main)' }}>
                              {ord.orderNumber}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontWeight: 600 }}>{ord.customerName}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>({ord.customerPhone})</span>
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                              {ord.dressType} ({ord.quantity} pcs)
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span className="badge badge-navy" style={{ fontSize: '0.8rem' }}>
                                {ord.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                              {formatLKR(ord.totalAmount)}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span className={`badge ${ord.paymentStatus === 'Paid' ? 'badge-success' : ord.paymentStatus === 'Partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.8rem' }}>
                                {ord.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {reportData.orders?.records?.length > 0 && (
                      <tfoot>
                        <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}>
                          <td colSpan="4" style={{ padding: '12px 14px', color: 'var(--text-main)' }}>
                            Total ({reportData.orders.records.length} Orders):
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            {formatLKR(ordersSummary.totalAmount)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 3. ATTENDANCE TABLE                                            */}
          {/* ============================================================== */}
          {(viewFilter === 'all' || viewFilter === 'attendance') && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Attendance Table
                  </h3>
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                    {attendanceSummary.present || 0} Present / {attendanceSummary.totalStaff || 0} Staff
                  </span>
                </div>

                <button
                  onClick={() => handleDownloadPDF('attendance')}
                  disabled={downloadingReport === 'attendance'}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', padding: '6px 12px' }}
                >
                  <Download size={13} />
                  {downloadingReport === 'attendance' ? 'Exporting...' : 'Download Attendance PDF'}
                </button>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '8px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Employee Name</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Role</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Branch</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Present / Absent</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Check-in Time</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Check-out Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!reportData.attendance?.records || reportData.attendance.records.length === 0) ? (
                        <tr>
                          <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No staff roster records found.
                          </td>
                        </tr>
                      ) : (
                        reportData.attendance.records.map((att, idx) => (
                          <tr key={att.userId} style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff'
                          }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-main)' }}>
                              {att.employeeName}
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                              {att.role}
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                              {att.branchName}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span className={`badge ${
                                att.attendanceStatus === 'Present' ? 'badge-success' :
                                att.attendanceStatus === 'Checked Out' ? 'badge-navy' :
                                att.attendanceStatus === 'Absent' ? 'badge-danger' : 'badge-warning'
                              }`} style={{ fontSize: '0.8rem' }}>
                                {att.attendanceStatus}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-main)', fontWeight: 600 }}>
                              {att.checkInTime}
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                              {att.checkOutTime}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 4. PAYMENTS TABLE                                              */}
          {/* ============================================================== */}
          {(viewFilter === 'all' || viewFilter === 'payments') && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Payments Table
                  </h3>
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                    {formatLKR(paymentsSummary.totalCollected)} Collected Today
                  </span>
                </div>

                <button
                  onClick={() => handleDownloadPDF('payments')}
                  disabled={downloadingReport === 'payments'}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', padding: '6px 12px' }}
                >
                  <Download size={13} />
                  {downloadingReport === 'payments' ? 'Exporting...' : 'Download Payments PDF'}
                </button>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '8px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Order Number</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Customer Name</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Payment Method</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700, textAlign: 'right' }}>Payment Received Today</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700, textAlign: 'right' }}>Outstanding Balance</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Time Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!reportData.payments?.records || reportData.payments.records.length === 0) ? (
                        <tr>
                          <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No payment transactions logged for this date.
                          </td>
                        </tr>
                      ) : (
                        reportData.payments.records.map((pay, idx) => (
                          <tr key={pay.paymentId} style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff'
                          }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-main)' }}>
                              {pay.orderNumber}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontWeight: 600 }}>{pay.customerName}</span>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span className="badge badge-navy" style={{ fontSize: '0.8rem' }}>
                                {pay.paymentMethod}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                              {formatLKR(pay.amountCollected)}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: pay.currentOutstandingBalance > 0 ? '#dc2626' : '#16a34a' }}>
                              {formatLKR(pay.currentOutstandingBalance)}
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                              {pay.paymentTime}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {reportData.payments?.records?.length > 0 && (
                      <tfoot>
                        <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 800 }}>
                          <td colSpan="3" style={{ padding: '12px 14px', color: 'var(--text-main)' }}>
                            Total Collections Today ({reportData.payments.records.length} Receipts):
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#16a34a', fontSize: '0.95rem' }}>
                            {formatLKR(paymentsSummary.totalCollected)}
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 5. PRODUCTION JOURNEY (Pending WIP & Milestones)                */}
          {/* ============================================================== */}
          {(viewFilter === 'all' || viewFilter === 'production') && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Production & Pending Orders
                  </h3>
                  <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                    {productionSummary.pendingWipCount || 0} In Progress
                  </span>
                </div>

                <button
                  onClick={() => handleDownloadPDF('production')}
                  disabled={downloadingReport === 'production'}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', padding: '6px 12px' }}
                >
                  <Download size={13} />
                  {downloadingReport === 'production' ? 'Exporting...' : 'Download Production PDF'}
                </button>
              </div>

              <div className="card" style={{ padding: '18px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                  {Object.entries(productionSummary.wipByStage || {}).map(([stage, count]) => (
                    <span key={stage} className="badge badge-navy" style={{ padding: '5px 10px', fontSize: '0.75rem' }}>
                      {stage}: <strong>{count}</strong>
                    </span>
                  ))}
                </div>

                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>Order #</th>
                        <th style={{ padding: '10px 12px' }}>Customer</th>
                        <th style={{ padding: '10px 12px' }}>Garment</th>
                        <th style={{ padding: '10px 12px' }}>Stage</th>
                        <th style={{ padding: '10px 12px' }}>Assigned Craftsman</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.production?.data?.pendingWip?.slice(0, 15).map(w => (
                        <tr key={w.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>{w.orderNumber}</td>
                          <td style={{ padding: '10px 12px' }}>{w.customerName}</td>
                          <td style={{ padding: '10px 12px' }}>{w.dressType}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                              {w.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{w.assignedTailor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
