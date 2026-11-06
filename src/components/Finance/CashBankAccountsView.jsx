import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, getBranchName, BRANCH_OPTIONS } from './financeUtils';
import {
  Wallet,
  Building,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  CreditCard,
  ShieldCheck,
  Star
} from 'lucide-react';

export const CashBankAccountsView = ({ branchScope, user, getAuthHeaders }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalSuccess, setModalSuccess] = useState(null);

  const role = String(user?.role || '').toUpperCase();
  const canCreate = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);

  // New account form state
  const [formData, setFormData] = useState({
    accountType: 'CASH',
    accountName: '',
    branchId: branchScope === 'ALL' ? '1' : String(branchScope),
    accountNumber: '',
    bankName: '',
    bankBranch: '',
    openingBalance: '',
    isPrimary: false
  });

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/finance/accounts?branchId=${branchScope}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to fetch financial accounts');
      }
      setAccounts(json.accounts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, getAuthHeaders]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      const payload = {
        accountType: formData.accountType,
        accountName: formData.accountName.trim(),
        branchId: formData.branchId === 'CENTRAL' ? null : parseInt(formData.branchId, 10),
        accountNumber: formData.accountNumber.trim() || null,
        bankName: formData.bankName.trim() || null,
        bankBranch: formData.bankBranch.trim() || null,
        openingBalance: formData.openingBalance ? parseFloat(formData.openingBalance) : 0,
        isPrimary: Boolean(formData.isPrimary)
      };

      const res = await fetch(`${API_BASE}/finance/accounts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to create financial account');
      }

      setModalSuccess(`Account "${formData.accountName}" created successfully.`);
      setTimeout(() => {
        setIsModalOpen(false);
        setModalSuccess(null);
        setFormData({
          accountType: 'CASH',
          accountName: '',
          branchId: branchScope === 'ALL' ? '1' : String(branchScope),
          accountNumber: '',
          bankName: '',
          bankBranch: '',
          openingBalance: '',
          isPrimary: false
        });
        fetchAccounts();
      }, 1200);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalCash = accounts
    .filter(a => a.accountType === 'CASH' || a.accountType === 'PETTY_CASH')
    .reduce((sum, a) => sum + (Number(a.currentBalance) || 0), 0);

  const totalBank = accounts
    .filter(a => a.accountType === 'BANK')
    .reduce((sum, a) => sum + (Number(a.currentBalance) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header with Title and Add Account Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Branch Cash & Bank Accounts
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Manage physical cash registers, petty cash, and commercial bank balances for Branch 1 & Branch 2
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchAccounts}
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

          {canCreate && (
            <button
              onClick={() => setIsModalOpen(true)}
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
              <Plus size={16} /> New Financial Account
            </button>
          )}
        </div>
      </div>

      {/* Summary Stat Strips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #D97706' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Cash in Drawers
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {formatLKR(totalCash)}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #2563EB' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Commercial Bank Balances
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {formatLKR(totalBank)}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Available Liquidity
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
            {formatLKR(totalCash + totalBank)}
          </div>
        </div>
      </div>

      {/* Account Cards Grid */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', gap: '12px' }}>
          <RefreshCw className="animate-spin text-blue-600" size={32} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading verified account balances...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--jb-crimson)', backgroundColor: '#FEF2F2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="var(--jb-crimson)" />
            <span style={{ color: '#991B1B', fontWeight: 600 }}>{error}</span>
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="card" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Wallet size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
          <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>No Accounts Configured Yet</h3>
          <p style={{ margin: '6px 0 16px 0', fontSize: '0.875rem' }}>
            Click "New Financial Account" to register the main cash drawers and bank accounts.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
          {accounts.map(acc => {
            const isCash = acc.accountType === 'CASH' || acc.accountType === 'PETTY_CASH';
            return (
              <div
                key={acc.id}
                className="card"
                style={{
                  padding: '22px',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  borderTop: acc.isPrimary ? '4px solid #2563EB' : '1px solid var(--border-color)',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: isCash ? '#FEF3C7' : '#DBEAFE',
                        color: isCash ? '#92400E' : '#1E40AF',
                        textTransform: 'uppercase'
                      }}>
                        {acc.accountType}
                      </span>
                      {acc.isPrimary && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          backgroundColor: '#E0E7FF',
                          color: '#3730A3'
                        }}>
                          <Star size={11} fill="#3730A3" /> Primary
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {acc.branchName}
                    </span>
                  </div>

                  <h3 style={{ margin: '6px 0 2px 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {acc.accountName}
                  </h3>

                  {acc.accountNumber && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Acct #{acc.accountNumber} {acc.bankName ? `• ${acc.bankName}` : ''}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                    Current Ledger Balance
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: acc.currentBalance >= 0 ? '#0B1F3A' : '#DC2626' }}>
                    {formatLKR(acc.currentBalance)}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '12px'
                }}>
                  <span>Opening: {formatLKR(acc.openingBalance)}</span>
                  <span>{acc.transactionCount} transactions</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Account Modal */}
      {isModalOpen && (
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
          <div className="card" style={{ maxWidth: '520px', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Create New Financial Account
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#FEE2E2', color: '#991B1B', fontSize: '0.85rem', marginBottom: '14px' }}>
                {modalError}
              </div>
            )}
            {modalSuccess && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#D1FAE5', color: '#065F46', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> {modalSuccess}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Account Type</label>
                <select
                  value={formData.accountType}
                  onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}
                  required
                >
                  <option value="CASH">Cash Drawer (Cash Register)</option>
                  <option value="BANK">Commercial Bank Account</option>
                  <option value="PETTY_CASH">Petty Cash Drawer</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Branch Link</label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}
                  required
                >
                  <option value="1">Branch 1 — JB Group (Main)</option>
                  <option value="2">Branch 2 — Bella Design</option>
                  <option value="CENTRAL">Group Central / HQ (Both Branches)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. Main Cash Register 1 or Commercial Bank LKR"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                  required
                />
              </div>

              {formData.accountType === 'BANK' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Commercial Bank of Ceylon"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Bank Branch</label>
                      <input
                        type="text"
                        placeholder="e.g. Colombo 03"
                        value={formData.bankBranch}
                        onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 1000284759"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>Initial Opening Balance (LKR)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="isPrimaryAccount"
                  checked={formData.isPrimary}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                />
                <label htmlFor="isPrimaryAccount" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Set as Primary Account for this branch
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--jb-crimson)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashBankAccountsView;

