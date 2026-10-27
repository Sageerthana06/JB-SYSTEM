import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  Search,
  Plus,
  RefreshCw,
  Mail,
  KeyRound,
  Building,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Link as LinkIcon,
  Edit,
  UserPlus,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';

const ROLE_DISPLAY_NAMES = {
  SUPER_ADMIN: 'CEO / Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  TAILOR: 'Tailor',
  CUTTING: 'Cutting Master',
  EMBROIDERY: 'Embroidery Specialist',
  CASHIER: 'Cashier'
};

const ROLE_COLORS = {
  SUPER_ADMIN: { bg: '#0f172a', text: '#f8fafc', border: '#334155' },
  ADMIN: { bg: '#1e3a8a', text: '#dbeafe', border: '#3b82f6' },
  MANAGER: { bg: '#0052cc', text: '#ffffff', border: '#2563eb' },
  STAFF: { bg: '#065f46', text: '#d1fae5', border: '#10b981' },
  TAILOR: { bg: '#581c87', text: '#f3e8ff', border: '#a855f7' },
  CUTTING: { bg: '#4c1d95', text: '#ede9fe', border: '#8b5cf6' },
  EMBROIDERY: { bg: '#831843', text: '#fce7f3', border: '#ec4899' },
  CASHIER: { bg: '#78350f', text: '#fef3c7', border: '#f59e0b' }
};

