import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
  CreditCard,
  DollarSign,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Scissors,
  Users,
  Award,
  Download,
  Printer,
  FileText,
  X,
  Check,
  Building,
  Info,
  TrendingUp,
  Layers,
  ArrowRight,
  ShieldCheck,
  Send
} from 'lucide-react';

export const WeeklySalaryERP = () => {
  const { user, getAuthHeaders, activeBranch } = useAuth();
  const printRef = useRef(null);

  // Role detection and authority levels
  const userRole = (user?.role || '').toUpperCase();
  const isCeo = userRole === 'SUPER_ADMIN' || userRole === 'CEO';
  const isManager = userRole === 'MANAGER';
  const isAdmin = userRole === 'ADMIN';
  const canDisburse = isCeo || isManager;

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);

  // Navigation & Week selection
  // Reference date in YYYY-MM-DD
  const [selectedWeekDate, setSelectedWeekDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // Filter states: Manager is strictly locked to their assigned branch
  const [branchFilter, setBranchFilter] = useState(() => {
    if (user?.role === 'MANAGER' && user?.branchId) {
      return String(user.branchId);
    }
    return activeBranch || 'ALL';
  });
  const [tailorFilter, setTailorFilter] = useState('ALL');
  const [workTypeFilter, setWorkTypeFilter] = useState('ALL'); // 'ALL' | 'CUTTING' | 'STITCHING'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PAYABLE' | 'ON_HOLD_CUSTOMER_PAYMENT' | 'WORK_PENDING' | 'PAID'
  const [searchQuery, setSearchQuery] = useState('');

  // Sub-view tab
  const [activeSubTab, setActiveSubTab] = useState('allocations'); // 'allocations' | 'tailors' | 'breakdown' | 'holds' | 'history'

  // Payment Recording Modal State
  const [recordingPaymentAlloc, setRecordingPaymentAlloc] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amountPaid: '',
    paymentMethod: 'Cash',
    referenceNo: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState(null);

  // Fetch report data from backend API
  const fetchSalaryReport = async (refDate = selectedWeekDate) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (refDate) params.append('week', refDate);
      if (branchFilter && branchFilter !== 'ALL') params.append('branchId', branchFilter);
      if (tailorFilter && tailorFilter !== 'ALL') params.append('tailorId', tailorFilter);
      if (workTypeFilter && workTypeFilter !== 'ALL') params.append('workType', workTypeFilter);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`${API_URL}/api/salary/weekly-report?${params.toString()}`, {
        headers: getAuthHeaders ? getAuthHeaders() : {
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });

      const data = await res.json();
      if (data.success) {
        setReportData(data);
      } else {
        setError(data.message || 'Failed to load weekly salary report');
      }
    } catch (err) {
      console.error('Error fetching weekly salary report:', err);
      setError('Network error connecting to salary calculation server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaryReport(selectedWeekDate);
  }, [selectedWeekDate, branchFilter, tailorFilter, workTypeFilter, statusFilter]);

  // Jump to previous week
  const handlePrevWeek = () => {
    const current = new Date(selectedWeekDate);
    current.setDate(current.getDate() - 7);
    setSelectedWeekDate(current.toISOString().split('T')[0]);
  };

  // Jump to next week
  const handleNextWeek = () => {
    const current = new Date(selectedWeekDate);
    current.setDate(current.getDate() + 7);
    setSelectedWeekDate(current.toISOString().split('T')[0]);
  };

  // Reset to current week
  const handleResetCurrentWeek = () => {
    const now = new Date();
    setSelectedWeekDate(now.toISOString().split('T')[0]);
  };

  // Open Payment Modal (Guarded: CEO and Manager only)
  const handleOpenPaymentModal = (alloc) => {
    if (!canDisburse) {
      alert('Access Denied: Financial payment disbursement requires Manager or CEO authorization.');
      return;
    }
    setPaymentFeedback(null);
    setRecordingPaymentAlloc(alloc);
    setPaymentForm({
      amountPaid: alloc.allocatedAmount,
      paymentMethod: 'Cash',
      referenceNo: '',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: `Weekly tailor salary disbursement for ${alloc.workTypeName} on ${alloc.orderNumber}`
    });
  };

  // Submit Payment Record
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!recordingPaymentAlloc) return;

    try {
      setSubmittingPayment(true);
      setPaymentFeedback(null);

      const res = await fetch(`${API_URL}/api/salary/record-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders ? getAuthHeaders() : { 'Authorization': `Bearer ${localStorage.getItem('jb_token')}` })
        },
        body: JSON.stringify({
          orderId: recordingPaymentAlloc.orderId,
          tailorId: recordingPaymentAlloc.tailorId,
          workType: recordingPaymentAlloc.workType,
          amountPaid: parseFloat(paymentForm.amountPaid),
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          referenceNo: paymentForm.referenceNo,
          notes: paymentForm.notes
        })
      });

      const data = await res.json();
      if (data.success) {
        setPaymentFeedback({ type: 'success', message: data.message });
        setTimeout(() => {
          setRecordingPaymentAlloc(null);
          fetchSalaryReport(selectedWeekDate);
        }, 1200);
      } else {
        setPaymentFeedback({ type: 'error', message: data.message || 'Payment recording failed.' });
      }
    } catch (err) {
      console.error('Error recording salary payment:', err);
      setPaymentFeedback({ type: 'error', message: 'Network error recording payment.' });
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Trigger Print / PDF
  const handlePrint = () => {
    window.print();
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'PAYABLE':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800,
            backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0'
          }}>
            <CheckCircle2 size={12} /> PAYABLE
          </span>
        );
      case 'ON_HOLD_CUSTOMER_PAYMENT':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800,
            backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a'
          }}>
            <AlertTriangle size={12} /> HELD (CUSTOMER UNPAID)
          </span>
        );
      case 'WORK_PENDING':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
            backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1'
          }}>
            <Clock size={12} /> WORK PENDING
          </span>
        );
      case 'PAID':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800,
            backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe'
          }}>
            <Check size={12} /> PAID
          </span>
        );
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  const summary = reportData?.summary || {
    totalEarnedInWeek: 0,
    totalPayable: 0,
    totalHeldOnCustomerPayment: 0,
    totalWorkPending: 0,
    totalPaidInWeek: 0,
    totalCarriedForward: 0,
    participatingTailorsCount: 0
  };

  const weekRange = reportData?.weekRange;

  // Unique tailors list for filter
  const tailorsList = useMemo(() => {
    return reportData?.tailorStatements || [];
  }, [reportData]);

  return (
    <div className="module-container-responsive" style={{ padding: '24px' }} ref={printRef}>
      {/* 1. Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            color: 'var(--jb-blue-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CreditCard size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 850, color: 'var(--text-main)', margin: 0 }}>
              Weekly Tailor Salary Management
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>

            </p>
          </div>
        </div>

        {/* Action Controls: Print + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handlePrint}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <Printer size={15} /> Print / Export
          </button>
          <button
            onClick={() => fetchSalaryReport(selectedWeekDate)}
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px',
              border: 'none', backgroundColor: 'var(--jb-blue-accent)',
              color: '#ffffff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Role-Specific Operational Visibility Banner */}
      {isCeo && (
        <div style={{
          backgroundColor: '#1e3a8a',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 2px 8px rgba(30, 58, 138, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={22} color="#93c5fd" />
            <div>
              <strong style={{ fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>👑 CEO Consolidated Executive View</span>
              </strong>
              <div style={{ fontSize: '0.78rem', color: '#bfdbfe', marginTop: '2px' }}>
                Organization-wide visibility across all branches, participating tailors, and authorized disbursements.
              </div>
            </div>
          </div>
          <span style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.4px'
          }}>
            FULL FINANCIAL &amp; PAYOUT AUTHORITY
          </span>
        </div>
      )}

      {isManager && (
        <div style={{
          backgroundColor: '#0f766e',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 2px 8px rgba(15, 118, 110, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building size={22} color="#99f6e4" />
            <div>
              <strong style={{ fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>👔 Manager Operational Scope — {user?.branchName || (user?.branchId === 2 ? 'Bella Design' : 'JB Group (Main)')}</span>
              </strong>
              <div style={{ fontSize: '0.78rem', color: '#ccfbf1', marginTop: '2px' }}>
                Restricted strictly to your authorised branch. Monitor tailor work completion, payment holds, and execute branch disbursements.
              </div>
            </div>
          </div>
          <span style={{
            backgroundColor: '#0d9488',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.4px'
          }}>
            BRANCH OPERATIONAL SCOPE
          </span>
        </div>
      )}

      {isAdmin && (
        <div style={{
          backgroundColor: '#334155',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 2px 8px rgba(51, 65, 85, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={22} color="#cbd5e1" />
            <div>
              <strong style={{ fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛡️ Admin Financial Oversight (Read-Only Payouts)</span>
              </strong>
              <div style={{ fontSize: '0.78rem', color: '#e2e8f0', marginTop: '2px' }}>
                Auditing tailor salary allocations, weekly statements, and reports. Actual payment execution authority is reserved for Manager or CEO.
              </div>
            </div>
          </div>
          <span style={{
            backgroundColor: '#1e293b',
            color: '#cbd5e1',
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.4px',
            border: '1px solid #475569'
          }}>
            FINANCIAL OVERSIGHT &amp; AUDIT ONLY
          </span>
        </div>
      )}

      {/* 2. Business Payment Rule Card Banner */}
      <div style={{
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
        border: '1px solid rgba(37, 99, 235, 0.2)',
        borderRadius: '12px',
        padding: '12px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={20} color="#2563eb" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600 }}>
            <strong>Business Allocation Formula:</strong> 50% Office • 25% Cutting Tailor • 25% Stitching Tailor.
            Allocation becomes <strong>PAYABLE</strong> only when work is completed <em>AND</em> customer has fully settled the agreed order price.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#065f46' }}>
            Office: 50%
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1e40af' }}>
            Cutting: 25%
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#f5f3ff', color: '#5b21b6' }}>
            Stitching: 25%
          </span>
        </div>
      </div>

      {/* 3. Week Selector Toolbar */}
      <div className="card" style={{
        padding: '12px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        borderLeft: '4px solid var(--jb-blue-accent)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Calendar size={18} color="var(--jb-blue-accent)" />
          <div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.5px' }}>
              Business Week (Asia/Colombo UTC+5:30)
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-main)' }}>
              {weekRange ? weekRange.formattedRange : 'Loading Week...'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handlePrevWeek}
            title="Previous Week"
            style={{
              padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', cursor: 'pointer',
              display: 'flex', alignItems: 'center'
            }}
          >
            <ChevronLeft size={16} /> Prev Week
          </button>

          <button
            onClick={handleResetCurrentWeek}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--jb-blue-accent)',
              backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--jb-blue-accent)',
              fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer'
            }}
          >
            Current Week
          </button>

          <button
            onClick={handleNextWeek}
            title="Next Week"
            style={{
              padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', cursor: 'pointer',
              display: 'flex', alignItems: 'center'
            }}
          >
            Next Week <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 4. 7 Executive Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        {/* Card 1: Total Earned in Week */}
        <div className="card" style={{ padding: '16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Earned (Week)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                LKR {summary.totalEarnedInWeek.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
              <Award size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Work completed within selected week
          </div>
        </div>

        {/* Card 2: Salary Payable */}
        <div className="card" style={{ padding: '16px', borderLeft: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                Salary Payable
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#065f46', marginTop: '4px' }}>
                LKR {summary.totalPayable.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#059669' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '8px', fontWeight: 600 }}>
            Ready for disbursement (customer fully paid)
          </div>
        </div>

        {/* Card 3: Held on Customer Payment */}
        <div className="card" style={{ padding: '16px', borderLeft: '3px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                Held (Customer Payment)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#92400e', marginTop: '4px' }}>
                LKR {summary.totalHeldOnCustomerPayment.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fffbeb', color: '#b45309' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: '8px', fontWeight: 600 }}>
            Work done • Waiting customer full settlement
          </div>
        </div>

        {/* Card 4: Work Pending */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Work Pending
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                LKR {summary.totalWorkPending.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#64748b' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Assigned cutting/stitching in progress
          </div>
        </div>

        {/* Card 5: Salary Paid in Week */}
        <div className="card" style={{ padding: '16px', borderLeft: '3px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase' }}>
                Salary Paid (Week)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#5b21b6', marginTop: '4px' }}>
                LKR {summary.totalPaidInWeek.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#6d28d9', marginTop: '8px', fontWeight: 600 }}>
            Disbursed in this week's period
          </div>
        </div>

        {/* Card 6: Carried Forward Unpaid */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Carried Forward
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                LKR {summary.totalCarriedForward.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0284c7' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Eligible unpaid from earlier weeks
          </div>
        </div>

        {/* Card 7: Participating Tailors */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Active Tailors
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                {summary.participatingTailorsCount} Tailors
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            With assigned or completed jobs
          </div>
        </div>
      </div>

      {/* 5. Sub-navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '18px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {[
          { id: 'allocations', label: 'All Salary Allocations', icon: Layers, badge: reportData?.allocations?.length },
          { id: 'tailors', label: 'Individual Tailor Statements', icon: Users, badge: tailorsList.length },
          { id: 'breakdown', label: 'Cutting vs Stitching (25/25/50)', icon: Scissors },
          { id: 'holds', label: 'Customer-Payment Holds', icon: AlertTriangle, badge: reportData?.allocations?.filter(a => a.status === 'ON_HOLD_CUSTOMER_PAYMENT').length },
          { id: 'history', label: 'Disbursement History Ledger', icon: FileText, badge: reportData?.recentPayments?.length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--jb-blue-accent)' : '3px solid transparent',
                backgroundColor: isActive ? 'var(--bg-main)' : 'transparent',
                color: isActive ? 'var(--jb-blue-accent)' : 'var(--text-muted)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '999px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  backgroundColor: isActive ? 'var(--jb-blue-accent)' : 'rgba(100, 116, 139, 0.15)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)'
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 6. Filter Controls Bar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search order, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px 7px 32px', borderRadius: '6px',
                  border: '1px solid var(--border-color)', fontSize: '0.8rem',
                  backgroundColor: 'var(--bg-main)', color: 'var(--text-main)'
                }}
              />
            </div>

            {/* Work Type Filter */}
            <select
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
              style={{
                padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                fontSize: '0.8rem', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontWeight: 600
              }}
            >
              <option value="ALL">All Work Types (Cutting &amp; Stitching)</option>
              <option value="CUTTING">✂️ Cutting Only (25%)</option>
              <option value="STITCHING">🧵 Stitching Only (25%)</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                fontSize: '0.8rem', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontWeight: 600
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PAYABLE">🟢 PAYABLE (Ready to Disburse)</option>
              <option value="ON_HOLD_CUSTOMER_PAYMENT">🟡 ON HOLD (Customer Payment Due)</option>
              <option value="WORK_PENDING">⚪ WORK PENDING</option>
              <option value="PAID">🟣 PAID (Disbursed)</option>
            </select>

            {/* Tailor Filter */}
            <select
              value={tailorFilter}
              onChange={(e) => setTailorFilter(e.target.value)}
              style={{
                padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                fontSize: '0.8rem', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontWeight: 600
              }}
            >
              <option value="ALL">All Tailors &amp; Craftsmen</option>
              {tailorsList.map(t => (
                <option key={t.tailorId} value={t.tailorId}>
                  {t.tailorName} ({t.jobsCount} jobs)
                </option>
              ))}
            </select>

            {/* Branch Filter — Locked to assigned branch for Managers */}
            {isManager ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-main)',
                border: '1.5px solid #0d9488', fontSize: '0.8rem', fontWeight: 700, color: '#0f766e'
              }}>
                <Building size={14} />
                <span>{user?.branchName || (user?.branchId === 2 ? 'Bella Design' : 'JB Group (Main)')} (Locked Scope)</span>
              </div>
            ) : (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                style={{
                  padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                  fontSize: '0.8rem', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontWeight: 600
                }}
              >
                <option value="ALL">All Branches</option>
                <option value="1">JB Group (Main)</option>
                <option value="2">Bella Design</option>
              </select>
            )}
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
            Showing <strong>{reportData?.filteredCount || 0}</strong> of <strong>{reportData?.allAllocationsCount || 0}</strong> allocations
          </div>
        </div>
      </div>

      {/* 7. Loading / Error States */}
      {loading && (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div>Computing Weekly Salary Allocations directly from authoritative PostgreSQL records...</div>
        </div>
      )}

      {error && !loading && (
        <div style={{
          padding: '20px', borderRadius: '10px', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', color: '#991b1b', marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* 8. TAB 1: ALL ALLOCATIONS LEDGER */}
      {!loading && !error && activeSubTab === 'allocations' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Order #</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Tailor</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Work Type</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Agreed Price</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>25% Share</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Work Status</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Customer Settlement</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Salary Status</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportData?.allocations?.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No salary allocations found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  reportData?.allocations?.map((alloc) => (
                    <tr
                      key={alloc.allocationKey}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: alloc.status === 'PAYABLE' ? 'rgba(16, 185, 129, 0.02)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{alloc.orderNumber}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {alloc.customerName} • {alloc.dressType}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{alloc.tailorName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{alloc.branchName}</div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontWeight: 700, color: alloc.workType === 'CUTTING' ? '#1e40af' : '#6b21a8'
                        }}>
                          {alloc.workType === 'CUTTING' ? '✂️ Cutting' : '🧵 Stitching'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                        LKR {alloc.agreedPrice.toLocaleString()}
                      </td>

                      <td style={{ padding: '12px 14px', fontWeight: 900, color: 'var(--text-main)' }}>
                        LKR {alloc.allocatedAmount.toLocaleString()}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {alloc.isWorkCompleted ? (
                          <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> Completed
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 500 }}>
                              ({alloc.workCompletedAt ? new Date(alloc.workCompletedAt).toLocaleDateString() : 'Yes'})
                            </span>
                          </div>
                        ) : (
                          <div style={{ color: '#64748b', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={13} /> In Progress
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {alloc.isCustomerFullyPaid ? (
                          <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> Fully Settled (100%)
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: '#b45309', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={13} /> {alloc.customerPaymentStatus}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#b45309' }}>
                              Due: LKR {alloc.customerBalanceDue.toLocaleString()}
                            </div>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        {renderStatusBadge(alloc.status)}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        {alloc.status === 'PAYABLE' && (
                          canDisburse ? (
                            <button
                              onClick={() => handleOpenPaymentModal(alloc)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <DollarSign size={13} /> Record Payment
                            </button>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                backgroundColor: '#ecfdf5',
                                color: '#065f46',
                                border: '1px solid #a7f3d0'
                              }}
                              title="Financial payment disbursement requires Manager or CEO authorization"
                            >
                              <CheckCircle2 size={11} /> Payable (Approval req. Mgr/CEO)
                            </span>
                          )
                        )}

                        {alloc.status === 'PAID' && (
                          <div style={{ fontSize: '0.7rem', color: '#6b21a8', fontWeight: 700 }}>
                            ✓ Paid: {alloc.paymentRecord?.paymentMethod || 'Cash'}
                          </div>
                        )}

                        {alloc.status === 'ON_HOLD_CUSTOMER_PAYMENT' && (
                          <span style={{ fontSize: '0.7rem', color: '#b45309', fontStyle: 'italic' }}>
                            Hold for customer payment
                          </span>
                        )}

                        {alloc.status === 'WORK_PENDING' && (
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            Awaiting work completion
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. TAB 2: INDIVIDUAL TAILOR STATEMENTS */}
      {!loading && !error && activeSubTab === 'tailors' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {tailorsList.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
              No active tailor statements for this period.
            </div>
          ) : (
            tailorsList.map((stmt) => (
              <div key={stmt.tailorId} className="card" style={{ padding: '18px', borderTop: '4px solid var(--jb-blue-accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850, color: 'var(--text-main)' }}>
                      {stmt.tailorName}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {stmt.branchName} • {stmt.jobsCount} Assigned Jobs
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800 }}>
                      Outstanding Due
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#059669' }}>
                      LKR {stmt.outstandingBalance.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px',
                  backgroundColor: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '8px', marginBottom: '14px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Earned (Week):</span>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>LKR {stmt.totalEarnedInWeek.toLocaleString()}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Payable Now:</span>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#059669' }}>LKR {stmt.totalPayable.toLocaleString()}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Held (Customer Due):</span>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#b45309' }}>LKR {stmt.totalHeld.toLocaleString()}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Paid (Week):</span>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#6b21a8' }}>LKR {stmt.totalPaidInWeek.toLocaleString()}</div>
                  </div>
                </div>

                {/* Job List preview */}
                <div style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Assigned Jobs Breakdown ({stmt.jobs.length})
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {stmt.jobs.map(job => (
                    <div
                      key={job.allocationKey}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem'
                      }}
                    >
                      <div>
                        <strong>{job.orderNumber}</strong> ({job.workType})
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{job.dressType}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800 }}>LKR {job.allocatedAmount.toLocaleString()}</div>
                        {renderStatusBadge(job.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 10. TAB 3: CUTTING VS STITCHING BREAKDOWN */}
      {!loading && !error && activeSubTab === 'breakdown' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {/* Office 50% Card */}
          <div className="card" style={{ padding: '20px', borderTop: '4px solid #1e3a8a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Building size={22} color="#1e3a8a" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850 }}>Office Allocation (50%)</h3>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e3a8a', marginBottom: '8px' }}>
              LKR {reportData?.cuttingVsStitching?.office?.totalAllocated?.toLocaleString()}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>
              The 50% office allocation represents company overhead, profit margin, operational facilities, utilities, and management expenses. It is strictly excluded from tailor salary disbursements.
            </p>
          </div>

          {/* Cutting 25% Card */}
          <div className="card" style={{ padding: '20px', borderTop: '4px solid #0284c7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Scissors size={22} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850 }}>Cutting Tailors (25%)</h3>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0284c7', marginBottom: '8px' }}>
              LKR {reportData?.cuttingVsStitching?.cutting?.totalAllocated?.toLocaleString()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
              <div>Completed Jobs: <strong>{reportData?.cuttingVsStitching?.cutting?.completedCount}</strong></div>
              <div>Payable Now: <strong style={{ color: '#059669' }}>LKR {reportData?.cuttingVsStitching?.cutting?.payableAmount?.toLocaleString()}</strong></div>
              <div>Already Paid: <strong style={{ color: '#6b21a8' }}>LKR {reportData?.cuttingVsStitching?.cutting?.paidAmount?.toLocaleString()}</strong></div>
            </div>
          </div>

          {/* Stitching 25% Card */}
          <div className="card" style={{ padding: '20px', borderTop: '4px solid #7c3aed' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Award size={22} color="#7c3aed" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850 }}>Stitching Tailors (25%)</h3>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#7c3aed', marginBottom: '8px' }}>
              LKR {reportData?.cuttingVsStitching?.stitching?.totalAllocated?.toLocaleString()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
              <div>Completed Jobs: <strong>{reportData?.cuttingVsStitching?.stitching?.completedCount}</strong></div>
              <div>Payable Now: <strong style={{ color: '#059669' }}>LKR {reportData?.cuttingVsStitching?.stitching?.payableAmount?.toLocaleString()}</strong></div>
              <div>Already Paid: <strong style={{ color: '#6b21a8' }}>LKR {reportData?.cuttingVsStitching?.stitching?.paidAmount?.toLocaleString()}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* 11. TAB 4: CUSTOMER PAYMENT HOLDS */}
      {!loading && !error && activeSubTab === 'holds' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px', backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: 800 }}>
              <AlertTriangle size={18} /> Customer Payment Hold Radar
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#92400e' }}>
              These bespoke garments have been completed by the tailor, but the salary allocation is held because the customer has an outstanding balance. Once full payment is settled, the salary immediately becomes PAYABLE.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 14px' }}>Order #</th>
                  <th style={{ padding: '10px 14px' }}>Customer Name</th>
                  <th style={{ padding: '10px 14px' }}>Tailor</th>
                  <th style={{ padding: '10px 14px' }}>Work</th>
                  <th style={{ padding: '10px 14px' }}>Total Agreed</th>
                  <th style={{ padding: '10px 14px' }}>Customer Paid</th>
                  <th style={{ padding: '10px 14px' }}>Balance Outstanding</th>
                  <th style={{ padding: '10px 14px' }}>Tailor Share (Held)</th>
                </tr>
              </thead>
              <tbody>
                {reportData?.allocations?.filter(a => a.status === 'ON_HOLD_CUSTOMER_PAYMENT').length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#059669', fontWeight: 700 }}>
                      ✓ No salary allocations are currently on hold. All completed work has full customer payment verified!
                    </td>
                  </tr>
                ) : (
                  reportData?.allocations?.filter(a => a.status === 'ON_HOLD_CUSTOMER_PAYMENT').map(a => (
                    <tr key={a.allocationKey} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 800 }}>{a.orderNumber}</td>
                      <td style={{ padding: '10px 14px' }}>{a.customerName}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{a.tailorName}</td>
                      <td style={{ padding: '10px 14px' }}>{a.workTypeName}</td>
                      <td style={{ padding: '10px 14px' }}>LKR {a.agreedPrice.toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', color: '#059669', fontWeight: 600 }}>LKR {a.customerTotalPaid.toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', color: '#dc2626', fontWeight: 800 }}>LKR {a.customerBalanceDue.toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 900, color: '#b45309' }}>LKR {a.allocatedAmount.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 12. TAB 5: SALARY PAYMENT HISTORY LEDGER */}
      {!loading && !error && activeSubTab === 'history' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
            Audit Trail of Recorded Salary Disbursements
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 14px' }}>Disbursement Date</th>
                  <th style={{ padding: '10px 14px' }}>Order Number</th>
                  <th style={{ padding: '10px 14px' }}>Work Type</th>
                  <th style={{ padding: '10px 14px' }}>Amount Disbursed</th>
                  <th style={{ padding: '10px 14px' }}>Method</th>
                  <th style={{ padding: '10px 14px' }}>Receipt / Ref</th>
                  <th style={{ padding: '10px 14px' }}>Authorised By</th>
                  <th style={{ padding: '10px 14px' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {reportData?.recentPayments?.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No salary disbursements recorded in this period yet.
                    </td>
                  </tr>
                ) : (
                  reportData?.recentPayments?.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 14px' }}>{new Date(p.paymentDate).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{p.orderNumber}</td>
                      <td style={{ padding: '10px 14px' }}>{p.workType}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 900, color: '#059669' }}>LKR {Number(p.amountPaid).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px' }}>{p.paymentMethod}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{p.referenceNo || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{p.recordedByName}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{p.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 13. RECORD SALARY PAYMENT MODAL */}
      {recordingPaymentAlloc && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1200, padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '16px', width: '100%',
            maxWidth: '520px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={22} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 850 }}>
                  Record Tailor Salary Payment
                </h3>
              </div>
              <button onClick={() => setRecordingPaymentAlloc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* Allocation Details Summary */}
            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.82rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <div><strong>Tailor:</strong> {recordingPaymentAlloc.tailorName}</div>
                <div><strong>Work Type:</strong> {recordingPaymentAlloc.workTypeName} (25%)</div>
                <div><strong>Order #:</strong> {recordingPaymentAlloc.orderNumber}</div>
                <div><strong>Customer:</strong> {recordingPaymentAlloc.customerName}</div>
                <div><strong>Agreed Price:</strong> LKR {recordingPaymentAlloc.agreedPrice.toLocaleString()}</div>
                <div><strong>Allocation Due:</strong> <span style={{ color: '#059669', fontWeight: 800 }}>LKR {recordingPaymentAlloc.allocatedAmount.toLocaleString()}</span></div>
              </div>
            </div>

            {paymentFeedback && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.8rem',
                backgroundColor: paymentFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
                color: paymentFeedback.type === 'success' ? '#065f46' : '#991b1b',
                border: paymentFeedback.type === 'success' ? '1px solid #a7f3d0' : '1px solid #fecaca'
              }}>
                {paymentFeedback.message}
              </div>
            )}

            <form onSubmit={handleSubmitPayment}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Amount to Disburse (LKR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={paymentForm.amountPaid}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amountPaid: e.target.value })}
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.9rem', fontWeight: 800 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      Payment Method *
                    </label>
                    <select
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Reference / Receipt Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SLIP-2026-104 or Cheque #"
                    value={paymentForm.referenceNo}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Notes
                  </label>
                  <input
                    type="text"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setRecordingPaymentAlloc(null)}
                  style={{
                    padding: '9px 16px', borderRadius: '6px', border: '1px solid var(--border-color)',
                    backgroundColor: '#f8fafc', color: '#475569', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  style={{
                    padding: '9px 20px', borderRadius: '6px', border: 'none',
                    backgroundColor: '#10b981', color: '#ffffff', fontSize: '0.82rem', fontWeight: 800,
                    cursor: submittingPayment ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Send size={14} /> {submittingPayment ? 'Recording...' : 'Confirm Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
