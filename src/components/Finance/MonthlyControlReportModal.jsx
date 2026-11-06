import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config/api';
import { formatLKR, getBranchName } from './financeUtils';
import {
  X,
  Printer,
  Download,
  Calendar,
  Building,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';

export const MonthlyControlReportModal = ({ isOpen, onClose, branchScope, getAuthHeaders }) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (branchScope) params.append('branchId', branchScope);
      params.append('year', selectedYear);
      params.append('month', selectedMonth);

      const res = await fetch(`${API_BASE}/finance/reports/monthly-control?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load monthly control report');
      }
      setReportData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReport();
    }
  }, [isOpen, selectedYear, selectedMonth, branchScope]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!reportData) return;

    const cur = reportData.currentMonth || {};
    const prev = reportData.previousMonth || {};
    const comp = reportData.comparison || {};

    const rows = [
      ['JB GROUP (PVT) LTD — MONTHLY FINANCIAL CONTROL REPORT'],
      [`Reporting Period: ${reportData.monthLabel}`],
      [`Compared To: ${reportData.prevMonthLabel}`],
      [`Branch Scope: ${branchScope === 'ALL' ? 'Consolidated (All Branches)' : `Branch ${branchScope}`}`],
      [`Generated: ${new Date().toLocaleString('en-GB')}`],
      [],
      ['FINANCIAL METRIC', `${reportData.monthLabel} (LKR)`, `${reportData.prevMonthLabel} (LKR)`, 'VARIANCE (LKR)'],
      ['Total Income Received', cur.totalIncome, prev.totalIncome, comp.incomeDiff],
      ['Total Operating Expenses Paid', cur.totalExpensesPaid, prev.totalExpensesPaid, comp.expensesDiff],
      ['Total Salaries Paid', cur.totalSalariesPaid, prev.totalSalariesPaid, comp.salariesDiff],
      ['Total Amount Paid', cur.totalPaid, prev.totalPaid, (cur.totalPaid - prev.totalPaid)],
      ['Pending Salaries', cur.pendingSalaries, prev.pendingSalaries, (cur.pendingSalaries - prev.pendingSalaries)],
      ['Pending Bills', cur.pendingBills, prev.pendingBills, (cur.pendingBills - prev.pendingBills)],
      ['Net Cashflow', cur.netCashflow, prev.netCashflow, comp.cashflowDiff]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => `"${cell}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `jb_financial_control_report_${selectedYear}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cur = reportData?.currentMonth || {};
  const prev = reportData?.previousMonth || {};
  const comp = reportData?.comparison || {};

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={22} color="#dc2626" />
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Monthly Financial Control Report
              </h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
              JB GROUP (PVT) LTD • Scope: {branchScope === 'ALL' ? 'Both Branches Consolidated' : getBranchName(branchScope)}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{
          padding: '14px 24px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Year
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
                Month
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
                {Array.from({ length: 12 }, (_, i) => {
                  const m = i + 1;
                  const monthName = new Date(2000, i, 1).toLocaleString('default', { month: 'long' });
                  return <option key={m} value={m}>{monthName}</option>;
                })}
              </select>
            </div>

            <button
              onClick={fetchReport}
              disabled={loading}
              style={{
                marginTop: '16px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleExportCSV}
              disabled={loading || !reportData}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Download size={14} /> Export CSV
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #0284c7',
                backgroundColor: '#eff6ff',
                color: '#0284c7',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Printer size={14} /> Print / PDF
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <RefreshCw className="animate-spin" size={28} style={{ margin: '0 auto 8px auto' }} />
              <p style={{ margin: 0 }}>Generating monthly financial report...</p>
            </div>
          )}

          {error && (
            <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {!loading && reportData && (
            <>
              {/* Comparative Summary Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 18px' }}>Financial Telemetry Metric</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>{reportData.monthLabel}</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>{reportData.prevMonthLabel}</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Variance / Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 18px', fontWeight: 700, color: '#0f172a' }}>
                        1. Total Income (Actual Received)
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                        {formatLKR(cur.totalIncome)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: '#64748b' }}>
                        {formatLKR(prev.totalIncome)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: comp.incomeDiff >= 0 ? '#16a34a' : '#dc2626' }}>
                        {comp.incomeDiff >= 0 ? `+ ${formatLKR(comp.incomeDiff)}` : `- ${formatLKR(Math.abs(comp.incomeDiff))}`}
                      </td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 18px', fontWeight: 700, color: '#0f172a' }}>
                        2. Total Operating Expenses Paid
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                        {formatLKR(cur.totalExpensesPaid)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: '#64748b' }}>
                        {formatLKR(prev.totalExpensesPaid)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: comp.expensesDiff <= 0 ? '#16a34a' : '#dc2626' }}>
                        {comp.expensesDiff >= 0 ? `+ ${formatLKR(comp.expensesDiff)}` : `- ${formatLKR(Math.abs(comp.expensesDiff))}`}
                      </td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 18px', fontWeight: 700, color: '#0f172a' }}>
                        3. Total Employee Salaries Paid
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                        {formatLKR(cur.totalSalariesPaid)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: '#64748b' }}>
                        {formatLKR(prev.totalSalariesPaid)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: comp.salariesDiff <= 0 ? '#16a34a' : '#dc2626' }}>
                        {comp.salariesDiff >= 0 ? `+ ${formatLKR(comp.salariesDiff)}` : `- ${formatLKR(Math.abs(comp.salariesDiff))}`}
                      </td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                      <td style={{ padding: '12px 18px', fontWeight: 800, color: '#0f172a' }}>
                        Total Disbursements (Expenses + Salaries)
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                        {formatLKR(cur.totalPaid)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: '#64748b' }}>
                        {formatLKR(prev.totalPaid)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700 }}>
                        {formatLKR(cur.totalPaid - prev.totalPaid)}
                      </td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: cur.netCashflow >= 0 ? '#f0fdf4' : '#fef2f2' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 900, color: cur.netCashflow >= 0 ? '#15803d' : '#b91c1c' }}>
                        Net Cashflow (Income − Total Paid)
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 900, fontSize: '1.05rem', color: cur.netCashflow >= 0 ? '#15803d' : '#b91c1c' }}>
                        {formatLKR(cur.netCashflow)}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, color: '#64748b' }}>
                        {formatLKR(prev.netCashflow)}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: comp.cashflowDiff >= 0 ? '#15803d' : '#b91c1c' }}>
                        {comp.cashflowDiff >= 0 ? `+ ${formatLKR(comp.cashflowDiff)}` : `- ${formatLKR(Math.abs(comp.cashflowDiff))}`}
                      </td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 18px', color: '#475569' }}>
                        Pending Salaries (Payable)
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>
                        {formatLKR(cur.pendingSalaries)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: '#64748b' }}>
                        {formatLKR(prev.pendingSalaries)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: '#64748b' }}>
                        {formatLKR(cur.pendingSalaries - prev.pendingSalaries)}
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: '12px 18px', color: '#475569' }}>
                        Pending Bills (Utilities & Rent)
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>
                        {formatLKR(cur.pendingBills)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: '#64748b' }}>
                        {formatLKR(prev.pendingBills)}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: '#64748b' }}>
                        {formatLKR(cur.pendingBills - prev.pendingBills)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#f8fafc',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '16px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonthlyControlReportModal;

