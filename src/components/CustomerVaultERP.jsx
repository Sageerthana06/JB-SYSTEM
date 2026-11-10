import React, { useState, useEffect, useRef } from 'react';
import {
  UserCheck,
  Search,
  Plus,
  Ruler,
  Phone,
  Mail,
  MapPin,
  Scissors,
  TrendingUp,
  History,
  Camera,
  User,
  X,
  MessageCircle,
  Loader2,
  Trophy,
  Award,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  DollarSign,
  FileText,
  ArrowDown,
  Layers,
  Sparkles
} from 'lucide-react';
import { API_URL, getImageUrl } from '../config/api';
import { getStatusLabel, STATUS_COLORS } from '../utils/orderStatus';
import { OrderCreationModal } from './OrderCreationModal';
import { CustomerCreationModal } from './CustomerCreationModal';
import { ImageUploadCapture } from './common/ImageUploadCapture';
import { validateImageFileClient } from '../utils/imageUploadHelper';
import { MonthlyCustomerWinnersSection } from './MonthlyCustomerWinnersSection';
import { DigitalInvoiceModal } from './DigitalInvoiceModal';

const normalizePhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) return '94' + digits.slice(1);
  if (digits.startsWith('94')) return digits;
  return digits;
};

// Formats measurement keys into readable labels
const formatMeasurementLabel = (key) => {
  if (!key) return '';
  const customLabels = {
    currentGarmentType: 'Current Garment Type',
    requiredAlteration: 'Required Alteration',
    requiredMeasurement: 'Alteration Measurement',
    alterationInstructions: 'Alteration Instructions',
    underBust: 'Under Bust',
    armhole: 'Armhole',
    blouseLength: 'Blouse Length',
    sleeveLength: 'Sleeve Length',
    sleeveRound: 'Sleeve Round',
    neckDeepFront: 'Front Neck Depth',
    neckDeepBack: 'Back Neck Depth',
    shoulderToWaist: 'Shoulder to Waist',
    bottomLength: 'Bottom Length',
    pantLength: 'Pant Length',
    inseamLength: 'Inseam Length',
    kneeRound: 'Knee Round',
    ankleRound: 'Ankle Round'
  };
  if (customLabels[key]) return customLabels[key];
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()).trim();
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
  const [activeVaultTab, setActiveVaultTab] = useState('winners'); // 'winners' | 'vault'
  const [selectedMeasurementIdx, setSelectedMeasurementIdx] = useState(0);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);

  const ordersTableRef = useRef(null);

  const handleSelectCustomerFromWinners = (customerId) => {
    setSelectedCustomerId(customerId);
    setActiveVaultTab('vault');
  };

  const scrollToOrders = () => {
    if (ordersTableRef.current) {
      ordersTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Photo upload states
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

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
    setSelectedMeasurementIdx(0);
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

  // 3. Handle direct photo change/upload for selected customer with 20 MB limit
  const processPhotoUpload = async (file) => {
    if (!file || !selectedCustomerId) return;

    const validation = validateImageFileClient(file);
    if (!validation.valid) {
      setUploadError(validation.error);
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
        setIsPhotoModalOpen(false);
        setTimeout(() => setUploadSuccess(''), 4000);
      } else {
        setUploadError(patchData.message || 'Failed to update customer record.');
      }
    } catch {
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
  const activeMeasurement = currentMeasurements.length > 0
    ? currentMeasurements[Math.min(selectedMeasurementIdx, currentMeasurements.length - 1)]
    : null;

  // Selected customer financials calculated directly from real database orders and verified payments
  const custTotalSpent = currentOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const custTotalPaid = currentOrders.reduce((sum, o) => {
    if (o.payments && Array.isArray(o.payments) && o.payments.length > 0) {
      const verifiedPaid = o.payments
        .filter(p => !p.status || p.status === 'VERIFIED')
        .reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0);
      return sum + verifiedPaid;
    }
    const tot = Number(o.totalAmount) || 0;
    const bal = Number(o.balanceAmount) || 0;
    return sum + Math.max(0, tot - bal);
  }, 0);
  const custBalanceDue = currentOrders.reduce((sum, o) => sum + (Number(o.balanceAmount) || 0), 0);

  // Measurement parsing helpers
  const rawMeasurements = activeMeasurement?.measurements;
  const isObjectMeasurements = rawMeasurements && typeof rawMeasurements === 'object' && !Array.isArray(rawMeasurements);

  const isAlteration = activeMeasurement && (
    activeMeasurement.dressType?.toLowerCase() === 'alteration' ||
    (isObjectMeasurements && ('currentGarmentType' in rawMeasurements || 'requiredAlteration' in rawMeasurements))
  );

  const alterationFields = isAlteration && isObjectMeasurements ? {
    currentGarmentType: rawMeasurements.currentGarmentType,
    requiredAlteration: rawMeasurements.requiredAlteration,
    requiredMeasurement: rawMeasurements.requiredMeasurement,
    alterationInstructions: rawMeasurements.alterationInstructions || activeMeasurement.fittingInstructions
  } : null;

  const standardMeasurements = isObjectMeasurements
    ? Object.entries(rawMeasurements).filter(([k]) => ![
        'currentGarmentType',
        'requiredAlteration',
        'requiredMeasurement',
        'alterationInstructions'
      ].includes(k))
    : [];

  return (
    <div className="erp-page-container" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px' }}>

      {/* 📌 Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        backgroundColor: '#ffffff',
        padding: '18px 22px',
        borderRadius: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        border: '1px solid #e2e8f0',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            backgroundColor: '#0a192f',
            padding: '12px',
            borderRadius: '12px',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(10, 25, 47, 0.2)'
          }}>
            <UserCheck size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0a192f', margin: 0 }}>
                Customer 360 & Measurement Vault
              </h1>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                padding: '2px 8px',
                borderRadius: '999px',
                textTransform: 'uppercase'
              }}>
                PostgreSQL Live ERP
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.825rem', fontWeight: 600, margin: '3px 0 0 0' }}>
              Bespoke garment measurements, complete client directory & real-time order history ledger
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCustomerModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#d90429',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(217, 4, 41, 0.25)',
            transition: 'background-color 0.15s ease'
          }}
        >
          <Plus size={16} />
          <span>New Customer Profile</span>
        </button>
      </div>

      {/* 📊 KPI Summary Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        {[
          { label: 'TOTAL VAULT CUSTOMERS', val: totalCustomers.toLocaleString(), sub: 'Registered client records', color: '#0a192f', icon: UserCheck },
          { label: 'REAL ORDERS RECORDED', val: totalOrders.toLocaleString(), sub: 'All-time database orders', color: '#2563eb', icon: Scissors },
          { label: 'MEASURED CLIENTS', val: totalMeasured.toLocaleString(), sub: 'Active sizing profiles', color: '#059669', icon: Ruler },
          { label: 'LIFETIME ORDER VALUE', val: totalRevenue > 0 ? `LKR ${totalRevenue.toLocaleString()}` : 'LKR 0', sub: 'Gross order ledger', color: '#1e3a8a', icon: TrendingUp }
        ].map((kpi, idx) => (
          <div key={idx} style={{
            backgroundColor: '#ffffff',
            padding: '16px 18px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {kpi.label}
              </span>
              <kpi.icon size={18} style={{ color: kpi.color }} />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: kpi.color, marginTop: '6px' }}>
              {kpi.val}
            </div>
            <div style={{ fontSize: '0.725rem', fontWeight: 600, color: '#94a3b8', marginTop: '2px' }}>
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* 🧭 Vault Subnavigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        backgroundColor: '#ffffff',
        padding: '8px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        width: 'fit-content',
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => setActiveVaultTab('winners')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: activeVaultTab === 'winners' ? '#0a192f' : 'transparent',
            color: activeVaultTab === 'winners' ? '#ffffff' : '#475569',
            fontWeight: 800,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: activeVaultTab === 'winners' ? '0 2px 8px rgba(10, 25, 47, 0.15)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <Trophy size={16} style={{ color: activeVaultTab === 'winners' ? '#f59e0b' : '#64748b' }} />
          <span>Monthly VIP Customer Winners</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveVaultTab('vault')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: activeVaultTab === 'vault' ? '#0a192f' : 'transparent',
            color: activeVaultTab === 'vault' ? '#ffffff' : '#475569',
            fontWeight: 800,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: activeVaultTab === 'vault' ? '0 2px 8px rgba(10, 25, 47, 0.15)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <UserCheck size={16} style={{ color: activeVaultTab === 'vault' ? '#38bdf8' : '#64748b' }} />
          <span>Customer 360 Workspace & Sizing Vault</span>
        </button>
      </div>

      {activeVaultTab === 'winners' ? (
        <MonthlyCustomerWinnersSection
          onSelectCustomerInVault={handleSelectCustomerFromWinners}
        />
      ) : (
        /* 🔍 Main Customer 360 & Vault Grid */
        <div className="grid-vault-main">

          {/* Left Column: Customer Directory */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            height: 'fit-content'
          }}>
            {/* Search Input with Clear Button */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by name, phone, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 34px 9px 36px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.825rem',
                  outline: 'none',
                  backgroundColor: '#f8fafc',
                  fontWeight: 600,
                  boxSizing: 'border-box'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Directory Header Counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '0 4px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                CLIENT DIRECTORY ({customers.length})
              </span>
              {loadingCustomers && <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 700 }}>Updating...</span>}
            </div>

            {/* Customer List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '72vh', overflowY: 'auto', paddingRight: '2px' }}>
              {customers.length === 0 ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.825rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  {loadingCustomers ? 'Loading client records...' : 'No customers match your search.'}
                </div>
              ) : (
                customers.map((cust) => {
                  const isSelected = selectedCustomerId === cust.id;
                  const ordersCount = cust.orders?.length || 0;
                  const measurementsCount = cust.measurements?.length || 0;

                  return (
                    <div
                      key={cust.id}
                      onClick={() => setSelectedCustomerId(cust.id)}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        border: isSelected ? '1.5px solid #d90429' : '1px solid #f1f5f9',
                        borderLeft: isSelected ? '4px solid #d90429' : '1px solid #f1f5f9',
                        backgroundColor: isSelected ? '#fef2f2' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(217, 4, 41, 0.12)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Avatar */}
                        {cust.profilePhoto ? (
                          <img
                            src={getImageUrl(cust.profilePhoto)}
                            alt={cust.name}
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: isSelected ? '2px solid #d90429' : '1.5px solid #cbd5e1',
                              flexShrink: 0
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            backgroundColor: isSelected ? '#0a192f' : '#1e293b',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            flexShrink: 0
                          }}>
                            {cust.name ? cust.name.charAt(0).toUpperCase() : <User size={16} />}
                          </div>
                        )}

                        {/* Customer Information */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cust.name}
                            </span>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '6px',
                              backgroundColor: isSelected ? '#d90429' : '#0a192f',
                              color: '#ffffff',
                              flexShrink: 0
                            }}>
                              #{cust.id}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 700 }}>
                              {cust.primaryPhone || 'Not Available'}
                            </span>
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                              {measurementsCount > 0 && (
                                <span style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d'
                                }}>
                                  Sized
                                </span>
                              )}
                              <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: ordersCount > 0 ? '#e0f2fe' : '#f1f5f9',
                                color: ordersCount > 0 ? '#0369a1' : '#64748b'
                              }}>
                                {ordersCount} {ordersCount === 1 ? 'Order' : 'Orders'}
                              </span>
                            </div>
                          </div>

                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cust.address || 'Address: Not Available'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Customer 360 Profile & Vault */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {loadingDetails && (
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                padding: '14px 20px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#0284c7',
                fontSize: '0.825rem',
                fontWeight: 700
              }}>
                <Loader2 size={16} className="spin-animation" />
                <span>Loading real-time client parameters and order history...</span>
              </div>
            )}

            {customerDetails ? (
              <>
                {/* 1. Profile Master Header Card */}
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '22px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Avatar with Camera upload button */}
                      <div style={{ position: 'relative', width: '74px', height: '74px', flexShrink: 0 }}>
                        {customerDetails.profilePhoto ? (
                          <img
                            src={getImageUrl(customerDetails.profilePhoto)}
                            alt={customerDetails.name}
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid #0a192f', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
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
                            fontSize: '1.6rem',
                            fontWeight: 900
                          }}>
                            {customerDetails.name?.charAt(0).toUpperCase() || <User size={32} />}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setIsPhotoModalOpen(true)}
                          title="Upload or Change Photo (Max 20 MB)"
                          style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            borderRadius: '50%',
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            border: '2px solid #ffffff',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                          }}
                        >
                          <Camera size={13} />
                        </button>
                      </div>

                      {/* Name & Identity */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                            {customerDetails.name}
                          </h2>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ffffff', backgroundColor: '#0a192f', padding: '3px 9px', borderRadius: '6px' }}>
                            ID #{customerDetails.id}
                          </span>
                          {customerDetails.branch && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534', backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '6px' }}>
                              {customerDetails.branch}
                            </span>
                          )}
                          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                            Member since {new Date(customerDetails.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>

                        {/* Contact details row */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '0.825rem', color: '#475569', flexWrap: 'wrap', alignItems: 'center' }}>
                          {customerDetails.primaryPhone ? (
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
                                padding: '3px 10px',
                                borderRadius: '6px',
                                border: '1px solid #bbf7d0',
                                fontWeight: 700,
                                textDecoration: 'none',
                                fontSize: '0.8rem'
                              }}
                            >
                              <MessageCircle size={13} color="#16a34a" /> {customerDetails.primaryPhone}
                            </a>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <Phone size={13} style={{ color: '#64748b' }} /> Phone: Not Available
                            </span>
                          )}
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <Phone size={13} style={{ color: '#64748b' }} /> Alt: {customerDetails.alternativePhone || 'Not Available'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <Mail size={13} style={{ color: '#64748b' }} /> Email: {customerDetails.email || 'Not Available'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <MapPin size={13} style={{ color: '#64748b' }} /> Address: {customerDetails.address || 'Not Available'}
                          </span>
                        </div>

                        {uploadSuccess && (
                          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, marginTop: '6px' }}>
                            ✓ {uploadSuccess}
                          </div>
                        )}
                        {uploadError && (
                          <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, marginTop: '6px' }}>
                            ✕ {uploadError}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={scrollToOrders}
                        title="Jump to customer order history table"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <History size={14} style={{ color: '#2563eb' }} />
                        <span>View Orders ({currentOrders.length})</span>
                      </button>

                      <button
                        onClick={() => setIsOrderModalOpen(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#d90429',
                          color: '#ffffff',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(217, 4, 41, 0.25)'
                        }}
                      >
                        <Plus size={14} />
                        <span>Create New Order</span>
                      </button>
                    </div>
                  </div>

                  {/* Financial & Order Summary Strip (Clearly separated Order Summary & Payment Summary) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    marginTop: '18px',
                    paddingTop: '16px',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    {/* Orders Summary Panel */}
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                          LIFETIME ORDERS
                        </span>
                        <Scissors size={14} style={{ color: '#0a192f' }} />
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0a192f', marginTop: '2px' }}>
                        {currentOrders.length} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Orders</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                        Total Value: <strong>LKR {custTotalSpent.toLocaleString()}</strong>
                      </div>
                    </div>

                    {/* Payments Received Panel */}
                    <div style={{ backgroundColor: '#f0fdf4', padding: '12px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
                          TOTAL PAID
                        </span>
                        <DollarSign size={14} style={{ color: '#16a34a' }} />
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>
                        LKR {custTotalPaid.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#15803d', marginTop: '2px' }}>
                        Settled cash & bank receipts
                      </div>
                    </div>

                    {/* Outstanding Balance Panel */}
                    <div style={{
                      backgroundColor: custBalanceDue > 0 ? '#fff7ed' : '#f0fdf4',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: `1px solid ${custBalanceDue > 0 ? '#fed7aa' : '#bbf7d0'}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: custBalanceDue > 0 ? '#c2410c' : '#15803d', textTransform: 'uppercase' }}>
                          OUTSTANDING BALANCE
                        </span>
                        <AlertCircle size={14} style={{ color: custBalanceDue > 0 ? '#dc2626' : '#16a34a' }} />
                      </div>
                      <div style={{
                        fontSize: '1.2rem',
                        fontWeight: 900,
                        color: custBalanceDue > 0 ? '#dc2626' : '#16a34a',
                        marginTop: '2px'
                      }}>
                        {custBalanceDue > 0 ? `LKR ${custBalanceDue.toLocaleString()}` : '✓ Fully Settled'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: custBalanceDue > 0 ? '#c2410c' : '#15803d', marginTop: '2px' }}>
                        {custBalanceDue > 0 ? 'Pending client settlement' : 'Zero balance due'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Sizing & Measurement Vault Card */}
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '22px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  {/* Vault Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ backgroundColor: '#fee2e2', padding: '6px', borderRadius: '8px', color: '#d90429' }}>
                        <Ruler size={18} />
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0a192f', margin: 0 }}>
                        Sizing Profile & Tailoring Parameters
                      </h3>
                    </div>

                    {activeMeasurement && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 12px', borderRadius: '999px' }}>
                        ✓ Verified: {new Date(activeMeasurement.measurementDate || activeMeasurement.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {/* Multiple Measurement Records Switcher Tabs */}
                  {currentMeasurements.length > 1 && (
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '14px',
                      overflowX: 'auto',
                      paddingBottom: '4px'
                    }}>
                      {currentMeasurements.map((m, idx) => (
                        <button
                          key={m.id || idx}
                          type="button"
                          onClick={() => setSelectedMeasurementIdx(idx)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: selectedMeasurementIdx === idx ? '1.5px solid #0a192f' : '1px solid #cbd5e1',
                            backgroundColor: selectedMeasurementIdx === idx ? '#0a192f' : '#f8fafc',
                            color: selectedMeasurementIdx === idx ? '#ffffff' : '#475569',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Ruler size={13} />
                          <span>{m.dressType || 'Not Available'}</span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            ({new Date(m.measurementDate || m.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Measurement Vault Content */}
                  {activeMeasurement ? (
                    <>
                      {/* Meta Parameters Strip */}
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '14px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        backgroundColor: '#f8fafc',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                          Dress Type: <strong style={{ color: '#0f172a' }}>{activeMeasurement.dressType || 'Not Available'}</strong>
                        </div>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                          Unit: <strong style={{ color: '#0f172a' }}>{activeMeasurement.measurementUnit || 'Not Available'}</strong>
                        </div>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                          Fit: <strong style={{ color: '#0f172a' }}>{activeMeasurement.fitPreference ? `${activeMeasurement.fitPreference} Fit` : 'Not Available'}</strong>
                        </div>
                        {activeMeasurement.takenBy && (
                          <>
                            <span style={{ color: '#cbd5e1' }}>•</span>
                            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                              Measured By: <strong style={{ color: '#0f172a' }}>{activeMeasurement.takenBy}</strong>
                            </div>
                          </>
                        )}
                      </div>

                      {/* 1. Alteration Garments Section */}
                      {isAlteration && alterationFields && (
                        <div style={{
                          backgroundColor: '#fffdf5',
                          borderRadius: '12px',
                          border: '1px solid #fde68a',
                          padding: '16px',
                          marginBottom: standardMeasurements.length > 0 ? '14px' : '0'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: '#92400e',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            marginBottom: '12px'
                          }}>
                            <Scissors size={15} />
                            <span>Alteration & Fitting Instructions</span>
                          </div>

                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '12px'
                          }}>
                            <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                                Current Garment Type
                              </span>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                                {alterationFields.currentGarmentType?.trim() || 'Not Available'}
                              </div>
                            </div>

                            <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                                Required Alteration
                              </span>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#b45309', marginTop: '2px' }}>
                                {alterationFields.requiredAlteration?.trim() || 'Not Available'}
                              </div>
                            </div>

                            <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                                Required Measurement
                              </span>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                                {alterationFields.requiredMeasurement?.trim() || 'Not Available'}
                              </div>
                            </div>

                            <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                                Alteration Instructions
                              </span>
                              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
                                {alterationFields.alterationInstructions?.trim() || 'Not Available'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. Standard Bespoke Garment Body Measurements Grid */}
                      {standardMeasurements.length > 0 ? (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
                          gap: '10px'
                        }}>
                          {standardMeasurements.map(([param, val]) => {
                            const label = formatMeasurementLabel(param);
                            const valStr = String(val ?? '').trim();
                            const unit = activeMeasurement.measurementUnit;

                            return (
                              <div key={param} style={{
                                backgroundColor: '#f8fafc',
                                padding: '12px 14px',
                                borderRadius: '10px',
                                border: '1px solid #e2e8f0'
                              }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                  {label}
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>
                                  {valStr ? (
                                    <>
                                      {valStr}{' '}
                                      {unit && (
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>
                                          {unit}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>
                                      Not Available
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : !isAlteration ? (
                        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.825rem' }}>
                          No specific numeric parameters recorded on this measurement entry.
                        </div>
                      ) : null}

                      {/* Fitting Instructions Note Box */}
                      {activeMeasurement.fittingInstructions && !isAlteration && (
                        <div style={{
                          marginTop: '12px',
                          padding: '10px 14px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.8rem',
                          color: '#475569'
                        }}>
                          <strong style={{ color: '#0f172a' }}>Fitting & Style Notes: </strong>
                          {activeMeasurement.fittingInstructions}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.825rem' }}>
                      No bespoke measurements recorded yet for this customer profile. Measurements will appear here when custom tailoring orders are placed.
                    </div>
                  )}
                </div>

                {/* 3. Tailoring Order & Fitting History Table */}
                <div
                  ref={ordersTableRef}
                  id="customer-orders-section"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '22px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ backgroundColor: '#eff6ff', padding: '6px', borderRadius: '8px', color: '#2563eb' }}>
                        <History size={18} />
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0a192f', margin: 0 }}>
                        Tailoring Order & Fitting History ({currentOrders.length})
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                      Complete client purchase & delivery ledger
                    </span>
                  </div>

                  {currentOrders.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.825rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                      No orders placed yet by this customer. Click <strong>Create New Order</strong> above to create the first order.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#64748b' }}>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Order Number</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Date</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Design / Garment</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Assigned Tailor</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Order Status</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Order Price</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Paid Amount</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right' }}>Balance</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'center' }}>Invoice</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentOrders.map((ord, idx) => {
                            const statusColors = STATUS_COLORS[ord.status] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
                            const total = Number(ord.totalAmount) || 0;
                            const balance = Number(ord.balanceAmount) || 0;
                            const paid = Math.max(0, total - balance);

                            return (
                              <tr
                                key={ord.id}
                                style={{
                                  borderBottom: idx === currentOrders.length - 1 ? 'none' : '1px solid #f1f5f9',
                                  backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                                }}
                              >
                                <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0f172a' }}>
                                  {ord.orderNumber || `ORD-${ord.id}`}
                                </td>
                                <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                  {new Date(ord.createdAt || ord.orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td style={{ padding: '12px 14px', fontWeight: 700, color: '#334155' }}>
                                  {ord.garmentDetails?.dressType || ord.garmentDetails?.specialDesignInstructions || 'Not Available'}
                                </td>
                                <td style={{ padding: '12px 14px', color: '#475569' }}>
                                  {ord.assignedTailor?.name ? (
                                    <span style={{ fontWeight: 600 }}>{ord.assignedTailor.name}</span>
                                  ) : (
                                    <span style={{ color: '#94a3b8' }}>Not Available</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '3px 9px',
                                    borderRadius: '999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    backgroundColor: statusColors.bg,
                                    color: statusColors.text,
                                    border: `1px solid ${statusColors.border}`,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {getStatusLabel(ord.status)}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                  {total > 0 ? `LKR ${total.toLocaleString()}` : 'Not Available'}
                                </td>
                                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                                  LKR {paid.toLocaleString()}
                                </td>
                                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800 }}>
                                  {total === 0 ? (
                                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, backgroundColor: '#f1f5f9', padding: '2px 7px', borderRadius: '4px' }}>
                                      Not Available
                                    </span>
                                  ) : balance <= 0 ? (
                                    <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 800, backgroundColor: '#dcfce7', padding: '2px 7px', borderRadius: '4px' }}>
                                      ✓ PAID
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 800, backgroundColor: '#fee2e2', padding: '2px 7px', borderRadius: '4px' }}>
                                      LKR {balance.toLocaleString()}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                  <button
                                    onClick={() => setSelectedInvoiceOrder({
                                      ...ord,
                                      customer: customerDetails || selectedCustomer
                                    })}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '4px 9px',
                                      backgroundColor: '#f0f9ff',
                                      border: '1px solid #bae6fd',
                                      borderRadius: '6px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      color: '#0369a1',
                                      cursor: 'pointer'
                                    }}
                                    title="View & Download Digital Invoice"
                                  >
                                    <FileText size={12} color="#0369a1" /> Invoice
                                  </button>
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
              <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                Select a customer from the directory on the left to view complete client history, body measurements, and order ledger.
              </div>
            )}

          </div>
        </div>
      )}

      {/* Update Customer Profile Photo Modal */}
      {isPhotoModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  Customer Profile Photo
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  {customerDetails?.name} • ID #{customerDetails?.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <ImageUploadCapture
              label="Select or Take Profile Photo"
              sublabel="Upload an existing photo or take a new photo with camera (Max 20 MB)"
              currentImageUrl={customerDetails?.profilePhoto ? getImageUrl(customerDetails.profilePhoto) : null}
              onFileSelected={(file) => processPhotoUpload(file)}
              isUploading={uploadingPhoto}
              cameraTitle="Take Customer Photo"
              onError={(err) => setUploadError(err)}
            />
          </div>
        </div>
      )}

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

      {/* Digital Invoice Preview Modal */}
      {selectedInvoiceOrder && (
        <DigitalInvoiceModal
          order={selectedInvoiceOrder}
          isOpen={Boolean(selectedInvoiceOrder)}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}

    </div>
  );
};
