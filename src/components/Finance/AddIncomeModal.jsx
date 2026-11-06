import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, getBranchName } from './financeUtils';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Building,
  CreditCard,
  FileText,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const AddIncomeModal = ({ isOpen, onClose, branchScope, user, getAuthHeaders, onIncomeAdded }) => {
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const role = String(user?.role || '').toUpperCase();
  const isManager = role === 'MANAGER';
  const effectiveBranch = (isManager && user?.branchId) ? String(user.branchId) : (branchScope === 'ALL' ? '1' : String(branchScope));

  const [form, setForm] = useState({
    branchId: effectiveBranch,
    categoryId: '',
    accountId: '',
    amount: '',
    paymentMethod: 'CASH',
    referenceNo: '',
    description: '',
    notes: '',
    receiptImage: ''
  });

  useEffect(() => {
    if (!isOpen) return;
    const loadDependencies = async () => {
      setLoadingDropdowns(true);
      try {
        const [catRes, accRes] = await Promise.all([
          fetch(`${API_BASE}/finance/categories`, { headers: getAuthHeaders() }),
          fetch(`${API_BASE}/finance/accounts${branchScope && branchScope !== 'ALL' ? `?branchId=${branchScope}` : ''}`, { headers: getAuthHeaders() })
        ]);
        const catJson = await catRes.json();
        const accJson = await accRes.json();

        if (catJson.success) {
          // Filter to Income categories, or create fallback
          const incomeCats = (catJson.data || []).filter(c => c.categoryType === 'INCOME');
          setCategories(incomeCats.length > 0 ? incomeCats : catJson.data || []);
          if (incomeCats.length > 0 && !form.categoryId) {
            setForm(prev => ({ ...prev, categoryId: String(incomeCats[0].id) }));
          }
        }

        if (accJson.success) {
          const accList = accJson.data || [];
          setAccounts(accList);
          if (accList.length > 0 && !form.accountId) {
            setForm(prev => ({ ...prev, accountId: String(accList[0].id) }));
          }
        }
      } catch (err) {
        console.error('Error loading income form dependencies:', err);
      } finally {
        setLoadingDropdowns(false);
      }
    };
    loadDependencies();
  }, [isOpen, branchScope, getAuthHeaders]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Amount must be greater than zero.');
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        branchId: form.branchId,
        type: 'INCOME',
        categoryId: parseInt(form.categoryId, 10),
        accountId: parseInt(form.accountId, 10),
        amount: amt,
        paymentMethod: form.paymentMethod,
        referenceNo: form.referenceNo?.trim() || null,
        description: form.description?.trim() || 'Additional Business Income',
        notes: form.notes?.trim() || null,
        receiptImage: form.receiptImage || null
      };

      const res = await fetch(`${API_BASE}/finance/transactions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to record income');
      }

      setSuccess(`Income of LKR ${formatLKR(amt)} recorded successfully.`);
      setTimeout(() => {
        onClose();
        setSuccess(null);
        if (onIncomeAdded) onIncomeAdded();
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#DCFCE7', color: '#166534' }}>
              <TrendingUp size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Record Additional Business Income
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Non-order operational earnings, scrap/fabric sales, consultations, etc.
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#FEE2E2', color: '#991B1B', marginBottom: '14px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#DCFCE7', color: '#166534', marginBottom: '14px', fontSize: '0.85rem' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Income Category *
            </label>
            <select
              required
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Amount (LKR) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="1"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 800 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Deposit To Account *
              </label>
              <select
                required
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.accountName} ({a.accountType})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Payment Method
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="CHEQUE">Cheque</option>
                <option value="ONLINE">Online Portal</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Branch
              </label>
              <select
                disabled={isManager}
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: isManager ? '#F3F4F6' : 'var(--bg-card)', color: 'var(--text-main)' }}
              >
                <option value="1">JB Group (Main)</option>
                <option value="2">Bella Design</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Description / Source *
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Sale of unused silk fabric scraps to workshop partner"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Reference Number (Receipt / Slip / Deposit Ref)
            </label>
            <input
              type="text"
              placeholder="e.g. REC-2026-0045"
              value={form.referenceNo}
              onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#16A34A', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
            >
              {submitting ? 'Recording...' : 'Record Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddIncomeModal;

