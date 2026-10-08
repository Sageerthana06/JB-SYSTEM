import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../utils/router';
import {
  LayoutDashboard,
  ShoppingBag,
  PlusCircle,
  User,
  LogOut,
  Sparkles,
  Scissors
} from 'lucide-react';

export const CustomerPortalLayout = ({ children, activePage }) => {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/customer/dashboard' },
    { id: 'orders', label: 'My Orders', icon: ShoppingBag, path: '/customer/orders' },
    { id: 'new-order', label: 'Create New Order', icon: PlusCircle, path: '/customer/new-order' },
    { id: 'profile', label: 'Profile', icon: User, path: '/customer/profile' }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      {/* Top Customer Header */}
      <header style={{
        backgroundColor: '#0B1F3A',
        color: '#ffffff',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Brand */}
          <div
            onClick={() => navigate('/customer/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer'
            }}
          >
            <img
              src="/jb_official_logo.png"
              alt="JB Group Logo"
              style={{ height: '36px', objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#d90429', fontFamily: "'Outfit', sans-serif" }}>J</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#38bdf8', fontFamily: "'Outfit', sans-serif" }}>B</span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', letterSpacing: '1px', marginLeft: '4px' }}>
                  CUSTOMER STUDIO
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                BELLA DESIGN ATELIER
              </div>
            </div>
          </div>

          {/* Nav Items */}
          <nav style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: isActive ? '#38bdf8' : '#cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? 'inset 0 0 0 1px rgba(56, 189, 248, 0.4)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#cbd5e1';
                    }
                  }}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User info & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '999px',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: '#d90429',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 800,
                color: '#ffffff'
              }}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                {user?.name || 'Customer'}
              </span>
            </div>

            <button
              onClick={() => logout('/customer/login')}
              title="Sign Out"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.color = '#f87171';
              }}
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '28px 24px',
        boxSizing: 'border-box'
      }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '16px 24px',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.8rem'
      }}>
        Bella Design Customer Studio • Powered by JB GROUP Management Systems
      </footer>
    </div>
  );
};
