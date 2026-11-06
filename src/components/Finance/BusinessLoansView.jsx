import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, getBranchName, formatDateColombo } from './financeUtils';
import {
  Landmark,
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
  CheckCircle2,
  Clock,
  DollarSign,
  Calendar,
  X,
  CreditCard,
  Building,
  AlertTriangle,
  Download,
  FileText,
  PieChart
} from 'lucide-react';

export const BusinessLoansView = ({ branchScope, user, getAuthHeaders }) => {
  const [loans, setLoans] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [repayModalLoan, setRepayModalLoan] = useState(null);
  const [viewHistoryLoan, setViewHistoryLoan] = useState(null);

  // Form states
  const [loanForm, setLoanForm] = useState({
    providerName: '',
    loanType: 'BANK_LOAN',
    originalPrincipal: '',
    interestRate: '',
    monthlyInstalment: '',
    disbursementDate: new Date().toISOString().split('T')[0],
    nextPaymentDate: '',
    maturityDate: '',
    depositAccountId: '',
    branchId: branchScope === 'ALL' ? '1' : String(branchScope),
    notes: ''
  });

  const [repayForm, setRepayForm] = useState({
    principalAmount: '',
    interestAmount: '',
    paymentMethod: 'BANK_TRANSFER',
    paidFromAccountId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    nextPaymentDate: '',
    referenceNo: '',
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  const role = String(user?.role || '').toUpperCase();
  const isManager = role === 'MANAGER';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchScope) params.append('branchId', branchScope);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const [resLoans, resAccounts] = await Promise.all([
        fetch(`${API_BASE}/finance/loans?${params.toString()}`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/finance/accounts${branchScope && branchScope !== 'ALL' ? `?branchId=${branchScope}` : ''}`, { headers: getAuthHeaders() })
      ]);

      const jsonLoans = await resLoans.json();
      const jsonAccounts = await resAccounts.json();

      if (!resLoans.ok || !jsonLoans.success) {
        throw new Error(jsonLoans.message || 'Failed to load business loans');
      }

      setLoans(jsonLoans.data || []);
      setSummary(jsonLoans.summary || null);

      if (jsonAccounts.success) setAccounts(jsonAccounts.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, statusFilter, searchQuery, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Add Loan
  const handleAddLoanSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${API_BASE}/finance/loans`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(loanForm)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to record loan');

      setFormSuccess('Business loan registered successfully.');
      setTimeout(() => {
        setIsAddLoanOpen(false);
        setFormSuccess(null);
        setLoanForm({
          providerName: '',
          loanType: 'BANK_LOAN',
          originalPrincipal: '',
          interestRate: '',
          monthlyInstalment: '',
          disbursementDate: new Date().toISOString().split('T')[0],
          nextPaymentDate: '',
          maturityDate: '',
          depositAccountId: '',
          branchId: branchScope === 'ALL' ? '1' : String(branchScope),
          notes: ''
        });
        fetchData();
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Repayment Submit
  const handleRepaySubmit = async (e) => {
    e.preventDefault();
    if (!repayModalLoan) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${API_BASE}/finance/loans/${repayModalLoan.id}/repay`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(repayForm)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to record repayment');

      setFormSuccess(json.message || 'Loan repayment recorded successfully.');
      setTimeout(() => {
        setRepayModalLoan(null);
        setFormSuccess(null);
        setRepayForm({
          principalAmount: '',
          interestAmount: '',
          paymentMethod: 'BANK_TRANSFER',
          paidFromAccountId: '',
          paymentDate: new Date().toISOString().split('T')[0],
          nextPaymentDate: '',
          referenceNo: '',
          notes: ''
        });
        fetchData();
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const exportToCSV = () => {
    if (!loans.length) return;
    const headers = ['Loan Number', 'Provider', 'Type', 'Branch', 'Original Principal', 'Outstanding Principal', 'Interest Rate %', 'Monthly Instalment', 'Next Payment Date', 'Status'];
    const rows = loans.map(l => [
      `"${l.loanNumber}"`,
      `"${l.providerName}"`,
      `"${l.loanType}"`,
      `"${getBranchName(l.branchId)}"`,
      Number(l.originalPrincipal || 0).toFixed(2),
      Number(l.outstandingPrincipal || 0).toFixed(2),
      Number(l.interestRate || 0).toFixed(2),
      Number(l.monthlyInstalment || 0).toFixed(2),
      l.nextPaymentDate ? new Date(l.nextPaymentDate).toLocaleDateString() : 'N/A',
      l.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Business_Loans_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header and Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Landmark size={24} color="#0B1F3A" />
            Business Loans & Financing Management
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Track bank loans, institutional credit, principal amortization, and interest expenses. Loan principal is financing, not revenue; interest is recorded as expense.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={exportToCSV}
            disabled={!loans.length}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            onClick={() => setIsAddLoanOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0B1F3A',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(11, 31, 58, 0.3)'
            }}
          >
            <Plus size={16} /> Record New Loan
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #2563EB' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Original Borrowed
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
            LKR {formatLKR(summary?.totalOriginalPrincipal || 0)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Across {summary?.totalLoansCount || 0} registered loans
          </span>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #DC2626', backgroundColor: '#FEF2F2' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase' }}>
            Total Outstanding Principal
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#B91C1C', marginTop: '4px' }}>
            LKR {formatLKR(summary?.totalOutstandingPrincipal || 0)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#991B1B' }}>
            {summary?.activeLoansCount || 0} active loans with remaining balance
          </span>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #16A34A' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803D', textTransform: 'uppercase' }}>
            Principal Repaid
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#15803D', marginTop: '4px' }}>
            LKR {formatLKR(summary?.totalPrincipalRepaid || 0)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Liability reductions settled
          </span>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #F59E0B' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase' }}>
            Total Interest Paid
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#B45309', marginTop: '4px' }}>
            LKR {formatLKR(summary?.totalInterestPaid || 0)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#92400E' }}>
            Financial financing expenses incurred
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', backgroundColor: 'var(--bg-main)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by loan number or provider name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.85rem', color: 'var(--text-main)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'ACTIVE', 'PAID_OFF'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: statusFilter === st ? '#0B1F3A' : 'var(--bg-main)',
                color: statusFilter === st ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <button
          onClick={fetchData}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Loans Data Table */}
      <div className="card" style={{ padding: '0', overflowX: 'auto', borderRadius: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>Loan Number</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>Provider</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>Type</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>Original Principal</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>Outstanding</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center' }}>Rate %</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>Monthly Instalment</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>Next Due</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && loans.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
                  Loading loans telemetry...
                </td>
              </tr>
            ) : loans.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No business loans registered in the database.
                </td>
              </tr>
            ) : (
              loans.map(l => {
                const isPaidOff = l.status === 'PAID_OFF' || Number(l.outstandingPrincipal || 0) <= 0.01;
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-main)' }}>
                      {l.loanNumber}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {l.providerName}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {l.loanType.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                      LKR {formatLKR(l.originalPrincipal)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: isPaidOff ? '#16A34A' : '#DC2626' }}>
                      LKR {formatLKR(l.outstandingPrincipal)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {Number(l.interestRate || 0).toFixed(1)}%
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                      {Number(l.monthlyInstalment) > 0 ? `LKR ${formatLKR(l.monthlyInstalment)}` : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {l.nextPaymentDate ? new Date(l.nextPaymentDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        backgroundColor: isPaidOff ? '#DEF7EC' : '#FEF3C7',
                        color: isPaidOff ? '#03543F' : '#92400E',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}>
                        {isPaidOff ? 'PAID OFF' : 'ACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        {!isPaidOff && (
                          <button
                            onClick={() => {
                              setRepayModalLoan(l);
                              setRepayForm({
                                principalAmount: '',
                                interestAmount: '',
                                paymentMethod: 'BANK_TRANSFER',
                                paidFromAccountId: accounts[0]?.id ? String(accounts[0].id) : '',
                                paymentDate: new Date().toISOString().split('T')[0],
                                nextPaymentDate: '',
                                referenceNo: '',
                                notes: ''
                              });
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#0B1F3A',
                              color: '#fff',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            Repay
                          </button>
                        )}
                        <button
                          onClick={() => setViewHistoryLoan(l)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-main)',
                            color: 'var(--text-main)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          History ({l.repayments?.length || 0})
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: RECORD NEW LOAN */}
      {isAddLoanOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Record Business Loan
              </h3>
              <button onClick={() => setIsAddLoanOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#FEE2E2', color: '#991B1B', marginBottom: '14px', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}
            {formSuccess && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#DCFCE7', color: '#166534', marginBottom: '14px', fontSize: '0.85rem' }}>
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleAddLoanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Loan Provider / Financial Institution *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Commercial Bank of Ceylon / HNB / Business Partner"
                  value={loanForm.providerName}
                  onChange={(e) => setLoanForm({ ...loanForm, providerName: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Loan Type
                  </label>
                  <select
                    value={loanForm.loanType}
                    onChange={(e) => setLoanForm({ ...loanForm, loanType: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="BANK_LOAN">Bank Term Loan</option>
                    <option value="BUSINESS_LOAN">Commercial Business Loan</option>
                    <option value="DIRECTORS_LOAN">Director / Founder Capital Loan</option>
                    <option value="OVERDRAFT">Bank Overdraft Facility</option>
                    <option value="OTHER">Other Private Financing</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Original Principal Amount (LKR) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="0.00"
                    value={loanForm.originalPrincipal}
                    onChange={(e) => setLoanForm({ ...loanForm, originalPrincipal: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Annual Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 14.5"
                    value={loanForm.interestRate}
                    onChange={(e) => setLoanForm({ ...loanForm, interestRate: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Monthly Instalment (LKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={loanForm.monthlyInstalment}
                    onChange={(e) => setLoanForm({ ...loanForm, monthlyInstalment: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Disbursement Date
                  </label>
                  <input
                    type="date"
                    value={loanForm.disbursementDate}
                    onChange={(e) => setLoanForm({ ...loanForm, disbursementDate: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Next Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={loanForm.nextPaymentDate}
                    onChange={(e) => setLoanForm({ ...loanForm, nextPaymentDate: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              {accounts.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Deposit Disbursed Funds To Account
                  </label>
                  <select
                    value={loanForm.depositAccountId}
                    onChange={(e) => setLoanForm({ ...loanForm, depositAccountId: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="">Do not deposit directly into financial account</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.accountName} ({a.accountType}) — Bal: LKR {formatLKR(a.currentBalance)}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Notes / Loan Agreement Reference
                </label>
                <textarea
                  rows={2}
                  placeholder="Loan tenure, collateral, or bank branch details..."
                  value={loanForm.notes}
                  onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddLoanOpen(false)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0B1F3A', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  {submitting ? 'Saving...' : 'Register Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD LOAN REPAYMENT */}
      {repayModalLoan && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Record Loan Repayment
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {repayModalLoan.providerName} — Loan {repayModalLoan.loanNumber}
                </p>
              </div>
              <button onClick={() => setRepayModalLoan(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: '#FEF2F2', padding: '12px', borderRadius: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#991B1B', fontWeight: 700 }}>Outstanding Principal:</span>
              <span style={{ fontSize: '1.15rem', color: '#991B1B', fontWeight: 900 }}>
                LKR {formatLKR(repayModalLoan.outstandingPrincipal)}
              </span>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#FEE2E2', color: '#991B1B', marginBottom: '14px', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}
            {formSuccess && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#DCFCE7', color: '#166534', marginBottom: '14px', fontSize: '0.85rem' }}>
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleRepaySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Principal Payment (LKR) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={repayForm.principalAmount}
                    onChange={(e) => setRepayForm({ ...repayForm, principalAmount: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 800 }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Reduces loan liability</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Interest Payment (LKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={repayForm.interestAmount}
                    onChange={(e) => setRepayForm({ ...repayForm, interestAmount: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 800 }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Recorded as interest expense</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Total Payment Amount: LKR {formatLKR((parseFloat(repayForm.principalAmount) || 0) + (parseFloat(repayForm.interestAmount) || 0))}
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Payment Method
                  </label>
                  <select
                    value={repayForm.paymentMethod}
                    onChange={(e) => setRepayForm({ ...repayForm, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / Standing Order</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                    <option value="ONLINE">Online Portal</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Deduct From Account
                  </label>
                  <select
                    value={repayForm.paidFromAccountId}
                    onChange={(e) => setRepayForm({ ...repayForm, paidFromAccountId: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="">Do not deduct from accounts ledger</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.accountName} ({a.accountType}) — Bal: LKR {formatLKR(a.currentBalance)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={repayForm.paymentDate}
                    onChange={(e) => setRepayForm({ ...repayForm, paymentDate: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Next Instalment Date
                  </label>
                  <input
                    type="date"
                    value={repayForm.nextPaymentDate}
                    onChange={(e) => setRepayForm({ ...repayForm, nextPaymentDate: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRepayModalLoan(null)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0B1F3A', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  {submitting ? 'Recording...' : 'Record Repayment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REPAYMENT HISTORY MODAL */}
      {viewHistoryLoan && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto', padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Repayment History — Loan {viewHistoryLoan.loanNumber}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Provider: {viewHistoryLoan.providerName} | Principal: LKR {formatLKR(viewHistoryLoan.originalPrincipal)}
                </p>
              </div>
              <button onClick={() => setViewHistoryLoan(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {!viewHistoryLoan.repayments || viewHistoryLoan.repayments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
                No repayments have been recorded for this loan yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {viewHistoryLoan.repayments.map((pmt, idx) => (
                  <div key={pmt.id || idx} style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        {pmt.repaymentNumber} • {pmt.paymentMethod}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Date: {new Date(pmt.paymentDate).toLocaleDateString()} {pmt.referenceNo ? `• Ref: ${pmt.referenceNo}` : ''}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', marginTop: '4px' }}>
                        Principal Paid: <strong>LKR {formatLKR(pmt.principalAmount)}</strong> | Interest Paid: <strong>LKR {formatLKR(pmt.interestAmount)}</strong>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, color: '#16A34A', fontSize: '1.05rem' }}>
                        LKR {formatLKR(pmt.totalPaid)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button
                onClick={() => setViewHistoryLoan(null)}
                style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 700 }}
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

export default BusinessLoansView;

