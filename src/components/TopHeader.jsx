import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, Bell, Sun, Moon, MapPin, ChevronDown, LogIn, Menu, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { API_URL } from '../config/api';

export const TopHeader = () => {
  const { user, activeBranch, setActiveBranch, theme, toggleTheme, setIsLoginOpen, isMobileMenuOpen, setIsMobileMenuOpen, setActiveTab } = useAuth();

  const userRole = (user?.role || '').toUpperCase();
  const canSwitchBranch = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'].includes(userRole);

  const branches = [
    { id: 'ALL', name: 'All Branches', short: 'All Branches' },
    { id: '1', name: 'JB Group (Main)', short: 'JB Group (Main)' },
    { id: '2', name: 'Bella Design', short: 'Bella Design' }
  ];

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const [pendingOrders, setPendingOrders] = useState([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const alertsRef = useRef(null);

  const isManagement = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'].includes(userRole);

  useEffect(() => {
    if (!isManagement) return;

    const fetchPendingOrders = async () => {
      try {
        const token = localStorage.getItem('jb_token');
        if (!token) return;
        const res = await fetch(`${API_URL}/api/orders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          const pending = data.orders.filter(o => o.status === 'PENDING_APPROVAL');
          setPendingOrders(pending);
        }
      } catch (e) {
        // quiet
      }
    };

    fetchPendingOrders();
    const interval = setInterval(fetchPendingOrders, 10000);
    return () => clearInterval(interval);
  }, [isManagement]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (alertsRef.current && !alertsRef.current.contains(event.target)) {
        setIsAlertsOpen(false);
      }
    };
    if (isAlertsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAlertsOpen]);

  return (
    <header className="top-header-responsive" style={{
      minHeight: '64px',
      backgroundColor: 'var(--bg-header)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
      boxSizing: 'border-box',
      width: '100%',
      maxWidth: '100%'
    }}>
      {/* Left Section: Mobile Menu Toggle, Branch Switcher & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Mobile Hamburger Toggle Button */}
        <button
          className="header-mobile-menu-btn"
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
          title="Toggle Navigation Menu"
          aria-label="Toggle navigation menu"
          style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            width: '38px',
            height: '38px',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-main)',
            padding: 0,
            flexShrink: 0
          }}
        >
          <Menu size={20} />
        </button>

        {/* Branch Selector Dropdown (Accessible only to CEO & Manager) */}
        {canSwitchBranch ? (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--bg-main)',
              border: '1.5px solid var(--jb-navy-light)',
              padding: '7px 12px',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 82, 204, 0.08)'
            }}>
              <MapPin size={16} style={{ color: 'var(--jb-blue-accent)' }} />
              <select
                value={activeBranch}
                onChange={(e) => setActiveBranch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  paddingRight: '4px'
                }}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id} style={{ color: '#0f172a', background: '#ffffff', fontWeight: 700 }}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          /* Locked Branch Badge for Staff & Tailor */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            padding: '7px 12px',
            borderRadius: '10px',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: 'var(--text-main)'
          }}>
            <MapPin size={15} style={{ color: 'var(--jb-navy-light)' }} />
            <span>{user?.branch?.name || (activeBranch === '2' ? 'Bella Design' : 'JB Group (Main)')}</span>
          </div>
        )}

        {/* Division Badge */}
        <div className="header-division-badge" style={{
          fontSize: '0.75rem',
          fontWeight: 800,
          backgroundColor: '#E6F0FF',
          color: 'var(--jb-navy-light)',
          padding: '5px 12px',
          borderRadius: '999px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: '1px solid #bfdbfe'
        }}>
          <strong>{activeBranch === '1' ? '🏢 JB Group (Main)' : activeBranch === '2' ? '🪡 Bella Design' : '✨ JB Group & Bella Design'}</strong>
        </div>
      </div>

      {/* Middle Section: Search Bar */}
      <div className="header-search-container" style={{ flex: 1, maxWidth: '400px', margin: '0 20px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search orders, materials, employees..."
            style={{
              width: '100%',
              padding: '9px 16px 9px 40px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              fontSize: '0.85rem',
              color: 'var(--text-main)',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Right Section: Today's Date + Fiscal Year + Theme + User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Today's Live Date Badge */}
        <div className="header-date-badge" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          fontSize: '0.78rem',
          fontWeight: 800,
          color: 'var(--text-main)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <Calendar size={14} style={{ color: 'var(--jb-blue-accent)' }} />
          <span>{todayFormatted}</span>
        </div>

        {/* Fiscal Year Badge */}
        <span className="header-fy-badge" style={{
          fontSize: '0.75rem',
          fontWeight: 800,
          padding: '6px 10px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-muted)'
        }}>
          FY 2026-27
        </span>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title="Toggle Light/Dark Theme"
          style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-main)'
          }}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} style={{ color: '#f59e0b' }} />}
        </button>

        {/* Notification Bell with Pending Approvals Dropdown */}
        <div style={{ position: 'relative' }} ref={alertsRef}>
          <button
            onClick={() => setIsAlertsOpen(prev => !prev)}
            title={pendingOrders.length > 0 ? `${pendingOrders.length} Order(s) awaiting approval` : "No pending approvals"}
            style={{
              background: isAlertsOpen ? 'var(--jb-navy-light)' : 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              color: isAlertsOpen ? '#ffffff' : 'var(--text-main)',
              transition: 'all 0.15s ease'
            }}
          >
            <Bell size={18} />
            {pendingOrders.length > 0 ? (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '18px',
                height: '18px',
                padding: '0 4px',
                borderRadius: '999px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '0.68rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.4)',
                border: '1.5px solid var(--bg-header)'
              }}>
                {pendingOrders.length}
              </span>
            ) : (
              <span style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#10b981'
              }}></span>
            )}
          </button>

          {/* Alerts Popover Dropdown */}
          {isAlertsOpen && (
            <div className="header-alerts-dropdown" style={{
              position: 'absolute',
              top: '46px',
              right: 0,
              width: '320px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
              zIndex: 1000,
              padding: '16px',
              animation: 'fadeIn 0.15s ease-out'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                  Management Alerts
                </span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  backgroundColor: pendingOrders.length > 0 ? '#fef3c7' : '#ecfdf5',
                  color: pendingOrders.length > 0 ? '#b45309' : '#047857'
                }}>
                  {pendingOrders.length > 0 ? `${pendingOrders.length} Pending Approval` : 'All Clear'}
                </span>
              </div>

              {pendingOrders.length === 0 ? (
                <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  <p style={{ fontSize: '0.82rem', margin: 0, fontWeight: 600 }}>All customer orders have been approved!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  {pendingOrders.slice(0, 5).map((ord) => (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setActiveTab('sales');
                        setIsAlertsOpen(false);
                      }}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0052cc' }}>
                          {ord.orderNumber}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 700, backgroundColor: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
                          Review Required
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 600 }}>
                        {ord.customer?.name || 'Customer'} • {ord.garmentDetails?.dressType || 'Order'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {ord.branch?.name || 'JB Group'}
                      </div>
                    </div>
                  ))}
                  {pendingOrders.length > 5 && (
                    <div style={{ fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', padding: '4px 0' }}>
                      + {pendingOrders.length - 5} more pending orders
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  setActiveTab('sales');
                  setIsAlertsOpen(false);
                }}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#0052cc',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Go to Sales Approvals →
              </button>
            </div>
          )}
        </div>

        {/* User Profile Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          paddingLeft: '12px',
          borderLeft: '1px solid var(--border-color)'
        }}>
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user?.name || 'User'}
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              backgroundColor: 'var(--jb-navy-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '0.85rem'
            }}>
              {(user?.name || 'U')[0].toUpperCase()}
            </div>
          )}
          <div className="header-user-details" style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {user?.name || 'Guest'}
            </span>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {user?.role || '—'}
            </span>
          </div>

          <button
            onClick={() => setIsLoginOpen(true)}
            title="Switch User Role / Login"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              marginLeft: '4px'
            }}
          >
            <LogIn size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
