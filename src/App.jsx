import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RouterProvider, useRouter } from './utils/router';
import { TopHeader } from './components/TopHeader';
import { Sidebar } from './components/Sidebar';
import { ModuleRenderer } from './components/ModuleRenderer';
import { LoginModal } from './components/LoginModal';

// Customer Portal Components
import { CustomerLogin } from './components/CustomerPortal/CustomerLogin';
import { CustomerRegister } from './components/CustomerPortal/CustomerRegister';
import { CustomerDashboard } from './components/CustomerPortal/CustomerDashboard';
import { CustomerNewOrder } from './components/CustomerPortal/CustomerNewOrder';
import { CustomerOrders } from './components/CustomerPortal/CustomerOrders';
import { CustomerProfile } from './components/CustomerPortal/CustomerProfile';

function MainLayout() {
  const { user, authLoading, isLoginOpen } = useAuth();
  const { currentPath, navigate } = useRouter();

  // Normalize path without trailing slash
  const path = currentPath.length > 1 && currentPath.endsWith('/')
    ? currentPath.slice(0, -1)
    : currentPath;

  const isCustomerRoute = path.startsWith('/customer');

  // Guard: If customer is logged in and navigates to staff root, redirect to customer dashboard
  useEffect(() => {
    if (!authLoading && user?.role === 'CUSTOMER' && !isCustomerRoute) {
      navigate('/customer/dashboard');
    }
  }, [user, authLoading, isCustomerRoute, navigate]);

  // Loading screen while restoring session from localStorage
  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', backgroundColor: '#0B1F3A',
        flexDirection: 'column', gap: '16px'
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.2)',
          borderTopColor: '#2563EB',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>
          Loading Bella Design Studio...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ==========================================
  // 1. PUBLIC CUSTOMER ROUTES
  // ==========================================
  if (path === '/customer/login') {
    if (user?.role === 'CUSTOMER') {
      return <CustomerDashboard />;
    }
    return <CustomerLogin />;
  }

  if (path === '/customer/register') {
    if (user?.role === 'CUSTOMER') {
      return <CustomerDashboard />;
    }
    return <CustomerRegister />;
  }

  // ==========================================
  // 2. PROTECTED CUSTOMER PORTAL ROUTES
  // (Unauthenticated users CANNOT access protected pages)
  // ==========================================
  if (path === '/customer/dashboard') {
    if (!user || user.role !== 'CUSTOMER') {
      return <CustomerLogin />;
    }
    return <CustomerDashboard />;
  }

  if (path === '/customer/new-order') {
    if (!user || user.role !== 'CUSTOMER') {
      return <CustomerLogin />;
    }
    return <CustomerNewOrder />;
  }

  if (path === '/customer/orders') {
    if (!user || user.role !== 'CUSTOMER') {
      return <CustomerLogin />;
    }
    return <CustomerOrders />;
  }

  if (path === '/customer/profile') {
    if (!user || user.role !== 'CUSTOMER') {
      return <CustomerLogin />;
    }
    return <CustomerProfile />;
  }

  // If user is a customer on any other route, isolate them to Customer Dashboard
  if (user?.role === 'CUSTOMER') {
    return <CustomerDashboard />;
  }

  // ==========================================
  // 3. STAFF / ERP ROUTES
  // ==========================================
  // Not authenticated as staff — show only the staff login modal
  if (isLoginOpen || !user) {
    return <LoginModal />;
  }

  // Authenticated staff — show full ERP layout
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopHeader />

        <main style={{ flex: 1 }}>
          <ModuleRenderer />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <MainLayout />
      </RouterProvider>
    </AuthProvider>
  );
}
