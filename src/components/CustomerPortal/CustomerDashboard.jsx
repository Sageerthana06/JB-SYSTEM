import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../utils/router';
import { CustomerPortalLayout } from './CustomerPortalLayout';
import { API_URL } from '../../config/api';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  PlusCircle,
  User,
  ArrowRight,
  Sparkles,
  Scissors,
  ChevronRight
} from 'lucide-react';

export const CustomerDashboard = () => {
  const { user, getAuthHeaders } = useAuth();
  const { navigate } = useRouter();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/customer-portal/orders`, {
      headers: getAuthHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.orders) {
          setOrders(data.orders);
        }
      })
      .catch(err => console.error('Error fetching customer orders:', err))
      .finally(() => setLoading(false));
  }, [getAuthHeaders]);

  const totalOrders = orders.length;
  const readyOrders = orders.filter(o => o.status === 'READY' || o.status === 'DELIVERED').length;
  const activeOrders = orders.filter(o => o.status !== 'READY' && o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REJECTED').length;

  const getStatusBadge = (status) => {
    const styles = {
      'PENDING_APPROVAL': { bg: '#fef3c7', color: '#b45309', label: 'Order Submitted — Waiting for Approval' },
      'REJECTED': { bg: '#fee2e2', color: '#dc2626', label: 'Order Rejected' },
      'ORDER_CONFIRMED': { bg: '#e0f2fe', color: '#0369a1', label: 'Order Confirmed' },
      'PENDING': { bg: '#e0f2fe', color: '#0369a1', label: 'Order Confirmed' },
      'PENDING_PRODUCTION': { bg: '#fef3c7', color: '#b45309', label: 'In Production Queue' },
      'CUTTING': { bg: '#dbeafe', color: '#1d4ed8', label: 'Cutting' },
      'STITCHING': { bg: '#dbeafe', color: '#1d4ed8', label: 'Stitching' },
      'AARI_EMBROIDERY': { bg: '#fae8ff', color: '#86198f', label: 'Embroidery' },
      'EMBROIDERY_AARI': { bg: '#fae8ff', color: '#86198f', label: 'Embroidery' },
      'FITTING_ALTERATION': { bg: '#e0e7ff', color: '#3730a3', label: 'Fitting / Alteration' },
      'FINISHING': { bg: '#fef3c7', color: '#b45309', label: 'Finishing' },
      'QUALITY_CHECK': { bg: '#f1f5f9', color: '#334155', label: 'Quality Check' },
      'READY': { bg: '#dcfce7', color: '#15803d', label: 'Ready for Collection' },
      'DELIVERED': { bg: '#dcfce7', color: '#15803d', label: 'Delivered' },
      'ON_HOLD': { bg: '#fee2e2', color: '#b91c1c', label: 'On Hold' },
      'CANCELLED': { bg: '#f1f5f9', color: '#64748b', label: 'Cancelled' }
    }[status] || { bg: '#f1f5f9', color: '#334155', label: status };

    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '999px',
        backgroundColor: styles.bg,
        color: styles.color,
        fontSize: '0.75rem',
        fontWeight: 700,
        display: 'inline-block'
      }}>
        {styles.label}
      </span>
    );
  };

  return (
    <CustomerPortalLayout activePage="dashboard">
      {/* Welcome Banner */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '32px 28px',
        marginBottom: '28px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          right: '-20px',
          top: '-20px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 82, 204, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#0052cc',
            fontSize: '0.78rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '8px'
          }}>
            <Sparkles size={14} />
            <span>Customer Studio Dashboard</span>
          </div>

          <h1 style={{
            fontSize: '2rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: '0 0 8px 0',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '-0.02em'
          }}>
            Welcome, {user?.name || 'Valued Customer'}!
          </h1>
          <p style={{
            color: '#64748b',
            fontSize: '0.95rem',
            margin: 0,
            maxWidth: '540px'
          }}>
            Track your bespoke tailoring orders, view tailoring status, and place new custom design requests directly with Bella Design atelier.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/customer/new-order')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '13px 20px',
              borderRadius: '12px',
              backgroundColor: '#0052cc',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 82, 204, 0.3)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0042a8';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#0052cc';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <PlusCircle size={18} />
            <span>Create New Order</span>
          </button>

          <button
            onClick={() => navigate('/customer/profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '13px 18px',
              borderRadius: '12px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              fontSize: '0.9rem',
              fontWeight: 700,
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
            }}
          >
            <User size={18} />
            <span>Profile</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Total Orders, Active Orders, Ready Orders */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '28px'
      }}>
        {/* Total Orders Card */}
        <div
          onClick={() => navigate('/customer/orders')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 24px -4px rgba(0, 82, 204, 0.12)';
            e.currentTarget.style.borderColor = '#93c5fd';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.02)';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            backgroundColor: '#eff6ff',
            color: '#0052cc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShoppingBag size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Orders
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: '2px 0 0 0' }}>
              {loading ? '...' : totalOrders}
            </div>
          </div>
          <ChevronRight size={20} color="#94a3b8" />
        </div>

        {/* Active Orders Card */}
        <div
          onClick={() => navigate('/customer/orders')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 24px -4px rgba(217, 119, 6, 0.12)';
            e.currentTarget.style.borderColor = '#fde68a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.02)';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            backgroundColor: '#fffbeb',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Orders (In Production)
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: '2px 0 0 0' }}>
              {loading ? '...' : activeOrders}
            </div>
          </div>
          <ChevronRight size={20} color="#94a3b8" />
        </div>

        {/* Ready Orders Card */}
        <div
          onClick={() => navigate('/customer/orders')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 24px -4px rgba(16, 185, 129, 0.12)';
            e.currentTarget.style.borderColor = '#6ee7b7';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.02)';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            backgroundColor: '#ecfdf5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CheckCircle2 size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Ready Orders
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: '2px 0 0 0' }}>
              {loading ? '...' : readyOrders}
            </div>
          </div>
          <ChevronRight size={20} color="#94a3b8" />
        </div>
      </div>

      {/* Recent Orders Section */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '28px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
              My Orders
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
              Recent tailor-made garment orders submitted by you
            </p>
          </div>

          <button
            onClick={() => navigate('/customer/orders')}
            style={{
              background: 'none',
              border: 'none',
              color: '#0052cc',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>View All Orders</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
            Loading your orders...
          </div>
        ) : orders.length === 0 ? (
          <div style={{
            padding: '50px 20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '16px',
            border: '1.5px dashed #cbd5e1'
          }}>
            <Scissors size={38} color="#94a3b8" style={{ marginBottom: '12px' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
              No Orders Placed Yet
            </h3>
            <p style={{ margin: '0 0 18px 0', color: '#64748b', fontSize: '0.88rem' }}>
              Ready to create your dream dress? Submit your first tailoring order now!
            </p>
            <button
              onClick={() => navigate('/customer/new-order')}
              style={{
                padding: '11px 20px',
                borderRadius: '10px',
                backgroundColor: '#0052cc',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.88rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              + Create First Order
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #f1f5f9', color: '#64748b', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 14px' }}>Order Number</th>
                  <th style={{ padding: '12px 14px' }}>Dress Type</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 14px' }}>Quantity</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((order) => (
                  <tr
                    key={order.id}
                    style={{
                      borderBottom: '1px solid #f8fafc',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ padding: '14px', fontWeight: 800, color: '#0052cc', fontSize: '0.9rem' }}>
                      {order.orderNumber}
                    </td>
                    <td style={{ padding: '14px', fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                      {order.garmentDetails?.dressType || 'Custom Garment'}
                      {order.garmentDetails?.fabricType && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                          {order.garmentDetails.fabricType} • {order.garmentDetails.fabricColour || 'Standard'}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px', color: '#64748b', fontSize: '0.85rem' }}>
                      {new Date(order.orderDate).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                      {order.garmentDetails?.quantity || 1}
                    </td>
                    <td style={{ padding: '14px' }}>
                      {getStatusBadge(order.status)}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>
                      <button
                        onClick={() => navigate('/customer/orders')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                          color: '#0052cc',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CustomerPortalLayout>
  );
};
