import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';
import { EXPENSE_CATEGORIES, getCategoryMeta, formatLKR } from './expenseConstants';
import {
  Printer,
  Download,
  Filter,
  Calendar,
  FileSpreadsheet,
  RefreshCw,
  Building,
  TrendingDown,
  CheckCircle2,
  Clock,
  PieChart
} from 'lucide-react';

export const ExpenseReportsView = ({ branchScope }) => {
  const { getAuthHeaders } = useAuth();
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchComprehensiveReport = () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (branchScope) params.set('branchId', branchScope);
    params.set('year', selectedYear);
    if (selectedMonth) params.set('month', selectedMonth);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    fetch(`${API_BASE}/expenses/reports/comprehensive?${params.toString()}`, {
      headers: { ...getAuthHeaders() }
    })
      .then(async res => {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const txt = await res.text();
          throw new Error(`API error (${res.status}): Server returned non-JSON`);
        }
        return res.json();
      })
      .then(data => {
        if (!data.success) throw new Error(data.message || 'Failed to generate comprehensive report');
        setReportData(data.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Error generating report');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchComprehensiveReport();
  }, [branchScope, selectedYear, selectedMonth, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!reportData) return;

    const rows = [
      ['JB GROUP - BUSINESS EXPENSE REPORT'],
      [`Generated: ${new Date().toLocaleString('en-GB')}`],
      [`Branch Scope: ${branchScope === 'ALL' ? 'Consolidated (All Branches)' : `Branch ${branchScope}`}`],
      [`Period: Year ${selectedYear} ${selectedMonth ? `Month ${selectedMonth}` : 'Full Year'}`],
      [],
      ['SUMMARY'],
      ['Total Incurred (LKR)', reportData.summary?.totalIncurred || 0],
      ['Total Settled (LKR)', reportData.summary?.totalPaid || 0],
      ['Total Pending (LKR)', reportData.summary?.totalPending || 0],
      ['Settlement Rate (%)', `${reportData.summary?.settlementRate || 0}%`],
      [],
      ['CATEGORY BREAKDOWN'],
      ['Category', 'Total (LKR)', 'Paid (LKR)', 'Pending (LKR)', 'Voucher Count']
    ];

    (reportData.categoryBreakdown || []).forEach(cat => {
      const meta = getCategoryMeta(cat.category);
      rows.push([
        meta.label,
        cat.total.toFixed(2),
        cat.paid.toFixed(2),
        cat.pending.toFixed(2),
        cat.count
      ]);
    });

    rows.push([]);
    rows.push(['BRANCH BREAKDOWN']);
    rows.push(['Branch', 'Total (LKR)', 'Paid (LKR)', 'Pending (LKR)', 'Voucher Count']);
    (reportData.branchBreakdown || []).forEach(b => {
      rows.push([
        b.name,
        b.total.toFixed(2),
        b.paid.toFixed(2),
        b.pending.toFixed(2),
        b.count
      ]);
    });

    rows.push([]);
    rows.push(['MONTHLY TRAJECTORY']);
    rows.push(['Month', 'Total (LKR)', 'Paid (LKR)', 'Pending (LKR)', 'Voucher Count']);
    (reportData.monthlyBreakdown || []).forEach(m => {
      rows.push([
        m.month,
        m.total.toFixed(2),
        m.paid.toFixed(2),
        m.pending.toFixed(2),
        m.count
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => `"${cell}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `jb_expenses_report_${selectedYear}_${selectedMonth || 'full_year'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = reportData?.summary || { totalIncurred: 0, totalPaid: 0, totalPending: 0, settlementRate: 0 };
  const categories = reportData?.categoryBreakdown || [];
  const branches = reportData?.branchBreakdown || [];
  const monthly = reportData?.monthlyBreakdown || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls Bar */}
      <div style={{
        padding: '16px 20px',
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Financial Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Billing Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              <option value="">All 12 Months</option>
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, '0');
                const monthName = new Date(2000, i, 1).toLocaleString('default', { month: 'long' });
                return <option key={m} value={m}>{monthName}</option>;
              })}
            </select>
          </div>

          <button
            onClick={fetchComprehensiveReport}
            disabled={loading}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              marginTop: '16px'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleExportCSV}
            disabled={loading || !reportData}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} /> Download CSV
          </button>

          <button
            onClick={handlePrint}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #0284c7',
              backgroundColor: '#eff6ff',
              color: '#0284c7',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer size={14} /> Print / Export PDF
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          fontSize: '0.88rem'
        }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          padding: '20px',
          borderRadius: '14px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Incurred Expenses
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
            {formatLKR(summary.totalIncurred)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            All approved operational costs
          </div>
        </div>

        <div style={{
          padding: '20px',
          borderRadius: '14px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
            Settled (Paid)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803d', marginTop: '6px' }}>
            {formatLKR(summary.totalPaid)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '4px' }}>
            Disbursed via Cash / Bank
          </div>
        </div>

        <div style={{
          padding: '20px',
          borderRadius: '14px',
          backgroundColor: summary.totalPending > 0 ? '#fff7ed' : '#f8fafc',
          border: `1px solid ${summary.totalPending > 0 ? '#fed7aa' : '#e2e8f0'}`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: summary.totalPending > 0 ? '#ea580c' : '#64748b', textTransform: 'uppercase' }}>
            Pending Settlement
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: summary.totalPending > 0 ? '#c2410c' : '#0f172a', marginTop: '6px' }}>
            {formatLKR(summary.totalPending)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#ea580c', marginTop: '4px' }}>
            Outstanding business liabilities
          </div>
        </div>

        <div style={{
          padding: '20px',
          borderRadius: '14px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
            Settlement Rate
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e3a8a', marginTop: '6px' }}>
            {summary.settlementRate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '4px' }}>
            Ratio of expenses paid
          </div>
        </div>
      </div>

      {/* Two Columns: Category Breakdown & Branch Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Category Breakdown Table */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              Category-wise Expense Breakdown (15 Categories)
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Period: {selectedYear} {selectedMonth ? `Month ${selectedMonth}` : 'All Months'}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Vouchers</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total (LKR)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Paid (LKR)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Pending (LKR)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => {
                  const meta = getCategoryMeta(cat.category);
                  const share = summary.totalIncurred > 0 ? ((cat.total / summary.totalIncurred) * 100).toFixed(1) : 0;

                  return (
                    <tr
                      key={cat.category}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: meta.color,
                            display: 'inline-block'
                          }} />
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            {meta.label}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b' }}>
                        {cat.count}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {formatLKR(cat.total)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        {formatLKR(cat.paid)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: cat.pending > 0 ? '#ea580c' : '#64748b' }}>
                        {formatLKR(cat.pending)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>
                        {share}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Branch-wise Breakdown */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc'
          }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              Branch Comparison
            </h3>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {branches.map(b => (
              <div
                key={b.branchId}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building size={16} color="#0284c7" />
                    <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                      {b.name}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                    {b.count} vouchers
                  </span>
                </div>

                <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>Incurred</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      {formatLKR(b.total)}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.68rem', color: '#16a34a', textTransform: 'uppercase' }}>Paid</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                      {formatLKR(b.paid)}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.68rem', color: '#ea580c', textTransform: 'uppercase' }}>Pending</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ea580c', marginTop: '2px' }}>
                      {formatLKR(b.pending)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Trajectory Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
            12-Month Expense Trajectory ({selectedYear})
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Month</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Vouchers</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Incurred</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Paid Amount</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Pending Amount</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Settlement Rate</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map(m => {
                const rate = m.total > 0 ? Math.round((m.paid / m.total) * 100) : 100;
                const monthName = new Date(parseInt(selectedYear, 10), m.monthNum - 1, 1).toLocaleString('default', { month: 'long' });

                return (
                  <tr
                    key={m.month}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                      {monthName} {selectedYear}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b' }}>
                      {m.count}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      {formatLKR(m.total)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                      {formatLKR(m.paid)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: m.pending > 0 ? '#ea580c' : '#64748b' }}>
                      {formatLKR(m.pending)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>
                      {rate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExpenseReportsView;
