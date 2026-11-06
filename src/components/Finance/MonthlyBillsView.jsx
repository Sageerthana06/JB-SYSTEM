import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, getBranchName } from './financeUtils';
import { AddMonthlyBillModal } from './AddMonthlyBillModal';
import { PayBillModal } from './PayBillModal';
import {
  Calendar,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  Trash2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

const CATEGORY_LABELS = {
  RENT: 'Rent',
  ELECTRICITY: 'Electricity',
  WATER: 'Water',
  INTERNET: 'Internet',
  TELEPHONE: 'Telephone',
  SECURITY: 'Security',
  MAINTENANCE: 'Maintenance',
  CLEANING: 'Cleaning',
  OTHER: 'Other'
};

export const MonthlyBillsView = ({ branchScope, user, getAuthHeaders, onNavigateTab }) => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [billingMonth, setBillingMonth] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [payingBill, setPayingBill] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchScope) params.append('branchId', branchScope);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (billingMonth) params.append('billingMonth', billingMonth);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`${API_BASE}/finance/bills?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load bills');
      }
      setBills(json.bills || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, categoryFilter, statusFilter, billingMonth, search, getAuthHeaders]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Handle Delete
  const handleDelete = async (billId, billNum) => {
    if (!window.confirm(`Are you sure you want to cancel unpaid bill ${billNum}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/finance/bills/${billId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.message || 'Failed to cancel bill');
        return;
      }
      fetchBills();
    } catch (err) {
      alert(err.message);
    }
  };

  // KPI Calculations
  const totalExpected = bills.reduce((acc, b) => acc + (b.actualAmount || b.expectedAmount || 0), 0);
  const totalPaid = bills.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
  const totalUnpaid = Math.max(0, totalExpected - totalPaid);
  const overdueCount = bills.filter(b => b.status === 'OVERDUE').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Monthly Recurring Bills Management
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Fixed commitments & utility obligations for {branchScope === 'ALL' ? 'Both Branches' : getBranchName(branchScope)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchBills}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'var(--jb-crimson)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}
          >
            <Plus size={16} /> Add Monthly Bill
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', background: '#F8FAFC' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Obligations
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0B1F3A', marginTop: '4px' }}>
            {formatLKR(totalExpected)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bills.length} bills in view</span>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', background: '#ECFDF5' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>
            Paid Bills
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
            {formatLKR(totalPaid)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#065F46' }}>Settled via Cash or Bank</span>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', background: '#FFFBEB' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>
            Unpaid / Remaining
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#D97706', marginTop: '4px' }}>
            {formatLKR(totalUnpaid)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#92400E' }}>Pending business liabilities</span>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', background: overdueCount > 0 ? '#FEF2F2' : '#F8FAFC' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: overdueCount > 0 ? '#991B1B' : 'var(--text-muted)', textTransform: 'uppercase' }}>
            Overdue Bills
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: overdueCount > 0 ? '#DC2626' : 'var(--text-main)', marginTop: '4px' }}>
            {overdueCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: overdueCount > 0 ? '#DC2626' : 'var(--text-muted)' }}>Past due date</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '14px 18px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search bill, provider, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: '#fff' }}
          >
            <option value="ALL">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: '#fff' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="UPCOMING">Upcoming</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Month:</span>
          <input
            type="month"
            value={billingMonth}
            onChange={(e) => setBillingMonth(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
          />
          {billingMonth && (
            <button
              onClick={() => setBillingMonth('')}
              style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bills Table */}
      <div className="card" style={{ padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px' }}>Bill #</th>
                <th style={{ padding: '12px 16px' }}>Title & Category</th>
                <th style={{ padding: '12px 16px' }}>Branch</th>
                <th style={{ padding: '12px 16px' }}>Month & Due Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Paid</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Due</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw className="animate-spin text-blue-600" size={24} style={{ margin: '0 auto 8px auto' }} />
                    Loading bills...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No monthly bills found matching criteria. Click "+ Add Monthly Bill" to schedule one.
                  </td>
                </tr>
              ) : (
                bills.map(b => {
                  const isPaid = b.status === 'PAID';
                  const isOverdue = b.status === 'OVERDUE';
                  const isPartial = b.status === 'PARTIALLY_PAID';

                  let badgeColor = '#FEF3C7';
                  let textColor = '#92400E';
                  if (isPaid) {
                    badgeColor = '#D1FAE5';
                    textColor = '#059669';
                  } else if (isOverdue) {
                    badgeColor = '#FEE2E2';
                    textColor = '#DC2626';
                  } else if (isPartial) {
                    badgeColor = '#FEF3C7';
                    textColor = '#B45309';
                  } else if (b.status === 'UPCOMING') {
                    badgeColor = '#DBEAFE';
                    textColor = '#1E40AF';
                  }

                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#2563EB' }}>
                        {b.billNumber}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{b.billName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                          <span>{CATEGORY_LABELS[b.category] || b.category}</span>
                          {b.providerName && <span>• {b.providerName}</span>}
                          {b.billReference && <span>• Ref: {b.billReference}</span>}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                        {b.branchName}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{b.billingMonth}</div>
                        <div style={{ fontSize: '0.75rem', color: isOverdue ? '#DC2626' : 'var(--text-muted)' }}>
                          Due: {new Date(b.dueDate).toLocaleDateString()}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700 }}>
                        {formatLKR(b.actualAmount || b.expectedAmount)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                        {formatLKR(b.paidAmount || 0)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: b.balanceDue > 0 ? '#DC2626' : 'var(--text-muted)' }}>
                        {formatLKR(b.balanceDue || 0)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          backgroundColor: badgeColor,
                          color: textColor
                        }}>
                          {b.status}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                          {!isPaid && (
                            <button
                              onClick={() => setPayingBill(b)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                background: '#059669',
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.78rem'
                              }}
                            >
                              Pay Bill
                            </button>
                          )}

                          {b.receiptImage && (
                            <button
                              onClick={() => setViewingReceipt(b.receiptImage)}
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                background: '#F3F4F6',
                                border: '1px solid #D1D5DB',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                color: '#374151'
                              }}
                              title="View Document"
                            >
                              <Receipt size={14} />
                            </button>
                          )}

                          {b.paidAmount === 0 && (
                            <button
                              onClick={() => handleDelete(b.id, b.billNumber)}
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                background: '#FEE2E2',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#DC2626'
                              }}
                              title="Cancel Unpaid Bill"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AddMonthlyBillModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        user={user}
        branchScope={branchScope}
        getAuthHeaders={getAuthHeaders}
        onSuccess={fetchBills}
      />

      <PayBillModal
        isOpen={!!payingBill}
        onClose={() => setPayingBill(null)}
        bill={payingBill}
        getAuthHeaders={getAuthHeaders}
        onSuccess={fetchBills}
      />

      {/* Document Viewer Modal */}
      {viewingReceipt && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{ maxWidth: '700px', width: '100%', maxHeight: '85vh', background: '#fff', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Bill Document Scan</h4>
              <button onClick={() => setViewingReceipt(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ overflow: 'auto', textAlign: 'center' }}>
              <img src={viewingReceipt} alt="Bill Scan" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyBillsView;

