import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Award,
  Medal,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ExternalLink,
  Phone,
  MapPin,
  TrendingUp,
  Package,
  CheckCircle2,
  Clock,
  User,
  SlidersHorizontal
} from 'lucide-react';
import { API_URL, getImageUrl } from '../config/api';
import { CustomerOrderHistoryModal } from './CustomerOrderHistoryModal';

export const MonthlyCustomerWinnersSection = ({
  onSelectCustomerInVault,
  currentBranchId
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const rankingType = 'ORDERS';
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [orderHistoryCustomer, setOrderHistoryCustomer] = useState(null);

  // Fetch monthly winners from live PostgreSQL backend
  const fetchWinners = useCallback(async (yearOverride, monthOverride, branchOverride) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('jb_token');
      const params = new URLSearchParams();

      const y = yearOverride ?? selectedYear;
      const m = monthOverride ?? selectedMonth;
      const b = branchOverride ?? branchFilter;

      if (y) params.append('year', y);
      if (m) params.append('month', m);
      if (b && b !== 'ALL') params.append('branchId', b);

      const res = await fetch(`${API_URL}/api/customers/monthly-winners?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const resData = await res.json();

      if (resData.success) {
        setData(resData);
        setSelectedYear(resData.year);
        setSelectedMonth(resData.month);
      }
    } catch (err) {
      console.error('Failed to load monthly customer winners:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, branchFilter]);

  // Initial load
  useEffect(() => {
    fetchWinners();
  }, []);

  const handleMonthChange = (e) => {
    const [yStr, mStr] = e.target.value.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    setSelectedYear(y);
    setSelectedMonth(m);
    fetchWinners(y, m);
  };

  const navigateMonth = (direction) => {
    if (!data?.availableMonths || data.availableMonths.length === 0) return;
    const months = data.availableMonths;
    const currentIdx = months.findIndex(m => m.year === selectedYear && m.month === selectedMonth);

    if (currentIdx === -1) return;

    let targetIdx = currentIdx + (direction === 'prev' ? 1 : -1);
    if (targetIdx >= 0 && targetIdx < months.length) {
      const target = months[targetIdx];
      setSelectedYear(target.year);
      setSelectedMonth(target.month);
      fetchWinners(target.year, target.month);
    }
  };

  // Derive dataset for Orders ranking
  const ordersDataset = data?.ordersRanking || {
    summary: data?.summary,
    topThree: data?.topThree || [],
    leaderboard: data?.leaderboard || []
  };

  const topThree = ordersDataset?.topThree || [];
  const goldWinner = topThree.find(w => w.rank === 1);
  const silverWinner = topThree.find(w => w.rank === 2);
  const bronzeWinner = topThree.find(w => w.rank === 3);

  const leaderboard = (ordersDataset?.leaderboard || []).filter(c => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.customerName?.toLowerCase().includes(q) ||
      c.primaryPhone?.includes(q) ||
      c.address?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ marginBottom: '28px' }}>
      {/* 🏆 Section Header & Controls */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '20px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            backgroundColor: '#fef3c7',
            padding: '12px',
            borderRadius: '16px',
            color: '#b45309',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
            transition: 'all 0.2s'
          }}>
            <Trophy size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0a192f', margin: 0 }}>
                Monthly Top 3 Customer Winners & VIP Leaderboard
              </h2>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                padding: '3px 9px',
                borderRadius: '999px',
                textTransform: 'uppercase'
              }}>
                Live Database
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.825rem', fontWeight: 600, margin: '3px 0 0 0' }}>
              Ranked by valid orders placed in {data?.monthName || 'the current month'}. Tie-breaker uses total order value.
            </p>
          </div>
        </div>

        {/* Controls: Month selector, Previous/Next, Branch, Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Quick Prev / Next Month */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '2px' }}>
            <button
              onClick={() => navigateMonth('prev')}
              title="Previous Month"
              style={{
                background: 'none',
                border: 'none',
                padding: '6px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#475569',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => navigateMonth('next')}
              title="Next Month"
              style={{
                background: 'none',
                border: 'none',
                padding: '6px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#475569',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Month Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} style={{ color: '#64748b' }} />
            <select
              value={`${selectedYear}-${selectedMonth}`}
              onChange={handleMonthChange}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#0f172a',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {(data?.availableMonths || []).map(m => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                  {m.label} ({m.orderCount || 0} {m.orderCount === 1 ? 'order' : 'orders'})
                </option>
              ))}
            </select>
          </div>

          {/* Branch filter */}
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              fetchWinners(selectedYear, selectedMonth, e.target.value);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1.5px solid #cbd5e1',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#0f172a',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="ALL">Consolidated HQ (All Branches)</option>
            <option value="1">Branch 1 – JB Group (Main)</option>
            <option value="2">Branch 2 – Bella Design</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={() => fetchWinners()}
            disabled={loading}
            title="Refresh Real-Time Rankings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1.5px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} style={{ color: '#2563eb' }} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 🧭 Orders Ranking Header & Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '18px'
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          backgroundColor: '#f1f5f9',
          padding: '6px',
          borderRadius: '16px',
          border: '1px solid #e2e8f0'
        }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '12px',
              backgroundColor: '#0a192f',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.875rem',
              boxShadow: '0 4px 12px rgba(10, 25, 47, 0.2)'
            }}
          >
            <Package size={17} />
            <span>Orders Winners</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#ffffff'
            }}>
              {ordersDataset.leaderboard?.length || 0} Clients
            </span>
          </div>
        </div>

        {/* Informational Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          borderRadius: '999px',
          backgroundColor: '#eff6ff',
          color: '#1e40af',
          border: '1px solid #bfdbfe',
          fontSize: '0.78rem',
          fontWeight: 700
        }}>
          <Package size={14} />
          <span>Valid Orders Placed (Excludes Rejected & Cancelled Orders)</span>
        </div>
      </div>

      {/* 📊 Month Summary KPI Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ backgroundColor: '#ffffff', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            MONTH VALID ORDERS
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#2563eb', marginTop: '4px' }}>
            {(ordersDataset.summary?.totalValidOrders || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Active orders counted</span>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            ACTIVE CLIENTS
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0a192f', marginTop: '4px' }}>
            {(ordersDataset.summary?.totalCustomers || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Clients ordered this month</span>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            TOTAL ORDER VALUE
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
            LKR {(ordersDataset.summary?.totalOrderValue || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Gross month order book</span>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            COLLECTED PAYMENTS
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#16a34a', marginTop: '4px' }}>
            LKR {(ordersDataset.summary?.totalPaid || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Paid towards orders</span>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            PENDING BALANCE
          </span>
          <div style={{
            fontSize: '1.4rem',
            fontWeight: 900,
            color: (ordersDataset.summary?.totalOutstanding || 0) > 0 ? '#dc2626' : '#16a34a',
            marginTop: '4px'
          }}>
            LKR {(ordersDataset.summary?.totalOutstanding || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Customer receivables</span>
        </div>
      </div>

      {/* 👑 Top 3 Customer Winners Podium Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {/* 🥇 1st Place - GOLD WINNER */}
        <WinnerPodiumCard
          place="1"
          medal="GOLD"
          title="Gold Winner 🥇"
          winner={goldWinner}
          monthName={data?.monthName}
          onViewOrders={(w) => setOrderHistoryCustomer(w)}
          onOpenVault={(w) => onSelectCustomerInVault && onSelectCustomerInVault(w.customerId)}
        />

        {/* 🥈 2nd Place - SILVER WINNER */}
        <WinnerPodiumCard
          place="2"
          medal="SILVER"
          title="Silver Winner 🥈"
          winner={silverWinner}
          monthName={data?.monthName}
          onViewOrders={(w) => setOrderHistoryCustomer(w)}
          onOpenVault={(w) => onSelectCustomerInVault && onSelectCustomerInVault(w.customerId)}
        />

        {/* 🥉 3rd Place - BRONZE WINNER */}
        <WinnerPodiumCard
          place="3"
          medal="BRONZE"
          title="Bronze Winner 🥉"
          winner={bronzeWinner}
          monthName={data?.monthName}
          onViewOrders={(w) => setOrderHistoryCustomer(w)}
          onOpenVault={(w) => onSelectCustomerInVault && onSelectCustomerInVault(w.customerId)}
        />
      </div>

      {/* 📋 Complete Monthly Customers Leaderboard */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0a192f' }}>
              Top Customers by Orders – {data?.monthName || 'Current Month'}
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              All {ordersDataset.summary?.totalCustomers || 0} ordering customers ranked by valid orders placed in this month (Primary: Orders Count • Tie-breaker: Order Value)
            </p>
          </div>

          {/* Leaderboard Search */}
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search customer, phone, or address..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.825rem',
                outline: 'none',
                backgroundColor: '#f8fafc',
                fontWeight: 600
              }}
            />
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{
            padding: '36px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '14px',
            border: '1px dashed #cbd5e1',
            color: '#64748b'
          }}>
            {loading ? 'Refreshing monthly rankings...' : 'No orders recorded for this month or filter.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 800 }}>Rank</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800 }}>Customer Name & Contact</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'center' }}>
                    Monthly Valid Orders
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>
                    Total Order Value
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>
                    Total Paid
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>
                    Outstanding Balance
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((cust, idx) => {
                  const isTop3 = cust.rank <= 3;
                  const rankBadge = cust.rank === 1
                    ? { bg: '#fef3c7', text: '#b45309', border: '#f59e0b', icon: '🥇 Gold #1' }
                    : cust.rank === 2
                    ? { bg: '#f1f5f9', text: '#475569', border: '#94a3b8', icon: '🥈 Silver #2' }
                    : cust.rank === 3
                    ? { bg: '#ffedd5', text: '#c2410c', border: '#ea580c', icon: '🥉 Bronze #3' }
                    : null;

                  return (
                    <tr
                      key={cust.customerId}
                      style={{
                        borderBottom: idx === leaderboard.length - 1 ? 'none' : '1px solid #f1f5f9',
                        backgroundColor: isTop3 ? (cust.rank === 1 ? '#fffdf5' : '#fafafa') : (idx % 2 === 0 ? '#ffffff' : '#fafafa'),
                        transition: 'background-color 0.15s'
                      }}
                    >
                      {/* Rank Column */}
                      <td style={{ padding: '14px 16px', fontWeight: 900 }}>
                        {rankBadge ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            backgroundColor: rankBadge.bg,
                            color: rankBadge.text,
                            border: `1px solid ${rankBadge.border}`
                          }}>
                            {rankBadge.icon}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-block',
                            width: '28px',
                            height: '28px',
                            lineHeight: '28px',
                            textAlign: 'center',
                            borderRadius: '50%',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            fontSize: '0.8rem',
                            fontWeight: 800
                          }}>
                            #{cust.rank}
                          </span>
                        )}
                      </td>

                      {/* Customer Details */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {cust.profilePhoto ? (
                            <img
                              src={getImageUrl(cust.profilePhoto)}
                              alt={cust.customerName}
                              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                            />
                          ) : (
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: '#0a192f',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.85rem'
                            }}>
                              {cust.customerName?.charAt(0).toUpperCase() || <User size={16} />}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                              {cust.customerName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                              <span>{cust.primaryPhone || 'No Phone'}</span>
                              {cust.address && <span>• {cust.address}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Valid Orders */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          backgroundColor: '#dbeafe',
                          color: '#1d4ed8'
                        }}>
                          {cust.orderCount} {cust.orderCount === 1 ? 'Order' : 'Orders'}
                        </span>
                      </td>

                      {/* Total Order Value */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        LKR {cust.totalOrderValue.toLocaleString()}
                      </td>

                      {/* Paid Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                        LKR {cust.totalPaid.toLocaleString()}
                      </td>

                      {/* Outstanding Balance */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800 }}>
                        {cust.outstandingBalance <= 0 ? (
                          <span style={{ color: '#16a34a', backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>
                            ✓ Fully Settled
                          </span>
                        ) : (
                          <span style={{ color: '#dc2626', backgroundColor: '#fee2e2', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>
                            LKR {cust.outstandingBalance.toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => setOrderHistoryCustomer(cust)}
                            title="View Individual Orders Breakdown"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Package size={13} style={{ color: '#2563eb' }} />
                            Orders ({cust.orderCount})
                          </button>
                          <button
                            onClick={() => onSelectCustomerInVault && onSelectCustomerInVault(cust.customerId)}
                            title="Open Customer 360 & Sizing Vault"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#0a192f',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <ExternalLink size={13} />
                            Vault
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Order / Payment History breakdown */}
      {orderHistoryCustomer && (
        <CustomerOrderHistoryModal
          isOpen={Boolean(orderHistoryCustomer)}
          onClose={() => setOrderHistoryCustomer(null)}
          customerData={orderHistoryCustomer}
          rankingType={rankingType}
          monthName={data?.monthName}
          onOpenVaultProfile={(id) => {
            if (onSelectCustomerInVault) {
              onSelectCustomerInVault(id);
            }
          }}
        />
      )}
    </div>
  );
};

// 🏆 Reusable Winner Podium Card Component
const WinnerPodiumCard = ({
  place,
  medal,
  title,
  winner,
  monthName,
  onViewOrders,
  onOpenVault
}) => {
  const configs = {
    GOLD: {
      gradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 60%, #fde68a 100%)',
      borderColor: '#f59e0b',
      shadow: '0 10px 25px -5px rgba(245, 158, 11, 0.25)',
      badgeBg: '#b45309',
      badgeText: '#ffffff',
      crown: '👑',
      accentColor: '#b45309'
    },
    SILVER: {
      gradient: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 60%, #e2e8f0 100%)',
      borderColor: '#94a3b8',
      shadow: '0 10px 25px -5px rgba(148, 163, 184, 0.25)',
      badgeBg: '#475569',
      badgeText: '#ffffff',
      crown: '🥈',
      accentColor: '#475569'
    },
    BRONZE: {
      gradient: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 60%, #fed7aa 100%)',
      borderColor: '#ea580c',
      shadow: '0 10px 25px -5px rgba(234, 88, 12, 0.25)',
      badgeBg: '#c2410c',
      badgeText: '#ffffff',
      crown: '🥉',
      accentColor: '#c2410c'
    }
  };

  const cfg = configs[medal] || configs.GOLD;

  if (!winner) {
    return (
      <div style={{
        background: cfg.gradient,
        borderRadius: '20px',
        border: `2px dashed ${cfg.borderColor}`,
        padding: '28px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '280px'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{cfg.crown}</div>
        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: cfg.accentColor }}>
          {title}
        </h4>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
          No qualifying #{place} winner recorded for {monthName || 'this month'}.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: cfg.gradient,
      borderRadius: '20px',
      border: `2px solid ${cfg.borderColor}`,
      padding: '24px',
      boxShadow: cfg.shadow,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      transition: 'transform 0.2s',
      cursor: 'pointer'
    }}
    onClick={() => onViewOrders && onViewOrders(winner)}
    >
      {/* Top Banner with Medal Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: cfg.badgeBg,
          color: cfg.badgeText,
          padding: '6px 14px',
          borderRadius: '999px',
          fontWeight: 900,
          fontSize: '0.8rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
        }}>
          <span>{cfg.crown}</span>
          <span>{title}</span>
        </div>

        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          padding: '4px 10px',
          borderRadius: '10px',
          fontSize: '0.72rem',
          fontWeight: 800,
          color: cfg.accentColor,
          border: '1px solid rgba(0,0,0,0.06)'
        }}>
          RANK #{winner.rank}
        </div>
      </div>

      {/* Customer Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
        {winner.profilePhoto ? (
          <img
            src={getImageUrl(winner.profilePhoto)}
            alt={winner.customerName}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: `3px solid ${cfg.borderColor}`,
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
            }}
          />
        ) : (
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#0a192f',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '1.4rem',
            border: `3px solid ${cfg.borderColor}`,
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
          }}>
            {winner.customerName?.charAt(0).toUpperCase() || <User size={28} />}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{
            margin: 0,
            fontSize: '1.2rem',
            fontWeight: 900,
            color: '#0f172a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {winner.customerName}
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#475569', marginTop: '2px', fontWeight: 600 }}>
            <Phone size={13} style={{ color: cfg.accentColor }} />
            <span>{winner.primaryPhone || 'No Phone'}</span>
          </div>
          {winner.address && (
            <div style={{
              fontSize: '0.75rem',
              color: '#64748b',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {winner.address}
            </div>
          )}
        </div>
      </div>

      {/* Winner Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(4px)',
        padding: '12px',
        borderRadius: '14px',
        border: '1px solid rgba(0,0,0,0.05)',
        marginBottom: '16px'
      }}>
        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Monthly Orders
          </span>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2563eb', marginTop: '1px' }}>
            {winner.orderCount} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Orders</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Total Order Value
          </span>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', marginTop: '1px' }}>
            LKR {winner.totalOrderValue.toLocaleString()}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Total Paid
          </span>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#16a34a', marginTop: '1px' }}>
            LKR {winner.totalPaid.toLocaleString()}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Outstanding Balance
          </span>
          <div style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: winner.outstandingBalance > 0 ? '#dc2626' : '#16a34a',
            marginTop: '1px'
          }}>
            LKR {winner.outstandingBalance.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewOrders && onViewOrders(winner);
          }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            padding: '10px 14px',
            borderRadius: '10px',
            border: `1.5px solid ${cfg.borderColor}`,
            fontWeight: 800,
            fontSize: '0.8rem',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}
        >
          <Package size={14} style={{ color: cfg.accentColor }} />
          View Orders ({winner.orderCount})
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenVault && onOpenVault(winner);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: '#0a192f',
            color: '#ffffff',
            padding: '10px 14px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          <ExternalLink size={14} />
          Vault
        </button>
      </div>
    </div>
  );
};
