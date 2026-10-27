import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { API_BASE, API_URL } from '../config/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('jb_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('jb_token') || null);
  const [authLoading, setAuthLoading] = useState(true); // true while restoring session

  const [activeBranch, setActiveBranch] = useState('ALL');
  const [activeTab, setActiveTab] = useState('overview');
  const [theme, setTheme] = useState('light');
  const [isLoginOpen, setIsLoginOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  /**
   * Build Authorization header for API calls.
   * Every fetch from the frontend should use this.
   */
  const getAuthHeaders = useCallback((isMultipart = false) => {
    const storedToken = token || localStorage.getItem('jb_token');
    const headers = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
    return headers;
  }, [token]);

  /**
   * Restore session from localStorage on app load.
   */
  useEffect(() => {
    const storedToken = localStorage.getItem('jb_token');
    if (!storedToken) {
      setAuthLoading(false);
      setIsLoginOpen(true);
      return;
    }
    // Verify token is still valid by calling /api/auth/me
    fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${storedToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setToken(storedToken);
          setUser(data.data);
          try { localStorage.setItem('jb_user', JSON.stringify(data.data)); } catch {}
          setIsLoginOpen(false);
        } else {
          // Token expired or invalid
          localStorage.removeItem('jb_token');
          localStorage.removeItem('jb_user');
          setUser(null);
          setToken(null);
          setIsLoginOpen(true);
        }
      })
      .catch(() => {
        localStorage.removeItem('jb_token');
        localStorage.removeItem('jb_user');
        setUser(null);
        setToken(null);
        setIsLoginOpen(true);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  /**
   * Real login — calls POST /api/auth/login with email + password.
   * Returns { success, message }
   */
  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        const { token: newToken, user: userData } = data.data;
        localStorage.setItem('jb_token', newToken);
        try { localStorage.setItem('jb_user', JSON.stringify(userData)); } catch {}
        setToken(newToken);
        setUser(userData);
        setIsLoginOpen(false);
        // Set starting tab based on role
        const defaultTab = {
          'SUPER_ADMIN': 'overview',
          'ADMIN': 'overview',
          'MANAGER': 'overview',
          'STAFF': 'sales',
          'TAILOR': 'production',
          'CUTTING': 'production',
          'EMBROIDERY': 'production',
          'Manager': 'customers'
        }[userData.role] || 'overview';
        setActiveTab(defaultTab);
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Login failed.' };
      }
    } catch (err) {
      console.error('Login connection error:', err);
      return { success: false, message: 'Network error. Please check the server.' };
    }
  };

  /**
   * Customer Login — calls POST /api/customer-portal/login
   */
  const customerLogin = async (identifier, password) => {
    try {
      const res = await fetch(`${API_BASE}/customer-portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();

      if (data.success && data.data) {
        const { token: newToken, customer: custData } = data.data;
        const customerUser = { ...custData, role: 'CUSTOMER' };
        localStorage.setItem('jb_token', newToken);
        setToken(newToken);
        setUser(customerUser);
        setIsLoginOpen(false);
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Invalid email/phone or password.' };
      }
    } catch (err) {
      console.error('Customer login error:', err);
      return { success: false, message: 'Network error. Please check server.' };
    }
  };

  /**
   * Customer Registration — calls POST /api/customer-portal/register
   */
  const customerRegister = async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/customer-portal/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success && data.data) {
        const { token: newToken, customer: custData } = data.data;
        const customerUser = { ...custData, role: 'CUSTOMER' };
        localStorage.setItem('jb_token', newToken);
        setToken(newToken);
        setUser(customerUser);
        setIsLoginOpen(false);
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Registration failed.' };
      }
    } catch (err) {
      console.error('Customer registration error:', err);
      return { success: false, message: 'Network error. Please check server.' };
    }
  };

  const [pendingOrders, setPendingOrders] = useState([]);

  /**
   * Centralized 10-second pending orders polling for authorized Management (CEO, Admin, Manager).
   * Strictly runs ONLY when authenticated with a management role.
   * Cleans up automatically on unmount, logout, or role switch.
   */
  useEffect(() => {
    const userRole = user?.role ? String(user.role).trim().toUpperCase() : '';
    const isManagement = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'].includes(userRole);

    if (!token || !user || !isManagement) {
      setPendingOrders([]);
      return;
    }

    let isMounted = true;

    const fetchPendingOrders = async () => {
      try {
        const storedToken = token || localStorage.getItem('jb_token');
        if (!storedToken) return;
        const res = await fetch(`${API_URL}/api/orders`, {
          headers: { 'Authorization': `Bearer ${storedToken}` }
        });
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.orders)) {
          const pending = data.orders.filter(o => o.status === 'PENDING_APPROVAL');
          setPendingOrders(pending);
        }
      } catch {
        // Quietly ignore network errors
      }
    };

    fetchPendingOrders();
    const interval = setInterval(fetchPendingOrders, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user, token]);

  /**
   * Logout — clear token and reset state.
   */
  const logout = (redirectUrl = null) => {
    const wasCustomer = user?.role === 'CUSTOMER';
    localStorage.removeItem('jb_token');
    localStorage.removeItem('jb_user');
    setToken(null);
    setUser(null);
    setPendingOrders([]);
    setIsLoginOpen(true);
    setActiveTab('overview');

    if (redirectUrl) {
      window.history.pushState({}, '', redirectUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else if (wasCustomer) {
      window.history.pushState({}, '', '/customer/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      authLoading,
      login,
      customerLogin,
      customerRegister,
      logout,
      getAuthHeaders,
      activeBranch,
      setActiveBranch,
      activeTab,
      setActiveTab,
      theme,
      toggleTheme,
      isLoginOpen,
      setIsLoginOpen,
      isMobileMenuOpen,
      setIsMobileMenuOpen,
      pendingOrders,
      pendingApprovalsCount: pendingOrders.length
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
