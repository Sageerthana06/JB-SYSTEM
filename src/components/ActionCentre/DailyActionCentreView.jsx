import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import {
  Target,
  Search,
  Filter,
  RefreshCw,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calendar,
  MessageCircle,
  FileText,
  CreditCard,
  User,
  ArrowRight,
  Send,
  Building,
  Check,
  X,
  Phone,
  ChevronRight,
  TrendingUp,
  Tag,
  Scissors,
  Package,
  Layers,
  HelpCircle,
  AlertTriangle,
  UserCheck,
  ListTodo,
  CheckSquare,
  Square,
  Award,
  Activity,
  Eye,
  ShieldCheck,
  History
} from 'lucide-react';

// Shared modals and utilities
import { RecordPaymentModal } from '../RecordPaymentModal';
import { DigitalInvoiceModal } from '../DigitalInvoiceModal';
import { CustomerProfileDrawer } from '../CustomerProfileDrawer';
import { normalizePhoneNumber, normalizePhoneForWhatsApp } from '../../utils/phoneUtils';
import { formatCurrencyLKR } from '../../utils/paymentCalculations';
import { getStatusLabel, getStatusColors } from '../../utils/orderStatus';

export const DailyActionCentreView = () => {
  const { user, activeBranch, setActiveBranch, getAuthHeaders } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  const isCeo = ['SUPER_ADMIN', 'CEO'].includes(userRole);
  const canSwitchBranch = isCeo;
  const effectiveBranch = (!isCeo && user?.branchId) ? String(user.branchId) : activeBranch;

  // Active Queue Tab: 'all', 'overdue', 'productionDelays', 'unassigned', 'pricePending', 'quotation', 'collection', 'delivery', 'checklist'
  const [activeQueueTab, setActiveQueueTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL'); // 'ALL', 'CRITICAL', 'HIGH'

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionData, setActionData] = useState({
    businessDate: '',
    timezone: 'Asia/Colombo',
    summary: {
      totalQueueItems: 0,
      uniqueOrdersCount: 0,
      overdueCount: 0,
      productionDelaysCount: 0,
      unassignedCount: 0,
      pricePendingCount: 0,
      quotationsCount: 0,
      collectionsCount: 0,
      deliveriesCount: 0,
      totalOutstandingBalance: 0,
      overdueDeliveriesCount: 0,
      dueTodayDeliveriesCount: 0,
      readyForDeliveryCount: 0,
      todayOrdersSummary: {
        ordersCreatedToday: 0,
        todayOrderValue: 0,
        todayPaymentsReceived: 0,
        todayOutstandingBalance: 0,
        priceAcceptedCount: 0,
        pricePendingCount: 0,
        todayUnassignedTasksCount: 0,
        allOutstandingCollections: 0
      }
    },
    todayOrdersSummary: {
      ordersCreatedToday: 0,
      todayOrderValue: 0,
      todayPaymentsReceived: 0,
      todayOutstandingBalance: 0,
      priceAcceptedCount: 0,
      pricePendingCount: 0,
      todayUnassignedTasksCount: 0,
      allOutstandingCollections: 0
    },
    checklist: {},
    endOfDaySummary: {},
    filterOptions: { responsiblePersons: [], availableTailors: [] },
    overdueQueue: [],
    productionDelayQueue: [],
    unassignedQueue: [],
    pricePendingQueue: [],
    quotationQueue: [],
    collectionQueue: [],
    deliveryQueue: []
  });

  // Checklist interactive completed state (persisted in PostgreSQL)
  const [checklistSubmittingId, setChecklistSubmittingId] = useState(null);

  // CEO Monitoring states
  const [ceoMonitoringData, setCeoMonitoringData] = useState(null);
  const [ceoMonitoringLoading, setCeoMonitoringLoading] = useState(false);
  const [ceoSelectedBranch, setCeoSelectedBranch] = useState('ALL');
  const [ceoSelectedManager, setCeoSelectedManager] = useState('');
  const [ceoSelectedDate, setCeoSelectedDate] = useState('');
  const [ceoSelectedStatus, setCeoSelectedStatus] = useState('ALL'); // 'ALL', 'COMPLETED', 'PENDING'
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Reused Modal States
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState(null);
  const [selectedCustomerIdForDrawer, setSelectedCustomerIdForDrawer] = useState(null);
  const [viewingOrderDetails, setViewingOrderDetails] = useState(null);

  // Quick Assign Modal
  const [assignModalData, setAssignModalData] = useState(null); // { item, selectedTailorId, notes, submitting, error }

  // Action Centre Specific Modals
  const [whatsAppModalData, setWhatsAppModalData] = useState(null); // { item, phone, message, title, type }
  const [followUpModalData, setFollowUpModalData] = useState(null); // { item, queueType }
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);

  // Fetch Action Centre Data from Backend
  const fetchActionCentre = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const params = new URLSearchParams();
      if (effectiveBranch && effectiveBranch !== 'ALL') {
        params.set('branchId', effectiveBranch);
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      if (selectedStaffFilter) {
        params.set('responsiblePersonId', selectedStaffFilter);
      }
      params.set('queue', 'all');

      const headers = getAuthHeaders ? getAuthHeaders() : {
        'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
      };

      const res = await fetch(`${API_URL}/api/action-centre?${params.toString()}`, { headers });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to fetch Daily Action Centre (HTTP ${res.status})`);
      }

      setActionData(json);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error('Error fetching Daily Action Centre:', err);
      setError(err.message || 'Unable to load Daily Action Centre. Please retry.');
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveBranch, searchQuery, selectedStaffFilter, getAuthHeaders]);

  // Fetch CEO Monitoring Data across branches
  const fetchCeoMonitoring = useCallback(async (isSilent = false) => {
    if (!isCeo) return;
    try {
      if (!isSilent) setCeoMonitoringLoading(true);
      const params = new URLSearchParams();
      if (ceoSelectedBranch && ceoSelectedBranch !== 'ALL') params.set('branchId', ceoSelectedBranch);
      if (ceoSelectedManager) params.set('managerId', ceoSelectedManager);
      if (ceoSelectedDate) params.set('date', ceoSelectedDate);
      if (ceoSelectedStatus && ceoSelectedStatus !== 'ALL') params.set('status', ceoSelectedStatus);

      const headers = getAuthHeaders ? getAuthHeaders() : {
        'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
      };

      const res = await fetch(`${API_URL}/api/action-centre/checklist/monitoring?${params.toString()}`, { headers });
      const json = await res.json();
      if (res.ok && json.success) {
        setCeoMonitoringData(json);
      }
      setCeoMonitoringLoading(false);
    } catch (err) {
      console.error('Failed to load CEO checklist monitoring:', err);
      setCeoMonitoringLoading(false);
    }
  }, [isCeo, ceoSelectedBranch, ceoSelectedManager, ceoSelectedDate, ceoSelectedStatus, getAuthHeaders]);

  useEffect(() => {
    fetchActionCentre();
  }, [fetchActionCentre]);

  useEffect(() => {
    if (isCeo) {
      fetchCeoMonitoring();
    }
  }, [isCeo, fetchCeoMonitoring]);

  // Complete or toggle checklist item in PostgreSQL immediately (Managers only; CEO is Read-Only)
  const handleToggleChecklistItem = async (checklistItemId, currentStatus) => {
    if (isCeo) {
      alert('CEO has read-only access to Manager Daily Checklists and cannot modify completion status.');
      return;
    }
    try {
      const newStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      setChecklistSubmittingId(checklistItemId);

      const headers = getAuthHeaders ? getAuthHeaders() : {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
      };

      const res = await fetch(`${API_URL}/api/action-centre/checklist/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          checklistItemId,
          status: newStatus,
          businessDate: actionData.businessDate
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to update checklist item in PostgreSQL.');
      }

      // Optimistically update actionData.checklist & progress
      setActionData(prev => {
        const currentItem = prev.checklist?.[checklistItemId] || {};
        const updatedItem = {
          ...currentItem,
          status: newStatus,
          isCompleted: newStatus === 'COMPLETED',
          completedBy: newStatus === 'COMPLETED' ? (user?.name || user?.email) : null,
          completedAt: newStatus === 'COMPLETED' ? new Date().toISOString() : null,
          completedAtFormatted: json.record?.completedAtFormatted || (newStatus === 'COMPLETED' ? 'Just now' : null)
        };

        const updatedChecklist = {
          ...prev.checklist,
          [checklistItemId]: updatedItem
        };

        const completedCount = Object.values(updatedChecklist).filter(i => i.status === 'COMPLETED').length;

        return {
          ...prev,
          checklist: updatedChecklist,
          checklistProgress: {
            completed: completedCount,
            total: 6,
            percentage: Math.round((completedCount / 6) * 100),
            label: `${completedCount}/6 Completed`
          }
        };
      });

      setChecklistSubmittingId(null);
      if (isCeo) {
        fetchCeoMonitoring(true);
      }
    } catch (err) {
      alert(`Error saving checklist item: ${err.message}`);
      setChecklistSubmittingId(null);
    }
  };

  // Handle saving follow-up notes/schedule
  const handleSaveFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpModalData) return;

    try {
      setFollowUpSubmitting(true);
      const { item, queueType, followUpDate, responsiblePersonId, nextAction, outcome, status, notes } = followUpModalData;

      const headers = getAuthHeaders ? getAuthHeaders() : {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
      };

      const res = await fetch(`${API_URL}/api/action-centre/follow-ups`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId: item.orderId,
          queueType,
          followUpDate,
          responsiblePersonId,
          nextAction,
          outcome,
          status,
          notes
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to record follow-up.');
      }

      setFollowUpModalData(null);
      setFollowUpSubmitting(false);
      fetchActionCentre(true);
    } catch (err) {
      alert(`Error saving follow-up: ${err.message}`);
      setFollowUpSubmitting(false);
    }
  };

  // Handle Quick Assign Tailor/Task
  const handleQuickAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignModalData || !assignModalData.selectedTailorId) {
      alert('Please select a craftsman to assign.');
      return;
    }

    try {
      setAssignModalData(prev => ({ ...prev, submitting: true, error: null }));

      const { item, selectedTailorId, notes } = assignModalData;
      const headers = getAuthHeaders ? getAuthHeaders() : {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jb_token')}`
      };

      let res;
      if (item.taskId) {
        // Reassign or assign specific task
        res = await fetch(`${API_URL}/api/orders/tasks/${item.taskId}/reassign`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            tailorId: parseInt(selectedTailorId, 10),
            reason: notes || 'Assigned via Daily Action Centre'
          })
        });
      } else {
        // Assign primary tailor to order
        res = await fetch(`${API_URL}/api/orders/${item.orderId}/assign-tailor`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            tailorId: parseInt(selectedTailorId, 10)
          })
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to assign tailor.');
      }

      setAssignModalData(null);
      fetchActionCentre(true);
    } catch (err) {
      setAssignModalData(prev => ({ ...prev, submitting: false, error: err.message }));
    }
  };

  // Helper to open WhatsApp modal prefilled
  const openWhatsAppDialog = (item, type) => {
    const rawPhone = item.customerPhone || '';
    const cleanPhone = normalizePhoneForWhatsApp(rawPhone);
    const brandTitle = item.branchId === 2 ? 'BELLA DESIGN' : 'JB GROUP (PVT) LTD';
    const brandShort = item.branchId === 2 ? 'BELLA DESIGN' : 'JB GROUP';
    const customerGreeting = item.customerName ? `Dear ${item.customerName},` : 'Dear Customer,';

    let defaultMessage = '';
    let title = '';

    if (type === 'OVERDUE') {
      title = 'Overdue Order Expedited Update WhatsApp';
      defaultMessage = `✨ ${brandTitle} ✨

${customerGreeting} 🌸

We are reaching out regarding your bespoke order with ${brandShort}.

📋 ORDER STATUS UPDATE
🔖 Order No: ${item.orderNumber}
👗 Item: ${item.itemName} × ${item.quantity || 1}
📅 Promised Date: ${item.promisedDate}

Our craftsmanship team is currently expediting completion of your garment with top priority. We will notify you the moment your garment is ready for collection or delivery.

Thank you for your valued patience and trust in ${brandShort}!
🏢 ${brandTitle}`;
    } else if (type === 'PRICE_PENDING') {
      title = 'Price Confirmation Follow-up WhatsApp';
      defaultMessage = `✨ ${brandTitle} ✨

${customerGreeting} 🌸

Thank you for visiting ${brandShort}! 💐

📋 QUOTATION & PRICING CONFIRMATION
🔖 Order No: ${item.orderNumber}
👗 Item: ${item.itemName} × ${item.quantity || 1}
${item.totalAmount > 0 ? `💰 Total Quotation: LKR ${formatCurrencyLKR(item.totalAmount)}` : `📋 Pricing Status: Under Custom Design Review`}

Kindly let us know if you confirm this quotation so our master craftsmen can begin work on your garment immediately.

Thank you!
🏢 ${brandTitle}`;
    } else if (type === 'PRODUCTION_DELAY') {
      title = 'Production Progress Update WhatsApp';
      defaultMessage = `✨ ${brandTitle} ✨

${customerGreeting} 🌸

An update on your bespoke tailoring order with ${brandShort}:

🔖 Order No: ${item.orderNumber}
👗 Item: ${item.itemName} × ${item.quantity || 1}
🧵 Current Stage: ${item.currentStage || 'Production'}

Our master craftsmen are dedicating detailed care to your outfit. We will update you as soon as the next stage is completed.

Thank you!
🏢 ${brandTitle}`;
    } else if (type === 'QUOTATION') {
      title = 'Quotation Follow-up WhatsApp';
      defaultMessage = `✨ ${brandTitle} ✨

${customerGreeting} 🌸

Thank you for contacting ${brandShort}! 💐

📋 QUOTATION FOLLOW-UP
🔖 Order No: ${item.orderNumber}
👗 Item: ${item.itemName} × ${item.quantity || 1}
💰 Total Amount: LKR ${formatCurrencyLKR(item.totalAmount)}

Kindly let us know if you would like to proceed with your order or if you require any adjustments to your quotation. We are happy to assist you!

🏢 ${brandTitle}
✨ Build • Lead • Inspire.`;
    } else if (type === 'COLLECTION') {
      title = 'Payment & Collection Reminder WhatsApp';
      const statusNote = item.isReady
        ? `🎉 Great news! Your custom tailored garment is READY FOR COLLECTION.`
        : `Kindly note your order payment details below:`;

      defaultMessage = `✨ ${brandTitle} ✨

${customerGreeting} 🌸

${statusNote}

📋 ORDER PAYMENT SUMMARY
🔖 Order No: ${item.orderNumber}
👗 Item: ${item.itemName} × ${item.quantity || 1}
💰 Net Payable: LKR ${formatCurrencyLKR(item.totalAmount)}
💵 Amount Paid: LKR ${formatCurrencyLKR(item.amountPaid)}
💳 Balance Due: LKR ${formatCurrencyLKR(item.balanceDue)}

Please settle the outstanding balance of LKR ${formatCurrencyLKR(item.balanceDue)} at your earliest convenience or upon collecting your garment.

Thank you for choosing ${brandShort}! 🌸
🏢 ${brandTitle}`;
    } else {
      title = 'Delivery Follow-up WhatsApp';
      const urgencyNote = item.isReady
        ? `🎉 Your bespoke outfit is finished and ready for pickup at our studio!`
        : `Your order is currently scheduled for delivery on ${item.promisedDate}.`;

      defaultMessage = `✨ ${brandTitle} ✨

${customerGreeting} 🌸

${urgencyNote}

🔖 Order No: ${item.orderNumber}
👗 Item: ${item.itemName} × ${item.quantity || 1}
📅 Promised Date: ${item.promisedDate}

Thank you for choosing ${brandShort}!
🏢 ${brandTitle}`;
    }

    setWhatsAppModalData({
      item,
      rawPhone,
      cleanPhone,
      title,
      type,
      message: defaultMessage
    });
  };

  // Launch WhatsApp with prefilled message
  const handleLaunchWhatsApp = () => {
    if (!whatsAppModalData) return;
    const targetPhone = whatsAppModalData.cleanPhone;
    if (!targetPhone) {
      alert('Customer does not have a valid phone number recorded.');
      return;
    }
    const url = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(whatsAppModalData.message)}`;
    window.open(url, '_blank');
    setWhatsAppModalData(null);
  };

  const summary = actionData.summary || {};
  const todaySummary = actionData.todayOrdersSummary || actionData.summary?.todayOrdersSummary || {};
  const overdueOrders = actionData.overdueQueue || [];
  const productionDelays = actionData.productionDelayQueue || [];
  const unassignedTasks = actionData.unassignedQueue || [];
  const pricePendingOrders = actionData.pricePendingQueue || [];
  const quotations = actionData.quotationQueue || [];
  const collections = actionData.collectionQueue || [];
  const deliveries = actionData.deliveryQueue || [];
  const checklistData = actionData.checklist || {};
  const endOfDaySummary = actionData.endOfDaySummary || {};
  const availableTailors = actionData.filterOptions?.availableTailors || [];

  // Priority filter function
  const applyPriorityFilter = (list) => {
    if (priorityFilter === 'CRITICAL') return list.filter(i => i.priority === 'CRITICAL');
    if (priorityFilter === 'HIGH') return list.filter(i => i.priority === 'CRITICAL' || i.priority === 'HIGH');
    return list;
  };

  const filteredOverdue = applyPriorityFilter(overdueOrders);
  const filteredDelays = applyPriorityFilter(productionDelays);
  const filteredUnassigned = applyPriorityFilter(unassignedTasks);
  const filteredPricePending = applyPriorityFilter(pricePendingOrders);
  const filteredQuotations = applyPriorityFilter(quotations);
  const filteredCollections = applyPriorityFilter(collections);
  const filteredDeliveries = applyPriorityFilter(deliveries);

  // Helper badge for priority
  const renderPriorityBadge = (priority) => {
    if (priority === 'CRITICAL') {
      return (
        <span style={{
          backgroundColor: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #fecaca',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <AlertCircle size={11} /> Critical
        </span>
      );
    }
    if (priority === 'HIGH') {
      return (
        <span style={{
          backgroundColor: '#fffbeb',
          color: '#b45309',
          border: '1px solid #fde68a',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <AlertTriangle size={11} /> High
        </span>
      );
    }
    return (
      <span style={{
        backgroundColor: '#f1f5f9',
        color: '#475569',
        border: '1px solid #cbd5e1',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.72rem',
        fontWeight: 700
      }}>
        Normal
      </span>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', color: 'var(--text-main)' }}>
      {/* 1. TOP HEADER & BUSINESS DATE BAR */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#002b66',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Target size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--jb-navy)' }}>
                  Daily Action Centre
                </h1>
                <span style={{
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 900
                }}>
                  {effectiveBranch === '2' ? 'BELLA DESIGN' : 'JB GROUP (PVT) LTD'}
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Operational command centre: Overdue orders, production bottlenecks, unassigned work, price approvals & manager checklist.
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Branch filter (CEO) & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            backgroundColor: '#eff6ff',
            color: '#1e40af',
            border: '1px solid #bfdbfe',
            fontSize: '0.82rem',
            fontWeight: 800
          }}>
            <Calendar size={14} />
            <span>Today: {actionData.businessDate || 'Live'} (Asia/Colombo)</span>
          </div>

          {canSwitchBranch && (
            <select
              value={effectiveBranch}
              onChange={(e) => setActiveBranch(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 700
              }}
            >
              <option value="ALL">All Branches Combined</option>
              <option value="1">JB Group (Main Branch)</option>
              <option value="2">Bella Design</option>
            </select>
          )}

          <button
            onClick={() => fetchActionCentre(true)}
            disabled={refreshing}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. TODAY'S ORDERS SUMMARY (SEPARATE SECTION - ASIA/COLOMBO) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        {/* Section Header */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#e0f2fe',
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main)' }}>
                  Today's Orders Summary
                </h2>
                <span style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 800
                }}>
                  Asia/Colombo
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Orders created today with live verified payment balances. Historical collection pipeline is strictly separate.
              </p>
            </div>
          </div>

          {/* Today's Order Count Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '0.82rem',
            fontWeight: 800
          }}>
            <CheckCircle2 size={15} />
            <span>{todaySummary.ordersCreatedToday || 0} Orders Created Today</span>
          </div>
        </div>

        {/* 4 Main Required Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '16px'
        }}>
          {/* Card 1: Today's Order Value */}
          <div style={{
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Today's Order Value
              </span>
              <DollarSign size={16} color="#002b66" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--jb-navy)' }}>
              LKR {formatCurrencyLKR(todaySummary.todayOrderValue || 0)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
              Total value of {todaySummary.ordersCreatedToday || 0} orders created today
            </div>
          </div>

          {/* Card 2: Today's Payments Received */}
          <div style={{
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Today's Payments Received
              </span>
              <CreditCard size={16} color="#16a34a" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#16a34a' }}>
              LKR {formatCurrencyLKR(todaySummary.todayPaymentsReceived || 0)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '4px', fontWeight: 600 }}>
              Verified payments on today's orders
            </div>
          </div>

          {/* Card 3: Today's Outstanding Balance */}
          <div style={{
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Today's Outstanding Balance
              </span>
              <AlertCircle size={16} color="#2563eb" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#2563eb' }}>
              LKR {formatCurrencyLKR(todaySummary.todayOutstandingBalance || 0)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
              Centralized calculation on confirmed orders
            </div>
          </div>

          {/* Card 4: All Outstanding Collections */}
          <div
            onClick={() => setActiveQueueTab('collection')}
            style={{
              backgroundColor: '#fff7ed',
              border: '1.5px solid #fed7aa',
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase' }}>
                All Outstanding Collections
              </span>
              <DollarSign size={16} color="#ea580c" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#c2410c' }}>
              LKR {formatCurrencyLKR(todaySummary.allOutstandingCollections ?? summary.totalOutstandingBalance ?? 0)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9a3412', marginTop: '4px', fontWeight: 700 }}>
              Historical confirmed collection queue ({summary.collectionsCount || 0} orders)
            </div>
          </div>
        </div>

        {/* Breakdown Ribbon: Price Status & Unassigned Tasks */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          backgroundColor: 'var(--bg-main)',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          fontSize: '0.8rem'
        }}>
          <span style={{ fontWeight: 800, color: 'var(--text-muted)', marginRight: '4px' }}>
            Today's Breakdown:
          </span>

          {/* Price Accepted Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
            fontWeight: 800
          }}>
            <CheckCircle2 size={13} />
            <span>Price Accepted: {todaySummary.priceAcceptedCount || 0}</span>
          </div>

          {/* Price Pending Pill */}
          <button
            onClick={() => setActiveQueueTab('pricePending')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '9999px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              fontWeight: 800,
              cursor: 'pointer'
            }}
            title="Click to view Price Pending queue"
          >
            <Tag size={13} />
            <span>Price Pending: {todaySummary.pricePendingCount || 0}</span>
          </button>

          {/* Today's Unassigned Tasks Pill */}
          <button
            onClick={() => setActiveQueueTab('unassigned')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '9999px',
              backgroundColor: '#faf5ff',
              border: '1px solid #e9d5ff',
              color: '#7e22ce',
              fontWeight: 800,
              cursor: 'pointer'
            }}
            title="Click to view Unassigned Tasks queue"
          >
            <Scissors size={13} />
            <span>Today's Unassigned Tasks: {todaySummary.todayUnassignedTasksCount || 0}</span>
          </button>
        </div>
      </div>

      {/* 3. STATS & QUEUE SUMMARY CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        {/* Total Queue Items & Unique Orders */}
        <div
          onClick={() => setActiveQueueTab('all')}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: `2px solid ${activeQueueTab === 'all' ? '#002b66' : 'var(--border-color)'}`,
            borderRadius: '14px',
            padding: '14px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Action Queue Volume
            </span>
            <Layers size={16} color="#002b66" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--jb-navy)' }}>
            {summary.totalQueueItems || 0} Items
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>
            Across <strong>{summary.uniqueOrdersCount || 0}</strong> Unique Orders
          </div>
        </div>

        {/* Overdue Orders (Feature A) */}
        <div
          onClick={() => setActiveQueueTab('overdue')}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: `2px solid ${activeQueueTab === 'overdue' ? '#dc2626' : 'var(--border-color)'}`,
            borderRadius: '14px',
            padding: '14px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Overdue Orders
            </span>
            <Clock size={16} color="#dc2626" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#dc2626' }}>
            {summary.overdueCount || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, marginTop: '4px' }}>
            Promised date exceeded
          </div>
        </div>

        {/* Unassigned Tasks (Feature C) */}
        <div
          onClick={() => setActiveQueueTab('unassigned')}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: `2px solid ${activeQueueTab === 'unassigned' ? '#9333ea' : 'var(--border-color)'}`,
            borderRadius: '14px',
            padding: '14px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Unassigned Tasks
            </span>
            <Scissors size={16} color="#9333ea" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#9333ea' }}>
            {summary.unassignedCount || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9333ea', fontWeight: 700, marginTop: '4px' }}>
            Pending craftsman assignment
          </div>
        </div>

        {/* Price Pending (Feature D) */}
        <div
          onClick={() => setActiveQueueTab('pricePending')}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: `2px solid ${activeQueueTab === 'pricePending' ? '#2563eb' : 'var(--border-color)'}`,
            borderRadius: '14px',
            padding: '14px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Price Pending
            </span>
            <Tag size={16} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#2563eb' }}>
            {summary.pricePendingCount || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700, marginTop: '4px' }}>
            Awaiting price confirmation
          </div>
        </div>

        {/* Outstanding Collections (Preserved) */}
        <div
          onClick={() => setActiveQueueTab('collection')}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: `2px solid ${activeQueueTab === 'collection' ? '#ea580c' : 'var(--border-color)'}`,
            borderRadius: '14px',
            padding: '14px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              All Outstanding Collections
            </span>
            <DollarSign size={16} color="#ea580c" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ea580c' }}>
            LKR {formatCurrencyLKR(summary.totalOutstandingBalance || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 700, marginTop: '4px' }}>
            {summary.collectionsCount || 0} Confirmed Orders with Balance Due
          </div>
        </div>

        {/* Deliveries & Dispatches (Preserved) */}
        <div
          onClick={() => setActiveQueueTab('delivery')}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: `2px solid ${activeQueueTab === 'delivery' ? '#16a34a' : 'var(--border-color)'}`,
            borderRadius: '14px',
            padding: '14px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Delivery Follow-up
            </span>
            <Package size={16} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16a34a' }}>
            {summary.readyForDeliveryCount || 0} Ready
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, marginTop: '4px' }}>
            {summary.deliveriesCount || 0} Total in Delivery Pipeline
          </div>
        </div>
      </div>

      {/* 3. CONTROLS, QUEUE SWITCHER & PRIORITY BAR */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
      }}>
        {/* Queue Switcher Buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Queues', count: summary.totalQueueItems || 0 },
            { id: 'overdue', label: 'Overdue Orders', count: overdueOrders.length, color: '#dc2626' },
            { id: 'productionDelays', label: 'Production Delays', count: productionDelays.length, color: '#d97706' },
            { id: 'unassigned', label: 'Unassigned Tasks', count: unassignedTasks.length, color: '#9333ea' },
            { id: 'pricePending', label: 'Price Pending', count: pricePendingOrders.length, color: '#2563eb' },
            { id: 'quotation', label: 'Quotation Follow-up', count: quotations.length, color: '#0284c7' },
            { id: 'collection', label: 'Collection Follow-up', count: collections.length, color: '#ea580c' },
            { id: 'delivery', label: 'Delivery Follow-up', count: deliveries.length, color: '#16a34a' },
            { id: 'checklist', label: "Today's Checklist & EOD", count: actionData.checklistProgress?.label || `${Object.values(actionData.checklist || {}).filter(i => i.status === 'COMPLETED').length}/6`, color: '#002b66' },
            ...(isCeo ? [{ id: 'ceoMonitoring', label: 'CEO Checklist Monitoring', count: `${ceoMonitoringData?.summary?.totalCompleted || 0}/${ceoMonitoringData?.summary?.totalItems || 18}`, color: '#4338ca' }] : [])
          ].map(tab => {
            const isSelected = activeQueueTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveQueueTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  border: isSelected ? '1.5px solid #002b66' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? '#002b66' : 'var(--bg-main)',
                  color: isSelected ? '#ffffff' : 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  color: isSelected ? '#ffffff' : '#0f172a',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: 900
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Priority Filter and Search Box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Priority filter buttons */}
          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setPriorityFilter('ALL')}
              style={{
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: priorityFilter === 'ALL' ? '#002b66' : 'var(--bg-main)',
                color: priorityFilter === 'ALL' ? '#ffffff' : 'var(--text-main)'
              }}
            >
              All Priorities
            </button>
            <button
              onClick={() => setPriorityFilter('CRITICAL')}
              style={{
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: priorityFilter === 'CRITICAL' ? '#dc2626' : 'var(--bg-main)',
                color: priorityFilter === 'CRITICAL' ? '#ffffff' : '#991b1b'
              }}
            >
              Critical
            </button>
            <button
              onClick={() => setPriorityFilter('HIGH')}
              style={{
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: priorityFilter === 'HIGH' ? '#ea580c' : 'var(--bg-main)',
                color: priorityFilter === 'HIGH' ? '#ffffff' : '#c2410c'
              }}
            >
              High & Above
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search customer, order, phone, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '7px 12px 7px 30px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                width: '230px'
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. ERROR NOTICE */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '20px',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={20} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{error}</span>
          <button
            onClick={() => fetchActionCentre()}
            style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: '6px', backgroundColor: '#991b1b', color: '#ffffff', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 5. LOADING SKELETON */}
      {loading ? (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '60px 20px',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#002b66' }} />
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
            Loading Live Daily Action Centre from Database...
          </div>
          <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
            Auditing overdue orders, craftsman queues, price pending items & manager checklist.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

          {/* ======================================================== */}
          {/* CEO MONITORING: ALL BRANCHES MANAGER CHECKLIST           */}
          {/* ======================================================== */}
          {activeQueueTab === 'ceoMonitoring' && isCeo && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              marginBottom: '30px'
            }}>
              {/* Header */}
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#002b66',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ShieldCheck size={24} color="#38bdf8" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#ffffff' }}>
                        Manager Daily Checklist Monitoring
                      </h2>
                      <span style={{
                        backgroundColor: '#38bdf8',
                        color: '#002b66',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        padding: '2px 8px',
                        borderRadius: '9999px'
                      }}>
                        CEO Executive View
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                      All branches & managers • Real-time completion progress & audit trail (Asia/Colombo)
                    </span>
                  </div>
                </div>

                {/* Refresh */}
                <button
                  onClick={() => fetchCeoMonitoring()}
                  disabled={ceoMonitoringLoading}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: '#ffffff',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={14} className={ceoMonitoringLoading ? 'animate-spin' : ''} />
                  <span>Refresh Monitoring</span>
                </button>
              </div>

              {/* CEO Filter Toolbar */}
              <div style={{
                padding: '16px 24px',
                backgroundColor: 'var(--bg-main)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '14px',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                  {/* Branch Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Branch:</span>
                    <select
                      value={ceoSelectedBranch}
                      onChange={(e) => setCeoSelectedBranch(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '0.8rem',
                        fontWeight: 700
                      }}
                    >
                      <option value="ALL">All Branches</option>
                      <option value="1">JB Group (Main)</option>
                      <option value="2">Bella Design</option>
                    </select>
                  </div>

                  {/* Date Filter (Historical) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Date:</span>
                    <select
                      value={ceoSelectedDate || (ceoMonitoringData?.colomboToday || '')}
                      onChange={(e) => setCeoSelectedDate(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '0.8rem',
                        fontWeight: 700
                      }}
                    >
                      {(ceoMonitoringData?.historicalDates || []).map(d => (
                        <option key={d} value={d}>
                          {d === ceoMonitoringData?.colomboToday ? `Today (${d})` : d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Status:</span>
                    <select
                      value={ceoSelectedStatus}
                      onChange={(e) => setCeoSelectedStatus(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '0.8rem',
                        fontWeight: 700
                      }}
                    >
                      <option value="ALL">All Items</option>
                      <option value="COMPLETED">Completed Only</option>
                      <option value="PENDING">Pending Only</option>
                    </select>
                  </div>
                </div>

                {/* Audit Log Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAuditLogs(!showAuditLogs)}
                  style={{
                    backgroundColor: showAuditLogs ? '#002b66' : 'transparent',
                    color: showAuditLogs ? '#ffffff' : '#002b66',
                    border: '1px solid #002b66',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <History size={14} />
                  <span>{showAuditLogs ? 'Hide Audit Log' : 'View Audit Log'}</span>
                </button>
              </div>

              {/* CEO Content Body */}
              <div style={{ padding: '24px' }}>
                {ceoMonitoringLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#002b66' }} />
                    <div style={{ fontWeight: 800 }}>Loading All Branch Checklist Monitoring...</div>
                  </div>
                ) : (
                  <>
                    {/* Summary KPI Cards */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '12px',
                      marginBottom: '24px'
                    }}>
                      <div style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Monitored Branches</span>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--jb-navy)', marginTop: '2px' }}>
                          {ceoMonitoringData?.summary?.totalBranches || 0} Branches
                        </div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Monitored Managers</span>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
                          {ceoMonitoringData?.summary?.totalManagers || 0} Managers
                        </div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Checklist Completion</span>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>
                          {ceoMonitoringData?.summary?.totalCompleted || 0} / {ceoMonitoringData?.summary?.totalItems || 0} ({ceoMonitoringData?.summary?.overallPercentage || 0}%)
                        </div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Pending Items</span>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ea580c', marginTop: '2px' }}>
                          {ceoMonitoringData?.summary?.totalPending || 0} Items Pending
                        </div>
                      </div>
                    </div>

                    {/* Audit Logs Panel */}
                    {showAuditLogs && (
                      <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        marginBottom: '24px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <History size={16} color="#002b66" />
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: '#002b66' }}>
                            Checklist Audit Trail History (Business Date: {ceoMonitoringData?.businessDate})
                          </h4>
                        </div>

                        {(!ceoMonitoringData?.auditLogs || ceoMonitoringData.auditLogs.length === 0) ? (
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>No audit actions recorded for this date.</div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#475569' }}>
                                  <th style={{ padding: '6px 8px' }}>Timestamp (Asia/Colombo)</th>
                                  <th style={{ padding: '6px 8px' }}>Action</th>
                                  <th style={{ padding: '6px 8px' }}>Checklist Item</th>
                                  <th style={{ padding: '6px 8px' }}>Performed By</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ceoMonitoringData.auditLogs.map(log => (
                                  <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '6px 8px', color: '#64748b' }}>{log.formattedCreatedAt || log.createdAt}</td>
                                    <td style={{ padding: '6px 8px', fontWeight: 800, color: log.action === 'MARKED_COMPLETED' ? '#16a34a' : '#ea580c' }}>
                                      {log.action}
                                    </td>
                                    <td style={{ padding: '6px 8px', fontWeight: 700 }}>{log.checklistItemId}</td>
                                    <td style={{ padding: '6px 8px' }}>{log.performedByName}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Branch-Wise Manager Progress & Tables */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {(ceoMonitoringData?.branches || []).map((b) => (
                        <div
                          key={`${b.branchId}-${b.manager.id}`}
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '14px',
                            overflow: 'hidden',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                          }}
                        >
                          {/* Branch & Manager Header */}
                          <div style={{
                            padding: '14px 18px',
                            backgroundColor: '#f1f5f9',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  backgroundColor: '#002b66',
                                  color: '#ffffff',
                                  fontSize: '0.72rem',
                                  fontWeight: 900,
                                  padding: '2px 8px',
                                  borderRadius: '6px'
                                }}>
                                  {b.branchName}
                                </span>
                                <span style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                  Manager: {b.manager.name}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  ({b.manager.role})
                                </span>
                              </div>
                              {b.lastCompletedFormatted && (
                                <div style={{ fontSize: '0.73rem', color: '#16a34a', marginTop: '3px', fontWeight: 700 }}>
                                  Completed by {b.lastCompletedBy || b.manager.name} • {b.lastCompletedFormatted}
                                </div>
                              )}
                            </div>

                            {/* Progress & Progress Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 900, fontSize: '0.85rem', color: b.progress.completed === 6 ? '#16a34a' : '#002b66' }}>
                                  Progress: {b.progress.label}
                                </div>
                              </div>
                              <div style={{
                                width: '100px',
                                height: '8px',
                                backgroundColor: '#e2e8f0',
                                borderRadius: '9999px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${b.progress.percentage}%`,
                                  height: '100%',
                                  backgroundColor: b.progress.completed === 6 ? '#16a34a' : '#2563eb',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            </div>
                          </div>

                          {/* 6 Checklist Items Table */}
                          <div style={{ padding: '14px 18px' }}>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '8px 10px', width: '40px' }}>#</th>
                                    <th style={{ padding: '8px 10px' }}>Checklist Item</th>
                                    <th style={{ padding: '8px 10px', width: '140px' }}>Status</th>
                                    <th style={{ padding: '8px 10px', width: '180px' }}>Completed By</th>
                                    <th style={{ padding: '8px 10px', width: '220px' }}>Completion Date & Exact Time</th>
                                    <th style={{ padding: '8px 10px', width: '120px', textAlign: 'right' }}>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {b.items.map((item, idx) => {
                                    const isItemCompleted = item.status === 'COMPLETED';
                                    return (
                                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '8px 10px', fontWeight: 800, color: 'var(--text-muted)' }}>
                                          {idx + 1}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontWeight: 800, color: 'var(--text-main)' }}>
                                          {item.title}
                                        </td>
                                        <td style={{ padding: '8px 10px' }}>
                                          {isItemCompleted ? (
                                            <span style={{
                                              backgroundColor: '#dcfce7',
                                              color: '#15803d',
                                              padding: '3px 8px',
                                              borderRadius: '6px',
                                              fontSize: '0.74rem',
                                              fontWeight: 800,
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}>
                                              <CheckCircle2 size={12} />
                                              <span>Completed</span>
                                            </span>
                                          ) : (
                                            <span style={{
                                              backgroundColor: '#fef3c7',
                                              color: '#b45309',
                                              padding: '3px 8px',
                                              borderRadius: '6px',
                                              fontSize: '0.74rem',
                                              fontWeight: 800,
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}>
                                              <Clock size={12} />
                                              <span>Pending</span>
                                            </span>
                                          )}
                                        </td>
                                        <td style={{ padding: '8px 10px', color: isItemCompleted ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 600 }}>
                                          {item.completedBy || '—'}
                                        </td>
                                        <td style={{ padding: '8px 10px', color: isItemCompleted ? '#166534' : 'var(--text-muted)', fontWeight: 700 }}>
                                          {item.completedAtFormatted || '—'}
                                        </td>
                                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                          {item.targetQueue ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (b.branchId !== activeBranch) {
                                                  setActiveBranch(String(b.branchId));
                                                }
                                                setActiveQueueTab(item.targetQueue);
                                              }}
                                              style={{
                                                backgroundColor: '#eff6ff',
                                                border: '1px solid #bfdbfe',
                                                color: '#1d4ed8',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                                cursor: 'pointer'
                                              }}
                                            >
                                              Inspect Queue
                                            </button>
                                          ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Pending Items Callout */}
                            {b.pendingItems.length > 0 ? (
                              <div style={{
                                marginTop: '12px',
                                padding: '10px 14px',
                                backgroundColor: '#fff7ed',
                                border: '1px solid #fed7aa',
                                borderRadius: '8px',
                                fontSize: '0.76rem',
                                color: '#9a3412',
                                fontWeight: 700
                              }}>
                                ⚠️ Pending Items ({b.pendingItems.length}): {b.pendingItems.join(', ')}
                              </div>
                            ) : (
                              <div style={{
                                marginTop: '12px',
                                padding: '10px 14px',
                                backgroundColor: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: '8px',
                                fontSize: '0.76rem',
                                color: '#166534',
                                fontWeight: 700
                              }}>
                                ✓ All 6 Daily Checklist items successfully completed for this branch and date.
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* FEATURE E: TODAY'S MANAGER CHECKLIST & END-OF-DAY SUMMARY */}
          {/* ======================================================== */}
          {(activeQueueTab === 'all' || activeQueueTab === 'checklist') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                padding: '16px 22px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#002b66',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ListTodo size={20} color="#38bdf8" />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#ffffff' }}>
                        Manager Daily Operational Checklist
                      </h2>
                      <span style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '9999px'
                      }}>
                        Live PostgreSQL Stored
                      </span>
                    </div>
                    <span style={{ fontSize: '0.76rem', color: '#cbd5e1' }}>
                      6 mandatory daily governance items • Completed records persisted immediately with timestamp and audit trail
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Progress Badge */}
                  <div style={{
                    fontSize: '0.8rem',
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <CheckCircle2 size={15} color="#4ade80" />
                    <span>Progress: {actionData.checklistProgress?.label || `${Object.values(checklistData).filter(i => i.status === 'COMPLETED').length}/6 Completed`}</span>
                  </div>

                  {isCeo && (
                    <button
                      type="button"
                      onClick={() => setActiveQueueTab('ceoMonitoring')}
                      style={{
                        backgroundColor: '#38bdf8',
                        color: '#002b66',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        fontSize: '0.78rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Eye size={14} />
                      <span>CEO All-Branch Monitoring</span>
                    </button>
                  )}
                </div>
              </div>

              <div style={{ padding: '20px 22px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '14px',
                  marginBottom: '24px'
                }}>
                  {Object.values(checklistData).map((item, index) => {
                    const isCompleted = item.status === 'COMPLETED';
                    const isSubmitting = checklistSubmittingId === item.id;

                    return (
                      <div
                        key={item.id}
                        style={{
                          backgroundColor: isCompleted ? '#f0fdf4' : 'var(--bg-main)',
                          border: isCompleted ? '1.5px solid #bbf7d0' : item.priority === 'CRITICAL' ? '1.5px solid #fecaca' : '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'all 0.15s ease',
                          boxShadow: isCompleted ? '0 1px 3px rgba(34, 197, 94, 0.1)' : 'none'
                        }}
                      >
                        <div>
                          {/* Item Header: Sequence, Title & Live Count */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                            <div style={{
                              fontWeight: 900,
                              fontSize: '0.92rem',
                              color: isCompleted ? '#166534' : 'var(--text-main)'
                            }}>
                              {index + 1}. {item.title}
                            </div>

                            {item.count !== undefined && (
                              <span style={{
                                backgroundColor: item.count > 0 ? (item.priority === 'CRITICAL' ? '#fee2e2' : '#fef3c7') : '#f1f5f9',
                                color: item.count > 0 ? (item.priority === 'CRITICAL' ? '#991b1b' : '#92400e') : '#475569',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                whiteSpace: 'nowrap'
                              }}>
                                {item.count > 0 ? `${item.count} Pending` : '0 Pending'}
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            {item.description}
                          </div>

                          {/* Completion Metadata / Status Badge */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 700
                          }}>
                            {isCompleted ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#dcfce7',
                                color: '#15803d',
                                padding: '3px 8px',
                                borderRadius: '6px'
                              }}>
                                <CheckCircle2 size={13} />
                                <span>Completed</span>
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                padding: '3px 8px',
                                borderRadius: '6px'
                              }}>
                                <Clock size={13} />
                                <span>Pending Action</span>
                              </span>
                            )}

                            {isCompleted && item.completedBy && (
                              <span style={{ color: '#166534', fontSize: '0.73rem' }}>
                                by <strong>{item.completedBy}</strong>
                                {item.completedAtFormatted && ` • ${item.completedAtFormatted}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons: Mark Completed & Queue Link */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          paddingTop: '10px',
                          borderTop: '1px solid ' + (isCompleted ? '#dcfce7' : 'var(--border-color)')
                        }}>
                          {/* Mark Complete or Reopen Button (Managers Only; Read-Only for CEO) */}
                          {isCeo ? (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #cbd5e1'
                            }}>
                              <Eye size={13} color="#002b66" />
                              <span>CEO Read-Only Mode</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleToggleChecklistItem(item.id, item.status)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                border: isCompleted ? '1px solid #cbd5e1' : 'none',
                                backgroundColor: isCompleted ? '#ffffff' : '#16a34a',
                                color: isCompleted ? '#475569' : '#ffffff',
                                transition: 'all 0.15s ease'
                              }}
                              title={isCompleted ? 'Click to mark as pending' : 'Click to mark as completed in PostgreSQL'}
                            >
                              {isSubmitting ? (
                                <>
                                  <RefreshCw size={13} className="animate-spin" />
                                  <span>Saving...</span>
                                </>
                              ) : isCompleted ? (
                                <>
                                  <Check size={13} color="#16a34a" />
                                  <span>Completed (Click to Revert)</span>
                                </>
                              ) : (
                                <>
                                  <CheckSquare size={14} />
                                  <span>Mark as Completed</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Queue Shortcut Link */}
                          {item.targetQueue && (
                            <button
                              type="button"
                              onClick={() => setActiveQueueTab(item.targetQueue)}
                              style={{
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#002b66',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 6px'
                              }}
                            >
                              <span>Open Queue</span>
                              <ArrowRight size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* End-of-Day Summary Dashboard */}
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Activity size={18} color="#002b66" />
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#002b66' }}>
                      End-of-Day Operational Production & Revenue Summary
                    </h3>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px'
                  }}>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Orders Completed Today</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>
                        {endOfDaySummary.ordersCompletedToday || 0} Orders
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Orders Delivered Today</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
                        {endOfDaySummary.ordersDeliveredToday || 0} Delivered
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>New Orders Booked Today</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#9333ea', marginTop: '2px' }}>
                        {endOfDaySummary.newOrdersReceivedToday || 0} Booked
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Outstanding Collections</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ea580c', marginTop: '2px' }}>
                        LKR {formatCurrencyLKR(endOfDaySummary.outstandingCollections || 0)}
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Overdue Production Tasks</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: endOfDaySummary.overdueProductionTasks > 0 ? '#dc2626' : '#16a34a', marginTop: '2px' }}>
                        {endOfDaySummary.overdueProductionTasks || 0} Delayed
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Pending Manager Actions</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#002b66', marginTop: '2px' }}>
                        {endOfDaySummary.pendingManagerActions || 0} Actions
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* FEATURE A: OVERDUE ORDERS QUEUE                          */}
          {/* ======================================================== */}
          {(activeQueueTab === 'all' || activeQueueTab === 'overdue') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#fef2f2',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#dc2626' }} />
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#991b1b' }}>
                    Overdue Orders ({filteredOverdue.length})
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#991b1b' }}>
                    Promised delivery date has elapsed without completed dispatch
                  </span>
                </div>
              </div>

              {filteredOverdue.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={28} style={{ margin: '0 auto 8px auto', color: '#16a34a' }} />
                  <p style={{ margin: 0, fontWeight: 700 }}>Zero overdue orders! All active deliveries are strictly on schedule.</p>
                </div>
              ) : (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fee2e2', color: '#991b1b', borderBottom: '1px solid #fecaca' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Customer</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Order Details</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Promised Date</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Overdue</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Assigned Craftsman</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Stage / Balance</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Priority</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOverdue.map((item, idx) => (
                        <tr
                          key={item.orderId || idx}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: item.priority === 'CRITICAL' ? 'rgba(254, 242, 242, 0.4)' : idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'
                          }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <div
                              onClick={() => setSelectedCustomerIdForDrawer(item.customerId)}
                              style={{ fontWeight: 800, color: 'var(--jb-navy)', cursor: 'pointer' }}
                              title="Click to view Customer Profile"
                            >
                              {item.customerName}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Phone size={11} /> {item.customerPhone || 'No Phone'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 800 }}>{item.orderNumber}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {item.itemName} × {item.quantity}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                            {item.promisedDate}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: 900,
                              fontSize: '0.75rem'
                            }}>
                              +{item.daysOverdue} days
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontWeight: 700, color: item.assignedTailor === 'Unassigned' ? '#dc2626' : 'var(--text-main)' }}>
                              {item.assignedTailor}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>
                              {getStatusLabel(item.productionStatus)}
                            </span>
                            {item.balanceDue > 0 && (
                              <div style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 800, marginTop: '2px' }}>
                                Bal: LKR {formatCurrencyLKR(item.balanceDue)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {renderPriorityBadge(item.priority)}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => openWhatsAppDialog(item, 'OVERDUE')}
                                style={{
                                  backgroundColor: '#25D366',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Send WhatsApp Update"
                              >
                                <MessageCircle size={12} /> WhatsApp
                              </button>
                              <button
                                onClick={() => setFollowUpModalData({ item, queueType: 'OVERDUE' })}
                                style={{
                                  backgroundColor: 'var(--bg-main)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-main)',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Follow-up
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* FEATURE B: PRODUCTION DELAYS QUEUE                       */}
          {/* ======================================================== */}
          {(activeQueueTab === 'all' || activeQueueTab === 'productionDelays') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#fffbeb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#d97706' }} />
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#92400e' }}>
                    Production Delays ({filteredDelays.length})
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#92400e' }}>
                    Incomplete cutting, stitching, embroidery, finishing or QC stages exceeding expected turnaround
                  </span>
                </div>
              </div>

              {filteredDelays.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={28} style={{ margin: '0 auto 8px auto', color: '#16a34a' }} />
                  <p style={{ margin: 0, fontWeight: 700 }}>Zero delayed production stages! Workshop throughput is running smoothly.</p>
                </div>
              ) : (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fef3c7', color: '#92400e', borderBottom: '1px solid #fde68a' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Order / Customer</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Current Stage</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Pending Task</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Assigned Craftsman</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Delay Reason</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Priority</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDelays.map((item, idx) => (
                        <tr
                          key={`${item.orderId}-${item.taskId || idx}`}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'
                          }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 800 }}>{item.orderNumber}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--jb-navy)', fontWeight: 700 }}>{item.customerName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.itemName} × {item.quantity}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span className="badge badge-navy" style={{ fontSize: '0.72rem' }}>
                              {getStatusLabel(item.currentStage)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{item.taskName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Type: {item.taskType}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700 }}>{item.assignedEmployee}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ color: '#b45309', fontWeight: 700, fontSize: '0.75rem' }}>
                              {item.delayReason}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {renderPriorityBadge(item.priority)}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => openWhatsAppDialog(item, 'PRODUCTION_DELAY')}
                                style={{
                                  backgroundColor: '#25D366',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <MessageCircle size={12} /> WhatsApp
                              </button>
                              <button
                                onClick={() => setAssignModalData({ item, selectedTailorId: item.assignedEmployeeId || '', notes: '', submitting: false, error: null })}
                                style={{
                                  backgroundColor: '#002b66',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                Reassign
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* FEATURE C: UNASSIGNED TASKS QUEUE                        */}
          {/* ======================================================== */}
          {(activeQueueTab === 'all' || activeQueueTab === 'unassigned') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#faf5ff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#9333ea' }} />
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#6b21a8' }}>
                    Unassigned Tasks & Production Orders ({filteredUnassigned.length})
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#6b21a8' }}>
                    Active orders needing craftsman allocation to start production
                  </span>
                </div>
              </div>

              {filteredUnassigned.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={28} style={{ margin: '0 auto 8px auto', color: '#16a34a' }} />
                  <p style={{ margin: 0, fontWeight: 700 }}>Zero unassigned tasks! Every production order is assigned to a craftsman.</p>
                </div>
              ) : (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', borderBottom: '1px solid #e9d5ff' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Order Number</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Customer</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Garment / Item</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Required Task</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Stage</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Promised Due</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Priority</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Quick Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUnassigned.map((item, idx) => (
                        <tr
                          key={`${item.orderId}-${item.taskId || idx}`}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'
                          }}
                        >
                          <td style={{ padding: '12px 14px', fontWeight: 800 }}>
                            {item.orderNumber}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 800, color: 'var(--jb-navy)' }}>{item.customerName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.customerPhone || 'No Phone'}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700 }}>{item.itemName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Qty: {item.quantity}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              backgroundColor: '#f3e8ff',
                              color: '#7e22ce',
                              border: '1px solid #e9d5ff',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: 800,
                              fontSize: '0.75rem'
                            }}>
                              {item.requiredTask}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>
                              {getStatusLabel(item.productionStatus)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                            {item.promisedDate}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {renderPriorityBadge(item.priority)}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <button
                              onClick={() => setAssignModalData({
                                item,
                                selectedTailorId: availableTailors[0]?.id ? String(availableTailors[0].id) : '',
                                notes: '',
                                submitting: false,
                                error: null
                              })}
                              style={{
                                backgroundColor: '#9333ea',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '0.76rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <UserCheck size={13} /> Assign Tasks
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* FEATURE D: PRICE PENDING FOLLOW-UP QUEUE                 */}
          {/* ======================================================== */}
          {(activeQueueTab === 'all' || activeQueueTab === 'pricePending') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#eff6ff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#2563eb' }} />
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#1e40af' }}>
                    Price Pending Follow-up ({filteredPricePending.length})
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#1e40af' }}>
                    Orders awaiting quotation confirmation, pricing review or customer acceptance
                  </span>
                </div>
              </div>

              {filteredPricePending.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={28} style={{ margin: '0 auto 8px auto', color: '#16a34a' }} />
                  <p style={{ margin: 0, fontWeight: 700 }}>Zero price pending orders! All quotations are confirmed or approved.</p>
                </div>
              ) : (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#dbeafe', color: '#1e40af', borderBottom: '1px solid #bfdbfe' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Customer</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Order / Quote</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Quotation Amount</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Approval Status</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Waiting Days</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Priority</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPricePending.map((item, idx) => (
                        <tr
                          key={item.orderId || idx}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'
                          }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <div
                              onClick={() => setSelectedCustomerIdForDrawer(item.customerId)}
                              style={{ fontWeight: 800, color: 'var(--jb-navy)', cursor: 'pointer' }}
                              title="Click to view Customer Profile"
                            >
                              {item.customerName}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Phone size={11} /> {item.customerPhone || 'No Phone'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 800 }}>{item.orderNumber}</div>
                            <div style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>{item.quotationNumber}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.itemName} × {item.quantity}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {item.totalAmount > 0 ? (
                              <strong style={{ color: 'var(--text-main)' }}>LKR {formatCurrencyLKR(item.totalAmount)}</strong>
                            ) : (
                              <span style={{ color: '#d97706', fontStyle: 'italic', fontWeight: 700 }}>Pending Quote</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 800
                            }}>
                              {item.approvalStatus}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                            {item.daysWaiting} day{item.daysWaiting === 1 ? '' : 's'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {renderPriorityBadge(item.priority)}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => openWhatsAppDialog(item, 'PRICE_PENDING')}
                                style={{
                                  backgroundColor: '#25D366',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <MessageCircle size={12} /> WhatsApp Quote
                              </button>
                              <button
                                onClick={() => setSelectedOrderForInvoice(item.order)}
                                style={{
                                  backgroundColor: '#002b66',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <FileText size={12} /> Invoice
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* QUEUE 1: QUOTATION FOLLOW-UP SECTION (Preserved)         */}
          {/* ======================================================== */}
          {(activeQueueTab === 'all' || activeQueueTab === 'quotation') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#0284c7' }} />
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--jb-navy)' }}>
                    Quotation Follow-up ({filteredQuotations.length})
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Quotations sent and awaiting customer confirmation
                  </span>
                </div>
              </div>

              {filteredQuotations.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={28} style={{ margin: '0 auto 8px auto', color: '#16a34a' }} />
                  <p style={{ margin: 0, fontWeight: 700 }}>Zero pending quotations requiring follow-up today!</p>
                </div>
              ) : (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Customer</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Order / Quote</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Branch</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Amount</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Sent Date</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Responsible Person</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Next Action</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotations.map((item, idx) => (
                        <tr
                          key={item.orderId || idx}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'
                          }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <div
                              onClick={() => setSelectedCustomerIdForDrawer(item.customerId)}
                              style={{ fontWeight: 800, color: 'var(--jb-navy)', cursor: 'pointer' }}
                              title="Click to view Customer Profile"
                            >
                              {item.customerName}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Phone size={11} /> {item.customerPhone || 'No Phone'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 800 }}>{item.orderNumber}</div>
                            <div style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 700 }}>{item.quotationNumber}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.itemName} × {item.quantity}</div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>{item.branchName}</span>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 800 }}>
                            LKR {formatCurrencyLKR(item.totalAmount)}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div>{item.sentDate}</div>
                            <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 700 }}>
                              {item.daysAwaiting}d ago
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700 }}>{item.responsiblePerson}</div>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#0284c7', fontWeight: 700 }}>
                            {item.nextAction}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => openWhatsAppDialog(item, 'QUOTATION')}
                                style={{
                                  backgroundColor: '#25D366',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <MessageCircle size={12} /> WhatsApp
                              </button>
                              <button
                                onClick={() => setSelectedOrderForInvoice(item.order)}
                                style={{
                                  backgroundColor: '#002b66',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <FileText size={12} /> Quote
                              </button>
                              <button
                                onClick={() => setFollowUpModalData({ item, queueType: 'QUOTATION' })}
                                style={{
                                  backgroundColor: 'var(--bg-main)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-main)',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Follow-up
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* QUEUE 2: COLLECTION FOLLOW-UP SECTION (Preserved)        */}
          {/* ======================================================== */}
          {(activeQueueTab === 'all' || activeQueueTab === 'collection') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#fff7ed',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ea580c' }} />
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#9a3412' }}>
                    Collection Follow-up ({filteredCollections.length})
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#9a3412' }}>
                    Confirmed orders with outstanding balance due • Total: LKR {formatCurrencyLKR(summary.totalOutstandingBalance || 0)}
                  </span>
                </div>
              </div>

              {filteredCollections.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={28} style={{ margin: '0 auto 8px auto', color: '#16a34a' }} />
                  <p style={{ margin: 0, fontWeight: 700 }}>Zero pending collections! All active accounts are 100% paid.</p>
                </div>
              ) : (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#ffedd5', color: '#9a3412', borderBottom: '1px solid #fed7aa' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Customer</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Order No</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Total Payable</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Paid (Verified)</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Balance Due</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Order Stage</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Next Action</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCollections.map((item, idx) => (
                        <tr
                          key={item.orderId || idx}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: item.isReady ? 'rgba(254, 243, 199, 0.4)' : idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'
                          }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <div
                              onClick={() => setSelectedCustomerIdForDrawer(item.customerId)}
                              style={{ fontWeight: 800, color: 'var(--jb-navy)', cursor: 'pointer' }}
                              title="Click to view Customer Profile"
                            >
                              {item.customerName}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Phone size={11} /> {item.customerPhone || 'No Phone'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 800 }}>{item.orderNumber}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.itemName} × {item.quantity}</div>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                            LKR {formatCurrencyLKR(item.totalAmount)}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#16a34a', fontWeight: 800 }}>
                            LKR {formatCurrencyLKR(item.amountPaid)}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#dc2626', fontWeight: 900 }}>
                            LKR {formatCurrencyLKR(item.balanceDue)}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>
                              {getStatusLabel(item.productionStatus)}
                            </span>
                            {item.isReady && (
                              <span style={{ display: 'block', fontSize: '0.68rem', color: '#16a34a', fontWeight: 800, marginTop: '2px' }}>
                                Ready for Pickup
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#ea580c', fontWeight: 700 }}>
                            {item.nextAction}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => setSelectedOrderForPayment(item.order)}
                                style={{
                                  backgroundColor: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <CreditCard size={12} /> Pay
                              </button>
                              <button
                                onClick={() => openWhatsAppDialog(item, 'COLLECTION')}
                                style={{
                                  backgroundColor: '#25D366',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <MessageCircle size={12} /> WhatsApp
                              </button>
                              <button
                                onClick={() => setFollowUpModalData({ item, queueType: 'COLLECTION' })}
                                style={{
                                  backgroundColor: 'var(--bg-main)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-main)',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Follow-up
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* QUEUE 3: DELIVERY FOLLOW-UP SECTION (Preserved)          */}
          {/* ======================================================== */}
          {(activeQueueTab === 'all' || activeQueueTab === 'delivery') && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#f0fdf4',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#166534' }}>
                    Delivery Follow-up ({filteredDeliveries.length})
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#166534' }}>
                    Orders ready for customer collection or scheduled for delivery
                  </span>
                </div>
              </div>

              {filteredDeliveries.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={28} style={{ margin: '0 auto 8px auto', color: '#16a34a' }} />
                  <p style={{ margin: 0, fontWeight: 700 }}>Zero delivery follow-ups pending right now!</p>
                </div>
              ) : (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#dcfce7', color: '#166534', borderBottom: '1px solid #bbf7d0' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Customer</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Order No</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Promised Date</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Urgency / Status</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Payment Status</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800 }}>Next Action</th>
                        <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeliveries.map((item, idx) => (
                        <tr
                          key={item.orderId || idx}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'
                          }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <div
                              onClick={() => setSelectedCustomerIdForDrawer(item.customerId)}
                              style={{ fontWeight: 800, color: 'var(--jb-navy)', cursor: 'pointer' }}
                              title="Click to view Customer Profile"
                            >
                              {item.customerName}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Phone size={11} /> {item.customerPhone || 'No Phone'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 800 }}>{item.orderNumber}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.itemName} × {item.quantity}</div>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                            {item.promisedDate}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {item.isReady ? (
                              <span style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 900 }}>
                                READY FOR PICKUP
                              </span>
                            ) : item.urgency === 'OVERDUE' ? (
                              <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 900 }}>
                                OVERDUE (+{item.daysOverdue}d)
                              </span>
                            ) : (
                              <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>
                                {getStatusLabel(item.productionStatus)}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {item.balanceDue > 0 ? (
                              <span style={{ color: '#dc2626', fontWeight: 800 }}>
                                Due LKR {formatCurrencyLKR(item.balanceDue)}
                              </span>
                            ) : (
                              <span style={{ color: '#16a34a', fontWeight: 800 }}>
                                Fully Settled ✓
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#15803d', fontWeight: 700 }}>
                            {item.nextAction}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => openWhatsAppDialog(item, 'DELIVERY')}
                                style={{
                                  backgroundColor: '#25D366',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <MessageCircle size={12} /> WhatsApp
                              </button>
                              <button
                                onClick={() => setSelectedOrderForInvoice(item.order)}
                                style={{
                                  backgroundColor: '#002b66',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 9px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <FileText size={12} /> Invoice
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* QUICK ASSIGN CRAFTSMAN MODAL                             */}
      {/* ======================================================== */}
      {assignModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1050,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: '#002b66',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Assign Craftsman to Order
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalData(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickAssignSubmit} style={{ padding: '20px' }}>
              <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '10px', padding: '12px', marginBottom: '16px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Order Number:</span>
                  <strong>{assignModalData.item?.orderNumber}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
                  <strong>{assignModalData.item?.customerName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Garment:</span>
                  <strong>{assignModalData.item?.itemName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Required Task:</span>
                  <span style={{ color: '#9333ea', fontWeight: 800 }}>
                    {assignModalData.item?.requiredTask || assignModalData.item?.taskName || 'Master Tailor Assignment'}
                  </span>
                </div>
              </div>

              {assignModalData.error && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '14px', fontWeight: 700 }}>
                  {assignModalData.error}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, marginBottom: '6px' }}>
                  Select Craftsman / Tailor:
                </label>
                <select
                  value={assignModalData.selectedTailorId}
                  onChange={(e) => setAssignModalData(prev => ({ ...prev, selectedTailorId: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  <option value="">-- Choose Craftsman --</option>
                  {availableTailors.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.role === 'TAILOR' ? 'Master Tailor' : t.role === 'CUTTING' ? 'Cutting Master' : t.role})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, marginBottom: '6px' }}>
                  Assignment Notes (Optional):
                </label>
                <textarea
                  rows={2}
                  value={assignModalData.notes || ''}
                  onChange={(e) => setAssignModalData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Special workshop notes, rush instructions, fabric handling..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAssignModalData(null)}
                  disabled={assignModalData.submitting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignModalData.submitting || !assignModalData.selectedTailorId}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#9333ea',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {assignModalData.submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{assignModalData.submitting ? 'Assigning...' : 'Confirm Assignment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* WHATSAPP CONFIRMATION MODAL                              */}
      {/* ======================================================== */}
      {whatsAppModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1050,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: '#002b66',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={18} color="#25D366" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  {whatsAppModalData.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWhatsAppModalData(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px', fontSize: '0.85rem' }}>
                <div><strong>Recipient:</strong> {whatsAppModalData.item?.customerName}</div>
                <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>
                  <strong>Phone:</strong> {whatsAppModalData.cleanPhone || 'No valid phone number'}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, marginBottom: '6px' }}>
                  WhatsApp Message Content:
                </label>
                <textarea
                  rows={8}
                  value={whatsAppModalData.message}
                  onChange={(e) => setWhatsAppModalData(prev => ({ ...prev, message: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.83rem',
                    lineHeight: 1.45,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setWhatsAppModalData(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLaunchWhatsApp}
                  disabled={!whatsAppModalData.cleanPhone}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#25D366',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Send size={14} />
                  <span>Send WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FOLLOW-UP RECORD MODAL                                   */}
      {/* ======================================================== */}
      {followUpModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1050,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: '#002b66',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Record Action Follow-Up ({followUpModalData.queueType})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFollowUpModalData(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFollowUp} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px', fontSize: '0.85rem' }}>
                <div><strong>Order:</strong> {followUpModalData.item?.orderNumber} ({followUpModalData.item?.customerName})</div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, marginBottom: '6px' }}>
                  Next Action Description:
                </label>
                <input
                  type="text"
                  required
                  value={followUpModalData.nextAction || ''}
                  onChange={(e) => setFollowUpModalData(prev => ({ ...prev, nextAction: e.target.value }))}
                  placeholder="e.g. Call customer for fitting confirmation"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, marginBottom: '6px' }}>
                  Scheduled Follow-up Date:
                </label>
                <input
                  type="date"
                  value={followUpModalData.followUpDate || ''}
                  onChange={(e) => setFollowUpModalData(prev => ({ ...prev, followUpDate: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, marginBottom: '6px' }}>
                  Action Notes:
                </label>
                <textarea
                  rows={3}
                  value={followUpModalData.notes || ''}
                  onChange={(e) => setFollowUpModalData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Call outcome, customer response, promised payment..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, marginBottom: '6px' }}>
                  Follow-up Status:
                </label>
                <select
                  value={followUpModalData.status || 'PENDING'}
                  onChange={(e) => setFollowUpModalData(prev => ({ ...prev, status: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  <option value="PENDING">Pending (Keep on Queue)</option>
                  <option value="COMPLETED">Mark as Completed (Remove from Active Queue)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setFollowUpModalData(null)}
                  disabled={followUpSubmitting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={followUpSubmitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#002b66',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {followUpSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{followUpSubmitting ? 'Saving...' : 'Save Follow-up'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* REUSED MODALS: RECORD PAYMENT, DIGITAL INVOICE, DRAWER   */}
      {/* ======================================================== */}
      {selectedOrderForPayment && (
        <RecordPaymentModal
          order={selectedOrderForPayment}
          onClose={() => {
            setSelectedOrderForPayment(null);
            fetchActionCentre(true);
          }}
          onPaymentSuccess={() => {
            setSelectedOrderForPayment(null);
            fetchActionCentre(true);
          }}
        />
      )}

      {selectedOrderForInvoice && (
        <DigitalInvoiceModal
          order={selectedOrderForInvoice}
          onClose={() => setSelectedOrderForInvoice(null)}
        />
      )}

      {selectedCustomerIdForDrawer && (
        <CustomerProfileDrawer
          customerId={selectedCustomerIdForDrawer}
          onClose={() => setSelectedCustomerIdForDrawer(null)}
        />
      )}
    </div>
  );
};
