import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, formatDateTimeColombo, getBranchName } from './financeUtils';
import {
  DollarSign,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  RotateCcw,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Calendar
} from 'lucide-react';

export const IncomeExpenseLedgerView = ({ branchScope, user, getAuthHeaders }) => {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('this_month');
  const [searchQuery, setSearchQuery] = useState('');

  // Record Transaction Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordSubmitting, setRecordSubmitting] = useState(false);
  const [recordError, setRecordError] = useState(null);
  const [recordSuccess, setRecordSuccess] = useState(null);

  const [formData, setFormData] = useState({
    type: 'EXPENSE',
    branchId: branchScope === 'ALL' ? '1' : String(branchScope),
    categoryId: '',
    accountId: '',
    amount: '',
    paymentMethod: 'CASH',
    referenceNo: '',
    description: '',
    notes: ''
  });

  // Reversal Modal
  const [reversalTarget, setReversalTarget] = useState(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);
  const [reversalError, setReversalError] = useState(null);

  const role = String(user?.role || '').toUpperCase();
  const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);

  // Load Categories & Accounts for dropdowns
  const fetchAuxData = useCallback(async () => {
    try {
      const [catRes, accRes] = await Promise.all([
        fetch(`${API_BASE}/finance/categories`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/finance/accounts?branchId=${branchScope}`, { headers: getAuthHeaders() })
      ]);
      const catJson = await catRes.json();
      const accJson = await accRes.json();

      if (catJson.success) setCategories(catJson.categories || []);
      if (accJson.success) setAccounts(accJson.accounts || []);
    } catch (e) {
      console.error('Error fetching auxiliary finance data:', e);
    }
  }, [branchScope, getAuthHeaders]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchScope) params.append('branchId', branchScope);
      if (typeFilter) params.append('type', typeFilter);
      if (categoryFilter) params.append('categoryId', categoryFilter);
      if (periodFilter) params.append('period', periodFilter);

      const res = await fetch(`${API_BASE}/finance/transactions?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to fetch ledger transactions');
      }
      setTransactions(json.transactions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, typeFilter, categoryFilter, periodFilter, getAuthHeaders]);

  useEffect(() => {
    fetchAuxData();
  }, [fetchAuxData]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    setRecordSubmitting(true);
    setRecordError(null);
    setRecordSuccess(null);

    try {
      const payload = {
        branchId: parseInt(formData.branchId, 10),
        type: formData.type,
        categoryId: parseInt(formData.categoryId, 10),
        accountId: parseInt(formData.accountId, 10),
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        referenceNo: formData.referenceNo.trim() || null,
        description: formData.description.trim() || null,
        notes: formData.notes.trim() || null
      };

      const res = await fetch(`${API_BASE}/finance/transactions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to record transaction');
      }

      setRecordSuccess(`Transaction ${json.transaction.transactionNumber} recorded successfully.`);
      setTimeout(() => {
        setIsRecordModalOpen(false);
        setRecordSuccess(null);
        setFormData({
          type: 'EXPENSE',
          branchId: branchScope === 'ALL' ? '1' : String(branchScope),
          categoryId: '',
          accountId: '',
          amount: '',
          paymentMethod: 'CASH',
          referenceNo: '',
          description: '',
          notes: ''
        });
        fetchTransactions();
        fetchAuxData(); // Refresh account balances
      }, 1200);
    } catch (err) {
      setRecordError(err.message);
    } finally {
      setRecordSubmitting(false);
    }
  };

  const handleReverseSubmit = async (e) => {
    e.preventDefault();
    if (!reversalTarget || !reversalReason.trim()) return;

    setReversing(true);
    setReversalError(null);
    try {
      const res = await fetch(`${API_BASE}/finance/transactions/${reversalTarget.id}/reverse`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: reversalReason.trim() })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to reverse transaction');
      }

      setReversalTarget(null);
      setReversalReason('');
      fetchTransactions();
      fetchAuxData();
    } catch (err) {
      setReversalError(err.message);
    } finally {
      setReversing(false);
    }
  };

  // Filter categories matching selected type in modal
  const eligibleCategories = categories.filter(c => c.categoryType === formData.type);

  // Client search filter
  const filteredTransactions = transactions.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.transactionNumber?.toLowerCase().includes(q) ||
      t.category?.name?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.referenceNo?.toLowerCase().includes(q) ||
      t.account?.accountName?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            General Ledger: Income & Expenses
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Verified financial transaction entries for {branchScope === 'ALL' ? 'Both Branches' : getBranchName(branchScope)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchTransactions}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
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
            onClick={() => {
              setIsRecordModalOpen(true);
              setRecordError(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '10px',
              background: 'var(--jb-crimson)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)'
            }}
          >
            <Plus size={16} /> Record Transaction
          </button>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search txn #, desc, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem',
                width: '100%',
                background: 'var(--bg-main)'
              }}
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: 'var(--bg-main)' }}
          >
            <option value="">All Types (Income & Expense)</option>
            <option value="EXPENSE">Expense Only</option>
            <option value="INCOME">Income Only</option>
            <option value="TRANSFER_OUT">Transfers Out</option>
            <option value="TRANSFER_IN">Transfers In</option>
          </select>

          {/* Period Filter */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: 'var(--bg-main)' }}
          >
            <option value="today">Today (Colombo)</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Year</option>
            <option value="all">All Time</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: 'var(--bg-main)' }}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.categoryType})</option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredTransactions.length}</strong> transactions
        </div>
      </div>

      {/* Ledger Table */}
      <div className="card" style={{ padding: '20px', borderRadius: '14px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px' }}>
            <RefreshCw className="animate-spin text-blue-600" size={32} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Querying general ledger...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '20px', backgroundColor: '#FEF2F2', borderLeft: '4px solid var(--jb-crimson)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991B1B', fontWeight: 600 }}>
              <AlertCircle size={20} /> {error}
            </div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <DollarSign size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>No Transactions Found</h3>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>
              No financial records match the selected filter criteria for this period.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 10px' }}>Txn #</th>
                  <th style={{ padding: '12px 10px' }}>Date</th>
                  <th style={{ padding: '12px 10px' }}>Branch</th>
                  <th style={{ padding: '12px 10px' }}>Type</th>
                  <th style={{ padding: '12px 10px' }}>Category</th>
                  <th style={{ padding: '12px 10px' }}>Account</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '12px 10px' }}>Description / Ref</th>
                  <th style={{ padding: '12px 10px' }}>Recorded By</th>
                  <th style={{ padding: '12px 10px' }}>Status</th>
                  {isExecutive && <th style={{ padding: '12px 10px', textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map(t => {
                  const isInc = t.type === 'INCOME' || t.type === 'TRANSFER_IN';
                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        opacity: t.isReversed ? 0.6 : 1,
                        backgroundColor: t.isReversed ? '#F9FAFB' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '12px 10px', fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>
                        {t.transactionNumber}
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>
                        {formatDateTimeColombo(t.transactionDate)}
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                        {t.branch?.name || getBranchName(t.branchId)}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: isInc ? '#D1FAE5' : '#FEE2F2',
                          color: isInc ? '#059669' : '#DC2626'
                        }}>
                          {isInc ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {t.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-main)', fontWeight: 600 }}>
                        {t.category?.name || 'General'}
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>
                        {t.account?.accountName || '—'}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: isInc ? '#059669' : '#DC2626' }}>
                        {isInc ? `+${formatLKR(t.amount)}` : `-${formatLKR(t.amount)}`}
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)', maxWidth: '200px' }}>
                        <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {t.description || t.notes || '—'}
                        </div>
                        {t.referenceNo && (
                          <div style={{ fontSize: '0.72rem', color: '#6B7280', fontFamily: 'monospace' }}>
                            Ref: {t.referenceNo}
                          </div>
                        )}
                        {t.isReversed && (
                          <div style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 600 }}>
                            Reversed: {t.reversalReason || 'Reversal offset logged'}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {t.createdByName}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: t.approvalStatus === 'APPROVED' ? '#E0F2FE' : (t.approvalStatus === 'REVERSED' ? '#F3F4F6' : '#FEF3C7'),
                          color: t.approvalStatus === 'APPROVED' ? '#0369A1' : (t.approvalStatus === 'REVERSED' ? '#6B7280' : '#B45309')
                        }}>
                          {t.approvalStatus}
                        </span>
                      </td>
                      {isExecutive && (
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          {!t.isReversed && t.approvalStatus === 'APPROVED' && t.sourceModule !== 'REVERSAL' && (
                            <button
                              onClick={() => {
                                setReversalTarget(t);
                                setReversalReason('');
                                setReversalError(null);
                              }}
                              title="Reverse transaction (creates offsetting journal entry)"
                              style={{
                                background: 'transparent',
                                border: '1px solid #E5E7EB',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#6B7280',
                                fontSize: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <RotateCcw size={12} /> Reverse
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Transaction Modal */}
      {isRecordModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="card" style={{ maxWidth: '560px', width: '100%', borderRadius: '16px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Record Financial Transaction
              </h3>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {recordError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#FEE2E2', color: '#991B1B', fontSize: '0.85rem', marginBottom: '14px' }}>
                {recordError}
              </div>
            )}
            {recordSuccess && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#D1FAE5', color: '#065F46', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> {recordSuccess}
              </div>
            )}

            <form onSubmit={handleRecordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Transaction Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value, categoryId: '' })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}
                    required
                  >
                    <option value="EXPENSE">Operating Expense (Outflow)</option>
                    <option value="INCOME">Other Income (Inflow)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Branch</label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}
                    required
                  >
                    <option value="1">Branch 1 — JB Group (Main)</option>
                    <option value="2">Branch 2 — Bella Design</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Chart of Accounts Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}
                  required
                >
                  <option value="">Select Category...</option>
                  {eligibleCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Payment / Cash Drawer Account</label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}
                  required
                >
                  <option value="">Select Account...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} ({a.branchName}) — Bal: {formatLKR(a.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Amount (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}
                    required
                  >
                    <option value="CASH">Cash Drawer</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CREDIT_CARD">Credit / Debit Card</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="ONLINE">Online Portal</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Reference / Voucher / Bill #</label>
                <input
                  type="text"
                  placeholder="e.g. INV-9841 or CEB-BILL-1029"
                  value={formData.referenceNo}
                  onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Description / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly showroom premises rent or sewing machine maintenance"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordSubmitting}
                  style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--jb-crimson)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  {recordSubmitting ? 'Recording...' : 'Record to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reversal Confirmation Modal */}
      {reversalTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#DC2626', marginBottom: '14px' }}>
              <RotateCcw size={22} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Confirm Transaction Reversal</h3>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              You are about to reverse transaction <strong>{reversalTarget.transactionNumber}</strong> ({formatLKR(reversalTarget.amount)}).
              An offsetting journal entry will be created and account balances will be restored. Records are never deleted.
            </p>

            {reversalError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#FEE2E2', color: '#991B1B', fontSize: '0.85rem', marginBottom: '14px' }}>
                {reversalError}
              </div>
            )}

            <form onSubmit={handleReverseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                  Reason for Reversal <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Duplicate entry, incorrect amount, or bill cancellation"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setReversalTarget(null)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reversing}
                  style={{ padding: '8px 20px', borderRadius: '8px', background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  {reversing ? 'Reversing...' : 'Execute Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncomeExpenseLedgerView;

