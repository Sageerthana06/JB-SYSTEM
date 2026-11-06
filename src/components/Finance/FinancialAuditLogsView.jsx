import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, formatDateTimeColombo, getBranchName } from './financeUtils';
import {
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  X
} from 'lucide-react';

export const FinancialAuditLogsView = ({ branchScope, user, getAuthHeaders }) => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, totalLogs: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchAuditLogs = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchScope) params.append('branchId', branchScope);
      params.append('page', page);
      params.append('limit', '50');
      if (actionFilter) params.append('action', actionFilter);

      const res = await fetch(`${API_BASE}/finance/audit-logs?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to fetch financial audit trail');
      }
      setLogs(json.logs || []);
      if (json.pagination) setPagination(json.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, actionFilter, getAuthHeaders]);

  useEffect(() => {
    fetchAuditLogs(1);
  }, [fetchAuditLogs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Financial Audit Trail & Event Telemetry
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Tamper-evident logs of all financial adjustments, reversals, advances, and disbursements
          </p>
        </div>

        <button
          onClick={() => fetchAuditLogs(pagination.page)}
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
      </div>

      {/* Filter Card */}
      <div className="card" style={{ padding: '14px 20px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Filter size={16} color="var(--text-muted)" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: 'var(--bg-main)' }}
          >
            <option value="">All Financial Actions</option>
            <option value="ACCOUNT_CREATED">Account Created</option>
            <option value="EXPENSE_RECORDED">Expense Recorded</option>
            <option value="INCOME_RECORDED">Income Recorded</option>
            <option value="FUNDS_TRANSFERRED">Funds Transferred</option>
            <option value="TRANSACTION_REVERSED">Transaction Reversed</option>
            <option value="PAYROLL_GENERATED">Payroll Generated</option>
            <option value="SALARY_DISBURSED">Salary Disbursed</option>
            <option value="SALARY_ADVANCE_REQUESTED">Advance Requested</option>
            <option value="SALARY_ADVANCE_APPROVED">Advance Approved</option>
            <option value="SALARY_ADVANCE_REJECTED">Advance Rejected</option>
            <option value="SALARY_ADVANCE_DISBURSED">Advance Disbursed</option>
          </select>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Total Events: <strong>{pagination.totalLogs}</strong>
        </div>
      </div>

      {/* Logs Table */}
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
        ) : logs.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <ShieldCheck size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>No Audit Logs Found</h3>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>
              No financial event logs match this action filter.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 10px' }}>Timestamp</th>
                  <th style={{ padding: '12px 10px' }}>Action</th>
                  <th style={{ padding: '12px 10px' }}>Entity</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '12px 10px' }}>Branch</th>
                  <th style={{ padding: '12px 10px' }}>Performed By</th>
                  <th style={{ padding: '12px 10px' }}>IP Address</th>
                  <th style={{ padding: '12px 10px' }}>Reason / Memo</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDateTimeColombo(l.createdAt)}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#EFF6FF',
                        color: '#1E40AF',
                        fontFamily: 'monospace'
                      }}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-main)' }}>
                      {l.entityType} #{l.entityId}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>
                      {l.amount ? formatLKR(l.amount) : '—'}
                    </td>
                    <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                      {getBranchName(l.branchId)}
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-main)' }}>
                      <div>{l.performedByName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{l.performedByRole}</div>
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {l.ipAddress || 'Internal'}
                    </td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-muted)', maxWidth: '200px' }}>
                      <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {l.reason || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      {(l.previousState || l.newState) && (
                        <button
                          onClick={() => setSelectedLog(l)}
                          title="View State Payload"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            color: '#2563EB',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Eye size={12} /> View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchAuditLogs(pagination.page - 1)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-main)',
                      cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                      opacity: pagination.page <= 1 ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.8rem'
                    }}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchAuditLogs(pagination.page + 1)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-main)',
                      cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                      opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.8rem'
                    }}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* State Payload Inspector Modal */}
      {selectedLog && (
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
          <div className="card" style={{ maxWidth: '640px', width: '100%', borderRadius: '16px', padding: '24px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Audit Event #{selectedLog.id}</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{selectedLog.action} on {selectedLog.entityType}</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {selectedLog.previousState && (
                <div>
                  <h5 style={{ margin: '0 0 6px 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Previous State</h5>
                  <pre style={{ margin: 0, padding: '12px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid var(--border-color)', fontSize: '0.78rem', overflowX: 'auto' }}>
                    {JSON.stringify(selectedLog.previousState, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.newState && (
                <div>
                  <h5 style={{ margin: '0 0 6px 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>New State</h5>
                  <pre style={{ margin: 0, padding: '12px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid var(--border-color)', fontSize: '0.78rem', overflowX: 'auto' }}>
                    {JSON.stringify(selectedLog.newState, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialAuditLogsView;

