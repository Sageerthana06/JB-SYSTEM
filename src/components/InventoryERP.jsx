/**
 * InventoryERP Component — JB GROUP / Bella Design ERP
 *
 * =========================================================================
 * COMPONENT ROADMAP & ARCHITECTURE:
 * =========================================================================
 * This workstation manages raw materials, warehouse inventory, and tailoring supply.
 *
 * Major Sections & Sub-Tabs:
 * 1. Materials Master ('items'):
 *    - SKU catalog: Fabrics, lining, thread spools, zippers, buttons, embellishments
 *    - Reorder levels, minimum stock alerts, and unit pricing
 * 2. Stock Movements Ledger ('ledger'):
 *    - Manual adjustments: STOCK_IN, RETURN, ISSUE, WASTAGE, DAMAGED
 * 3. Tailor Material Requests ('requests'):
 *    - Tailors request supplies for specific orders; warehouse staff issues materials
 * 4. Purchase Orders & GRN ('purchases'):
 *    - Requisitions, manager approval, and verified goods received notes (GRN)
 * 5. Suppliers ('suppliers'):
 *    - Vendor directory, contact details, payment terms
 * 6. Customer Fabric Tracker ('customer-fabrics'):
 *    - Customer-owned fabric lifecycle (<CustomerFabricTracker />)
 * =========================================================================
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  ArrowUpDown,
  Download,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Layers,
  FileText,
  DollarSign,
  CheckCircle2,
  Clock,
  X,
  Edit2,
  Trash2,
  RotateCcw,
  Inbox,
  Eye,
  LayoutGrid,
  List,
  Scissors
} from 'lucide-react';
import { CustomerFabricTracker } from './CustomerFabricTracker';

export const InventoryERP = () => {
  const { user, activeBranch } = useAuth();
  const token = localStorage.getItem('jb_token');
  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }), [token]);

  // Tab State: 'materials' | 'ledger' | 'requests' | 'purchases' | 'valuation'
  const [activeTab, setActiveTab] = useState('materials');

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Meta & Permissions
  const [meta, setMeta] = useState({
    categories: ['Fabric', 'Lining', 'Thread', 'Buttons', 'Zippers', 'Embroidery Materials', 'Accessories', 'Packaging'],
    units: ['Meters', 'Yards', 'Pieces', 'Rolls', 'Packets', 'Spools', 'Cones', 'Kg'],
    capabilities: {}
  });

  // KPI Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState({
    totalItems: 0,
    activeItems: 0,
    stockValue: 0,
    outOfStock: 0,
    lowStock: 0,
    reorderDue: 0,
    pendingRequests: 0,
    pendingApproval: 0
  });

  // Materials State
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pages: 1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL'); // 'ALL' | 'out' | 'low' | 'reorder' | 'ok'
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // Movements (Ledger) State
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Material Requests (Tailor Integration) State
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Modals & Requisition State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementItem, setMovementItem] = useState(null);
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);
  const [viewMode, setViewMode] = useState('auto'); // 'auto' | 'grid' | 'table'

  // Material Requisition Creation State
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [orderSearchText, setOrderSearchText] = useState('');
  const [orderSearchResults, setOrderSearchResults] = useState([]);
  const [isSearchingOrders, setIsSearchingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reqTailorId, setReqTailorId] = useState('');
  const [reqTailorName, setReqTailorName] = useState('');
  const [reqItems, setReqItems] = useState([{ itemId: '', quantity: '', notes: '' }]);
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  // Issue Material Modal State
  const [issueModalReq, setIssueModalReq] = useState(null);
  const [issueQty, setIssueQty] = useState('');
  const [issueNotes, setIssueNotes] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  // Return / Damaged / Wastage Modal State
  const [returnModalReq, setReturnModalReq] = useState(null);
  const [returnCondition, setReturnCondition] = useState('REUSABLE'); // 'REUSABLE' | 'DAMAGED' | 'WASTAGE'
  const [returnQty, setReturnQty] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Item Form State
  const [itemForm, setItemForm] = useState({
    sku: '',
    name: '',
    category: 'Fabric',
    unit: 'Meters',
    description: '',
    colour: '',
    openingStock: 0,
    minStockLevel: 5,
    reorderLevel: 15,
    unitCost: 0,
    storageLocation: ''
  });

  // Movement Form State
  const [movementForm, setMovementForm] = useState({
    type: 'STOCK_IN', // 'STOCK_IN' | 'ISSUE' | 'RETURN' | 'WASTAGE' | 'DAMAGED' | 'ADJUSTMENT'
    quantity: '',
    countedQuantity: '',
    unitCost: '',
    referenceNo: '',
    reason: ''
  });

  // Auto-dismiss banners
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Fetch Meta info (categories, units, permissions)
  const fetchMeta = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventory/meta`, { headers: authHeaders });
      const data = await res.json();
      if (data.success && data.data) {
        setMeta(data.data);
      }
    } catch (e) {
      console.warn('Could not fetch inventory meta', e);
    }
  }, [authHeaders]);

  // Fetch Dashboard Stats
  const fetchDashboardStats = useCallback(async () => {
    try {
      const branchParam = activeBranch && activeBranch !== 'ALL' ? `?branchId=${activeBranch}` : '';
      const res = await fetch(`${API_URL}/api/inventory/dashboard${branchParam}`, { headers: authHeaders });
      const data = await res.json();
      if (data.success && data.data) {
        setDashboardStats(data.data);
      }
    } catch (e) {
      console.warn('Could not fetch inventory dashboard stats', e);
    }
  }, [authHeaders, activeBranch]);

  // Fetch Material Items
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: pagination.page,
        pageSize: pagination.pageSize,
        sort: sortBy,
        dir: sortDir
      });
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (stockFilter !== 'ALL') params.append('stock', stockFilter);
      if (activeBranch && activeBranch !== 'ALL') params.append('branchId', activeBranch);

      const res = await fetch(`${API_URL}/api/inventory/items?${params.toString()}`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setItems(data.data || []);
        if (data.pagination) setPagination(data.pagination);
      } else {
        setError(data.message || 'Failed to fetch inventory items');
      }
    } catch {
      setError('Network error connecting to inventory database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders, pagination.page, pagination.pageSize, sortBy, sortDir, searchQuery, selectedCategory, stockFilter, activeBranch]);

  // Fetch Stock Movements
  const fetchMovements = useCallback(async () => {
    try {
      setLoadingMovements(true);
      const res = await fetch(`${API_URL}/api/inventory/movements?page=1&pageSize=50`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setMovements(data.data || []);
      }
    } catch (e) {
      console.warn('Error fetching stock movements', e);
    } finally {
      setLoadingMovements(false);
    }
  }, [authHeaders]);

  // Fetch Material Requests
  const fetchRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const res = await fetch(`${API_URL}/api/inventory/requests?page=1&pageSize=50`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setRequests(data.data || []);
      }
    } catch (e) {
      console.warn('Error fetching material requests', e);
    } finally {
      setLoadingRequests(false);
    }
  }, [authHeaders]);

  // Initial Data Load
  useEffect(() => {
    fetchMeta();
    fetchDashboardStats();
    fetchItems();
  }, [fetchMeta, fetchDashboardStats, fetchItems]);

  // Tab switch fetchers
  useEffect(() => {
    if (activeTab === 'ledger') fetchMovements();
    if (activeTab === 'requests') fetchRequests();
  }, [activeTab, fetchMovements, fetchRequests]);

  // Open Add Item Modal
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setItemForm({
      sku: '',
      name: '',
      category: meta.categories[0] || 'Fabric',
      unit: meta.units[0] || 'Meters',
      description: '',
      colour: '',
      openingStock: 0,
      minStockLevel: 5,
      reorderLevel: 15,
      unitCost: 0,
      storageLocation: ''
    });
    setIsItemModalOpen(true);
  };

  // Open Edit Item Modal
  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setItemForm({
      sku: item.sku || '',
      name: item.name || '',
      category: item.category || 'Fabric',
      unit: item.unit || 'Meters',
      description: item.description || '',
      colour: item.colour || '',
      openingStock: item.openingStock || 0,
      minStockLevel: item.minStockLevel || 5,
      reorderLevel: item.reorderLevel || 15,
      unitCost: item.unitCost || 0,
      storageLocation: item.storageLocation || ''
    });
    setIsItemModalOpen(true);
  };

  // Open Stock Movement Modal
  const handleOpenMovementModal = (item, defaultType = 'STOCK_IN') => {
    setMovementItem(item);
    setMovementForm({
      type: defaultType,
      quantity: '',
      countedQuantity: item.currentStock || 0,
      unitCost: item.unitCost || '',
      referenceNo: '',
      reason: ''
    });
    setIsMovementModalOpen(true);
  };

  // Auto-generate SKU
  const handleGenerateSku = () => {
    const prefixMap = {
      Fabric: 'FAB',
      Lining: 'LIN',
      Thread: 'THD',
      Buttons: 'BTN',
      Zippers: 'ZIP',
      'Embroidery Materials': 'EMB',
      Accessories: 'ACC',
      Packaging: 'PKG'
    };
    const prefix = prefixMap[itemForm.category] || 'MAT';
    const rand = Math.floor(100 + Math.random() * 900);
    setItemForm(prev => ({ ...prev, sku: `${prefix}-${rand}` }));
  };

  // Save Item (Create or Update)
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (isSubmittingItem) return;
    try {
      if (!itemForm.sku.trim() || !itemForm.name.trim()) {
        alert('SKU and Material Name are required.');
        return;
      }
      setIsSubmittingItem(true);

      const method = editingItem ? 'PUT' : 'POST';
      const url = editingItem
        ? `${API_URL}/api/inventory/items/${editingItem.id}`
        : `${API_URL}/api/inventory/items`;

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(itemForm)
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(editingItem ? 'Material details updated successfully!' : 'Material created successfully!');
        setIsItemModalOpen(false);
        fetchItems();
        fetchDashboardStats();
      } else {
        alert(data.message || 'Error saving material.');
      }
    } catch {
      alert('Network error while saving material.');
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // Submit Stock Movement
  const handleSaveMovement = async (e) => {
    e.preventDefault();
    if (!movementItem || isSubmittingMovement) return;
    try {
      setIsSubmittingMovement(true);

      const idempotencyKey = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload = {
        itemId: movementItem.id,
        type: movementForm.type,
        idempotencyKey,
        referenceNo: movementForm.referenceNo || undefined,
        reason: movementForm.reason || undefined
      };

      if (movementForm.type === 'ADJUSTMENT') {
        payload.countedQuantity = Number(movementForm.countedQuantity);
      } else {
        payload.quantity = Number(movementForm.quantity);
        if (!payload.quantity || payload.quantity <= 0) {
          alert('Please enter a valid quantity greater than 0.');
          setIsSubmittingMovement(false);
          return;
        }
      }

      if (movementForm.type === 'STOCK_IN' && movementForm.unitCost) {
        payload.unitCost = Number(movementForm.unitCost);
      }

      const res = await fetch(`${API_URL}/api/inventory/movements`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(`Stock movement (${movementForm.type}) recorded successfully!`);
        setIsMovementModalOpen(false);
        fetchItems();
        fetchDashboardStats();
        if (activeTab === 'ledger') fetchMovements();
      } else {
        alert(data.message || 'Failed to record stock movement.');
      }
    } catch {
      alert('Network error recording movement.');
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  // ==========================================
  // TAILOR MATERIAL REQUISITION HANDLERS
  // ==========================================

  const handleOpenNewRequestModal = async () => {
    setSelectedOrder(null);
    setOrderSearchText('');
    setOrderSearchResults([]);
    setReqTailorId('');
    setReqTailorName('');
    setReqItems([{ itemId: '', quantity: '', notes: '' }]);
    setIsNewRequestModalOpen(true);

    try {
      const res = await fetch(`${API_URL}/api/inventory/items?pageSize=200&isActive=true`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setCatalogueItems(data.data || []);
      }
    } catch (e) {
      console.warn('Could not load material catalogue for requisition', e);
    }
  };

  const handleSearchOrders = async (query) => {
    setOrderSearchText(query);
    if (!query.trim()) {
      setOrderSearchResults([]);
      return;
    }
    try {
      setIsSearchingOrders(true);
      const res = await fetch(`${API_URL}/api/inventory/orders/lookup?q=${encodeURIComponent(query.trim())}`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setOrderSearchResults(data.data || []);
      }
    } catch (e) {
      console.warn('Error searching orders', e);
    } finally {
      setIsSearchingOrders(false);
    }
  };

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setOrderSearchText(order.orderNumber);
    setReqTailorId(order.tailorId || order.assignedTailorId || '');
    setReqTailorName(order.tailorName || '');
    setOrderSearchResults([]);
  };

  const handleAddReqLine = () => {
    setReqItems(prev => [...prev, { itemId: '', quantity: '', notes: '' }]);
  };

  const handleRemoveReqLine = (idx) => {
    setReqItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateReqLine = (idx, field, value) => {
    setReqItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleSaveNewRequest = async (e) => {
    e.preventDefault();
    if (!selectedOrder) {
      alert('Please search and select a customer order.');
      return;
    }
    const validLines = reqItems.filter(i => i.itemId && Number(i.quantity) > 0);
    if (!validLines.length) {
      alert('Please specify at least one material and quantity.');
      return;
    }

    try {
      setIsSubmittingReq(true);
      const clientKey = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload = {
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        tailorId: reqTailorId ? Number(reqTailorId) : undefined,
        tailorName: reqTailorName || undefined,
        items: validLines.map(line => ({
          itemId: Number(line.itemId),
          quantity: Number(line.quantity),
          notes: line.notes || undefined
        })),
        clientKey
      };

      const res = await fetch(`${API_URL}/api/inventory/requests`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(`Material requisition submitted for order ${selectedOrder.orderNumber}!`);
        setIsNewRequestModalOpen(false);
        fetchRequests();
        fetchDashboardStats();
      } else {
        alert(data.message || 'Failed to submit material requisition.');
      }
    } catch {
      alert('Network error submitting requisition.');
    } finally {
      setIsSubmittingReq(false);
    }
  };

  // Issue Material Modal Handlers
  const handleOpenIssueModal = (req) => {
    setIssueModalReq(req);
    const maxPossible = Math.min(req.remainingToIssue, req.currentStock);
    setIssueQty(String(maxPossible > 0 ? maxPossible : req.remainingToIssue));
    setIssueNotes('');
  };

  const handleSubmitIssue = async (e) => {
    e.preventDefault();
    if (!issueModalReq) return;
    const quantity = Number(issueQty);
    if (!quantity || quantity <= 0) {
      alert('Enter a valid issue quantity.');
      return;
    }
    if (quantity > issueModalReq.remainingToIssue + 0.0001) {
      alert(`Cannot issue more than remaining requested (${issueModalReq.remainingToIssue} ${issueModalReq.unit}).`);
      return;
    }
    if (quantity > issueModalReq.currentStock + 0.0001) {
      alert(`Insufficient stock! Warehouse only has ${issueModalReq.currentStock} ${issueModalReq.unit} available.`);
      return;
    }

    try {
      setIsSubmittingIssue(true);
      const idempotencyKey = `iss-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const res = await fetch(`${API_URL}/api/inventory/requests/${issueModalReq.id}/issue`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ quantity, notes: issueNotes, idempotencyKey })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Successfully issued ${quantity} ${issueModalReq.unit} to tailor for ${issueModalReq.orderNumber}. Stock deducted!`);
        setIssueModalReq(null);
        fetchRequests();
        fetchItems();
        fetchDashboardStats();
      } else {
        alert(data.message || 'Failed to issue material.');
      }
    } catch {
      alert('Network error issuing material.');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  // Return / Damaged / Wastage Modal Handlers
  const handleOpenReturnModal = (req) => {
    setReturnModalReq(req);
    setReturnCondition('REUSABLE');
    setReturnQty(String(req.outstandingWithTailor || 0));
    setReturnReason('');
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    if (!returnModalReq) return;
    const quantity = Number(returnQty);
    if (!quantity || quantity <= 0) {
      alert('Enter a valid return/wastage quantity.');
      return;
    }
    if (quantity > returnModalReq.outstandingWithTailor + 0.0001) {
      alert(`Cannot record ${quantity}. Tailor only has ${returnModalReq.outstandingWithTailor} ${returnModalReq.unit} outstanding.`);
      return;
    }

    try {
      setIsSubmittingReturn(true);
      const idempotencyKey = `ret-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const res = await fetch(`${API_URL}/api/inventory/requests/${returnModalReq.id}/return`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          quantity,
          condition: returnCondition,
          reason: returnReason || undefined,
          idempotencyKey
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || 'Return / wastage recorded successfully!');
        setReturnModalReq(null);
        fetchRequests();
        fetchItems();
        fetchDashboardStats();
      } else {
        alert(data.message || 'Failed to record return.');
      }
    } catch {
      alert('Network error recording return.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const handleCloseRequest = async (requestId, reqNo) => {
    if (!confirm(`Are you sure you want to close requisition ${reqNo}? Outstanding consumption will be finalised.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/inventory/requests/${requestId}/complete`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Requisition ${reqNo} closed successfully.`);
        fetchRequests();
        fetchDashboardStats();
      } else {
        alert(data.message || 'Failed to close requisition.');
      }
    } catch {
      alert('Network error closing requisition.');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!items.length) {
      alert('No materials to export.');
      return;
    }
    const headers = ['SKU', 'Name', 'Category', 'Unit', 'Current Stock', 'Min Stock', 'Unit Cost (LKR)', 'Stock Value (LKR)', 'Location', 'Status'];
    const rows = items.map(i => [
      i.sku,
      `"${(i.name || '').replace(/"/g, '""')}"`,
      i.category,
      i.unit,
      i.currentStock,
      i.minStockLevel,
      i.unitCost || 0,
      ((i.currentStock || 0) * (i.unitCost || 0)).toFixed(2),
      `"${(i.storageLocation || '').replace(/"/g, '""')}"`,
      i.stockStatus
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `JB_GROUP_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="module-container-responsive" style={{ padding: '24px 28px', maxWidth: '1600px', margin: '0 auto' }}>

      {/* 1. Header & Live Telemetry Strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'var(--jb-crimson-light)',
            color: 'var(--jb-crimson)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(220,38,38,0.15)'
          }}>
            <Package size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                Inventory & Material Management ERP
              </h1>
              <span className="badge badge-navy" style={{ fontSize: '0.72rem', padding: '3px 9px' }}>
                Enterprise V2.6
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              Real-time fabric rolls, lining, thread spools, trims, and atomic order consumption ledger
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setRefreshing(true); fetchItems(); fetchDashboardStats(); }}
            disabled={refreshing}
            className="btn-secondary"
            style={{ padding: '9px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-secondary"
            style={{ padding: '9px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="btn-primary"
            style={{
              padding: '9px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: 'var(--jb-crimson)',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 4px 12px rgba(220,38,38,0.25)'
            }}
          >
            <Plus size={16} />
            <span>Add New Material</span>
          </button>
        </div>
      </div>

      {/* Success / Error Banners */}
      {successMsg && (
        <div style={{
          backgroundColor: '#dcfce7',
          color: '#15803d',
          border: '1px solid #86efac',
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.88rem',
          fontWeight: 700
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          border: '1px solid #fca5a5',
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.88rem',
          fontWeight: 700
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. Executive KPI Cards Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '22px'
      }}>
        {/* Total Material Types */}
        <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid var(--jb-navy)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
            <span>TOTAL SKUs</span>
            <Package size={17} color="var(--jb-navy)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '6px' }}>
            {dashboardStats.totalItems || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {dashboardStats.activeItems || 0} active in catalogue
          </div>
        </div>

        {/* Total Valuation */}
        <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
            <span>VALUATION (WAC)</span>
            <DollarSign size={17} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10b981', marginTop: '6px' }}>
            LKR {Number(dashboardStats.stockValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Weighted average asset value
          </div>
        </div>

        {/* Total Purchase Spend (confirmed GRN receipts only; hidden without VIEW_COSTS) */}
        {dashboardStats.purchaseSpend && (
          <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #6366f1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
              <span>TOTAL PURCHASE SPEND</span>
              <DollarSign size={17} color="#6366f1" />
            </div>
            {dashboardStats.purchaseSpend.available ? (
              <>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#4f46e5', marginTop: '6px' }}>
                  LKR {Number(dashboardStats.purchaseSpend.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {dashboardStats.purchaseSpend.receiptCount} confirmed receipt{dashboardStats.purchaseSpend.receiptCount === 1 ? '' : 's'} & stock entries
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.3 }}>
                Unavailable â€” No confirmed purchase receipts
              </div>
            )}
          </div>
        )}

        {/* Low Stock Alerts */}
        <div
          className="card"
          onClick={() => { setStockFilter('low'); setActiveTab('materials'); }}
          style={{ padding: '16px 18px', borderLeft: '4px solid #f59e0b', cursor: 'pointer', transition: 'transform 0.15s ease' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
            <span>LOW STOCK ITEMS</span>
            <AlertTriangle size={17} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#d97706', marginTop: '6px' }}>
            {dashboardStats.lowStock || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Below min stock threshold
          </div>
        </div>

        {/* Out of Stock */}
        <div
          className="card"
          onClick={() => { setStockFilter('out'); setActiveTab('materials'); }}
          style={{ padding: '16px 18px', borderLeft: '4px solid #ef4444', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
            <span>OUT OF STOCK</span>
            <TrendingDown size={17} color="#ef4444" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ef4444', marginTop: '6px' }}>
            {dashboardStats.outOfStock || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Requires urgent reorder
          </div>
        </div>

        {/* Tailor Material Requisitions */}
        <div
          className="card"
          onClick={() => setActiveTab('requests')}
          style={{ padding: '16px 18px', borderLeft: '4px solid var(--jb-crimson)', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
            <span>PENDING REQUISITIONS</span>
            <Clock size={17} color="var(--jb-crimson)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--jb-crimson)', marginTop: '6px' }}>
            {dashboardStats.pendingRequests || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Awaiting store issue to tailors
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderBottom: '2px solid var(--border-color)',
        marginBottom: '20px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {[
          { id: 'materials', label: 'Material Master', icon: Layers, count: items.length },
          { id: 'ledger', label: 'Stock Movement Ledger', icon: FileText },
          { id: 'requests', label: 'Order Material Issues', icon: RotateCcw, count: dashboardStats.pendingRequests },
          { id: 'customerFabric', label: 'Customer Fabric Tracker', icon: Scissors },
          { id: 'valuation', label: 'Valuation & Reorder Analytics', icon: DollarSign }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                background: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--jb-crimson)' : 'var(--text-muted)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                borderBottom: isActive ? '3px solid var(--jb-crimson)' : '3px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {Boolean(tab.count) && (
                <span style={{
                  backgroundColor: isActive ? 'var(--jb-crimson)' : 'var(--border-color)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.68rem',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  fontWeight: 800
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Tab 1: MATERIAL MASTER */}
      {activeTab === 'materials' && (
        <div>
          {/* Filters Bar */}
          <div className="card" style={{ padding: '14px 18px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between' }}>

              {/* Search Box */}
              <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search SKU, material name, location..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                  className="touch-input"
                  style={{ width: '100%', paddingLeft: '36px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                />
              </div>

              {/* Category Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                  className="touch-input"
                  style={{ height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem', fontWeight: 600 }}
                >
                  <option value="ALL">All Categories</option>
                  {(meta.categories || []).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Stock Health Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Stock Status:</span>
                <select
                  value={stockFilter}
                  onChange={(e) => { setStockFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                  className="touch-input"
                  style={{ height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem', fontWeight: 600 }}
                >
                  <option value="ALL">All Stock Levels</option>
                  <option value="ok">In Stock / Healthy</option>
                  <option value="reorder">Reorder Due (â‰¤ Reorder Level)</option>
                  <option value="low">Low Stock (â‰¤ Min Level)</option>
                  <option value="out">Out of Stock (0)</option>
                </select>
              </div>

              {/* Sort By */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="touch-input"
                  style={{ height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
                >
                  <option value="name">Material Name</option>
                  <option value="sku">SKU Code</option>
                  <option value="stock">Current Stock</option>
                  <option value="value">Stock Value</option>
                  <option value="category">Category</option>
                </select>
                <button
                  onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="btn-secondary"
                  style={{ height: '38px', padding: '0 10px' }}
                  title="Toggle Ascending/Descending"
                >
                  <ArrowUpDown size={15} />
                </button>
              </div>

              {/* View Mode Toggle (Grid vs Table) */}
              <div className="inv-filter-view-toggle" style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '2px', backgroundColor: 'var(--bg-main)' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('auto')}
                  className="btn-secondary"
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    fontSize: '0.72rem',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: viewMode === 'auto' ? 'var(--bg-card)' : 'transparent',
                    color: viewMode === 'auto' ? 'var(--jb-crimson)' : 'var(--text-muted)',
                    fontWeight: viewMode === 'auto' ? 800 : 600,
                    boxShadow: viewMode === 'auto' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                  title="Auto (Desktop Table, Mobile 2-Col Cards)"
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className="btn-secondary"
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: viewMode === 'grid' ? 'var(--bg-card)' : 'transparent',
                    color: viewMode === 'grid' ? 'var(--jb-crimson)' : 'var(--text-muted)',
                    fontWeight: viewMode === 'grid' ? 800 : 600,
                    boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                  title="Force Card Grid"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className="btn-secondary"
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: viewMode === 'table' ? 'var(--bg-card)' : 'transparent',
                    color: viewMode === 'table' ? 'var(--jb-crimson)' : 'var(--text-muted)',
                    fontWeight: viewMode === 'table' ? 800 : 600,
                    boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                  title="Force Table View"
                >
                  <List size={15} />
                </button>
              </div>

            </div>
          </div>

          {/* Loading Indicator */}
          {loading ? (
            <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--jb-crimson)' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>Querying Inventory Database...</div>
            </div>
          ) : items.length === 0 ? (
            /* EMPTY STATE: Professional, informative, with Add First Material button */
            <div className="card" style={{ padding: '64px 24px', textAlign: 'center', border: '2px dashed var(--border-color)' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px',
                color: 'var(--jb-crimson)',
                border: '1px solid var(--border-color)'
              }}>
                <Inbox size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                {searchQuery || selectedCategory !== 'ALL' || stockFilter !== 'ALL'
                  ? 'No Materials Match Your Filters'
                  : 'No Materials In Inventory Database Yet'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '520px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
                {searchQuery || selectedCategory !== 'ALL' || stockFilter !== 'ALL'
                  ? 'Try clearing your search query or changing category and stock level filters.'
                  : 'Your inventory catalogue is currently empty. Start by registering your first tailoring material (raw silk, lining, threads, buttons, zippers).'}
              </p>

              {searchQuery || selectedCategory !== 'ALL' || stockFilter !== 'ALL' ? (
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); setStockFilter('ALL'); }}
                  className="btn-secondary"
                  style={{ padding: '9px 18px', fontSize: '0.85rem' }}
                >
                  Clear All Filters
                </button>
              ) : (
                <button
                  onClick={handleOpenAddModal}
                  className="btn-primary"
                  style={{
                    padding: '11px 24px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    backgroundColor: 'var(--jb-crimson)',
                    color: '#ffffff',
                    border: 'none',
                    margin: '0 auto',
                    boxShadow: '0 4px 14px rgba(220,38,38,0.3)'
                  }}
                >
                  <Plus size={18} />
                  <span>Add First Material Now</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* DESKTOP TABLE VIEW (Visible on tablet/desktop, hidden on mobile unless forced) */}
              <div className={viewMode === 'grid' ? 'hidden-force' : viewMode === 'table' ? 'inv-desktop-view-forced' : 'inv-desktop-view'}>
                <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>SKU / CODE</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>MATERIAL NAME</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>CATEGORY</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>CURRENT STOCK</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center' }}>HEALTH</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>UNIT COST (WAC)</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>VALUATION</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-muted)' }}>LOCATION</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const isLow = item.currentStock <= item.minStockLevel && item.currentStock > 0;
                          const isOut = item.currentStock <= 0;
                          const isReorder = item.currentStock <= item.reorderLevel && !isLow && !isOut;

                          return (
                            <tr
                              key={item.id}
                              style={{
                                borderBottom: '1px solid var(--border-color)',
                                transition: 'background 0.1s ease',
                                backgroundColor: isOut ? 'rgba(239,68,68,0.03)' : 'transparent'
                              }}
                            >
                              {/* SKU */}
                              <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--jb-navy)' }}>
                                <span style={{
                                  fontFamily: 'monospace',
                                  backgroundColor: 'var(--bg-main)',
                                  padding: '3px 7px',
                                  borderRadius: '5px',
                                  border: '1px solid var(--border-color)',
                                  fontSize: '0.8rem'
                                }}>
                                  {item.sku}
                                </span>
                              </td>

                              {/* Material Name */}
                              <td style={{ padding: '14px 16px' }}>
                                <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{item.name}</div>
                                {item.description && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {item.description}
                                  </div>
                                )}
                              </td>

                              {/* Category */}
                              <td style={{ padding: '14px 16px' }}>
                                <span className="badge badge-navy" style={{ fontSize: '0.74rem' }}>
                                  {item.category}
                                </span>
                              </td>

                              {/* Current Stock */}
                              <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                <div style={{ fontWeight: 900, fontSize: '0.95rem', color: isOut ? '#dc2626' : 'var(--text-main)' }}>
                                  {item.currentStock} {item.unit}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  Min: {item.minStockLevel} | Reorder: {item.reorderLevel}
                                </div>
                              </td>

                              {/* Health Status */}
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                {isOut ? (
                                  <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                                    OUT OF STOCK
                                  </span>
                                ) : isLow ? (
                                  <span style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                                    LOW STOCK
                                  </span>
                                ) : isReorder ? (
                                  <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                                    REORDER DUE
                                  </span>
                                ) : (
                                  <span style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800 }}>
                                    HEALTHY
                                  </span>
                                )}
                              </td>

                              {/* Unit Cost */}
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                                LKR {Number(item.unitCost || 0).toFixed(2)}
                              </td>

                              {/* Valuation */}
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                                LKR {(Number(item.currentStock || 0) * Number(item.unitCost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              {/* Storage Location */}
                              <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                                {item.storageLocation || '—'}
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  {/* View Details */}
                                  <button
                                    onClick={() => setViewingItem(item)}
                                    className="btn-secondary"
                                    style={{ padding: '5px 7px', color: 'var(--jb-navy)' }}
                                    title="View Full Material Specs"
                                  >
                                    <Eye size={13} />
                                  </button>

                                  {/* Stock In */}
                                  <button
                                    onClick={() => handleOpenMovementModal(item, 'STOCK_IN')}
                                    className="btn-secondary"
                                    style={{ padding: '5px 9px', fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}
                                    title="Stock Receipt / Restock"
                                  >
                                    + Stock In
                                  </button>

                                  {/* Issue / Wastage */}
                                  <button
                                    onClick={() => handleOpenMovementModal(item, 'ISSUE')}
                                    className="btn-secondary"
                                    style={{ padding: '5px 9px', fontSize: '0.75rem', fontWeight: 700, color: '#ea580c' }}
                                    title="Issue / Deduct Stock"
                                  >
                                    - Issue
                                  </button>

                                  {/* Edit */}
                                  <button
                                    onClick={() => handleOpenEditModal(item)}
                                    className="btn-secondary"
                                    style={{ padding: '5px 7px', color: 'var(--text-muted)' }}
                                    title="Edit Material Details"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* MOBILE 2-COLUMN SHOPPING-APP GRID (Visible on screens <= 860px or when grid forced) */}
              <div className={viewMode === 'table' ? 'hidden-force' : viewMode === 'grid' ? 'inv-mobile-view-forced' : 'inv-mobile-view'}>
                <div className="inv-material-grid">
                  {items.map((item) => {
                    const isLow = item.currentStock <= item.minStockLevel && item.currentStock > 0;
                    const isOut = item.currentStock <= 0;
                    const isReorder = item.currentStock <= item.reorderLevel && !isLow && !isOut;
                    const statusClass = isOut ? 'status-out' : isLow ? 'status-low' : isReorder ? 'status-reorder' : 'status-healthy';
                    const valuationNum = (Number(item.currentStock || 0) * Number(item.unitCost || 0));

                    return (
                      <div key={item.id} className={`inv-mat-card ${statusClass}`}>
                        {/* Top: Category & Health Status */}
                        <div className="inv-mat-card-header">
                          <span className="inv-mat-cat-badge" title={item.category}>
                            {item.category}
                          </span>
                          {isOut ? (
                            <span className="inv-mat-status-pill" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
                              OUT
                            </span>
                          ) : isLow ? (
                            <span className="inv-mat-status-pill" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>
                              LOW
                            </span>
                          ) : isReorder ? (
                            <span className="inv-mat-status-pill" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                              REORDER
                            </span>
                          ) : (
                            <span className="inv-mat-status-pill" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                              OK
                            </span>
                          )}
                        </div>

                        {/* SKU & Name */}
                        <div>
                          <div className="inv-mat-sku">{item.sku}</div>
                          <div className="inv-mat-name" title={item.name}>{item.name}</div>
                        </div>

                        {/* Stock Balance Box */}
                        <div className="inv-mat-stock-box">
                          <div className="inv-mat-stock-qty" style={{ color: isOut ? '#dc2626' : isLow ? '#d97706' : 'var(--text-main)' }}>
                            {item.currentStock} <span style={{ fontSize: '0.74rem', fontWeight: 600 }}>{item.unit}</span>
                          </div>
                          <div className="inv-mat-stock-limits" title={`Min: ${item.minStockLevel} | Reorder: ${item.reorderLevel}`}>
                            Min: {item.minStockLevel} | Reorder: {item.reorderLevel}
                          </div>
                        </div>

                        {/* Financials (Cost & Valuation) */}
                        <div className="inv-mat-financials">
                          <div>
                            <div className="inv-mat-fin-label">Unit Cost:</div>
                            <div className="inv-mat-fin-val" title={`LKR ${Number(item.unitCost || 0).toFixed(2)}`}>
                              LKR {Number(item.unitCost || 0).toFixed(2)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="inv-mat-fin-label">WAC Value:</div>
                            <div className="inv-mat-valuation-val" title={`LKR ${valuationNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                              LKR {valuationNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>

                        {/* 4 Action Buttons in 2x2 compact grid */}
                        <div className="inv-mat-actions-grid">
                          <button
                            onClick={() => handleOpenMovementModal(item, 'STOCK_IN')}
                            className="inv-mat-btn inv-mat-btn-in"
                            title="Receive Stock"
                          >
                            <TrendingUp size={11} />
                            <span>+ In</span>
                          </button>
                          <button
                            onClick={() => handleOpenMovementModal(item, 'ISSUE')}
                            className="inv-mat-btn inv-mat-btn-out"
                            title="Issue Stock"
                          >
                            <TrendingDown size={11} />
                            <span>- Out</span>
                          </button>
                          <button
                            onClick={() => setViewingItem(item)}
                            className="inv-mat-btn inv-mat-btn-view"
                            title="View Details"
                          >
                            <Eye size={11} />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="inv-mat-btn inv-mat-btn-edit"
                            title="Edit Material"
                          >
                            <Edit2 size={11} />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pagination Controls */}
              <div style={{
                marginTop: '14px',
                padding: '12px 14px',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                backgroundColor: 'var(--bg-card)'
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Showing <strong>{items.length}</strong> of <strong>{pagination.total}</strong> materials
                </div>

                {pagination.pages > 1 && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page <= 1}
                      className="btn-secondary"
                      style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                    >
                      Prev
                    </button>
                    <span style={{ padding: '6px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                      {pagination.page} / {pagination.pages}
                    </span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={pagination.page >= pagination.pages}
                      className="btn-secondary"
                      style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2: STOCK MOVEMENT LEDGER */}
      {activeTab === 'ledger' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Auditable Stock Movement Ledger</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Immutable transaction audit trail of every stock increase, order consumption, return, and wastage
              </p>
            </div>
            <button onClick={fetchMovements} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} className={loadingMovements ? 'animate-spin' : ''} />
              <span>Refresh Ledger</span>
            </button>
          </div>

          {loadingMovements ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading movement history...
            </div>
          ) : movements.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No stock movements recorded yet. Movements appear when you perform Stock-In, Order Issues, or Adjustments.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)' }}>DATE & TIME</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)' }}>TYPE</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)' }}>MATERIAL</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>DELTA</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right' }}>BEFORE --  AFTER</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)' }}>REF / ORDER NO</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)' }}>REASON / NOTES</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)' }}>PERFORMED BY</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(m.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            backgroundColor: isPositive ? '#dcfce7' : '#fee2e2',
                            color: isPositive ? '#15803d' : '#dc2626'
                          }}>
                            {m.type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                          {m.sku} â€” {m.itemName}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: isPositive ? '#15803d' : '#dc2626' }}>
                          {isPositive ? `+${m.quantity}` : m.quantity} {m.unit}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                          {m.previousStock} --- <strong>{m.newStock}</strong>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                          {m.orderNumber || m.referenceNo || 'â€”'}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                          {m.reason || 'â€”'}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-main)', fontWeight: 600 }}>
                          {m.performedByName || 'System'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. Tab 3: ORDER MATERIAL REQUISITIONS */}
      {activeTab === 'requests' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Tailor Order Material Requisitions & Issues</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Links material consumption directly to customer orders and assigned tailors. Prevents negative stock and verifies available balance.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={fetchRequests} className="btn-secondary" style={{ padding: '7px 14px', fontSize: '0.8rem' }}>
                <RefreshCw size={14} className={loadingRequests ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleOpenNewRequestModal}
                className="btn-primary"
                style={{
                  padding: '7px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--jb-crimson)',
                  color: '#ffffff',
                  boxShadow: '0 4px 10px rgba(220,38,38,0.2)'
                }}
              >
                <Plus size={15} />
                <span>Create Order Requisition</span>
              </button>
            </div>
          </div>

          {loadingRequests ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading material requisitions...
            </div>
          ) : requests.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RotateCcw size={36} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>No material requisitions placed for orders yet.</div>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Click "Create Order Requisition" above to link fabrics & supplies to an order.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>REQ NO</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>ORDER & CUSTOMER</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>ASSIGNED TAILOR</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>MATERIAL NAME + SKU</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>REQUESTED / ISSUED QUANTITY</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>REMAINING TO ISSUE</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>WITH TAILOR</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>REUSABLE RETURNED</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>DAMAGED</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>WASTAGE / SCRAP</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>STATUS</th>
                    <th style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => {
                    const reqQty = Number(r.requestedQty || 0);
                    const issQty = Number(r.issuedQty || 0);
                    const retQty = Number(r.returnedQty || 0);
                    const damQty = Number(r.damagedQty || 0);
                    const wasQty = Number(r.wastageQty || 0);
                    const remainingToIssue = r.remainingToIssue !== undefined ? Number(r.remainingToIssue) : Math.max(0, reqQty - issQty);
                    const withTailor = r.outstandingWithTailor !== undefined ? Number(r.outstandingWithTailor) : Math.max(0, issQty - retQty - damQty - wasQty);

                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        {/* 1. REQ NO */}
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--jb-navy)', whiteSpace: 'nowrap' }}>
                          {r.requestNo}
                        </td>

                        {/* 2. ORDER & CUSTOMER */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 800, color: 'var(--jb-crimson)' }}>{r.orderNumber}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {r.customerName || 'Walk-in Customer'}
                          </div>
                        </td>

                        {/* 3. ASSIGNED TAILOR */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700, color: r.tailorName && r.tailorName !== 'Unassigned' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                            {r.tailorName || 'Not Assigned'}
                          </span>
                        </td>

                        {/* 4. MATERIAL NAME + SKU */}
                        <td style={{ padding: '12px 14px', minWidth: '170px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{r.itemName}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            SKU: {r.sku} <span style={{ opacity: 0.85 }}>(Stock: {r.currentStock} {r.unit})</span>
                          </div>
                        </td>

                        {/* 5. REQUESTED / ISSUED QUANTITY */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div><strong>{reqQty}</strong> {r.unit}</div>
                          <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700, marginTop: '2px' }}>
                            Issued: {issQty} {r.unit}
                          </div>
                        </td>

                        {/* 6. REMAINING TO ISSUE */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: remainingToIssue > 0 ? '#ea580c' : '#15803d', whiteSpace: 'nowrap' }}>
                          {remainingToIssue} {r.unit}
                        </td>

                        {/* 7. WITH TAILOR */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: withTailor > 0 ? '#0284c7' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {withTailor} {r.unit}
                        </td>

                        {/* 8. REUSABLE RETURNED */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: retQty > 0 ? '#15803d' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {retQty > 0 ? `+${retQty} ${r.unit}` : `0 ${r.unit}`}
                        </td>

                        {/* 9. DAMAGED */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: damQty > 0 ? '#dc2626' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {damQty > 0 ? `${damQty} ${r.unit}` : `0 ${r.unit}`}
                        </td>

                        {/* 10. WASTAGE / SCRAP */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: wasQty > 0 ? '#ca8a04' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {wasQty > 0 ? `${wasQty} ${r.unit}` : `0 ${r.unit}`}
                        </td>

                        {/* 11. STATUS */}
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span className={`badge ${r.status === 'COMPLETED' ? 'badge-success' :
                            r.status === 'ISSUED' ? 'badge-success' :
                              r.status === 'PARTIALLY_ISSUED' ? 'badge-navy' :
                                r.status === 'REQUESTED' ? 'badge-warning' : 'badge-navy'
                            }`}>
                            {r.status}
                          </span>
                        </td>

                        {/* 12. ACTIONS */}
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {remainingToIssue > 0 && (
                              <button
                                onClick={() => handleOpenIssueModal(r)}
                                className="btn-primary"
                                style={{ padding: '4px 10px', fontSize: '0.74rem', backgroundColor: '#15803d', color: '#ffffff' }}
                                title="Confirm Issue Material to Tailor"
                              >
                                Issue
                              </button>
                            )}
                            {withTailor > 0 && (
                              <button
                                onClick={() => handleOpenReturnModal(r)}
                                className="btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.74rem', borderColor: '#ea580c', color: '#ea580c', fontWeight: 700 }}
                                title="Record Reusable Return, Damaged Stock, or Wastage"
                              >
                                Return / Scrap
                              </button>
                            )}
                            {remainingToIssue <= 0 && r.status !== 'COMPLETED' && (
                              <button
                                onClick={() => handleCloseRequest(r.id, r.requestNo)}
                                className="btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}
                                title="Finalise Requisition"
                              >
                                Close
                              </button>
                            )}
                            {r.status === 'COMPLETED' && (
                              <span style={{ color: '#15803d', fontSize: '0.74rem', fontWeight: 700 }}>âœ“ Done</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 7. Tab 4: VALUATION & ANALYTICS */}
      {activeTab === 'valuation' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 6px 0' }}>Inventory Stock Valuation Summary</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            Costing Method: <strong>Weighted Average Cost (WAC)</strong> â€” Updated atomically upon every stock receipt.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '18px', backgroundColor: 'var(--bg-main)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>TOTAL VALUE ON HAND</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981', marginTop: '6px' }}>
                LKR {Number(dashboardStats.stockValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ padding: '18px', backgroundColor: 'var(--bg-main)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>ACTIVE MATERIAL SKUs</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--jb-navy)', marginTop: '6px' }}>
                {dashboardStats.activeItems || 0}
              </div>
            </div>
          </div>

          <button onClick={handleExportCSV} className="btn-primary" style={{ padding: '9px 18px', fontSize: '0.85rem' }}>
            <Download size={16} />
            <span>Download Full Inventory Valuation Ledger (CSV)</span>
          </button>
        </div>
      )}

      {/* 8. Tab: CUSTOMER FABRIC TRACKER */}
      {activeTab === 'customerFabric' && (
        <CustomerFabricTracker
          user={user}
          activeBranch={activeBranch}
          authHeaders={authHeaders}
          meta={meta}
        />
      )}

      {/* ========================================================
          MODAL: ADD / EDIT MATERIAL
      ======================================================== */}
      {isItemModalOpen && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-card" style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--jb-crimson-light)', color: 'var(--jb-crimson)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  {editingItem ? 'Edit Material Details' : 'Register New Material SKU'}
                </h3>
              </div>
              <button onClick={() => setIsItemModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveItem}>
              <div className="inv-form-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                {/* SKU Code */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>SKU / Material Code *</label>
                    {!editingItem && (
                      <button type="button" onClick={handleGenerateSku} style={{ background: 'none', border: 'none', color: 'var(--jb-crimson)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                        Auto Generate
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FAB-RAW-001"
                    value={itemForm.sku}
                    onChange={(e) => setItemForm(prev => ({ ...prev, sku: e.target.value.toUpperCase() }))}
                    disabled={Boolean(editingItem)}
                    className="touch-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Category */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Category *</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm(prev => ({ ...prev, category: e.target.value }))}
                    className="touch-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  >
                    {(meta.categories || []).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Material Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Material Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pure Raw Silk - Crimson Red (60 Inch)"
                  value={itemForm.name}
                  onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                  className="touch-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Description / Fabric Specs</label>
                <textarea
                  rows={2}
                  placeholder="Fabric composition, GSM, weave type, supplier reference..."
                  value={itemForm.description}
                  onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                  className="touch-input"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                />
              </div>

              {/* Unit, Opening Stock, Unit Cost, and Auto-calculated Total Stock Value */}
              <div className="inv-form-grid-2col" style={{ display: 'grid', gridTemplateColumns: !editingItem ? '1fr 1fr' : '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Unit of Measure *</label>
                  <select
                    value={itemForm.unit}
                    onChange={(e) => setItemForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="touch-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  >
                    {(meta.units || []).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                {!editingItem && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                      Opening Stock ({itemForm.unit || 'Units'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={itemForm.openingStock}
                      onChange={(e) => setItemForm(prev => ({ ...prev, openingStock: e.target.value }))}
                      className="touch-input"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Cost Per Unit (LKR)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={itemForm.unitCost}
                    onChange={(e) => setItemForm(prev => ({ ...prev, unitCost: e.target.value }))}
                    className="touch-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    <span>Total Stock Value (LKR)</span>
                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800 }}>Auto-calculated</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`LKR ${((Number(editingItem ? editingItem.currentStock : itemForm.openingStock) || 0) * (Number(itemForm.unitCost) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    className="touch-input"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      color: '#047857',
                      cursor: 'not-allowed'
                    }}
                    title="Opening Stock Ã— Cost Per Unit (Read-only)"
                  />
                </div>
              </div>

              {/* Thresholds & Location */}
              <div className="inv-form-grid-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Min Stock Level</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={itemForm.minStockLevel}
                    onChange={(e) => setItemForm(prev => ({ ...prev, minStockLevel: e.target.value }))}
                    className="touch-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Reorder Level</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={itemForm.reorderLevel}
                    onChange={(e) => setItemForm(prev => ({ ...prev, reorderLevel: e.target.value }))}
                    className="touch-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Storage Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Rack A-02"
                    value={itemForm.storageLocation}
                    onChange={(e) => setItemForm(prev => ({ ...prev, storageLocation: e.target.value }))}
                    className="touch-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="inv-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '9px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingItem}
                  className="btn-primary"
                  style={{
                    padding: '9px 22px',
                    backgroundColor: 'var(--jb-crimson)',
                    color: '#ffffff',
                    fontWeight: 700,
                    opacity: isSubmittingItem ? 0.7 : 1,
                    cursor: isSubmittingItem ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingItem ? (editingItem ? 'Saving Changes...' : 'Creating Material...') : (editingItem ? 'Save Changes' : 'Create Material')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: QUICK STOCK MOVEMENT (STOCK IN / ISSUE)
      ======================================================== */}
      {isMovementModalOpen && movementItem && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-card" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Record Stock Movement</h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {movementItem.sku} — <strong>{movementItem.name}</strong> (Available: {movementItem.currentStock} {movementItem.unit})
                </div>
              </div>
              <button onClick={() => setIsMovementModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveMovement}>
              {/* Type Selection */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Transaction Type *</label>
                <select
                  value={movementForm.type}
                  onChange={(e) => setMovementForm(prev => ({ ...prev, type: e.target.value }))}
                  className="touch-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <option value="STOCK_IN">Stock Receipt (+ Into Store)</option>
                  <option value="ISSUE">Stock Issue (- Out of Store)</option>
                  <option value="RETURN">Customer/Supplier Return (+ Into Store)</option>
                  <option value="WASTAGE">Fabric Wastage / Scrap (- Loss)</option>
                  <option value="DAMAGED">Damaged Goods (- Loss)</option>
                  <option value="ADJUSTMENT">Physical Audit Stock Adjustment (= Count)</option>
                </select>
              </div>

              {/* Quantity */}
              {movementForm.type === 'ADJUSTMENT' ? (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Physical Counted Stock ({movementItem.unit}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    placeholder={`Current is ${movementItem.currentStock}`}
                    value={movementForm.countedQuantity}
                    onChange={(e) => setMovementForm(prev => ({ ...prev, countedQuantity: e.target.value }))}
                    className="touch-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: movementForm.type === 'STOCK_IN' ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                      Quantity ({movementItem.unit}) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0.001"
                      placeholder="e.g. 10.5"
                      value={movementForm.quantity}
                      onChange={(e) => setMovementForm(prev => ({ ...prev, quantity: e.target.value }))}
                      className="touch-input"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                    />
                  </div>

                  {movementForm.type === 'STOCK_IN' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                        Unit Cost (LKR)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder={String(movementItem.unitCost || '0.00')}
                        value={movementForm.unitCost}
                        onChange={(e) => setMovementForm(prev => ({ ...prev, unitCost: e.target.value }))}
                        className="touch-input"
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Reference No */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Reference No (Invoice / PO / Receipt)</label>
                <input
                  type="text"
                  placeholder="e.g. INV-8891, PO-102"
                  value={movementForm.referenceNo}
                  onChange={(e) => setMovementForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                  className="touch-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                />
              </div>

              {/* Reason */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Received new shipment from Colombo supplier"
                  value={movementForm.reason}
                  onChange={(e) => setMovementForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="touch-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                />
              </div>

              {/* Actions */}
              <div className="inv-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsMovementModalOpen(false)} className="btn-secondary" style={{ padding: '9px 18px' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMovement}
                  className="btn-primary"
                  style={{
                    padding: '9px 22px',
                    backgroundColor: movementForm.type === 'STOCK_IN' ? '#15803d' : 'var(--jb-crimson)',
                    color: '#ffffff',
                    fontWeight: 700,
                    opacity: isSubmittingMovement ? 0.7 : 1,
                    cursor: isSubmittingMovement ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingMovement ? 'Processing Movement...' : 'Confirm Stock Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: VIEW MATERIAL SPECIFICATIONS & AUDIT
      ======================================================== */}
      {viewingItem && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-card" style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--jb-navy)' }}>
                  <Package size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{viewingItem.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--jb-navy)', fontSize: '0.8rem' }}>{viewingItem.sku}</span>
                    <span className="badge badge-navy" style={{ fontSize: '0.68rem' }}>{viewingItem.category}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewingItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '14px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>AVAILABLE STOCK</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: viewingItem.currentStock <= 0 ? '#dc2626' : viewingItem.currentStock <= viewingItem.minStockLevel ? '#d97706' : '#15803d', marginTop: '2px' }}>
                  {viewingItem.currentStock} {viewingItem.unit}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Min: {viewingItem.minStockLevel} | Reorder: {viewingItem.reorderLevel}
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>VALUATION & COST</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
                  LKR {(Number(viewingItem.currentStock || 0) * Number(viewingItem.unitCost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Unit WAC: LKR {Number(viewingItem.unitCost || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {viewingItem.description && (
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <strong style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Description / Specs:</strong>
                  <div>{viewingItem.description}</div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px', borderBottom: '1px dashed var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Storage Location:</span>
                <strong>{viewingItem.storageLocation || 'Not Assigned'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px', borderBottom: '1px dashed var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Stock Status:</span>
                <strong>{viewingItem.currentStock <= 0 ? 'Out of Stock' : viewingItem.currentStock <= viewingItem.minStockLevel ? 'Low Stock' : viewingItem.currentStock <= viewingItem.reorderLevel ? 'Reorder Due' : 'Healthy'}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { const it = viewingItem; setViewingItem(null); handleOpenMovementModal(it, 'STOCK_IN'); }}
                className="btn-secondary"
                style={{ color: '#15803d', borderColor: '#a7f3d0', backgroundColor: '#ecfdf5', fontWeight: 700, padding: '7px 12px', fontSize: '0.8rem' }}
              >
                + Receive Stock
              </button>
              <button
                type="button"
                onClick={() => { const it = viewingItem; setViewingItem(null); handleOpenMovementModal(it, 'ISSUE'); }}
                className="btn-secondary"
                style={{ color: '#ea580c', borderColor: '#fed7aa', backgroundColor: '#fff7ed', fontWeight: 700, padding: '7px 12px', fontSize: '0.8rem' }}
              >
                - Issue Stock
              </button>
              <button
                type="button"
                onClick={() => { const it = viewingItem; setViewingItem(null); handleOpenEditModal(it); }}
                className="btn-secondary"
                style={{ fontWeight: 700, padding: '7px 14px', fontSize: '0.8rem' }}
              >
                Edit Material
              </button>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="btn-secondary"
                style={{ padding: '7px 14px', fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CREATE ORDER MATERIAL REQUISITION
      ======================================================== */}
      {isNewRequestModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: 'var(--jb-crimson-light)', color: 'var(--jb-crimson)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Create Order Material Requisition</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Link fabrics and trims to a customer order and assign a tailor. Stock is deducted only upon manager issue.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsNewRequestModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNewRequest}>
              {/* 1. Order Lookup */}
              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  1. Search Customer Order (Order Number or Customer Name) *
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    required={!selectedOrder}
                    placeholder="Type order number e.g. ORD-2026-0001 or customer name..."
                    value={orderSearchText}
                    onChange={(e) => handleSearchOrders(e.target.value)}
                    className="touch-input"
                    style={{ width: '100%', paddingLeft: '38px', height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.88rem' }}
                  />
                  {isSearchingOrders && (
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Searching...
                    </div>
                  )}
                </div>

                {/* Autocomplete Dropdown List */}
                {orderSearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    marginTop: '4px'
                  }}>
                    {orderSearchResults.map(ord => (
                      <div
                        key={ord.id}
                        onClick={() => handleSelectOrder(ord)}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--jb-crimson)' }}>{ord.orderNumber}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Customer: <strong>{ord.customerName}</strong> {ord.dressType ? `â€¢ ${ord.dressType}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>{ord.status}</span>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Tailor: {ord.tailorName || 'None'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Order Preview Card */}
                {selectedOrder && (
                  <div style={{
                    marginTop: '10px',
                    padding: '12px 16px',
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: '8px',
                    border: '1px solid #10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem'
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#10b981' }}>
                        âœ“ Selected Order: {selectedOrder.orderNumber} â€” {selectedOrder.customerName}
                      </div>
                      <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                        Dress Type: <strong>{selectedOrder.dressType || 'Standard'}</strong> â€¢ Fabric: <strong>{selectedOrder.fabricSuppliedBy || 'Store Fabric'}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedOrder(null); setOrderSearchText(''); }}
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    >
                      Change Order
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Tailor Assignment */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                  2. Assigned Tailor *
                </label>
                <select
                  value={reqTailorId}
                  onChange={(e) => {
                    const tId = e.target.value;
                    setReqTailorId(tId);
                    const found = (meta.tailors || []).find(t => String(t.id) === String(tId));
                    setReqTailorName(found ? found.name : '');
                  }}
                  className="touch-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <option value="">-- Select Tailor for this Order --</option>
                  {(meta.tailors || []).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.role})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Materials issued against this requisition will be charged and tracked under this tailor.
                </div>
              </div>

              {/* 3. Material Lines */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 800 }}>3. Required Materials & Supplies *</label>
                  <button
                    type="button"
                    onClick={handleAddReqLine}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--jb-crimson)', borderColor: 'var(--jb-crimson)' }}
                  >
                    + Add Another Material
                  </button>
                </div>

                {reqItems.map((line, idx) => {
                  const selectedMat = catalogueItems.find(c => String(c.id) === String(line.itemId));
                  return (
                    <div key={idx} style={{
                      padding: '12px',
                      backgroundColor: 'var(--bg-main)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      marginBottom: '10px'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'flex-start' }}>
                        {/* Material Selector */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>Material SKU / Name</label>
                          <select
                            required
                            value={line.itemId}
                            onChange={(e) => handleUpdateReqLine(idx, 'itemId', e.target.value)}
                            className="touch-input"
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
                          >
                            <option value="">-- Choose Material --</option>
                            {catalogueItems.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.sku}  {item.name} ({item.currentStock} {item.unit} in stock)
                              </option>
                            ))}
                          </select>
                          {selectedMat && (
                            <div style={{ fontSize: '0.72rem', color: selectedMat.currentStock > 0 ? '#15803d' : '#dc2626', marginTop: '3px', fontWeight: 700 }}>
                              Current Warehouse Stock: {selectedMat.currentStock} {selectedMat.unit}
                            </div>
                          )}
                        </div>

                        {/* Quantity */}
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                            Qty ({selectedMat ? selectedMat.unit : 'Units'})
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            required
                            placeholder="e.g. 2.5"
                            value={line.quantity}
                            onChange={(e) => handleUpdateReqLine(idx, 'quantity', e.target.value)}
                            className="touch-input"
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
                          />
                        </div>

                        {/* Remove button */}
                        {reqItems.length > 1 && (
                          <div style={{ paddingTop: '20px' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveReqLine(idx)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '4px' }}
                              title="Remove item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Notes line */}
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="text"
                          placeholder="Cutting notes, placement instruction, color shade..."
                          value={line.notes}
                          onChange={(e) => handleUpdateReqLine(idx, 'notes', e.target.value)}
                          className="touch-input"
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewRequestModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '9px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReq}
                  className="btn-primary"
                  style={{ padding: '9px 24px', backgroundColor: 'var(--jb-crimson)', color: '#ffffff', fontWeight: 800 }}
                >
                  {isSubmittingReq ? 'Submitting...' : 'Submit Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ISSUE MATERIAL TO TAILOR
      ======================================================== */}
      {issueModalReq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>Confirm Material Issue</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Req: <strong>{issueModalReq.requestNo}</strong>  Order: <strong>{issueModalReq.orderNumber}</strong>
                </div>
              </div>
              <button onClick={() => setIssueModalReq(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Info Summary Box */}
            <div style={{
              padding: '14px',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginBottom: '16px',
              fontSize: '0.82rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Material:</span>
                <strong>{issueModalReq.sku} â€” {issueModalReq.itemName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assigned Tailor:</span>
                <strong>{issueModalReq.tailorName || 'Not Assigned'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Requested:</span>
                <strong>{issueModalReq.requestedQty} {issueModalReq.unit}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Already Issued:</span>
                <span style={{ color: '#15803d', fontWeight: 700 }}>{issueModalReq.issuedQty} {issueModalReq.unit}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Remaining Needed:</span>
                <strong style={{ color: '#ea580c' }}>{issueModalReq.remainingToIssue} {issueModalReq.unit}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Current Warehouse Stock:</span>
                <strong style={{ color: issueModalReq.currentStock >= issueModalReq.remainingToIssue ? '#15803d' : '#dc2626' }}>
                  {issueModalReq.currentStock} {issueModalReq.unit}
                </strong>
              </div>
            </div>

            <form onSubmit={handleSubmitIssue}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                  Issue Quantity ({issueModalReq.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  max={Math.min(issueModalReq.remainingToIssue, issueModalReq.currentStock)}
                  required
                  value={issueQty}
                  onChange={(e) => setIssueQty(e.target.value)}
                  className="touch-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem', fontWeight: 700 }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Max allowed: {Math.min(issueModalReq.remainingToIssue, issueModalReq.currentStock)} {issueModalReq.unit} (Partial issues supported)
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                  Issue Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Issued roll #4, verified dye lot match"
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  className="touch-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIssueModalReq(null)}
                  className="btn-secondary"
                  style={{ padding: '9px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIssue}
                  className="btn-primary"
                  style={{ padding: '9px 24px', backgroundColor: '#15803d', color: '#ffffff', fontWeight: 800 }}
                >
                  {isSubmittingIssue ? 'Issuing...' : 'Confirm Stock Deduction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: RECORD MATERIAL RETURN / DAMAGED / WASTAGE
      ======================================================== */}
      {returnModalReq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Record Material Return / Wastage</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Req: <strong>{returnModalReq.requestNo}</strong> Order: <strong>{returnModalReq.orderNumber}</strong>
                </div>
              </div>
              <button onClick={() => setReturnModalReq(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Outstanding Summary */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '8px',
              border: '1px solid #ea580c',
              marginBottom: '16px',
              fontSize: '0.84rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Currently with Tailor ({returnModalReq.tailorName || 'Tailor'}):</span>
                <strong style={{ fontSize: '1.1rem', color: '#ea580c' }}>
                  {returnModalReq.outstandingWithTailor} {returnModalReq.unit}
                </strong>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Issued: {returnModalReq.issuedQty} {returnModalReq.unit} | Returned: {returnModalReq.returnedQty} | Damaged: {returnModalReq.damagedQty || 0} | Wastage: {returnModalReq.wastageQty}
              </div>
            </div>

            <form onSubmit={handleSubmitReturn}>
              {/* Return Condition Options */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, marginBottom: '8px' }}>
                  Select Return Classification *
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Option 1: REUSABLE */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: returnCondition === 'REUSABLE' ? '2px solid #10b981' : '1px solid var(--border-color)',
                    backgroundColor: returnCondition === 'REUSABLE' ? '#ecfdf5' : 'transparent',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="returnCondition"
                      value="REUSABLE"
                      checked={returnCondition === 'REUSABLE'}
                      onChange={() => setReturnCondition('REUSABLE')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, color: '#15803d', fontSize: '0.85rem' }}>
                        Reusable Material Return (Restores Warehouse Stock)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Uncut or clean fabric roll / trims returned in good condition. Increases warehouse inventory balance.
                      </div>
                    </div>
                  </label>

                  {/* Option 2: DAMAGED */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: returnCondition === 'DAMAGED' ? '2px solid #dc2626' : '1px solid var(--border-color)',
                    backgroundColor: returnCondition === 'DAMAGED' ? '#fef2f2' : 'transparent',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="returnCondition"
                      value="DAMAGED"
                      checked={returnCondition === 'DAMAGED'}
                      onChange={() => setReturnCondition('DAMAGED')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.85rem' }}>
                        Damaged Stock Return (Unusable - No Stock Restoration)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Damaged during tailoring or defective. Stock is NOT restored to warehouse; logged for quality control.
                      </div>
                    </div>
                  </label>

                  {/* Option 3: WASTAGE */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: returnCondition === 'WASTAGE' ? '2px solid #ca8a04' : '1px solid var(--border-color)',
                    backgroundColor: returnCondition === 'WASTAGE' ? '#fefce8' : 'transparent',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="returnCondition"
                      value="WASTAGE"
                      checked={returnCondition === 'WASTAGE'}
                      onChange={() => setReturnCondition('WASTAGE')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, color: '#ca8a04', fontSize: '0.85rem' }}>
                        Cutting Wastage / Scrap Trimmings (Production Loss)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Normal scrap / off-cuts from cutting. Stock is NOT restored; recorded to monitor pattern efficiency.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Quantity */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                  Quantity ({returnModalReq.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  max={returnModalReq.outstandingWithTailor}
                  required
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  className="touch-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem', fontWeight: 700 }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Maximum: {returnModalReq.outstandingWithTailor} {returnModalReq.unit}
                </div>
              </div>

              {/* Reason / Notes */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                  Reason / Condition Notes {returnCondition !== 'REUSABLE' ? '*' : ''}
                </label>
                <input
                  type="text"
                  required={returnCondition !== 'REUSABLE'}
                  placeholder={returnCondition === 'REUSABLE' ? 'e.g. Extra 0.5m left after cutting pattern' : 'e.g. Snag in weave / off-cut trimmings'}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="touch-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setReturnModalReq(null)}
                  className="btn-secondary"
                  style={{ padding: '9px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="btn-primary"
                  style={{
                    padding: '9px 24px',
                    backgroundColor: returnCondition === 'REUSABLE' ? '#15803d' : returnCondition === 'DAMAGED' ? '#dc2626' : '#ca8a04',
                    color: '#ffffff',
                    fontWeight: 800
                  }}
                >
                  {isSubmittingReturn ? 'Saving...' : 'Confirm Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
