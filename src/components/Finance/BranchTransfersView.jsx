import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, formatDateTimeColombo, getBranchName } from './financeUtils';
import {
  ArrowRightLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Wallet,
  Building,
  Info,
  Clock,
  Send
} from 'lucide-react';

export const BranchTransfersView = ({ branchScope, user, getAuthHeaders }) => {
  const [accounts, setAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const fetchAccountsAndTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accRes, txnRes] = await Promise.all([
        fetch(`${API_BASE}/finance/accounts?branchId=${branchScope}`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/finance/transactions?type=TRANSFER_OUT&branchId=${branchScope}`, { headers: getAuthHeaders() })
      ]);

      const accJson = await accRes.json();
      const txnJson = await txnRes.json();

      if (accJson.success) setAccounts(accJson.accounts || []);
      if (txnJson.success) setTransfers(txnJson.transactions || []);
    } catch (err) {
      setError(err.message || 'Failed to load transfer telemetry');
    } finally {
      setLoading(false);
    }
  }, [branchScope, getAuthHeaders]);

  useEffect(() => {
    fetchAccountsAndTransfers();
  }, [fetchAccountsAndTransfers]);

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const fId = parseInt(fromAccountId, 10);
    const tId = parseInt(toAccountId, 10);
    const numAmount = parseFloat(amount);

    if (isNaN(fId) || isNaN(tId)) {
      setError('Please select both a source account and a destination account.');
      return;
    }

    if (fId === tId) {
      setError('Source and destination accounts must be different.');
      return;
    }

    if (!numAmount || numAmount <= 0) {
      setError('Transfer amount must be greater than zero.');
      return;
    }

    const sourceAccount = accounts.find(a => a.id === fId);
    if (sourceAccount && Number(sourceAccount.currentBalance) < numAmount) {
      setError(`Insufficient funds in ${sourceAccount.accountName}. Available balance: ${formatLKR(sourceAccount.currentBalance)}`);
      return;
    }

    setTransferring(true);
    try {
      const res = await fetch(`${API_BASE}/finance/transactions/transfer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fromAccountId: fId,
          toAccountId: tId,
          amount: numAmount,
          notes: notes.trim() || null
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Transfer failed');
      }

      setSuccess(json.message || 'Funds transferred successfully.');
      setAmount('');
      setNotes('');
      fetchAccountsAndTransfers();
    } catch (err) {
      setError(err.message);
    } finally {
      setTransferring(false);
    }
  };

  const selectedFromAcc = accounts.find(a => a.id === parseInt(fromAccountId, 10));
  const selectedToAcc = accounts.find(a => a.id === parseInt(toAccountId, 10));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Branch & Account Funds Transfer
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Execute safe balance transfers between cash drawers and bank accounts across Branch 1 & Branch 2
          </p>
        </div>

        <button
          onClick={fetchAccountsAndTransfers}
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

      {/* Educational Notice on P&L Neutrality */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px 20px',
        borderRadius: '12px',
        background: '#EFF6FF',
        border: '1px solid #BFDBFE'
      }}>
        <Info size={22} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.85rem', color: '#1E40AF', lineHeight: 1.5 }}>
          <strong>P&L Neutrality Principle:</strong> Internal branch and account transfers move liquidity between cash drawers and bank accounts without creating revenue or expense. They are strictly excluded from Profit & Loss reporting and do not alter Net Profit.
        </div>
      </div>

      {/* Transfer Execution Form Card */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
          Execute New Transfer
        </h3>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#FEE2E2', color: '#991B1B', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#D1FAE5', color: '#065F46', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} /> {success}
          </div>
        )}

        <form onSubmit={handleTransferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* From Account */}
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Source Account (Debit / Outflow)
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff' }}
                required
              >
                <option value="">Select source account...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.accountName} ({a.branchName}) — Bal: {formatLKR(a.currentBalance)}
                  </option>
                ))}
              </select>
              {selectedFromAcc && (
                <div style={{ marginTop: '10px', fontSize: '0.85rem' }}>
                  Available Balance: <strong style={{ color: '#0B1F3A' }}>{formatLKR(selectedFromAcc.currentBalance)}</strong>
                </div>
              )}
            </div>

            {/* To Account */}
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Destination Account (Credit / Inflow)
              </label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff' }}
                required
              >
                <option value="">Select destination account...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.accountName} ({a.branchName}) — Bal: {formatLKR(a.currentBalance)}
                  </option>
                ))}
              </select>
              {selectedToAcc && (
                <div style={{ marginTop: '10px', fontSize: '0.85rem' }}>
                  Current Balance: <strong style={{ color: '#0B1F3A' }}>{formatLKR(selectedToAcc.currentBalance)}</strong>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                Transfer Amount (LKR)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                Transfer Notes / Reason
              </label>
              <input
                type="text"
                placeholder="e.g. Bank deposit from Branch 1 cash drawer or petty cash replenishment"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button
              type="submit"
              disabled={transferring}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                borderRadius: '10px',
                background: 'var(--jb-crimson)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.9rem',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)'
              }}
            >
              <Send size={16} /> {transferring ? 'Processing Transfer...' : 'Execute Transfer'}
            </button>
          </div>
        </form>
      </div>

      {/* Transfer History Ledger */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
          Transfer Audit History
        </h3>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <RefreshCw className="animate-spin text-blue-600" size={28} />
          </div>
        ) : transfers.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No internal transfers recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 12px' }}>Transfer #</th>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>Source Account</th>
                  <th style={{ padding: '10px 12px' }}>Destination</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '10px 12px' }}>Notes</th>
                  <th style={{ padding: '10px 12px' }}>Executed By</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>
                      {t.transactionNumber}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {formatDateTimeColombo(t.transactionDate)}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      {t.account?.accountName || '—'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-main)' }}>
                      {t.toAccount?.accountName || 'Target Account'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#0B1F3A' }}>
                      {formatLKR(t.amount)}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {t.description || t.notes || '—'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {t.createdByName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchTransfersView;

