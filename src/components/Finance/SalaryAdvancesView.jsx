import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, getBranchName, formatDateColombo } from './financeUtils';
import {
  DollarSign,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  CreditCard,
  Check,
  Ban,
  Clock,
  Send
} from 'lucide-react';

export const SalaryAdvancesView = ({ branchScope, user, getAuthHeaders }) => {
  const [advances, setAdvances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Request Advance Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [requestSuccess, setRequestSuccess] = useState(null);

  const [formData, setFormData] = useState({
    employeeId: '',
    branchId: branchScope === 'ALL' ? '1' : String(branchScope),
    amount: '',
    reason: ''
  });

  // Disburse Advance Modal
  const [disburseTarget, setDisburseTarget] = useState(null);
  const [disburseAccountId, setDisburseAccountId] = useState('');
  const [disbursing, setDisbursing] = useState(false);
  const [disburseError, setDisburseError] = useState(null);

  const role = String(user?.role || '').toUpperCase();
  const canApprove = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);

  const fetchAuxData = useCallback(async () => {
    try {
      const [empRes, accRes] = await Promise.all([
        fetch(`${API_BASE}/users/employees`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/finance/accounts?branchId=${branchScope}`, { headers: getAuthHeaders() })
      ]);
      const empJson = await empRes.json();
      const accJson = await accRes.json();

      if (empJson.success) setEmployees(empJson.employees || []);
      if (accJson.success) setAccounts(accJson.accounts || []);
    } catch (e) {
      console.error('Error fetching employees or accounts:', e);
    }
  }, [branchScope, getAuthHeaders]);

  const fetchAdvances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchScope) params.append('branchId', branchScope);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`${API_BASE}/finance/advances?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to fetch salary advances');
      }
      setAdvances(json.advances || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, statusFilter, getAuthHeaders]);

  useEffect(() => {
    fetchAuxData();
  }, [fetchAuxData]);

  useEffect(() => {
    fetchAdvances();
  }, [fetchAdvances]);

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setRequestSubmitting(true);
    setRequestError(null);
    setRequestSuccess(null);

    try {
      const payload = {
        employeeId: parseInt(formData.employeeId, 10),
        branchId: parseInt(formData.branchId, 10),
        amount: parseFloat(formData.amount),
        reason: formData.reason.trim() || null
      };

      const res = await fetch(`${API_BASE}/finance/advances/request`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to request advance');
      }

      setRequestSuccess(json.message || 'Salary advance requested successfully.');
      setTimeout(() => {
        setIsRequestModalOpen(false);
        setRequestSuccess(null);
        setFormData({
          employeeId: '',
          branchId: branchScope === 'ALL' ? '1' : String(branchScope),
          amount: '',
          reason: ''
        });
        fetchAdvances();
      }, 1200);
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleApprove = async (advanceId) => {
    try {
      const res = await fetch(`${API_BASE}/finance/advances/${advanceId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to approve advance');
      }
      fetchAdvances();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReject = async (advanceId) => {
    const reason = prompt('Please enter the reason for rejecting this advance request:');
    if (!reason) return;

    try {
      const res = await fetch(`${API_BASE}/finance/advances/${advanceId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to reject advance');
      }
      fetchAdvances();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDisburseAdvance = async (e) => {
    e.preventDefault();
    if (!disburseTarget || !disburseAccountId) {
      setDisburseError('Please select a payment drawer/account.');
      return;
    }

    setDisbursing(true);
    setDisburseError(null);
    try {
      const res = await fetch(`${API_BASE}/finance/advances/${disburseTarget.id}/disburse`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          disbursedFromAccountId: parseInt(disburseAccountId, 10)
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to disburse advance');
      }

      setDisburseTarget(null);
      setDisburseAccountId('');
      fetchAdvances();
      fetchAuxData();
    } catch (err) {
      setDisburseError(err.message);
    } finally {
      setDisbursing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Employee Salary Advance Management
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Manage salary advance requests, approvals, drawer disbursements, and payroll deductions
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchAdvances}
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
              setIsRequestModalOpen(true);
              setRequestError(null);
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
            <Plus size={16} /> Request Salary Advance
          </button>
        </div>
      </div>

      {/* Filter Tabs Card */}
      <div className="card" style={{ padding: '14px 20px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {['', 'PENDING', 'APPROVED', 'DISBURSED', 'DEDUCTED', 'REJECTED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: statusFilter === st ? '1px solid #2563EB' : '1px solid var(--border-color)',
                background: statusFilter === st ? '#EFF6FF' : 'var(--bg-main)',
                color: statusFilter === st ? '#1E40AF' : 'var(--text-main)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.8rem'
              }}
            >
              {st === '' ? 'All Advances' : st}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Found <strong>{advances.length}</strong> advances
        </div>
      </div>

      {/* Advances Table */}
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
        ) : advances.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <DollarSign size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>No Salary Advances Found</h3>
            <p style={{ margin: '6px 0 16px 0', fontSize: '0.85rem' }}>
              Click "Request Salary Advance" to register an advance request for an employee.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 10px' }}>Advance #</th>
                  <th style={{ padding: '12px 10px' }}>Date</th>
                  <th style={{ padding: '12px 10px' }}>Employee</th>
                  <th style={{ padding: '12px 10px' }}>Branch</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '12px 10px' }}>Reason</th>
                  <th style={{ padding: '12px 10px' }}>Status</th>
                  {canApprove && <th style={{ padding: '12px 10px', textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {advances.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>
                      {a.advanceNumber}
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>
                      {formatDateColombo(a.advanceDate)}
                    </td>
                    <td style={{ padding: '12px 10px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {a.employee?.name}
                    </td>
                    <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                      {a.branch?.name || getBranchName(a.branchId)}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: '#DC2626' }}>
                      {formatLKR(a.amount)}
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-muted)', maxWidth: '240px' }}>
                      {a.reason || '—'}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor:
                          a.status === 'DISBURSED' ? '#D1FAE5' :
                          a.status === 'APPROVED' ? '#DBEAFE' :
                          a.status === 'DEDUCTED' ? '#E0E7FF' :
                          a.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                        color:
                          a.status === 'DISBURSED' ? '#065F46' :
                          a.status === 'APPROVED' ? '#1E40AF' :
                          a.status === 'DEDUCTED' ? '#3730A3' :
                          a.status === 'REJECTED' ? '#991B1B' : '#92400E'
                      }}>
                        {a.status}
                      </span>
                    </td>
                    {canApprove && (
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        {a.status === 'PENDING' && (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              onClick={() => handleApprove(a.id)}
                              title="Approve advance request"
                              style={{ padding: '4px 8px', borderRadius: '6px', background: '#059669', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(a.id)}
                              title="Reject advance request"
                              style={{ padding: '4px 8px', borderRadius: '6px', background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {a.status === 'APPROVED' && (
                          <button
                            onClick={() => {
                              setDisburseTarget(a);
                              setDisburseAccountId('');
                              setDisburseError(null);
                            }}
                            title="Disburse cash from drawer"
                            style={{ padding: '4px 10px', borderRadius: '6px', background: '#2563EB', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            Disburse Cash
                          </button>
                        )}
                        {a.status === 'DISBURSED' && (
                          <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                            Disbursed on {formatDateColombo(a.disbursedAt)}
                          </span>
                        )}
                        {a.status === 'DEDUCTED' && (
                          <span style={{ fontSize: '0.72rem', color: '#4F46E5', fontWeight: 600 }}>
                            Deducted in Payroll
                          </span>
                        )}
                        {a.status === 'REJECTED' && (
                          <span style={{ fontSize: '0.72rem', color: '#DC2626' }}>
                            Rejected
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

      {/* Request Advance Modal */}
      {isRequestModalOpen && (
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
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Request Employee Salary Advance</h3>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {requestError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#FEE2E2', color: '#991B1B', fontSize: '0.85rem', marginBottom: '14px' }}>
                {requestError}
              </div>
            )}
            {requestSuccess && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#D1FAE5', color: '#065F46', fontSize: '0.85rem', marginBottom: '14px' }}>
                {requestSuccess}
              </div>
            )}

            <form onSubmit={handleRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Select Employee</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}
                  required
                >
                  <option value="">Choose employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role || 'Staff'}) — {emp.branch?.name || 'JB Group'}
                    </option>
                  ))}
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

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Advance Amount (LKR)</label>
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
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Reason / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency medical advance or personal advance"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestSubmitting}
                  style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--jb-crimson)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  {requestSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disburse Cash Modal */}
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
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Disburse Salary Advance</h3>
              <button
                onClick={() => setDisburseTarget(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-main)', marginBottom: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{disburseTarget.employee?.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Advance #{disburseTarget.advanceNumber}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#DC2626', marginTop: '6px' }}>
                {formatLKR(disburseTarget.amount)}
              </div>
            </div>

            {disburseError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#FEE2E2', color: '#991B1B', fontSize: '0.85rem', marginBottom: '14px' }}>
                {disburseError}
              </div>
            )}

            <form onSubmit={handleDisburseAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Paying Cash Drawer / Account</label>
                <select
                  value={disburseAccountId}
                  onChange={(e) => setDisburseAccountId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff' }}
                  required
                >
                  <option value="">Select cash drawer...</option>
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
                  style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563EB', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  {disbursing ? 'Disbursing...' : 'Confirm Cash Handover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryAdvancesView;

