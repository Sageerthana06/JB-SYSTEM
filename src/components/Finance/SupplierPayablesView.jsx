import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, getBranchName, formatDateColombo } from './financeUtils';
import {
  Truck,
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
  FileText
} from 'lucide-react';

export const SupplierPayablesView = ({ branchScope, user, getAuthHeaders }) => {
  const [payables, setPayables] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  // Modals
  const [isAddInvoiceOpen, setIsAddInvoiceOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [paymentModalPayable, setPaymentModalPayable] = useState(null);
  const [viewHistoryPayable, setViewHistoryPayable] = useState(null);

  // Form states
  const [invoiceForm, setInvoiceForm] = useState({
    supplierId: '',
    invoiceNumber: '',
    purchaseDescription: '',
    branchId: branchScope === 'ALL' ? '1' : String(branchScope),
    totalAmount: '',
    paidAmount: '',
    dueDate: '',
    notes: '',
    paymentMethod: 'CASH',
    accountId: ''
  });

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    category: 'FABRIC',
    paymentTerms: 'NET_30',
    notes: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'CASH',
    accountId: '',
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
      if (selectedSupplierId) params.append('supplierId', selectedSupplierId);

      const [resPayables, resSuppliers, resAccounts] = await Promise.all([
        fetch(`${API_BASE}/finance/suppliers/payables?${params.toString()}`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/finance/suppliers`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/finance/accounts${branchScope && branchScope !== 'ALL' ? `?branchId=${branchScope}` : ''}`, { headers: getAuthHeaders() })
      ]);

      const jsonPayables = await resPayables.json();
      const jsonSuppliers = await resSuppliers.json();
      const jsonAccounts = await resAccounts.json();

      if (!resPayables.ok || !jsonPayables.success) {
        throw new Error(jsonPayables.message || 'Failed to load supplier payables');
      }

      setPayables(jsonPayables.data || []);
      setSummary(jsonPayables.summary || null);

      if (jsonSuppliers.success) setSuppliers(jsonSuppliers.data || []);
      if (jsonAccounts.success) setAccounts(jsonAccounts.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, statusFilter, searchQuery, selectedSupplierId, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Add Invoice Submit
  const handleAddInvoiceSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${API_BASE}/finance/suppliers/payables`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(invoiceForm)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to create invoice');

      setFormSuccess('Supplier invoice created successfully.');
      setTimeout(() => {
        setIsAddInvoiceOpen(false);
        setFormSuccess(null);
        setInvoiceForm({
          supplierId: '',
          invoiceNumber: '',
          purchaseDescription: '',
          branchId: branchScope === 'ALL' ? '1' : String(branchScope),
          totalAmount: '',
          paidAmount: '',
          dueDate: '',
          notes: '',
          paymentMethod: 'CASH',
          accountId: ''
        });
        fetchData();
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Add Supplier Submit
  const handleAddSupplierSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${API_BASE}/finance/suppliers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(supplierForm)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to add supplier');

      setFormSuccess('Supplier added successfully.');
      setTimeout(() => {
        setIsAddSupplierOpen(false);
        setFormSuccess(null);
        setSupplierForm({
          name: '',
          contactPerson: '',
          phone: '',
          email: '',
          address: '',
          category: 'FABRIC',
          paymentTerms: 'NET_30',
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

  // Handle Record Payment Submit
  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentModalPayable) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${API_BASE}/finance/suppliers/payables/${paymentModalPayable.id}/pay`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(paymentForm)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to record payment');

      setFormSuccess(json.message || 'Payment recorded successfully.');
      setTimeout(() => {
        setPaymentModalPayable(null);
        setFormSuccess(null);
        setPaymentForm({
          amount: '',
          paymentMethod: 'CASH',
          accountId: '',
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
    if (!payables.length) return;
    const headers = ['Invoice Number', 'Supplier', 'Description', 'Branch', 'Total Amount', 'Paid Amount', 'Outstanding Amount', 'Due Date', 'Status'];
    const rows = payables.map(p => [
      `"${p.invoiceNumber}"`,
      `"${p.supplier?.name || 'N/A'}"`,
      `"${(p.purchaseDescription || '').replace(/"/g, '""')}"`,
      `"${getBranchName(p.branchId)}"`,
      Number(p.totalAmount || 0).toFixed(2),
      Number(p.paidAmount || 0).toFixed(2),
      Number(p.outstandingAmount || 0).toFixed(2),
      p.dueDate ? new Date(p.dueDate).toLocaleDateString() : 'N/A',
      p.paymentStatus
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Supplier_Payables_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return <span style={{ backgroundColor: '#DEF7EC', color: '#03543F', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>PAID</span>;
      case 'PARTIALLY_PAID':
        return <span style={{ backgroundColor: '#FEF08A', color: '#854D0E', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>PARTIAL</span>;
      case 'OVERDUE':
        return <span style={{ backgroundColor: '#FDE8E8', color: '#9B1C1C', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>OVERDUE</span>;
      case 'UNPAID':
      default:
        return <span style={{ backgroundColor: '#F3F4F6', color: '#374151', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>UNPAID</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header and Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={24} color="var(--jb-crimson)" />
            Supplier Debt & Payables Management
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Live tracking of materials, purchases, and supplier credit accounts. Unpaid balances are kept strictly as payables until actual settlement.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={exportToCSV}
            disabled={!payables.length}
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
            onClick={() => setIsAddSupplierOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#F8FAFC',
              color: '#334155',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Plus size={15} /> Add Supplier
          </button>
          <button
            onClick={() => setIsAddInvoiceOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--jb-crimson, #dc2626)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
            }}
          >
            <Plus size={16} /> New Supplier Invoice
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #2563EB' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Invoiced
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
            LKR {formatLKR(summary?.totalInvoiced || 0)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {summary?.totalPayablesCount || 0} Total Supplier Invoices
          </span>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #16A34A' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803D', textTransform: 'uppercase' }}>
            Total Paid (Settled)
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#15803D', marginTop: '4px' }}>
            LKR {formatLKR(summary?.totalPaid || 0)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Actual settled purchases
          </span>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--jb-crimson, #DC2626)', backgroundColor: '#FEF2F2' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase' }}>
            Total Supplier Outstanding
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#B91C1C', marginTop: '4px' }}>
            LKR {formatLKR(summary?.totalOutstanding || 0)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#991B1B' }}>
            Total liabilities owed to suppliers
          </span>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #F59E0B' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase' }}>
            Overdue Payables
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#B45309', marginTop: '4px' }}>
            LKR {formatLKR(summary?.overdueAmount || 0)}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#92400E' }}>
            {summary?.overdueCount || 0} overdue invoices past due date
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', backgroundColor: 'var(--bg-main)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by invoice number, supplier or item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.85rem', color: 'var(--text-main)' }}
          />
        </div>

        <select
          value={selectedSupplierId}
          onChange={(e) => setSelectedSupplierId(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
        >
          <option value="">All Suppliers</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: statusFilter === st ? 'var(--jb-crimson, #DC2626)' : 'var(--bg-main)',
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

      {/* Payables Data Table */}
      <div className="card" style={{ padding: '0', overflowX: 'auto', borderRadius: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>Invoice No</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>Supplier</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>Description</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>Branch</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>Total (LKR)</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>Paid (LKR)</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>Outstanding</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>Due Date</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && payables.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
                  Loading supplier payables from database...
                </td>
              </tr>
            ) : payables.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No supplier payables found matching current filters.
                </td>
              </tr>
            ) : (
              payables.map(p => {
                const isOverdue = Number(p.outstandingAmount || 0) > 0.01 && p.dueDate && new Date(p.dueDate) < new Date();
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-main)' }}>
                      {p.invoiceNumber}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {p.supplier?.name || 'N/A'}
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.supplier?.phone || ''}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-main)', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.purchaseDescription}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {getBranchName(p.branchId)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                      {formatLKR(p.totalAmount)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#15803D', fontWeight: 700 }}>
                      {formatLKR(p.paidAmount)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: Number(p.outstandingAmount) > 0.01 ? '#B91C1C' : '#15803D', fontWeight: 800 }}>
                      {formatLKR(p.outstandingAmount)}
                    </td>
                    <td style={{ padding: '12px 16px', color: isOverdue ? '#DC2626' : 'var(--text-muted)', fontWeight: isOverdue ? 800 : 500, fontSize: '0.82rem' }}>
                      {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : 'None'}
                      {isOverdue && <div style={{ fontSize: '0.7rem', color: '#DC2626' }}>Overdue</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {getStatusBadge(isOverdue && p.paymentStatus !== 'PAID' ? 'OVERDUE' : p.paymentStatus)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        {Number(p.outstandingAmount) > 0.01 && (
                          <button
                            onClick={() => {
                              setPaymentModalPayable(p);
                              setPaymentForm({
                                amount: String(p.outstandingAmount),
                                paymentMethod: 'CASH',
                                accountId: accounts[0]?.id ? String(accounts[0].id) : '',
                                referenceNo: '',
                                notes: ''
                              });
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#16A34A',
                              color: '#fff',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            Pay
                          </button>
                        )}
                        <button
                          onClick={() => setViewHistoryPayable(p)}
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
                          History ({p.payments?.length || 0})
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

      {/* MODAL 1: ADD SUPPLIER INVOICE */}
      {isAddInvoiceOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Record Supplier Invoice
              </h3>
              <button onClick={() => setIsAddInvoiceOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
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

            <form onSubmit={handleAddInvoiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Supplier *
                </label>
                <select
                  required
                  value={invoiceForm.supplierId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, supplierId: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Supplier Invoice Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-987"
                  value={invoiceForm.invoiceNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Purchase Description *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. 50m Cotton Twill fabric, 100 sets metallic buttons"
                  value={invoiceForm.purchaseDescription}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, purchaseDescription: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Total Amount (LKR) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="0.00"
                    value={invoiceForm.totalAmount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, totalAmount: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Paid Upfront (LKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={invoiceForm.paidAmount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, paidAmount: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Branch
                  </label>
                  <select
                    disabled={isManager}
                    value={invoiceForm.branchId}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, branchId: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: isManager ? '#F3F4F6' : 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="1">JB Group (Main)</option>
                    <option value="2">Bella Design</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddInvoiceOpen(false)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--jb-crimson, #DC2626)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  {submitting ? 'Saving...' : 'Save Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD SUPPLIER */}
      {isAddSupplierOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Add New Supplier
              </h3>
              <button onClick={() => setIsAddSupplierOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
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

            <form onSubmit={handleAddSupplierSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Supplier Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Lanka Silk Mills (Pvt) Ltd"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mr. Perera"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="0771234567"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Category
                </label>
                <select
                  value={supplierForm.category}
                  onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                >
                  <option value="FABRIC">Fabric & Textiles</option>
                  <option value="HABERDASHERY">Buttons, Zips & Accessories</option>
                  <option value="PACKAGING">Packaging & Labels</option>
                  <option value="EQUIPMENT">Machinery & Maintenance</option>
                  <option value="SERVICES">Transport & Delivery</option>
                  <option value="OTHER">Other Goods</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddSupplierOpen(false)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#2563EB', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  {submitting ? 'Saving...' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD PAYMENT */}
      {paymentModalPayable && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Record Supplier Payment
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {paymentModalPayable.supplier?.name} — Invoice {paymentModalPayable.invoiceNumber}
                </p>
              </div>
              <button onClick={() => setPaymentModalPayable(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: '#FEF2F2', padding: '12px', borderRadius: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#991B1B', fontWeight: 700 }}>Outstanding Balance:</span>
              <span style={{ fontSize: '1.15rem', color: '#991B1B', fontWeight: 900 }}>
                LKR {formatLKR(paymentModalPayable.outstandingAmount)}
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

            <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Payment Amount (LKR) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="1"
                  max={paymentModalPayable.outstandingAmount}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 800 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Payment Method
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Card</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>

              {accounts.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Deduct From Financial Account
                  </label>
                  <select
                    value={paymentForm.accountId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, accountId: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="">Do not deduct from accounts ledger</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.accountName} ({a.accountType}) — Bal: LKR {formatLKR(a.currentBalance)}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Reference No / Cheque No
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-987654 or CHQ-00124"
                  value={paymentForm.referenceNo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPaymentModalPayable(null)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#16A34A', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PAYMENT HISTORY MODAL */}
      {viewHistoryPayable && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Payment History — Invoice {viewHistoryPayable.invoiceNumber}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Supplier: {viewHistoryPayable.supplier?.name} | Total: LKR {formatLKR(viewHistoryPayable.totalAmount)}
                </p>
              </div>
              <button onClick={() => setViewHistoryPayable(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {!viewHistoryPayable.payments || viewHistoryPayable.payments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
                No payments have been recorded for this invoice yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {viewHistoryPayable.payments.map((pmt, idx) => (
                  <div key={pmt.id || idx} style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        {pmt.paymentNumber} • {pmt.paymentMethod}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Date: {new Date(pmt.paymentDate).toLocaleDateString()} {pmt.referenceNo ? `• Ref: ${pmt.referenceNo}` : ''} • Recorded by {pmt.paidBy}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, color: '#16A34A', fontSize: '1.05rem' }}>
                        LKR {formatLKR(pmt.amount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button
                onClick={() => setViewHistoryPayable(null)}
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

export default SupplierPayablesView;

