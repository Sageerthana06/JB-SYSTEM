import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, getBranchName, formatDateColombo } from './financeUtils';
import {
  FileText,
  Printer,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Building,
  CheckCircle2,
  Calendar,
  Layers,
  PieChart,
  DollarSign
} from 'lucide-react';

export const ProfitLossReportView = ({ branchScope, user, getAuthHeaders }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [period, setPeriod] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const reportRef = useRef(null);

  const fetchPnl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchScope) params.append('branchId', branchScope);
      if (period) params.append('period', period);
      if (period === 'custom' && customStart && customEnd) {
        params.append('startDate', customStart);
        params.append('endDate', customEnd);
      }

      const res = await fetch(`${API_BASE}/finance/reports/profit-and-loss?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to generate Profit & Loss report');
      }
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branchScope, period, customStart, customEnd, getAuthHeaders]);

  useEffect(() => {
    fetchPnl();
  }, [fetchPnl]);

  const handlePrint = () => {
    window.print();
  };

  const summary = data?.summary || {};
  const branchBreakdown = data?.branchBreakdown;
  const opexCategories = data?.opexByCategory || {};
  const methods = data?.revenueByMethod || {};
  const sources = data?.revenueBySource || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Control Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Profit & Loss (P&L) Statement
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Real-time operating income, cost of goods sold, and branch overhead performance
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', background: 'var(--bg-main)', fontWeight: 600 }}
          >
            <option value="today">Today (Colombo)</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Date Range</option>
          </select>

          {period === 'custom' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
              />
              <button
                onClick={fetchPnl}
                style={{ padding: '7px 14px', borderRadius: '8px', background: '#2563EB', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                Apply
              </button>
            </div>
          )}

          <button
            onClick={fetchPnl}
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
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: '#0B1F3A',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}
          >
            <Printer size={15} /> Print Statement
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '340px', gap: '12px' }}>
          <RefreshCw className="animate-spin text-blue-600" size={32} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Compiling Profit & Loss statement...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--jb-crimson)', backgroundColor: '#FEF2F2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="var(--jb-crimson)" />
            <span style={{ color: '#991B1B', fontWeight: 600 }}>{error}</span>
          </div>
        </div>
      ) : (
        <div ref={reportRef} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Executive Summary Highlighting Gross & Net Profit */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {/* Total Revenue */}
            <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #059669' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Operating Revenue
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#059669', marginTop: '6px' }}>
                {formatLKR(summary.totalRevenue)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Verified customer collections
              </div>
            </div>

            {/* COGS */}
            <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #D97706' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Cost of Goods Sold (COGS)
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#D97706', marginTop: '6px' }}>
                {formatLKR(summary.totalCogs)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Materials ({formatLKR(summary.materialSpend)}) + Wages ({formatLKR(summary.tailorWages)})
              </div>
            </div>

            {/* Gross Profit */}
            <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #2563EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Gross Profit
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563EB', background: '#DBEAFE', padding: '2px 6px', borderRadius: '4px' }}>
                  {summary.grossProfitMargin}% Margin
                </span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0B1F3A', marginTop: '6px' }}>
                {formatLKR(summary.grossProfit)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Revenue minus Direct Production Costs
              </div>
            </div>

            {/* Total OPEX */}
            <div className="card" style={{ padding: '20px', borderRadius: '14px', borderLeft: '4px solid #DC2626' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Operating Expenses (OPEX)
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#DC2626', marginTop: '6px' }}>
                {formatLKR(summary.totalOpex)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Rent, utilities, staff salaries & overhead
              </div>
            </div>

            {/* Net Operating Profit */}
            <div className="card" style={{
              padding: '20px',
              borderRadius: '14px',
              background: summary.netProfit >= 0 ? 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)' : 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)',
              color: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#A7F3D0', textTransform: 'uppercase' }}>
                  Net Profit (Bottom Line)
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                  {summary.netProfitMargin}% Margin
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '6px' }}>
                {formatLKR(summary.netProfit)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#E2E8F0', marginTop: '4px' }}>
                Gross Profit minus Operating Overhead
              </div>
            </div>
          </div>

          {/* Consolidated Branch Comparison Cards (when viewing ALL) */}
          {branchBreakdown && (
            <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Branch Performance Matrix: Branch 1 vs. Branch 2
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Branch 1 */}
                <div style={{ padding: '20px', borderRadius: '12px', border: '2px solid #2563EB', backgroundColor: 'var(--bg-main)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1E40AF' }}>
                      {branchBreakdown.branch1.name} (Branch 1)
                    </h4>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E40AF', background: '#DBEAFE', padding: '3px 8px', borderRadius: '6px' }}>
                      {branchBreakdown.branch1.netMargin}% Net Margin
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Revenue:</span>
                      <strong>{formatLKR(branchBreakdown.branch1.revenue)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>COGS (Materials + Labor):</span>
                      <strong style={{ color: '#D97706' }}>-{formatLKR(branchBreakdown.branch1.cogs)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Gross Profit:</span>
                      <strong>{formatLKR(branchBreakdown.branch1.grossProfit)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Operating Expenses:</span>
                      <strong style={{ color: '#DC2626' }}>-{formatLKR(branchBreakdown.branch1.opex)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #2563EB', paddingTop: '8px', fontSize: '1rem', fontWeight: 900 }}>
                      <span>Branch Net Profit:</span>
                      <span style={{ color: branchBreakdown.branch1.netProfit >= 0 ? '#059669' : '#DC2626' }}>
                        {formatLKR(branchBreakdown.branch1.netProfit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Branch 2 */}
                <div style={{ padding: '20px', borderRadius: '12px', border: '2px solid #7C3AED', backgroundColor: 'var(--bg-main)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#6D28D9' }}>
                      {branchBreakdown.branch2.name} (Branch 2)
                    </h4>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6D28D9', background: '#EDE9FE', padding: '3px 8px', borderRadius: '6px' }}>
                      {branchBreakdown.branch2.netMargin}% Net Margin
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Revenue:</span>
                      <strong>{formatLKR(branchBreakdown.branch2.revenue)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>COGS (Materials + Labor):</span>
                      <strong style={{ color: '#D97706' }}>-{formatLKR(branchBreakdown.branch2.cogs)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Gross Profit:</span>
                      <strong>{formatLKR(branchBreakdown.branch2.grossProfit)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Operating Expenses:</span>
                      <strong style={{ color: '#DC2626' }}>-{formatLKR(branchBreakdown.branch2.opex)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #7C3AED', paddingTop: '8px', fontSize: '1rem', fontWeight: 900 }}>
                      <span>Branch Net Profit:</span>
                      <span style={{ color: branchBreakdown.branch2.netProfit >= 0 ? '#059669' : '#DC2626' }}>
                        {formatLKR(branchBreakdown.branch2.netProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Itemized Statement Card */}
          <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Itemized Financial Breakdown
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {/* Revenue Breakdown */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 800, color: '#059669', borderBottom: '2px solid #D1FAE5', paddingBottom: '6px' }}>
                  1. Operating Revenue Details
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                  {Object.entries(methods).map(([method, amt]) => (
                    <div key={method} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Payment: {method}</span>
                      <strong>{formatLKR(amt)}</strong>
                    </div>
                  ))}
                  {Object.entries(sources).map(([src, amt]) => (
                    <div key={src} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--text-muted)' }}>
                      <span>Channel: {src} Orders</span>
                      <span>{formatLKR(amt)}</span>
                    </div>
                  ))}
                  {Object.keys(methods).length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No verified customer payments in this period.</div>
                  )}
                </div>
              </div>

              {/* OPEX Breakdown */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 800, color: '#DC2626', borderBottom: '2px solid #FEE2E2', paddingBottom: '6px' }}>
                  2. Operating Overhead (OPEX) by Category
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                  {Object.entries(opexCategories).map(([cat, amt]) => (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{cat}</span>
                      <strong style={{ color: '#DC2626' }}>{formatLKR(amt)}</strong>
                    </div>
                  ))}
                  {Object.keys(opexCategories).length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No operating expenses posted in this period.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitLossReportView;

