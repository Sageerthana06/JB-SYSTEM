import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasPermission, ROLE_LABELS, MODULE_PERMISSIONS } from '../utils/permissions';
import { API_URL } from '../config/api';
import {
  LayoutDashboard,
  ShoppingCart,
  Scissors,
  Users,
  UserCheck,
  Package,
  DollarSign,
  CreditCard,
  Share2,
  Building,
  AlertTriangle,
  Brain,
  Smartphone,
  FileSpreadsheet,
  Award,
  LogOut,
  X
} from 'lucide-react';

export const Sidebar = () => {
  const { activeTab, setActiveTab, user, logout, isMobileMenuOpen, setIsMobileMenuOpen } = useAuth();

  const role = user?.role || null;
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) return;

    const checkPending = async () => {
      try {
        const token = localStorage.getItem('jb_token');
        if (!token) return;
        const res = await fetch(`${API_URL}/api/orders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          const count = data.orders.filter(o => o.status === 'PENDING_APPROVAL').length;
          setPendingApprovals(count);
        }
      } catch (e) {}
    };

    checkPending();
    const interval = setInterval(checkPending, 10000);
    return () => clearInterval(interval);
  }, [role]);

  const allNavGroups = [
    {
      title: 'MAIN MENU',
      items: [
        { id: 'overview',    label: 'Dashboard',           icon: LayoutDashboard, badge: 'Live Orders' },
        { id: 'sales',       label: 'Sales',               icon: ShoppingCart,    badge: pendingApprovals > 0 ? `${pendingApprovals} Pending` : undefined },
        { id: 'production',  label: 'Production',          icon: Scissors,        badge: 'Production Kanban' },
        { id: 'tailors',     label: 'Tailor Performance',  icon: Award },
        { id: 'customers',   label: 'Customers',           icon: Users }
      ]
    },
    {
      title: 'WAREHOUSE & INVENTORY',
      items: [
        { id: 'inventory',   label: 'Materials & Inventory', icon: Package, badge: '12 Alert' }
      ]
    },
    {
      title: 'FINANCE & PAYROLL',
      items: [
        { id: 'payroll',     label: 'Salary & Payroll ERP',  icon: CreditCard },
        { id: 'finance',     label: 'Finance',               icon: DollarSign }
      ]
    },
    {
      title: 'ORGANIZATION',
      items: [
        { id: 'staff',       label: 'Staff & Users',         icon: UserCheck },
        { id: 'marketing',   label: 'Customer Enquiries',    icon: Share2 },
        { id: 'branches',    label: 'Branch Reports',        icon: Building }
      ]
    },
    {
      title: 'INTELLIGENCE & ALERTS',
      items: [
        { id: 'alerts',      label: 'Alerts',                icon: AlertTriangle, alertCount: 8 },
        { id: 'bi',          label: 'BI Insights Engine',    icon: Brain },
        { id: 'mobile',      label: 'CEO Mobile Mode',       icon: Smartphone },
        { id: 'reports',     label: 'Reports & Export',      icon: FileSpreadsheet }
      ]
    }
  ];

  // Filter groups by permission
  const navGroups = allNavGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      const requiredPermission = MODULE_PERMISSIONS[item.id];
      return !requiredPermission || hasPermission(role, requiredPermission);
    })
  })).filter(group => group.items.length > 0);

  const roleLabel = ROLE_LABELS[role] || role || 'Guest';

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`sidebar-drawer ${isMobileMenuOpen ? 'open' : ''}`}
        style={{
          width: '260px',
          backgroundColor: 'var(--bg-sidebar)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          transition: 'all 0.3s ease',
          position: 'relative',
          zIndex: 1050
        }}
      >
        {/* Brand Header */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/jb_group_logo.png"
              alt="JB GROUP"
              style={{
                height: '42px',
                objectFit: 'contain',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                padding: '4px'
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '1px' }}>
                JB GROUP
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Enterprise Console
              </span>
            </div>
          </div>

          {/* Close button visible only on mobile/tablet */}
          <button
            className="sidebar-mobile-close-btn"
            onClick={() => setIsMobileMenuOpen(false)}
            title="Close navigation"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

      {/* Role Badge */}
      {user && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(0,0,0,0.15)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>{user.name}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--jb-blue-accent)', fontWeight: 600, marginTop: '2px' }}>{roleLabel}</div>
        </div>
      )}

      {/* Navigation Sections */}
      <div style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} style={{ marginBottom: '20px' }}>
            <h5 style={{
              fontSize: '0.675rem',
              fontWeight: 800,
              color: '#64748b',
              padding: '0 12px 8px 12px',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              {group.title}
            </h5>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {group.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      borderLeft: isActive ? '4px solid var(--jb-blue-accent)' : '4px solid transparent',
                      backgroundColor: isActive ? 'var(--jb-navy-light)' : 'transparent',
                      color: isActive ? '#ffffff' : '#94a3b8',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.12)';
                        e.currentTarget.style.color = '#ffffff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#94a3b8';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <IconComponent size={18} style={{ color: isActive ? '#ffffff' : (item.alertCount ? '#ef4444' : '#94a3b8') }} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span style={{
                        fontSize: '0.675rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: isActive ? 'var(--jb-blue-accent)' : 'rgba(217, 4, 41, 0.15)',
                        color: isActive ? '#ffffff' : '#f87171'
                      }}>
                        {item.badge}
                      </span>
                    )}

                    {item.alertCount && (
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '999px',
                        backgroundColor: 'var(--jb-crimson)',
                        color: '#ffffff'
                      }}>
                        {item.alertCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: Logout + version */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(0,0,0,0.2)',
        fontSize: '0.75rem',
        color: '#64748b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
          <span style={{ color: '#cbd5e1', fontWeight: 600 }}>JB Cloud Sync Active</span>
        </div>
        {user && (
          <button
            onClick={() => {
              logout();
              setIsMobileMenuOpen(false);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#ef4444', fontSize: '0.8rem', fontWeight: 700, padding: '4px 0',
              width: '100%'
            }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        )}
        <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Version 3.2.0 • 3 Branches Linked</p>
      </div>
    </aside>
    </>
  );
};
