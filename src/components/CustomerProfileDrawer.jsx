import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Phone,
  MessageCircle,
  MapPin,
  Building,
  Calendar,
  Scissors,
  User,
  FileText,
  AlertCircle,
  RefreshCw,
  Package
} from 'lucide-react';
import { API_URL, getImageUrl } from '../config/api';
import { getStatusColors, getStatusLabel } from '../utils/orderStatus';

export const CustomerProfileDrawer = ({
  customerId,
  isOpen,
  onClose,
  onOpenInvoice
}) => {
  const { user } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const roleUpper = (user?.role || '').toUpperCase();
  const isFullAccess = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(roleUpper);

  // Fetch real PostgreSQL customer profile and timeline
  const fetchCustomerProfile = async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('jb_token');
      const res = await fetch(`${API_URL}/api/customers/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success && data.customer) {
        // Ensure orders are strictly sorted latest first
        const sortedOrders = [...(data.customer.orders || [])].sort((a, b) => {
          const dateA = new Date(a.createdAt || a.orderDate || 0);
          const dateB = new Date(b.createdAt || b.orderDate || 0);
          return dateB - dateA;
        });
        setCustomer({
          ...data.customer,
          orders: sortedOrders
        });
      } else {
        setError(data.message || 'Customer profile not found.');
      }
    } catch (err) {
      console.error('Error fetching customer profile:', err);
      setError('Unable to connect to database. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomerProfile(customerId);
    } else if (!isOpen) {
      setCustomer(null);
      setError(null);
    }
  }, [isOpen, customerId]);

  if (!isOpen || !isFullAccess) return null;

  // Format clean date
  const formatDate = (isoString) => {
    if (!isoString) return 'Not Specified';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Not Specified';
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Not Specified';
    }
  };

  // WhatsApp click handler
  const getWhatsAppLink = (phone) => {
    if (!phone) return '#';
    const cleanNumber = phone.replace(/[^0-9]/g, '');
    const internationalNumber = cleanNumber.startsWith('0') ? '94' + cleanNumber.slice(1) : cleanNumber;
    return `https://wa.me/${internationalNumber}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(7, 15, 30, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 10000,
          transition: 'opacity 0.25s ease'
        }}
      />

      {/* Right-Side Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '620px',
          backgroundColor: 'var(--bg-card)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.28)',
          zIndex: 10001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'drawerSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <style>{`
          @keyframes drawerSlideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Drawer Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
            flexShrink: 0
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Customer 360 Profile
              </h2>
              <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>
                PostgreSQL Live
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              CEO Executive View • Client identity & chronological order timeline
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s'
            }}
            title="Close Drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            backgroundColor: 'var(--bg-main)'
          }}
        >
          {loading && (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--jb-blue-accent)', margin: '0 auto 14px auto' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Loading customer profile from database...
              </p>
            </div>
          )}

          {!loading && error && (
            <div style={{
              padding: '24px',
              backgroundColor: '#fee2e2',
              borderRadius: '12px',
              border: '1px solid #fecaca',
              textAlign: 'center'
            }}>
              <AlertCircle size={32} style={{ color: 'var(--jb-crimson)', margin: '0 auto 10px auto' }} />
              <h4 style={{ fontWeight: 800, color: '#991b1b', margin: '0 0 6px 0' }}>
                Failed to Load Customer Profile
              </h4>
              <p style={{ fontSize: '0.825rem', color: '#b91c1c', margin: '0 0 14px 0' }}>{error}</p>
              <button
                className="btn-secondary"
                onClick={() => fetchCustomerProfile(customerId)}
                style={{ fontSize: '0.775rem' }}
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}

          {!loading && !error && customer && (
            <>
              {/* ======================================================== */}
              {/* CUSTOMER IDENTITY SECTION                                */}
              {/* ======================================================== */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '20px',
                  marginBottom: '24px',
                  boxShadow: 'var(--shadow-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
                  {/* Photo / Avatar */}
                  {customer.profilePhoto ? (
                    <img
                      src={getImageUrl(customer.profilePhoto)}
                      alt={customer.name}
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid var(--border-color)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--jb-navy)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.6rem',
                        fontWeight: 900,
                        border: '3px solid var(--border-color)',
                        flexShrink: 0
                      }}
                    >
                      {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, textTransform: 'capitalize' }}>
                        {customer.name}
                      </h3>
                      <span className="badge badge-navy" style={{ fontSize: '0.72rem' }}>
                        ID: #CUST-{customer.id}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      {customer.email || 'No email registered'}
                    </p>

                    {customer.primaryPhone && (
                      <a
                        href={getWhatsAppLink(customer.primaryPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '8px',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          backgroundColor: '#25D366',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textDecoration: 'none'
                        }}
                      >
                        <MessageCircle size={14} /> WhatsApp Chat
                      </a>
                    )}
                  </div>
                </div>

                {/* Identity Information Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border-color)'
                  }}
                >
                  {/* WhatsApp / Primary Phone */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#ecfdf5', color: '#059669' }}>
                      <Phone size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>WhatsApp / Contact</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {customer.primaryPhone || 'Not Provided'}
                      </div>
                    </div>
                  </div>

                  {/* Alternative Contact */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'var(--bg-main)', color: 'var(--text-muted)' }}>
                      <Phone size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Alternative Contact</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: customer.alternativePhone ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {customer.alternativePhone || 'None Provided'}
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#eff6ff', color: 'var(--jb-blue-accent)' }}>
                      <MapPin size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Address</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: customer.address ? 'var(--text-main)' : 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {customer.address || 'Not Provided'}
                      </div>
                    </div>
                  </div>

                  {/* Branch */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                      <Building size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Branch</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {customer.branch || 'Bella Design Main Branch'}
                      </div>
                    </div>
                  </div>

                  {/* Customer Since */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#f3e8ff', color: '#7e22ce' }}>
                      <Calendar size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Customer Since</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {formatDate(customer.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Lifetime Orders Count */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                      <Package size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Orders</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {customer.orders?.length || 0} Orders Recorded
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* ORDER TIMELINE SECTION (Latest Order First)               */}
              {/* ======================================================== */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      Order Timeline
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      Chronological history • Latest order shown first
                    </p>
                  </div>
                  <span className="badge badge-navy" style={{ fontSize: '0.725rem' }}>
                    {customer.orders?.length || 0} Orders
                  </span>
                </div>

                {(!customer.orders || customer.orders.length === 0) ? (
                  <div
                    style={{
                      padding: '36px 20px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <Package size={32} style={{ margin: '0 auto 8px auto', opacity: 0.6 }} />
                    <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>
                      No orders found for this customer.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {customer.orders.map((order, idx) => {
                      const colors = getStatusColors(order.status);
                      const garment = order.garmentDetails || {};
                      const isFirst = idx === 0;

                      return (
                        <div
                          key={order.id}
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            border: isFirst ? '2px solid var(--jb-navy-light)' : '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '18px 20px',
                            boxShadow: isFirst ? '0 4px 14px rgba(11, 31, 58, 0.08)' : 'var(--shadow-card)',
                            position: 'relative'
                          }}
                        >
                          {/* Top Heading for Each Order */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '8px',
                              borderBottom: '1px solid var(--border-color)',
                              paddingBottom: '12px',
                              marginBottom: '14px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h5
                                style={{
                                  fontSize: '1rem',
                                  fontWeight: 800,
                                  color: 'var(--jb-navy-light)',
                                  margin: 0
                                }}
                              >
                                Order # {order.orderNumber || `ORD-2026-${String(order.id).padStart(4, '0')}`}
                              </h5>
                              {isFirst && (
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    backgroundColor: '#dbeafe',
                                    color: '#1d4ed8',
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    textTransform: 'uppercase'
                                  }}
                                >
                                  Latest Order
                                </span>
                              )}
                            </div>

                            {/* Production Status Badge */}
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '999px',
                                backgroundColor: colors.bg,
                                color: colors.text,
                                border: `1px solid ${colors.border}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: colors.text
                                }}
                              />
                              {getStatusLabel(order.status)}
                            </span>
                          </div>

                          {/* Order Details Grid */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                              gap: '12px',
                              marginBottom: '14px'
                            }}
                          >
                            {/* Booking Date */}
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                                Booking Date
                              </span>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                                {formatDate(order.orderDate || order.createdAt)}
                              </div>
                            </div>

                            {/* Dress Type */}
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                                Dress Type
                              </span>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Scissors size={13} style={{ color: 'var(--jb-crimson)' }} />
                                {garment.dressType || 'Bespoke Garment'}
                              </div>
                            </div>

                            {/* Quantity */}
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                                Quantity
                              </span>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                                {garment.quantity || 1} Unit{garment.quantity === 1 ? '' : 's'}
                              </div>
                            </div>

                            {/* Assigned Tailor */}
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                                Assigned Tailor
                              </span>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: order.assignedTailor ? 'var(--text-main)' : 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <User size={13} style={{ color: order.assignedTailor ? 'var(--jb-blue-accent)' : 'var(--text-muted)' }} />
                                {order.assignedTailor?.name || 'Not Assigned'}
                              </div>
                            </div>

                            {/* Delivery Date / Occasion */}
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                                Target Delivery / Event
                              </span>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                                {garment.occasion || 'Standard atelier queue'}
                              </div>
                            </div>

                            {/* Payment Status */}
                            <div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
                                Payment Status
                              </span>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '2px' }}>
                                <span
                                  style={{
                                    color: (order.paymentStatus || '').toLowerCase() === 'paid' ? '#16a34a' : '#d97706',
                                    fontWeight: 800
                                  }}
                                >
                                  {order.paymentStatus || 'Unpaid'}
                                </span>
                                {order.totalAmount > 0 && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                                    (LKR {order.totalAmount.toLocaleString()})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Design Reference Image Preview */}
                          {garment.designReferenceImage && (
                            <div
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--bg-main)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '14px'
                              }}
                            >
                              <img
                                src={getImageUrl(garment.designReferenceImage)}
                                alt="Design Reference"
                                onClick={() => setPreviewImage(getImageUrl(garment.designReferenceImage))}
                                style={{
                                  width: '44px',
                                  height: '44px',
                                  borderRadius: '6px',
                                  objectFit: 'cover',
                                  cursor: 'pointer',
                                  border: '1px solid var(--border-color)'
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                  Design Reference Attached
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  Click to enlarge bespoke garment sketch/photo
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setPreviewImage(getImageUrl(garment.designReferenceImage))}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.72rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: '#fff',
                                  cursor: 'pointer'
                                }}
                              >
                                View Design
                              </button>
                            </div>
                          )}

                          {/* Bottom Action Footer with Invoice Button */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingTop: '10px',
                              borderTop: '1px solid var(--border-color)',
                              flexWrap: 'wrap',
                              gap: '8px'
                            }}
                          >
                            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                              {order.branch?.name && <span>Branch: {order.branch.name} • </span>}
                              Balance: <strong>LKR {(order.balanceAmount || 0).toLocaleString()}</strong>
                            </div>

                            {/* View / Download Invoice Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenInvoice) {
                                  onOpenInvoice(order);
                                }
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--jb-navy)',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '0.775rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(11, 31, 58, 0.15)'
                              }}
                            >
                              <FileText size={14} /> View Invoice
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 10005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={previewImage}
              alt="Design Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                borderRadius: '8px',
                objectFit: 'contain'
              }}
            />
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
