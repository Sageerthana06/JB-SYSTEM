import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, getBranchName, formatDateColombo } from './financeUtils';
import {
  Users,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  CreditCard,
  DollarSign,
  Calendar,
  Check
} from 'lucide-react';

export const StaffPayrollView = ({ branchScope, user, getAuthHeaders }) => {
  const [payrollList, setPayrollList] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Current month default in YYYY-MM
  const currentMonthStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const [statusFilter, setStatusFilter] = useState('');

  // Generate Payroll Modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [generateSuccess, setGenerateSuccess] = useState(null);
  const [generateMonth, setGenerateMonth] = useState(currentMonthStr());
  const [generateBranch, setGenerateBranch] = useState(branchScope === 'ALL' ? '1' : String(branchScope));

  // Disburse Modal
  const [disburseTarget, setDisburseTarget] = useState(null);
  const [disburseAccountId, setDisburseAccountId] = useState('');
  const [disbursing, setDisbursing] = useState(false);
  const [disburseError, setDisburseError] = useState(null);

  const role = String(user?.role || '').toUpperCase();
  const canManage = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);

  const fetchAuxAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/finance/accounts?branchId=${branchScope}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (json.success) setAccounts(json.accounts || []);
    } catch (e) {
      console.error('Error fetching accounts:', e);
    }
  }, [branchScope, getAuthHeaders]);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchScope) params.append('branchId', branchScope);
      if (selectedMonth) params.append('month', selectedMonth);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`${API_BASE}/finance/payroll?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to fetch staff payroll');
      }
      setPayrollList(json.payroll || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, selectedMonth, statusFilter, getAuthHeaders]);

  useEffect(() => {
    fetchAuxAccounts();
  }, [fetchAuxAccounts]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  const handleGeneratePayroll = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/finance/payroll/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          branchId: parseInt(generateBranch, 10),
          month: generateMonth
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to generate payroll');
      }

      setGenerateSuccess(json.message);
      setTimeout(() => {
        setIsGenerateModalOpen(false);
        setGenerateSuccess(null);
        setSelectedMonth(generateMonth);
        fetchPayroll();
      }, 1200);
    } catch (err) {
      setGenerateError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDisbursePayroll = async (e) => {
    e.preventDefault();
    if (!disburseTarget || !disburseAccountId) {
      setDisburseError('Please select a payment account.');
      return;
    }

    setDisbursing(true);
    setDisburseError(null);
    try {
      const res = await fetch(`${API_BASE}/finance/payroll/${disburseTarget.id}/disburse`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          paidFromAccountId: parseInt(disburseAccountId, 10),
          paymentMethod: 'CASH'
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to disburse salary');
      }

      setDisburseTarget(null);
      setDisburseAccountId('');
      fetchPayroll();
      fetchAuxAccounts();
    } catch (err) {
      setDisburseError(err.message);
    } finally {
      setDisbursing(false);
    }
  };

  const totalGross = payrollList.reduce((acc, p) => acc + (Number(p.grossSalary) || 0), 0);
  const totalAdvancesDeducted = payrollList.reduce((acc, p) => acc + (Number(p.advanceDeductions) || 0), 0);
  const totalNet = payrollList.reduce((acc, p) => acc + (Number(p.netSalary) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Monthly Staff Payroll & Salaries
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Manager, Cashier & Staff monthly disbursements with automatic advance deductions
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchPayroll}
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

          {canManage && (
            <button
              onClick={() => {
                setIsGenerateModalOpen(true);
                setGenerateError(null);
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
              <Plus size={16} /> Generate Monthly Draft
            </button>
          )}
        </div>
      </div>

      {/* Month & Filter Bar */}
      <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--text-muted)" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: 'var(--bg-main)', fontWeight: 600 }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: 'var(--bg-main)' }}
          >
            <option value="">All Statuses (Draft & Paid)</option>
            <option value="DRAFT">Draft (Pending Payment)</option>
            <option value="PAID">Disbursed (Paid)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
          <span>Total Gross: <strong>{formatLKR(totalGross)}</strong></span>
          <span>Advances Deducted: <strong style={{ color: '#DC2626' }}>-{formatLKR(totalAdvancesDeducted)}</strong></span>
          <span>Total Net Payable: <strong style={{ color: '#059669' }}>{formatLKR(totalNet)}</strong></span>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="card" style={{ padding: '20px', borderRadius: '14px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <RefreshCw className="animate-spin text-blue-600" size={32} />
          </div>
        ) : error ? (
          <div style={{ padding: '20px', backgroundColor: '#FEF2F2', borderLeft: '4px solid var(--jb-crimson)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991B1B', fontWeight: 600 }}>
              <AlertCircle size={20} /> {error}
            </div>
          </div>
        ) : payrollList.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>No Payroll Records for {selectedMonth}</h3>
            <p style={{ margin: '6px 0 16px 0', fontSize: '0.85rem' }}>
              Click "Generate Monthly Draft" to calculate salaries for eligible staff and managers.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 10px' }}>Payroll #</th>
                  <th style={{ padding: '12px 10px' }}>Employee</th>
                  <th style={{ padding: '12px 10px' }}>Role</th>
                  <th style={{ padding: '12px 10px' }}>Branch</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Basic</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Allowances</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Gross</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Adv. Deductions</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Net Payable</th>
                  <th style={{ padding: '12px 10px' }}>Status</th>
                  {canManage && <th style={{ padding: '12px 10px', textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {payrollList.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>
                      {p.payrollNumber}
                    </td>
                    <td style={{ padding: '12px 10px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {p.employee?.name}
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>
                      {p.employee?.role || 'Staff'}
                    </td>
                    <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                      {p.branch?.name || getBranchName(p.branchId)}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      {formatLKR(p.basicSalary)}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                      {formatLKR(p.allowances)}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>
                      {formatLKR(p.grossSalary)}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: Number(p.advanceDeductions) > 0 ? '#DC2626' : 'var(--text-muted)' }}>
                      {Number(p.advanceDeductions) > 0 ? `-${formatLKR(p.advanceDeductions)}` : '0.00'}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '0.95rem' }}>
                      {formatLKR(p.netSalary)}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: p.status === 'PAID' ? '#D1FAE5' : '#FEF3C7',
                        color: p.status === 'PAID' ? '#065F46' : '#92400E'
                      }}>
                        {p.status}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        {p.status === 'DRAFT' ? (
                          <button
                            onClick={() => {
                              setDisburseTarget(p);
                              setDisburseAccountId('');
                              setDisburseError(null);
                            }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              background: 'var(--jb-crimson)',
                              color: '#fff',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '0.78rem'
                            }}
                          >
                            Disburse
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Paid on {formatDateColombo(p.paymentDate)}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate Payroll Modal */}
      {isGenerateModalOpen && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Generate Monthly Staff Payroll</h3>
              <button
                onClick={() => setIsGenerateModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {generateError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#FEE2E2', color: '#991B1B', fontSize: '0.85rem', marginBottom: '14px' }}>
                {generateError}
              </div>
            )}
            {generateSuccess && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#D1FAE5', color: '#065F46', fontSize: '0.85rem', marginBottom: '14px' }}>
                {generateSuccess}
              </div>
            )}

            <form onSubmit={handleGeneratePayroll} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Target Month (YYYY-MM)</label>
                <input
                  type="month"
                  value={generateMonth}
                  onChange={(e) => setGenerateMonth(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Branch</label>
                <select
                  value={generateBranch}
                  onChange={(e) => setGenerateBranch(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}
                  required
                >
                  <option value="1">Branch 1 — JB Group (Main)</option>
                  <option value="2">Branch 2 — Bella Design</option>
                </select>
              </div>

              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                This creates payroll drafts for all active non-craftsmen staff, fetches base salaries, and applies any disbursed salary advances as deductions.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--jb-crimson)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  {generating ? 'Calculating...' : 'Generate Payroll Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disburse Modal */}
      {disburseTarget && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Disburse Employee Salary</h3>
              <button
                onClick={() => setDisburseTarget(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-main)', marginBottom: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{disburseTarget.employee?.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{disburseTarget.employee?.role} • {disburseTarget.month}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#059669', marginTop: '8px' }}>
                Net: {formatLKR(disburseTarget.netSalary)}
              </div>
            </div>

            {disburseError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#FEE2E2', color: '#991B1B', fontSize: '0.85rem', marginBottom: '14px' }}>
                {disburseError}
              </div>
            )}

            <form onSubmit={handleDisbursePayroll} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Paying Account / Cash Drawer</label>
                <select
                  value={disburseAccountId}
                  onChange={(e) => setDisburseAccountId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff' }}
                  required
                >
                  <option value="">Select paying drawer/account...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} ({a.branchName}) — Bal: {formatLKR(a.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setDisburseTarget(null)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disbursing}
                  style={{ padding: '8px 20px', borderRadius: '8px', background: '#059669', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  {disbursing ? 'Disbursing...' : 'Confirm Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffPayrollView;

