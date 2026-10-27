import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Check
} from 'lucide-react';

export const TailorSalaryPanel = () => {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [salaryData, setSalaryData] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchMySalary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/salary/my-salary`, {
        headers: getAuthHeaders ? getAuthHeaders() : {
          'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setSalaryData(data);
      } else {
        setError(data.message || 'Failed to load personal salary statement.');
      }
    } catch (err) {
      console.error('Error fetching tailor salary:', err);
      setError('Network error connecting to salary calculation server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySalary();
  }, []);

  const summary = salaryData?.summary || {
    totalEarnedInWeek: 0,
    totalPayable: 0,
    totalHeldOnCustomerPayment: 0,
    totalWorkPending: 0,
    totalPaidInWeek: 0,
    totalCarriedForward: 0,
    outstandingBalance: 0
  };

  const weekRange = salaryData?.weekRange;

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'PAYABLE':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800,
            backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0'
          }}>
            <CheckCircle2 size={12} /> PAYABLE
          </span>
        );
      case 'ON_HOLD_CUSTOMER_PAYMENT':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800,
            backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a'
          }}>
            <AlertTriangle size={12} /> HELD (CUSTOMER PAYMENT)
          </span>
        );
      case 'WORK_PENDING':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
            backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1'
          }}>
            <Clock size={12} /> WORK PENDING
          </span>
        );
      case 'PAID':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800,
            backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe'
          }}>
            <Check size={12} /> PAID
          </span>
        );
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  const filteredAllocations = (salaryData?.allocations || []).filter(a => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 10px' }} />
        <div>Loading your weekly tailor earnings and statements...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b' }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {/* 1. Header Banner */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '14px', marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 850, color: 'var(--text-main)' }}>
            My Weekly Tailor Earnings &amp; Salary Statement
          </h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Craftsman: <strong>{salaryData?.tailor?.name}</strong> • Business Week: {weekRange?.formattedRange}
          </span>
        </div>

        <button
          onClick={fetchMySalary}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} /> Refresh My Salary
        </button>
      </div>

      {/* 2. Rule reminder */}
      <div style={{
        padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.05)',
        border: '1px solid rgba(37, 99, 235, 0.2)', marginBottom: '18px', fontSize: '0.8rem', color: 'var(--text-main)'
      }}>
        💡 <strong>Salary Earning Rule:</strong> You receive exactly 25% of the agreed garment price for cutting and 25% for stitching. Salary becomes <strong>PAYABLE</strong> when your assigned work is marked completed and the customer has fully settled the order.
      </div>

      {/* 3. Personal KPI Summary Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px', marginBottom: '22px'
      }}>
        {/* Total Earned This Week */}
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Earned (This Week)
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
            LKR {summary.totalEarnedInWeek.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>Work finished this week</div>
        </div>

        {/* Ready for Payout */}
        <div className="card" style={{ padding: '14px', borderLeft: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
            Payable Now
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#065f46', marginTop: '2px' }}>
            LKR {summary.totalPayable.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#059669', marginTop: '4px', fontWeight: 600 }}>Ready for cash payout</div>
        </div>

        {/* Held on Customer Payment */}
        <div className="card" style={{ padding: '14px', borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
            Held (Customer Unpaid)
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#92400e', marginTop: '2px' }}>
            LKR {summary.totalHeldOnCustomerPayment.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#b45309', marginTop: '4px', fontWeight: 600 }}>Waiting customer settlement</div>
        </div>

        {/* Work in progress */}
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Work In Progress
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
            LKR {summary.totalWorkPending.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>Assigned jobs to complete</div>
        </div>

        {/* Paid This Week */}
        <div className="card" style={{ padding: '14px', borderLeft: '3px solid #8b5cf6' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase' }}>
            Paid (This Week)
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#5b21b6', marginTop: '2px' }}>
            LKR {summary.totalPaidInWeek.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#6d28d9', marginTop: '4px', fontWeight: 600 }}>Disbursed by management</div>
        </div>

        {/* Total Outstanding Balance */}
        <div className="card" style={{ padding: '14px', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>
            Total Due to Me
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#047857', marginTop: '2px' }}>
            LKR {summary.outstandingBalance.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#065f46', marginTop: '4px', fontWeight: 600 }}>Payable + carried forward</div>
        </div>
      </div>

      {/* 4. Filter Toolbar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Filter Jobs:</span>
        {['ALL', 'PAYABLE', 'ON_HOLD_CUSTOMER_PAYMENT', 'WORK_PENDING', 'PAID'].map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            style={{
              padding: '5px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: statusFilter === st ? 800 : 600,
              border: statusFilter === st ? '1px solid var(--jb-blue-accent)' : '1px solid var(--border-color)',
              backgroundColor: statusFilter === st ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-main)',
              color: statusFilter === st ? 'var(--jb-blue-accent)' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            {st === 'ALL' ? 'All My Jobs' : st}
          </button>
        ))}
      </div>

      {/* 5. Assigned Garments Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 800, fontSize: '0.85rem' }}>
          My Assigned Production Jobs &amp; Earnings ({filteredAllocations.length})
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 14px' }}>Order Number</th>
                <th style={{ padding: '10px 14px' }}>Work Type</th>
                <th style={{ padding: '10px 14px' }}>Agreed Garment Price</th>
                <th style={{ padding: '10px 14px' }}>My 25% Share</th>
                <th style={{ padding: '10px 14px' }}>My Work Status</th>
                <th style={{ padding: '10px 14px' }}>Work Completed Date</th>
                <th style={{ padding: '10px 14px' }}>Customer Payment</th>
                <th style={{ padding: '10px 14px' }}>Salary Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No assigned salary allocations found for this status filter.
                  </td>
                </tr>
              ) : (
                filteredAllocations.map(alloc => (
                  <tr key={alloc.allocationKey} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 800 }}>
                      {alloc.orderNumber}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{alloc.dressType}</div>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: alloc.workType === 'CUTTING' ? '#1e40af' : '#6b21a8' }}>
                      {alloc.workType === 'CUTTING' ? '✂️ Cutting (25%)' : '🧵 Stitching (25%)'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      LKR {alloc.agreedPrice.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 900, color: '#047857' }}>
                      LKR {alloc.allocatedAmount.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {alloc.isWorkCompleted ? (
                        <span style={{ color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <CheckCircle2 size={13} /> Completed
                        </span>
                      ) : (
                        <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={13} /> In Progress
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                      {alloc.workCompletedAt ? new Date(alloc.workCompletedAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {alloc.isCustomerFullyPaid ? (
                        <span style={{ color: '#059669', fontWeight: 700 }}>✓ Settled in Full</span>
                      ) : (
                        <span style={{ color: '#b45309', fontWeight: 600 }}>Payment Pending</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {renderStatusBadge(alloc.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Historical Salary Payments Received Ledger */}
      {salaryData?.paymentHistory && salaryData.paymentHistory.length > 0 && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 800, fontSize: '0.85rem' }}>
            Historical Salary Payments Received
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 14px' }}>Date</th>
                  <th style={{ padding: '10px 14px' }}>Order Number</th>
                  <th style={{ padding: '10px 14px' }}>Work</th>
                  <th style={{ padding: '10px 14px' }}>Amount Disbursed</th>
                  <th style={{ padding: '10px 14px' }}>Payment Method</th>
                  <th style={{ padding: '10px 14px' }}>Reference / Receipt</th>
                  <th style={{ padding: '10px 14px' }}>Disbursed By</th>
                </tr>
              </thead>
              <tbody>
                {salaryData.paymentHistory.map(ph => (
                  <tr key={ph.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 14px' }}>{new Date(ph.paymentDate).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{ph.orderNumber}</td>
                    <td style={{ padding: '10px 14px' }}>{ph.workType}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 900, color: '#059669' }}>LKR {Number(ph.amountPaid).toLocaleString()}</td>
                    <td style={{ padding: '10px 14px' }}>{ph.paymentMethod}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{ph.referenceNo || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{ph.recordedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