export const UserManagement = () => {
  const { user: currentUser, getAuthHeaders } = useAuth();
  const isCeo = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';
  const isManager = currentUser?.role === 'MANAGER';

  // Data state
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [eligibleEmployees, setEligibleEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedBranch, setSelectedBranch] = useState(isManager ? String(currentUser.branchId || 1) : 'ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [resetModalUser, setResetModalUser] = useState(null);
  const [deactivateModalUser, setDeactivateModalUser] = useState(null);
  const [editModalUser, setEditModalUser] = useState(null);

  // Password Modal state (Manual Set & Email Reset Link)
  const [passwordModalTab, setPasswordModalTab] = useState('manual'); // 'manual' | 'email'
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    mode: 'new', // 'new' or 'existing'
    employeeRecordId: '',
    name: '',
    email: '',
    phone: '',
    role: 'STAFF',
    branchId: isManager ? currentUser.branchId || 1 : 1,
    setupMethod: 'email', // 'email' or 'manual'
    password: '',
    isActive: true
  });

  const [linkData, setLinkData] = useState({
    userId: '',
    employeeRecordId: ''
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    role: '',
    branchId: 1,
    phone: ''
  });

  // Action status messages
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', text: '' }
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  // Fetch all users & employees
  const fetchUsers = async () => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams();
      if (selectedRole !== 'ALL') params.append('role', selectedRole);
      if (selectedBranch !== 'ALL') params.append('branchId', selectedBranch);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`${API_URL}/api/users?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      } else {
        showToast('error', data.message || 'Failed to load user accounts.');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      showToast('error', 'Network error loading user accounts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch branches
  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/branches`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.branches)) {
        setBranches(data.branches);
      }
    } catch {}
  };

  // Fetch unlinked employees for account creation / linking
  const fetchEligibleEmployees = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/employees`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setEligibleEmployees(data.employees || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchUsers();
    fetchBranches();
    fetchEligibleEmployees();
  }, [selectedRole, selectedBranch, selectedStatus]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Employee Selection in Create Modal
  const handleEmployeeSelect = (empId) => {
    const emp = eligibleEmployees.find(e => String(e.id) === String(empId));
    if (emp) {
      setFormData(prev => ({
        ...prev,
        employeeRecordId: emp.id,
        name: emp.name,
        email: emp.email || prev.email,
        phone: emp.phone || prev.phone,
        role: emp.role || prev.role,
        branchId: emp.branchId || prev.branchId
      }));
    } else {
      setFormData(prev => ({ ...prev, employeeRecordId: '' }));
    }
  };

  // Create User Handler
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.role) {
      showToast('error', 'Please fill in all required fields.');
      return;
    }

    if (formData.setupMethod === 'manual' && (!formData.password || formData.password.length < 6)) {
      showToast('error', 'Initial password must be at least 6 characters long.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          branchId: formData.branchId,
          password: formData.setupMethod === 'manual' ? formData.password : undefined,
          sendSetupLink: formData.setupMethod === 'email',
          employeeRecordId: formData.mode === 'existing' ? formData.employeeRecordId : undefined,
          phone: formData.phone,
          isActive: formData.isActive
        })
      });
      const data = await res.json();
      setActionLoading(false);

      if (data.success) {
        showToast('success', data.message || 'User account successfully created.');
        setCreateModalOpen(false);
        setFormData({
          mode: 'new',
          employeeRecordId: '',
          name: '',
          email: '',
          phone: '',
          role: 'STAFF',
          branchId: isManager ? currentUser.branchId || 1 : 1,
          setupMethod: 'email',
          password: '',
          isActive: true
        });
        fetchUsers();
        fetchEligibleEmployees();
      } else {
        showToast('error', data.message || 'Failed to create user account.');
      }
    } catch {
      setActionLoading(false);
      showToast('error', 'Network error creating user account.');
    }
  };

  // Link User & Employee Handler
  const handleLinkAccount = async (e) => {
    e.preventDefault();
    if (!linkData.userId || !linkData.employeeRecordId) {
      showToast('error', 'Please select both an account and an employee record.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/users/link`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: linkData.userId,
          employeeRecordId: linkData.employeeRecordId
        })
      });
      const data = await res.json();
      setActionLoading(false);

      if (data.success) {
        showToast('success', data.message);
        setLinkModalOpen(false);
        setLinkData({ userId: '', employeeRecordId: '' });
        fetchUsers();
        fetchEligibleEmployees();
      } else {
        showToast('error', data.message || 'Failed to link account.');
      }
    } catch {
      setActionLoading(false);
      showToast('error', 'Network error linking accounts.');
    }
  };

  // Open Password Management Modal
  const handleOpenPasswordModal = (user, tab = 'manual') => {
    setResetModalUser(user);
    setPasswordModalTab(tab);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  // Helper to determine if current user is allowed to set/reset password for target user
  const canManagePassword = (target) => {
    if (!currentUser || !target || !target.hasLogin) return false;
    // SUPER_ADMIN (CEO) can manage any account
    if (currentUser.role === 'SUPER_ADMIN') return true;
    // ADMIN can manage any account except SUPER_ADMIN
    if (currentUser.role === 'ADMIN') return target.role !== 'SUPER_ADMIN';
    // MANAGER restrictions:
    if (currentUser.role === 'MANAGER') {
      // Must NEVER change CEO or Admin passwords
      if (['SUPER_ADMIN', 'ADMIN'].includes(target.role)) return false;
      // Cannot change other managers
      if (target.role === 'MANAGER') return false;
      // Must be within manager's authorized branch
      if (currentUser.branchId && target.branchId !== currentUser.branchId) return false;
      // Permitted roles: Staff, Tailor, Cutting, Embroidery, Cashier
      const permitted = ['STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY', 'CASHIER'];
      return permitted.includes(target.role);
    }
    return false;
  };

  const getPasswordTooltip = (target) => {
    if (!target.hasLogin) return 'Account does not have a login account yet.';
    if (currentUser.role === 'SUPER_ADMIN') return 'Set password manually or send email reset link';
    if (currentUser.role === 'ADMIN') {
      if (target.role === 'SUPER_ADMIN') return 'Admins cannot change CEO/Super Admin password';
      return 'Set password manually or send email reset link';
    }
    if (currentUser.role === 'MANAGER') {
      if (target.role === 'SUPER_ADMIN') return 'Managers must never change CEO password';
      if (target.role === 'ADMIN') return 'Managers cannot change Admin password';
      if (target.role === 'MANAGER') return 'Managers cannot change other Manager passwords';
      if (currentUser.branchId && target.branchId !== currentUser.branchId) {
        return 'Managers can only set passwords for users in their branch';
      }
      const permitted = ['STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY', 'CASHIER'];
      if (!permitted.includes(target.role)) {
        return `Managers can only manage passwords for: ${permitted.join(', ')}`;
      }
      return 'Set password manually or send email reset link';
    }
    return 'Permission denied';
  };

  // Manual Set Password Handler (CEO & Manager)
  const handleManualSetPassword = async (e) => {
    if (e) e.preventDefault();
    if (!resetModalUser || !resetModalUser.userId) return;

    if (!newPassword || newPassword.length < 6) {
      showToast('error', 'Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('error', 'New password and confirmation password do not match.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/users/${resetModalUser.userId}/set-password`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: newPassword,
          confirmPassword: confirmPassword
        })
      });
      const data = await res.json();
      setActionLoading(false);

      if (data.success) {
        showToast('success', data.message || `Password updated successfully for ${resetModalUser.name}.`);
        setResetModalUser(null);
        setNewPassword('');
        setConfirmPassword('');
        fetchUsers();
      } else {
        showToast('error', data.message || 'Failed to update password.');
      }
    } catch {
      setActionLoading(false);
      showToast('error', 'Network error setting password.');
    }
  };

  // Email Reset Password Handler
  const handleConfirmResetPassword = async () => {
    if (!resetModalUser || !resetModalUser.userId) return;

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/users/${resetModalUser.userId}/reset-password`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setActionLoading(false);

      if (data.success) {
        showToast('success', data.message);
        setResetModalUser(null);
      } else {
        showToast('error', data.message || 'Failed to initiate password reset.');
      }
    } catch {
      setActionLoading(false);
      showToast('error', 'Network error initiating password reset.');
    }
  };

  // Toggle Status (Activate / Deactivate) Handler
  const handleConfirmToggleStatus = async () => {
    if (!deactivateModalUser) return;
    const targetId = deactivateModalUser.userId;
    const newStatus = !deactivateModalUser.isActive;

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/users/${targetId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: newStatus })
      });
      const data = await res.json();
      setActionLoading(false);

      if (data.success) {
        showToast('success', data.message);
        if (data.warning) {
          setTimeout(() => showToast('error', data.warning), 3000);
        }
        setDeactivateModalUser(null);
        fetchUsers();
      } else {
        showToast('error', data.message || 'Failed to update account status.');
      }
    } catch {
      setActionLoading(false);
      showToast('error', 'Network error updating account status.');
    }
  };

  // Edit User Handler
  const handleOpenEdit = (user) => {
    setEditModalUser(user);
    setEditFormData({
      name: user.name || '',
      role: user.role || 'STAFF',
      branchId: user.branchId || 1,
      phone: user.phone || ''
    });
  };

  const handleConfirmEdit = async (e) => {
    e.preventDefault();
    if (!editModalUser || !editModalUser.userId) return;

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/users/${editModalUser.userId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: editFormData.name,
          role: editFormData.role,
          branchId: editFormData.branchId,
          phone: editFormData.phone
        })
      });
      const data = await res.json();
      setActionLoading(false);

      if (data.success) {
        showToast('success', 'User account updated successfully.');
        setEditModalUser(null);
        fetchUsers();
      } else {
        showToast('error', data.message || 'Failed to update user.');
      }
    } catch {
      setActionLoading(false);
      showToast('error', 'Network error updating user.');
    }
  };

  // Compute metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.hasLogin && u.isActive).length;
    const inactive = users.filter(u => u.hasLogin && !u.isActive).length;
    const noLogin = users.filter(u => !u.hasLogin).length;
    return { total, active, inactive, noLogin };
  }, [users]);

  // Allowed roles for dropdown
  const permittedRoles = isCeo
    ? ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY', 'CASHIER']
    : ['STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY', 'CASHIER'];

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Never';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '28px',
          zIndex: 99999,
          padding: '14px 20px',
          borderRadius: '12px',
          backgroundColor: toast.type === 'success' ? '#065f46' : '#991b1b',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.9rem',
          fontWeight: 600,
          animation: 'fadeIn 0.2s ease'
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, marginLeft: '8px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Banner Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #0052cc 0%, #071324 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(0, 82, 204, 0.25)'
          }}>
            <ShieldCheck size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                All-Role User &amp; Login Management
              </h1>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: isCeo ? '#eff6ff' : '#ecfdf5',
                color: isCeo ? '#0052cc' : '#059669',
                border: `1px solid ${isCeo ? '#bfdbfe' : '#a7f3d0'}`
              }}>
                {isCeo ? 'CEO Executive Console' : 'Branch Manager Portal'}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              Manage employee accounts, single-use email password resets, branch authorization, and access controls.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchUsers}
            disabled={refreshing}
            title="Refresh Data"
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Link Existing Login Button */}
          <button
            onClick={() => setLinkModalOpen(true)}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1.5px solid #0052cc',
              backgroundColor: '#eff6ff',
              color: '#0052cc',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <LinkIcon size={16} />
            <span>Link Existing Login</span>
          </button>

          {/* Create Login Account Button */}
          <button
            onClick={() => setCreateModalOpen(true)}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(90deg, #0052cc 0%, #0042b3 100%)',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0, 82, 204, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            <UserPlus size={17} />
            <span>Create Login Account</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Card 1: Total */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: '16px', borderLeft: '4px solid #0052cc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Roster Accounts
            </span>
            <Users size={18} color="#0052cc" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '8px' }}>
            {metrics.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Across {isCeo ? 'All Branches' : 'Authorized Branch'}
          </div>
        </div>

        {/* Card 2: Active */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: '16px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Login Accounts
            </span>
            <UserCheck size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#059669', marginTop: '8px' }}>
            {metrics.active}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            Authorized &amp; Authenticated
          </div>
        </div>

        {/* Card 3: Inactive */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: '16px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Deactivated Accounts
            </span>
            <UserX size={18} color="#ef4444" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#dc2626', marginTop: '8px' }}>
            {metrics.inactive}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Access Temporarily Suspended
          </div>
        </div>

        {/* Card 4: Unlinked Employees */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: '16px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Unlinked / No Login
            </span>
            <AlertTriangle size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#d97706', marginTop: '8px' }}>
            {metrics.noLogin}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Employees without active login
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="card" style={{ padding: '16px 20px', borderRadius: '16px', marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 260px', position: 'relative' }}>
            <Search size={17} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, employee ID, or email..."
              style={{
                width: '100%',
                padding: '10px 14px 10px 40px',
                borderRadius: '10px',
                border: '1.5px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Role Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1.5px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">CEO / Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="STAFF">Staff</option>
              <option value="TAILOR">Tailor</option>
              <option value="CUTTING">Cutting</option>
              <option value="EMBROIDERY">Embroidery</option>
              <option value="CASHIER">Cashier</option>
            </select>
          </div>

          {/* Branch Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={isManager} // Restricted for branch manager
              title={isManager ? 'Branch locked to your authorized assignment' : 'Select Branch'}
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1.5px solid var(--border-color)',
                backgroundColor: isManager ? '#f1f5f9' : 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: isManager ? 'not-allowed' : 'pointer'
              }}
            >
              {isCeo && <option value="ALL">All Branches Combined</option>}
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1.5px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
            <thead>
              <tr style={{
                backgroundColor: 'var(--bg-sidebar)',
                color: '#cbd5e1',
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                borderBottom: '1px solid rgba(255,255,255,0.08)'
              }}>
                <th style={{ padding: '14px 20px' }}>Employee</th>
                <th style={{ padding: '14px 16px' }}>Employee ID</th>
                <th style={{ padding: '14px 16px' }}>Role</th>
                <th style={{ padding: '14px 16px' }}>Branch</th>
                <th style={{ padding: '14px 16px' }}>Login Status</th>
                <th style={{ padding: '14px 16px' }}>Account Status</th>
                <th style={{ padding: '14px 16px' }}>Last Login</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={20} className="animate-spin" color="#0052cc" />
                      <span>Loading user management directory...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Users size={32} style={{ opacity: 0.4, margin: '0 auto 8px auto' }} />
                    <p style={{ margin: 0, fontWeight: 700 }}>No users or employee accounts match the selected filters.</p>
                  </td>
                </tr>
              ) : (
                users.map((row) => {
                  const roleCfg = ROLE_COLORS[row.role] || { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
                  const isCurrentSelf = currentUser.id === row.userId;
                  const isTargetPrivileged = ['SUPER_ADMIN', 'ADMIN'].includes(row.role);
                  const managerRestricted = isManager && isTargetPrivileged;
                  const canManagePwd = canManagePassword(row);
                  const pwdTooltip = getPasswordTooltip(row);

                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s',
                        opacity: row.isActive ? 1 : 0.65
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 82, 204, 0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Name & Email */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            backgroundColor: row.isActive ? '#eff6ff' : '#fee2e2',
                            color: row.isActive ? '#0052cc' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.85rem'
                          }}>
                            {row.name ? row.name.slice(0, 2).toUpperCase() : 'JB'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                              {row.name}
                              {isCurrentSelf && (
                                <span style={{
                                  marginLeft: '6px',
                                  fontSize: '0.68rem',
                                  backgroundColor: '#dbeafe',
                                  color: '#1d4ed8',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 800
                                }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {row.email || 'No email registered'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td style={{ padding: '16px 16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-color)',
                          fontFamily: 'monospace',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: 'var(--text-main)'
                        }}>
                          {row.employeeId}
                        </span>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '16px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          backgroundColor: roleCfg.bg,
                          color: roleCfg.text,
                          border: `1px solid ${roleCfg.border}`
                        }}>
                          {ROLE_DISPLAY_NAMES[row.role] || row.role}
                        </span>
                      </td>

                      {/* Branch */}
                      <td style={{ padding: '16px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: 'var(--text-main)'
                        }}>
                          <Building size={14} color="#64748b" />
                          <span>{row.branchName}</span>
                        </span>
                      </td>

                      {/* Login Status */}
                      <td style={{ padding: '16px 16px' }}>
                        {row.hasLogin ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '999px',
                            backgroundColor: row.isActive ? '#ecfdf5' : '#fef2f2',
                            color: row.isActive ? '#059669' : '#dc2626'
                          }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: row.isActive ? '#10b981' : '#ef4444'
                            }} />
                            {row.loginStatus}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '999px',
                            backgroundColor: '#fffbeb',
                            color: '#b45309'
                          }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#f59e0b'
                            }} />
                            No Login Account
                          </span>
                        )}
                      </td>

                      {/* Account Status */}
                      <td style={{ padding: '16px 16px' }}>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: row.isActive ? '#059669' : '#dc2626'
                        }}>
                          {row.accountStatus}
                        </span>
                      </td>

                      {/* Last Login */}
                      <td style={{ padding: '16px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatDate(row.lastLoginAt)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {/* If no login account yet, button to Create Login for this employee */}
                          {!row.hasLogin && (
                            <button
                              onClick={() => {
                                setFormData({
                                  mode: 'existing',
                                  employeeRecordId: row.employeeRecordId,
                                  name: row.name,
                                  email: row.email || '',
                                  phone: row.phone || '',
                                  role: row.role,
                                  branchId: row.branchId || 1,
                                  setupMethod: 'email',
                                  password: '',
                                  isActive: true
                                });
                                setCreateModalOpen(true);
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '8px',
                                border: '1px solid #0052cc',
                                backgroundColor: '#eff6ff',
                                color: '#0052cc',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Plus size={14} /> Create Login
                            </button>
                          )}

                          {/* Set / Reset Password Action */}
                          {row.hasLogin && (
                            <button
                              onClick={() => handleOpenPasswordModal(row, 'manual')}
                              disabled={!canManagePwd}
                              title={pwdTooltip}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '8px',
                                border: '1px solid ' + (canManagePwd ? '#cbd5e1' : '#e2e8f0'),
                                backgroundColor: canManagePwd ? '#ffffff' : '#f8fafc',
                                color: canManagePwd ? '#0f172a' : '#94a3b8',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: canManagePwd ? 'pointer' : 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                if (canManagePwd) {
                                  e.currentTarget.style.borderColor = '#0052cc';
                                  e.currentTarget.style.color = '#0052cc';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (canManagePwd) {
                                  e.currentTarget.style.borderColor = '#cbd5e1';
                                  e.currentTarget.style.color = '#0f172a';
                                }
                              }}
                            >
                              <KeyRound size={13} color={canManagePwd ? '#0052cc' : '#94a3b8'} />
                              <span>Set Password</span>
                            </button>
                          )}

                          {/* Edit User Action */}
                          {row.hasLogin && (
                            <button
                              onClick={() => handleOpenEdit(row)}
                              disabled={managerRestricted}
                              title={managerRestricted ? 'Cannot edit privileged accounts' : 'Edit role / details'}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: managerRestricted ? '#94a3b8' : '#0f172a',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: managerRestricted ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              <Edit size={13} />
                            </button>
                          )}

                          {/* Activate / Deactivate Toggle */}
                          {row.hasLogin && (
                            <button
                              onClick={() => setDeactivateModalUser(row)}
                              disabled={isCurrentSelf || managerRestricted}
                              title={
                                isCurrentSelf
                                  ? 'You cannot deactivate your own account'
                                  : managerRestricted
                                  ? 'Managers cannot deactivate privileged accounts'
                                  : row.isActive ? 'Deactivate account' : 'Activate account'
                              }
                              style={{
                                padding: '6px 10px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: isCurrentSelf || managerRestricted
                                  ? '#f1f5f9'
                                  : row.isActive ? '#fee2e2' : '#ecfdf5',
                                color: isCurrentSelf || managerRestricted
                                  ? '#94a3b8'
                                  : row.isActive ? '#dc2626' : '#059669',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: isCurrentSelf || managerRestricted ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {row.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL 1: CREATE LOGIN ACCOUNT                                       */}
      {/* =================================================================== */}
      {createModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(7, 19, 36, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.4)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                  Create Login Account
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Establish a secure login credential for authorized staff members
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Mode Switcher */}
            <div style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              padding: '4px',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, mode: 'new', employeeRecordId: '' }))}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: formData.mode === 'new' ? '#ffffff' : 'transparent',
                  color: formData.mode === 'new' ? '#0052cc' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: formData.mode === 'new' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Create New Employee &amp; Login
              </button>
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, mode: 'existing' }))}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: formData.mode === 'existing' ? '#ffffff' : 'transparent',
                  color: formData.mode === 'existing' ? '#0052cc' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: formData.mode === 'existing' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Select Existing Employee
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              {/* Existing Employee Dropdown if mode is 'existing' */}
              {formData.mode === 'existing' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Select Existing Employee *
                  </label>
                  <select
                    value={formData.employeeRecordId}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '11px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="">-- Choose unlinked employee --</option>
                    {eligibleEmployees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.employeeId} — {e.name} ({ROLE_DISPLAY_NAMES[e.role] || e.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Full Name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Priyantha Kumar"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Email Address */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="name@jbgroup.com"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Role & Branch Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '11px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {permittedRoles.map(r => (
                      <option key={r} value={r}>{ROLE_DISPLAY_NAMES[r] || r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Branch *
                  </label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData(p => ({ ...p, branchId: e.target.value }))}
                    disabled={isManager}
                    style={{
                      width: '100%',
                      padding: '11px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      backgroundColor: isManager ? '#f8fafc' : '#ffffff'
                    }}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password Setup Method */}
              <div style={{ marginBottom: '18px', padding: '14px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '10px' }}>
                  Secure Password Setup Method
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="setupMethod"
                      checked={formData.setupMethod === 'email'}
                      onChange={() => setFormData(p => ({ ...p, setupMethod: 'email' }))}
                      style={{ accentColor: '#0052cc' }}
                    />
                    <span>Send secure setup link via email (Single-use, 60-min expiry)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="setupMethod"
                      checked={formData.setupMethod === 'manual'}
                      onChange={() => setFormData(p => ({ ...p, setupMethod: 'manual' }))}
                      style={{ accentColor: '#0052cc' }}
                    />
                    <span>Set initial temporary password manually</span>
                  </label>
                </div>

                {formData.setupMethod === 'manual' && (
                  <div style={{ marginTop: '12px' }}>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                      placeholder="Enter minimum 6-character password"
                      required={formData.setupMethod === 'manual'}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#0052cc',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 82, 204, 0.3)'
                  }}
                >
                  {actionLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: LINK EXISTING LOGIN TO EMPLOYEE                            */}
      {/* =================================================================== */}
      {linkModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(7, 19, 36, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                  Link Existing Login to Employee
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Connect an active login account to its official employee record
                </p>
              </div>
              <button
                onClick={() => setLinkModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleLinkAccount}>
              {/* Select User */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Select Login Account *
                </label>
                <select
                  value={linkData.userId}
                  onChange={(e) => setLinkData(p => ({ ...p, userId: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="">-- Choose active login --</option>
                  {users.filter(u => u.hasLogin).map(u => (
                    <option key={u.id} value={u.userId}>
                      {u.name} ({u.email}) — {u.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Employee */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Select Employee Record *
                </label>
                <select
                  value={linkData.employeeRecordId}
                  onChange={(e) => setLinkData(p => ({ ...p, employeeRecordId: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="">-- Choose unlinked employee --</option>
                  {eligibleEmployees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.employeeId} — {e.name} ({ROLE_DISPLAY_NAMES[e.role] || e.role})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#0052cc',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: actionLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {actionLoading ? 'Linking...' : 'Link Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: PASSWORD MANAGEMENT (MANUAL SET & EMAIL RESET LINK)        */}
      {/* =================================================================== */}
      {resetModalUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(7, 19, 36, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.4)',
            textAlign: 'left'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#eff6ff',
                  color: '#0052cc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #bfdbfe'
                }}>
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                    Password Management
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                      {resetModalUser.name}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1'
                    }}>
                      {ROLE_DISPLAY_NAMES[resetModalUser.role] || resetModalUser.role}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Target Account Info Card */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem'
            }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Target Account
                </div>
                <div style={{ fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                  {resetModalUser.email || 'No email registered'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Branch
                </div>
                <div style={{ fontWeight: 700, color: '#0052cc', marginTop: '2px' }}>
                  {resetModalUser.branchName || 'Main'}
                </div>
              </div>
            </div>

            {/* Mode Tabs */}
            <div style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              padding: '4px',
              borderRadius: '12px',
              marginBottom: '20px',
              gap: '4px'
            }}>
              <button
                type="button"
                onClick={() => setPasswordModalTab('manual')}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  border: 'none',
                  background: passwordModalTab === 'manual' ? '#ffffff' : 'transparent',
                  color: passwordModalTab === 'manual' ? '#0052cc' : '#64748b',
                  boxShadow: passwordModalTab === 'manual' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <KeyRound size={15} />
                <span>Set Password Manually</span>
              </button>
              <button
                type="button"
                onClick={() => setPasswordModalTab('email')}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  border: 'none',
                  background: passwordModalTab === 'email' ? '#ffffff' : 'transparent',
                  color: passwordModalTab === 'email' ? '#0052cc' : '#64748b',
                  boxShadow: passwordModalTab === 'email' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Mail size={15} />
                <span>Email Reset Link</span>
              </button>
            </div>

            {/* Tab 1: Set Password Manually */}
            {passwordModalTab === 'manual' && (
              <form onSubmit={handleManualSetPassword}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '6px'
                  }}>
                    New Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new secure password (min. 6 characters)"
                      required
                      autoComplete="new-password"
                      style={{
                        width: '100%',
                        padding: '11px 40px 11px 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#0052cc'}
                      onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '6px'
                  }}>
                    Confirm Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter the new password"
                      required
                      autoComplete="new-password"
                      style={{
                        width: '100%',
                        padding: '11px 40px 11px 14px',
                        borderRadius: '10px',
                        border: '1.5px solid ' + (confirmPassword && newPassword !== confirmPassword ? '#ef4444' : '#cbd5e1'),
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#0052cc'}
                      onBlur={(e) => e.target.style.borderColor = confirmPassword && newPassword !== confirmPassword ? '#ef4444' : '#cbd5e1'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Real-time Validation Indicators */}
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '0.78rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: newPassword.length >= 6 ? '#059669' : '#64748b',
                    fontWeight: newPassword.length >= 6 ? 700 : 500
                  }}>
                    {newPassword.length >= 6 ? <Check size={14} color="#059669" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid #cbd5e1' }} />}
                    <span>At least 6 characters</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: confirmPassword && newPassword === confirmPassword ? '#059669' : confirmPassword && newPassword !== confirmPassword ? '#dc2626' : '#64748b',
                    fontWeight: confirmPassword && newPassword === confirmPassword ? 700 : 500
                  }}>
                    {confirmPassword && newPassword === confirmPassword ? (
                      <Check size={14} color="#059669" />
                    ) : confirmPassword && newPassword !== confirmPassword ? (
                      <AlertCircle size={14} color="#dc2626" />
                    ) : (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid #cbd5e1' }} />
                    )}
                    <span>
                      {confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : 'Passwords match'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setResetModalUser(null)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || newPassword.length < 6 || newPassword !== confirmPassword}
                    style={{
                      flex: 1.4,
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: (actionLoading || newPassword.length < 6 || newPassword !== confirmPassword) ? '#94a3b8' : '#0052cc',
                      color: '#ffffff',
                      fontWeight: 800,
                      cursor: (actionLoading || newPassword.length < 6 || newPassword !== confirmPassword) ? 'not-allowed' : 'pointer',
                      boxShadow: (newPassword.length >= 6 && newPassword === confirmPassword) ? '0 4px 12px rgba(0, 82, 204, 0.3)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <KeyRound size={16} />}
                    <span>{actionLoading ? 'Saving...' : 'Set Password'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Send Email Reset Link */}
            {passwordModalTab === 'email' && (
              <div>
                <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                  Generate a secure, single-use password reset link and send it via email to:
                </p>

                <div style={{
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: '#0f172a',
                  marginBottom: '16px'
                }}>
                  {resetModalUser.email || <span style={{ color: '#ef4444', fontStyle: 'italic' }}>No email address registered</span>}
                </div>

                {!resetModalUser.email && (
                  <div style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.8rem',
                    color: '#92400e',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertTriangle size={16} color="#d97706" />
                    <span>This account has no email. Please switch to <strong>Set Password Manually</strong>.</span>
                  </div>
                )}

                <div style={{
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '0.78rem',
                  color: '#1d4ed8',
                  textAlign: 'left',
                  marginBottom: '20px',
                  lineHeight: 1.45
                }}>
                  &bull; Token expires automatically in <strong>60 minutes</strong>.<br />
                  &bull; Token is single-use and invalidated immediately upon setup.<br />
                  &bull; Plaintext passwords are never revealed or stored.
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setResetModalUser(null)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmResetPassword}
                    disabled={actionLoading || !resetModalUser.email}
                    style={{
                      flex: 1.4,
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: (actionLoading || !resetModalUser.email) ? '#94a3b8' : '#0052cc',
                      color: '#ffffff',
                      fontWeight: 800,
                      cursor: (actionLoading || !resetModalUser.email) ? 'not-allowed' : 'pointer',
                      boxShadow: resetModalUser.email ? '0 4px 12px rgba(0, 82, 204, 0.3)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />}
                    <span>{actionLoading ? 'Sending...' : 'Send Reset Link'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: CONFIRM ACTIVATE / DEACTIVATE                              */}
      {/* =================================================================== */}
      {deactivateModalUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(7, 19, 36, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.4)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: deactivateModalUser.isActive ? '#fee2e2' : '#ecfdf5',
              color: deactivateModalUser.isActive ? '#dc2626' : '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              {deactivateModalUser.isActive ? <UserX size={28} /> : <UserCheck size={28} />}
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
              {deactivateModalUser.isActive ? 'Deactivate User Account' : 'Reactivate User Account'}
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
              {deactivateModalUser.isActive
                ? `Are you sure you want to deactivate ${deactivateModalUser.name}? The account will be temporarily suspended from logging into the portal.`
                : `Are you sure you want to reactivate ${deactivateModalUser.name}? The user will regain portal access immediately.`}
            </p>

            {deactivateModalUser.isActive && (
              <div style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.78rem',
                color: '#b45309',
                textAlign: 'left',
                marginBottom: '20px'
              }}>
                <strong>Safety Guarantee:</strong> Deactivating an account does NOT delete any employee records, tailor assignments, or order histories.
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeactivateModalUser(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleStatus}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: deactivateModalUser.isActive ? '#dc2626' : '#059669',
                  color: '#ffffff',
                  fontWeight: 800,
                  cursor: actionLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {actionLoading
                  ? 'Processing...'
                  : deactivateModalUser.isActive ? 'Confirm Deactivation' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 5: EDIT USER                                                  */}
      {/* =================================================================== */}
      {editModalUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(7, 19, 36, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '460px',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                  Edit Account Details
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Update name, role assignment, or branch
                </p>
              </div>
              <button
                onClick={() => setEditModalUser(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmEdit}>
              {/* Full Name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(p => ({ ...p, name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Role */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Role Assignment
                </label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData(p => ({ ...p, role: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {permittedRoles.map(r => (
                    <option key={r} value={r}>{ROLE_DISPLAY_NAMES[r] || r}</option>
                  ))}
                </select>
              </div>

              {/* Branch */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Assigned Branch
                </label>
                <select
                  value={editFormData.branchId}
                  onChange={(e) => setEditFormData(p => ({ ...p, branchId: e.target.value }))}
                  disabled={isManager}
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    backgroundColor: isManager ? '#f8fafc' : '#ffffff'
                  }}
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditModalUser(null)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#0052cc',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: actionLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
