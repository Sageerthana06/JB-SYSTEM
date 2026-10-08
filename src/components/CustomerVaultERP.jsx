import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Search,
  Plus,
  Ruler,
  FileText,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Clock,
  Sparkles,
  Scissors,
  CheckCircle2,
  TrendingUp,
  History,
  Tag,
  ShieldCheck,
  Edit3,
  Camera,
  Upload,
  User,
  X,
  CreditCard,
  MessageCircle,
  AlertCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { API_URL, getImageUrl } from '../config/api';
import { getStatusLabel, STATUS_COLORS } from '../utils/orderStatus';
import { OrderCreationModal } from './OrderCreationModal';
import { CustomerCreationModal } from './CustomerCreationModal';

const normalizePhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) return '94' + digits.slice(1);
  if (digits.startsWith('94')) return digits;
  return digits;
};

export const CustomerVaultERP = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Photo upload states
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');

  // 1. Fetch real customers list from PostgreSQL
  const fetchCustomers = async (query = '') => {
    setLoadingCustomers(true);
    try {
      const token = localStorage.getItem('jb_token');
      const res = await fetch(`${API_URL}/api/customers/search?query=${encodeURIComponent(query)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.customers)) {
        setCustomers(data.customers);
        // Automatically select first customer if none selected or if previous selection not in list
        if (data.customers.length > 0) {
          if (!selectedCustomerId || !data.customers.some(c => c.id === selectedCustomerId)) {
            setSelectedCustomerId(data.customers[0].id);
          }
        } else {
          setSelectedCustomerId(null);
          setCustomerDetails(null);
        }
      }
    } catch (err) {
      console.error('Failed to load customers for vault:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    fetchCustomers(searchQuery);
  }, [searchQuery]);

  // 2. Fetch full Customer 360 profile from PostgreSQL when selectedCustomerId changes
  const fetchCustomerDetails = async (id) => {
    if (!id) return;
    setLoadingDetails(true);
    try {
      const token = localStorage.getItem('jb_token');
      const res = await fetch(`${API_URL}/api/customers/${id}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomerDetails(data.customer);
      }
    } catch (err) {
      console.error('Failed to load customer profile details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerDetails(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  // 3. Handle direct photo change/upload for selected customer
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCustomerId) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Photo must be 5MB or smaller.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      setUploadError('Invalid format. JPG, JPEG, PNG, or WEBP only.');
      return;
    }

    setUploadingPhoto(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const token = localStorage.getItem('jb_token');
      const formData = new FormData();
      formData.append('customerPhoto', file);

      const uploadRes = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        setUploadError(uploadData.message || 'Failed to upload photo.');
        setUploadingPhoto(false);
        return;
      }

      const photoUrl = uploadData.photoUrl || uploadData.imageUrl;

      const patchRes = await fetch(`${API_URL}/api/customers/${selectedCustomerId}/photo`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ profilePhoto: photoUrl })
      });
      const patchData = await patchRes.json();

      if (patchData.success) {
        setUploadSuccess('Profile photo updated successfully!');
        setCustomerDetails(prev => prev ? { ...prev, profilePhoto: photoUrl } : prev);
        setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? { ...c, profilePhoto: photoUrl } : c));
        setTimeout(() => setUploadSuccess(''), 4000);
      } else {
        setUploadError(patchData.message || 'Failed to update customer record.');
      }
    } catch (err) {
      setUploadError('Network error uploading customer photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // 4. Calculate real KPI stats from real database orders
  const totalCustomers = customers.length;
  const totalOrders = customers.reduce((sum, c) => sum + (c.orders?.length || 0), 0);
  const totalMeasured = customers.filter(c => (c.measurements?.length || 0) > 0).length;
  const totalRevenue = customers.reduce((sum, c) => {
    const custOrders = c.orders || [];
    return sum + custOrders.reduce((oSum, o) => oSum + (Number(o.totalAmount) || 0), 0);
  }, 0);

  // Selected customer real data helpers
  const currentOrders = customerDetails?.orders || [];
  const currentMeasurements = customerDetails?.measurements || [];
  const activeMeasurement = currentMeasurements.length > 0 ? currentMeasurements[0] : null;

  // Selected customer financials
  const custTotalSpent = currentOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const custTotalPaid = currentOrders.reduce((sum, o) => sum + (Number(o.advancePayment) || 0), 0);
  const custBalanceDue = currentOrders.reduce((sum, o) => sum + (Number(o.balanceAmount) || 0), 0);

  return (
    <div className="erp-page-container" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      {/* 📌 Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        backgroundColor: '#ffffff',
        padding: '20px 24px',
        borderRadius: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        border: '1px solid #e2e8f0',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#fee2e2', padding: '12px', borderRadius: '14px', color: '#d90429' }}>
            <UserCheck size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0a192f', margin: 0 }}>
              Customer 360 & Measurement Vault
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, margin: '2px 0 0 0' }}>
              Real-time PostgreSQL client profiles, bespoke tailoring parameters & order ledger
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCustomerModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#d90429',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(217, 4, 41, 0.3)',
            transition: 'transform 0.2s'
          }}
        >
          <Plus size={18} />
          New Customer Profile
        </button>
      </div>

      {/* 📊 Real KPI Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'TOTAL VAULT CUSTOMERS', val: totalCustomers.toLocaleString(), sub: 'Registered Clients', color: '#0a192f', icon: UserCheck },
          { label: 'REAL ORDERS RECORDED', val: totalOrders.toLocaleString(), sub: 'Database Orders', color: '#2563eb', icon: Scissors },
          { label: 'MEASURED CLIENTS', val: totalMeasured.toLocaleString(), sub: 'Active Sizing Vaults', color: '#d97706', icon: Ruler },
          { label: 'LIFETIME ORDER VALUE', val: totalRevenue > 0 ? `LKR ${totalRevenue.toLocaleString()}` : 'LKR 0', sub: 'Gross Order Volume', color: '#16a34a', icon: TrendingUp }
        ].map((kpi, idx) => (
          <div key={idx} style={{
            backgroundColor: '#ffffff',
            padding: '18px 20px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.725rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {kpi.label}
              </span>
              <kpi.icon size={20} style={{ color: kpi.color }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: kpi.color, marginTop: '8px' }}>
              {kpi.val}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginTop: '2px' }}>
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* 🔍 Main Vault Grid */}
      <div className="grid-vault-main">
        
        {/* Left Column: Real Customer Directory */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
          height: 'fit-content'
        }}>
          {/* Search Field */}
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 40px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                backgroundColor: '#f8fafc',
                fontWeight: 600
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '0 4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>
              DIRECTORY ({customers.length})
            </span>
            {loadingCustomers && <span style={{ fontSize: '0.72rem', color: '#2563eb' }}>Updating...</span>}
          </div>

          {/* Directory List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '72vh', overflowY: 'auto', paddingRight: '4px' }}>
            {customers.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                {loadingCustomers ? 'Loading real customers...' : 'No customers found.'}
              </div>
            ) : (
              customers.map((cust) => {
                const isSelected = selectedCustomerId === cust.id;
                const ordersCount = cust.orders?.length || 0;
                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: isSelected ? '2px solid #d90429' : '1px solid #f1f5f9',
                      backgroundColor: isSelected ? '#fff5f5' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(217, 4, 41, 0.12)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {cust.profilePhoto ? (
                        <img
                          src={getImageUrl(cust.profilePhoto)}
                          alt={cust.name}
                          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #cbd5e1', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0a192f', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, flexShrink: 0 }}>
                          {cust.name ? cust.name.charAt(0).toUpperCase() : <User size={16} />}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cust.name}
                          </span>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '999px',
                            backgroundColor: ordersCount > 0 ? '#e0f2fe' : '#f1f5f9',
                            color: ordersCount > 0 ? '#0369a1' : '#64748b'
                          }}>
                            {ordersCount} {ordersCount === 1 ? 'Order' : 'Orders'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '3px', fontSize: '0.75rem', color: '#64748b', alignItems: 'center' }}>
                          <span>{cust.primaryPhone || 'No Phone'}</span>
                          {cust.address && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>• {cust.address}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Customer 360 Workspace with Real PostgreSQL Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {loadingDetails && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '16px 24px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#0284c7',
              fontSize: '0.85rem',
              fontWeight: 700
            }}>
              <Loader2 size={18} className="spin-animation" />
              <span>Loading complete customer profile and order timeline...</span>
            </div>
          )}

          {customerDetails ? (
            <>
              {/* Profile Master Card */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
                    {/* Profile Photo with direct upload trigger */}
                    <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
                      {customerDetails.profilePhoto ? (
                        <img
                          src={getImageUrl(customerDetails.profilePhoto)}
                          alt={customerDetails.name}
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid #0052cc', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          backgroundColor: '#0a192f',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.8rem',
                          fontWeight: 900
                        }}>
                          {customerDetails.name?.charAt(0).toUpperCase() || <User size={36} />}
                        </div>
                      )}

                      <label
                        title="Upload / Change Photo"
                        style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          border: '2px solid #ffffff',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                        }}
                      >
                        <Camera size={14} />
                        <input
                          type="file"
                          accept="image/jpeg, image/png, image/webp, image/jpg"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                          {customerDetails.name}
                        </h2>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          ID: #{customerDetails.id}
                        </span>
                        {customerDetails.branch && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534', backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '6px' }}>
                            {customerDetails.branch}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.85rem', color: '#475569', flexWrap: 'wrap', alignItems: 'center' }}>
                        {customerDetails.primaryPhone && (
                          <a
                            href={`https://wa.me/${normalizePhoneForWhatsApp(customerDetails.primaryPhone)}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              backgroundColor: '#f0fdf4',
                              color: '#15803d',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              border: '1px solid #bbf7d0',
                              fontWeight: 700,
                              textDecoration: 'none',
                              fontSize: '0.82rem'
                            }}
                          >
                            <MessageCircle size={14} color="#16a34a" /> {customerDetails.primaryPhone}
                          </a>
                        )}
                        {customerDetails.alternativePhone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={14} /> Alt: {customerDetails.alternativePhone}
                          </span>
                        )}
                        {customerDetails.email && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={14} /> {customerDetails.email}
                          </span>
                        )}
                        {customerDetails.address && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={14} /> {customerDetails.address}
                          </span>
                        )}
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          Customer since {new Date(customerDetails.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {uploadSuccess && (
                        <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, marginTop: '6px' }}>
                          ✓ {uploadSuccess}
                        </div>
                      )}
                      {uploadError && (
                        <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 700, marginTop: '6px' }}>
                          ✕ {uploadError}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <button
                    onClick={() => setIsOrderModalOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                    }}
                  >
                    <Plus size={14} color="#d90429" /> Create New Order
                  </button>
                </div>

                {/* Financial Summary Strip */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px',
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Orders</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{currentOrders.length}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Invoiced</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>LKR {custTotalSpent.toLocaleString()}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Paid</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>LKR {custTotalPaid.toLocaleString()}</div>
                  </div>
                  <div style={{ backgroundColor: custBalanceDue > 0 ? '#fffbeb' : '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${custBalanceDue > 0 ? '#fde68a' : '#e2e8f0'}` }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: custBalanceDue > 0 ? '#b45309' : '#64748b', textTransform: 'uppercase' }}>Balance Due</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: custBalanceDue > 0 ? '#dc2626' : '#16a34a', marginTop: '2px' }}>
                      {custBalanceDue > 0 ? `LKR ${custBalanceDue.toLocaleString()}` : '✓ Fully Paid'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sizing & Measurement Vault */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Ruler size={20} style={{ color: '#d90429' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Encrypted Sizing Profile & Tailoring Parameters
                    </h3>
                  </div>
                  {activeMeasurement && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 12px', borderRadius: '999px' }}>
                      ✓ Verified: {new Date(activeMeasurement.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Measurements Content */}
                {activeMeasurement && activeMeasurement.measurements && typeof activeMeasurement.measurements === 'object' && Object.keys(activeMeasurement.measurements).length > 0 ? (
                  <>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', backgroundColor: '#fee2e2', padding: '3px 10px', borderRadius: '6px' }}>
                        Dress Type: {activeMeasurement.dressType || 'Bespoke Garment'}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', backgroundColor: '#f1f5f9', padding: '3px 10px', borderRadius: '6px' }}>
                        Unit: {activeMeasurement.measurementUnit || 'Inches'}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', backgroundColor: '#f1f5f9', padding: '3px 10px', borderRadius: '6px' }}>
                        Fit: {activeMeasurement.fitPreference || 'Regular'} Fit
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                      {Object.entries(activeMeasurement.measurements).map(([param, val]) => (
                        <div key={param} style={{
                          backgroundColor: '#f8fafc',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                            {param.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                            {String(val)} <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>{activeMeasurement.measurementUnit || 'Inches'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.85rem' }}>
                    No bespoke measurements recorded yet for this customer profile. Measurements will appear here when custom orders are placed.
                  </div>
                )}
              </div>

              {/* Real Tailoring Order & Fitting History */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={20} style={{ color: '#2563eb' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Tailoring Order & Fitting History ({currentOrders.length})
                    </h3>
                  </div>
                </div>

                {currentOrders.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    No orders placed yet by this customer.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                          <th style={{ padding: '12px 14px' }}>Order Number</th>
                          <th style={{ padding: '12px 14px' }}>Garment Item</th>
                          <th style={{ padding: '12px 14px' }}>Booking Date</th>
                          <th style={{ padding: '12px 14px' }}>Assigned Tailor</th>
                          <th style={{ padding: '12px 14px' }}>Status</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Amount</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Payment Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentOrders.map((ord) => {
                          const statusColors = STATUS_COLORS[ord.status] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
                          const total = Number(ord.totalAmount) || 0;
                          const paid = Number(ord.advancePayment) || 0;
                          const balance = Number(ord.balanceAmount) || 0;
                          return (
                            <tr key={ord.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0f172a' }}>
                                {ord.orderNumber || `ORD-${ord.id}`}
                              </td>
                              <td style={{ padding: '12px 14px', fontWeight: 700, color: '#334155' }}>
                                {ord.garmentDetails?.dressType || 'Custom Dress'}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#64748b' }}>
                                {new Date(ord.createdAt || ord.orderDate).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#475569' }}>
                                {ord.assignedTailor?.name ? (
                                  <span style={{ fontWeight: 600 }}>{ord.assignedTailor.name}</span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  fontSize: '0.725rem',
                                  fontWeight: 800,
                                  backgroundColor: statusColors.bg,
                                  color: statusColors.text,
                                  border: `1px solid ${statusColors.border}`
                                }}>
                                  {getStatusLabel(ord.status)}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                {total > 0 ? `LKR ${total.toLocaleString()}` : 'Price Pending'}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                {total === 0 ? (
                                  <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>UNPRICED</span>
                                ) : balance <= 0 ? (
                                  <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 800, backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '6px' }}>
                                    ✓ PAID
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 800, backgroundColor: '#fee2e2', padding: '3px 8px', borderRadius: '6px' }}>
                                    DUE: LKR {balance.toLocaleString()}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '40px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
              Select a customer from the directory on the left to view complete client history, body measurements, and order ledger.
            </div>
          )}

        </div>
      </div>

      {/* New Order / Customer Creation Modal */}
      <OrderCreationModal
        isOpen={isOrderModalOpen}
        onClose={() => {
          setIsOrderModalOpen(false);
          fetchCustomers(searchQuery);
        }}
      />

      <CustomerCreationModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={() => fetchCustomers(searchQuery)}
      />

    </div>
  );
};
