import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { API_URL } from '../config/api';
import { generateCustomerFabricPDF } from '../utils/customerFabricPdf';
import { CameraCaptureModal } from './common/CameraCaptureModal';
import { validateImageFileClient } from '../utils/imageUploadHelper';
import {
  Scissors,
  Plus,
  Search,
  CheckCircle2,
  X,
  Download,
  AlertTriangle,
  Building,
  FileText,
  History,
  RefreshCw,
  Inbox,
  Camera,
  Image,
  Eye,
  Trash2
} from 'lucide-react';

const MATERIAL_CATEGORIES = [
  'Fabric',
  'Lining',
  'Thread',
  'Buttons',
  'Zipper',
  'Lace',
  'Beads',
  'Embroidery Materials',
  'Other'
];

const MATERIAL_UNITS = [
  'Meter',
  'Yard',
  'Piece',
  'Roll',
  'Bundle',
  'Kilogram (kg)',
  'Gram (g)',
  'Set',
  'Spool',
  'Cone',
  'Packet',
  'Box',
  'Dozen'
];

const CONDITIONS_ON_RECEIPT = [
  'New',
  'Good',
  'Damaged',
  'Other'
];

const FABRIC_TYPES = [
  'Silk',
  'Raw Silk',
  'Cotton',
  'Chiffon',
  'Georgette',
  'Velvet',
  'Organza',
  'Linen',
  'Crepe',
  'Brocade',
  'Satin',
  'Net',
  'Lace',
  'Banarasi',
  'Other'
];

export const CustomerFabricTracker = ({ user, activeBranch, authHeaders, meta }) => {
  // State
  const [fabrics, setFabrics] = useState([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    totalReceived: 0,
    totalAvailableInStore: 0,
    totalWithTailors: 0,
    totalConsumed: 0,
    totalReturnedToStore: 0,
    totalReturnedToCustomer: 0,
    totalWaste: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fabricTypeFilter, setFabricTypeFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pages: 1 });
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Modals
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [activeActionModal, setActiveActionModal] = useState(null); // 'ISSUE' | 'TAILOR_RETURN' | 'CONSUME' | 'WASTE' | 'RETURN_CUSTOMER' | 'HISTORY'
  const [selectedItem, setSelectedItem] = useState(null);

  // Customer & Order lookup in Receive Material Modal
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [isSearchingOrders, setIsSearchingOrders] = useState(false);
  const [orderSearchText, setOrderSearchText] = useState('');
  const [orderSearchResults, setOrderSearchResults] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Material Photo – Camera & Gallery state
  const [materialPhotoFile, setMaterialPhotoFile] = useState(null);
  const [materialPhotoPreview, setMaterialPhotoPreview] = useState(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState(null);
  const galleryInputRef = useRef(null);

  // Receive Form State
  const [receiveForm, setReceiveForm] = useState({
    branchId: '',
    customerId: '',
    customerName: '',
    customerPhone: '',
    orderId: '',
    orderNumber: '',
    orderStatus: '',
    materialCategory: 'Fabric',
    materialName: '',
    fabricColour: '',
    fabricDescription: '',
    receivedQty: '',
    unit: 'Meter',
    dateReceived: new Date().toISOString().split('T')[0],
    conditionOnReceipt: 'Good',
    notes: '',
    photoUrl: ''
  });
  const [isSubmittingReceive, setIsSubmittingReceive] = useState(false);

  // Action Form State
  const [actionQty, setActionQty] = useState('');
  const [actionTailorId, setActionTailorId] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // History state
  const [historyMovements, setHistoryMovements] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Check if current user is Super Admin/CEO, Admin, or Manager
  const isManager = useMemo(() => {
    if (!user || !user.role) return false;
    const r = String(user.role).trim().toUpperCase();
    return r === 'SUPER_ADMIN' || r === 'CEO' || r === 'ADMIN' || r === 'MANAGER';
  }, [user]);

  // Auto-dismiss banners
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // Fetch Fabrics
  const fetchFabrics = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (searchQuery.trim()) p.append('search', searchQuery.trim());
      if (statusFilter !== 'ALL') p.append('status', statusFilter);
      if (fabricTypeFilter !== 'ALL') p.append('fabricType', fabricTypeFilter);
      if (fromDate) p.append('from', fromDate);
      if (toDate) p.append('to', toDate);

      // Handle active branch or branch filter
      const effectiveBranch = branchFilter !== 'ALL' ? branchFilter : (activeBranch !== 'ALL' ? activeBranch : null);
      if (effectiveBranch) {
        const foundB = (meta?.branches || []).find(b => b.name === effectiveBranch || String(b.id) === String(effectiveBranch));
        if (foundB) p.append('branchId', foundB.id);
      }

      p.append('page', pagination.page);
      p.append('pageSize', pagination.pageSize);

      const res = await fetch(`${API_URL}/api/inventory/customer-fabrics?${p.toString()}`, {
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success) {
        setFabrics(data.data || []);
        if (data.summary) setSummary(data.summary);
        if (data.pagination) setPagination(data.pagination);
      } else {
        setError(data.message || 'Failed to fetch customer fabrics.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error fetching customer fabrics.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, fabricTypeFilter, branchFilter, activeBranch, fromDate, toDate, pagination.page, pagination.pageSize, authHeaders, meta]);

  useEffect(() => {
    fetchFabrics();
  }, [fetchFabrics]);

  // Search Customers for Receive Modal
  const handleSearchCustomers = async () => {
    if (!customerSearchText.trim()) return;
    setIsSearchingCustomers(true);
    try {
      const res = await fetch(`${API_URL}/api/customers/search?query=${encodeURIComponent(customerSearchText.trim())}`, {
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success) {
        setCustomerSearchResults(data.customers || []);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  // Select Customer & load their orders
  const handleSelectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setCustomerSearchResults([]);
    setSelectedOrder(null);
    setCustomerOrders([]);
    setReceiveForm(prev => ({
      ...prev,
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.primaryPhone || cust.phone || '',
      orderId: '',
      orderNumber: '',
      orderStatus: ''
    }));

    // Fetch customer's orders
    try {
      const res = await fetch(`${API_URL}/api/inventory/customer-fabrics/orders/lookup?customerId=${cust.id}`, {
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success) {
        setCustomerOrders(data.data || []);
      }
    } catch (e) {
      console.warn('Error fetching customer orders:', e);
    }
  };

  // Search Orders for Receive Modal
  const handleSearchOrders = async () => {
    if (!orderSearchText.trim()) return;
    setIsSearchingOrders(true);
    try {
      const custParam = selectedCustomer?.id ? `&customerId=${selectedCustomer.id}` : '';
      const res = await fetch(`${API_URL}/api/inventory/customer-fabrics/orders/lookup?q=${encodeURIComponent(orderSearchText.trim())}${custParam}`, {
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success) {
        setOrderSearchResults(data.data || []);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsSearchingOrders(false);
    }
  };

  const handleSelectOrder = (o) => {
    setSelectedOrder(o);
    setOrderSearchResults([]);
    // If no customer selected yet, auto-select customer from order
    if (!selectedCustomer) {
      setSelectedCustomer({
        id: o.customerId,
        name: o.customerName,
        primaryPhone: o.customerPhone
      });
    }
    setReceiveForm(prev => ({
      ...prev,
      orderId: o.id,
      orderNumber: o.orderNumber,
      orderStatus: o.status || '',
      customerId: o.customerId,
      customerName: o.customerName || prev.customerName || '',
      customerPhone: o.customerPhone || prev.customerPhone || '',
      branchId: o.branchId ? String(o.branchId) : prev.branchId,
      materialName: prev.materialName || o.garmentFabricType || '',
      fabricColour: prev.fabricColour || o.garmentFabricColour || ''
    }));
  };

  // Photo handlers: Gallery & Camera
  const handleGalleryFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFileClient(file, {
      maxSizeMB: 20,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
    });
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setError(null);
    setMaterialPhotoFile(file);
    if (materialPhotoPreview && materialPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(materialPhotoPreview);
    }
    setMaterialPhotoPreview(URL.createObjectURL(file));
  };

  const handleCameraCapture = (file) => {
    if (!file) return;
    const validation = validateImageFileClient(file, {
      maxSizeMB: 20,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
    });
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setError(null);
    setMaterialPhotoFile(file);
    if (materialPhotoPreview && materialPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(materialPhotoPreview);
    }
    setMaterialPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setMaterialPhotoFile(null);
    if (materialPhotoPreview && materialPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(materialPhotoPreview);
    }
    setMaterialPhotoPreview(null);
    setReceiveForm(prev => ({ ...prev, photoUrl: '' }));
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
    }
  };

  // Open Receive Modal
  const handleOpenReceiveModal = () => {
    setSelectedCustomer(null);
    setCustomerSearchText('');
    setCustomerSearchResults([]);
    setCustomerOrders([]);
    setSelectedOrder(null);
    setOrderSearchText('');
    setOrderSearchResults([]);
    setMaterialPhotoFile(null);
    if (materialPhotoPreview && materialPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(materialPhotoPreview);
    }
    setMaterialPhotoPreview(null);
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
    }
    const defaultBranchId = activeBranch !== 'ALL' && activeBranch
      ? ((meta?.branches || []).find(b => b.name === activeBranch)?.id || meta?.branches?.[0]?.id || '')
      : (meta?.branches?.[0]?.id || '');

    setReceiveForm({
      branchId: defaultBranchId ? String(defaultBranchId) : '',
      customerId: '',
      customerName: '',
      customerPhone: '',
      orderId: '',
      orderNumber: '',
      orderStatus: '',
      materialCategory: 'Fabric',
      materialName: '',
      fabricColour: '',
      fabricDescription: '',
      receivedQty: '',
      unit: 'Meter',
      dateReceived: new Date().toISOString().split('T')[0],
      conditionOnReceipt: 'Good',
      notes: '',
      photoUrl: ''
    });
    setIsReceiveModalOpen(true);
  };

  // Submit Receive Customer Fabric
  const handleSubmitReceive = async (e) => {
    e.preventDefault();
    if (!receiveForm.customerId) {
      setError('Please search and select an existing customer.');
      return;
    }
    if (!receiveForm.orderId) {
      setError('Please search and select an order for this customer.');
      return;
    }
    if (selectedCustomer && selectedOrder && selectedOrder.customerId !== selectedCustomer.id) {
      setError('The selected order does not belong to the selected customer.');
      return;
    }
    if (!receiveForm.materialName.trim()) {
      setError('Material / Fabric Name is required.');
      return;
    }
    if (!receiveForm.fabricColour.trim()) {
      setError('Colour is required.');
      return;
    }
    const q = parseFloat(receiveForm.receivedQty);
    if (!q || q <= 0 || isNaN(q)) {
      setError('Quantity received must be a positive number greater than zero.');
      return;
    }
    if (!receiveForm.unit) {
      setError('Unit is required.');
      return;
    }

    setIsSubmittingReceive(true);
    setError(null);
    try {
      let uploadedPhotoUrl = receiveForm.photoUrl || null;
      if (materialPhotoFile) {
        const formData = new FormData();
        formData.append('file', materialPhotoFile);
        const token = localStorage.getItem('jb_token');
        const uploadRes = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          uploadedPhotoUrl = uploadData.imageUrl || uploadData.photoUrl;
        } else {
          setError(uploadData.message || 'Error uploading material photo.');
          setIsSubmittingReceive(false);
          return;
        }
      }

      const res = await fetch(`${API_URL}/api/inventory/customer-fabrics`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          branchId: receiveForm.branchId ? parseInt(receiveForm.branchId, 10) : null,
          customerId: parseInt(receiveForm.customerId, 10),
          orderId: parseInt(receiveForm.orderId, 10),
          materialCategory: receiveForm.materialCategory,
          materialName: receiveForm.materialName.trim(),
          fabricType: receiveForm.materialName.trim(),
          fabricColour: receiveForm.fabricColour.trim(),
          fabricDescription: receiveForm.fabricDescription?.trim() || null,
          receivedQty: q,
          unit: receiveForm.unit,
          dateReceived: receiveForm.dateReceived,
          conditionOnReceipt: receiveForm.conditionOnReceipt,
          notes: receiveForm.notes?.trim() || null,
          photoUrl: uploadedPhotoUrl,
          idempotencyKey: `RECEIVE:${receiveForm.orderId}:${Date.now()}`
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Customer fabric received successfully (${data.data?.code}).`);
        setIsReceiveModalOpen(false);
        setMaterialPhotoFile(null);
        setMaterialPhotoPreview(null);
        fetchFabrics();
      } else {
        setError(data.message || 'Failed to register customer fabric.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error registering customer fabric.');
    } finally {
      setIsSubmittingReceive(false);
    }
  };

  // Open Action Modal
  const handleOpenActionModal = (item, action) => {
    setSelectedItem(item);
    setActiveActionModal(action);
    setActionQty('');
    setActionNotes('');
    setActionTailorId(item.assignedTailorId ? String(item.assignedTailorId) : '');
    setError(null);

    if (action === 'HISTORY') {
      fetchMovementHistory(item.id);
    }
  };

  // Fetch Movement History
  const fetchMovementHistory = async (id) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_URL}/api/inventory/customer-fabrics/${id}`, {
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success && data.data) {
        setHistoryMovements(data.data.movements || []);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Submit Action (Issue, Return to store, Consume, Waste, Return to customer)
  const handleSubmitAction = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    const q = parseFloat(actionQty);
    if (!q || q <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    let endpoint = '';
    let body = { quantity: q, notes: actionNotes };

    if (activeActionModal === 'ISSUE') {
      endpoint = `${API_URL}/api/inventory/customer-fabrics/${selectedItem.id}/issue`;
      if (actionTailorId) body.tailorId = Number(actionTailorId);
    } else if (activeActionModal === 'TAILOR_RETURN') {
      endpoint = `${API_URL}/api/inventory/customer-fabrics/${selectedItem.id}/tailor-return`;
    } else if (activeActionModal === 'CONSUME') {
      endpoint = `${API_URL}/api/inventory/customer-fabrics/${selectedItem.id}/consume`;
    } else if (activeActionModal === 'WASTE') {
      endpoint = `${API_URL}/api/inventory/customer-fabrics/${selectedItem.id}/waste`;
    } else if (activeActionModal === 'RETURN_CUSTOMER') {
      endpoint = `${API_URL}/api/inventory/customer-fabrics/${selectedItem.id}/return-to-customer`;
    }

    setIsSubmittingAction(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || 'Action completed successfully.');
        setActiveActionModal(null);
        setSelectedItem(null);
        fetchFabrics();
      } else {
        setError(data.message || 'Operation failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error executing fabric action.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Helper: Fetch all records matching active filters for unpaginated export
  const fetchExportDataset = async () => {
    try {
      const p = new URLSearchParams();
      if (searchQuery.trim()) p.append('search', searchQuery.trim());
      if (statusFilter !== 'ALL') p.append('status', statusFilter);
      if (fabricTypeFilter !== 'ALL') p.append('fabricType', fabricTypeFilter);
      if (fromDate) p.append('from', fromDate);
      if (toDate) p.append('to', toDate);

      const effectiveBranch = branchFilter !== 'ALL' ? branchFilter : (activeBranch !== 'ALL' ? activeBranch : null);
      if (effectiveBranch) {
        const foundB = (meta?.branches || []).find(b => b.name === effectiveBranch || String(b.id) === String(effectiveBranch));
        if (foundB) p.append('branchId', foundB.id);
      }
      p.append('all', 'true');

      const res = await fetch(`${API_URL}/api/inventory/customer-fabrics?${p.toString()}`, {
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success) {
        return { items: data.data || [], summaryTotals: data.summary || summary };
      }
    } catch (err) {
      console.warn('Error fetching all filtered records, falling back to loaded records', err);
    }
    return { items: fabrics, summaryTotals: summary };
  };

  // Export CSV (Filtered Records)
  const handleExportCSV = async () => {
    setIsExportingCsv(true);
    try {
      const { items } = await fetchExportDataset();
      const headers = [
        'Fabric Code',
        'Order Number',
        'Customer Name',
        'Customer Phone',
        'Fabric Type',
        'Fabric Colour',
        'Description',
        'Received Qty',
        'In Store Qty',
        'With Tailor Qty',
        'Consumed Qty',
        'Tailor Return Qty',
        'Returned to Customer Qty',
        'Waste Qty',
        'Unit',
        'Customer Purchase Price',
        'Price Currency',
        'Price Type',
        'Purchase Receipt URL',
        'Status',
        'Branch',
        'Date Received'
      ];

      const rows = items.map(f => [
        f.code,
        f.orderNumber,
        f.customerName,
        f.customerPhone || '',
        f.fabricType,
        f.fabricColour,
        f.fabricDescription || '',
        f.receivedQty,
        f.availableQty,
        f.tailorBalanceQty,
        f.consumedQty,
        f.returnedToStoreQty,
        f.returnedToCustomerQty,
        f.wasteQty,
        f.unit,
        f.customerPurchasePrice !== null && f.customerPurchasePrice !== undefined && String(f.customerPurchasePrice).trim() !== '' ? f.customerPurchasePrice : 'Not provided',
        f.customerPurchaseCurrency || 'LKR',
        f.customerPurchasePriceType || 'TOTAL',
        f.customerPurchaseReceiptUrl || '',
        f.status,
        f.branchName || '',
        f.dateReceived ? new Date(f.dateReceived).toLocaleDateString() : ''
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `customer_fabrics_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV', err);
      setError('Failed to export CSV report.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Export PDF (Filtered Records with Professional JB Group Report Layout)
  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      const { items, summaryTotals } = await fetchExportDataset();

      // Resolve human-readable branch name
      let branchName = 'All Branches';
      const effectiveBranch = branchFilter !== 'ALL' ? branchFilter : (activeBranch !== 'ALL' ? activeBranch : null);
      if (effectiveBranch) {
        const foundB = (meta?.branches || []).find(b => b.name === effectiveBranch || String(b.id) === String(effectiveBranch));
        branchName = foundB ? foundB.name : effectiveBranch;
      }

      // Generate PDF document
      const doc = generateCustomerFabricPDF({
        records: items,
        summary: summaryTotals,
        filters: {
          branch: branchName,
          status: statusFilter === 'ALL' ? 'All Statuses' : statusFilter.replace(/_/g, ' '),
          fabricType: fabricTypeFilter === 'ALL' ? 'All Types' : fabricTypeFilter,
          search: searchQuery.trim(),
          from: fromDate,
          to: toDate
        },
        user,
        generatedAt: new Date()
      });

      doc.save(`Customer_Fabric_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF', err);
      setError('Failed to generate PDF report.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header & Primary Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(217, 4, 41, 0.1)',
            color: 'var(--jb-crimson)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Scissors size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-main)' }}>
              Customer Fabric Tracker
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Track customer-provided fabrics separately from company stock & valuation (WAC unaffected)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={isExportingCsv}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 14px', fontSize: '0.85rem' }}
            title="Export filtered records to CSV"
          >
            <Download size={16} />
            <span>{isExportingCsv ? 'Exporting...' : 'Export CSV'}</span>
          </button>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            disabled={isExportingPdf}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 14px', fontSize: '0.85rem' }}
            title="Export professional PDF tracking report"
          >
            <FileText size={16} />
            <span>{isExportingPdf ? 'Generating PDF...' : 'Export PDF'}</span>
          </button>

          {isManager && (
            <button
              onClick={handleOpenReceiveModal}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontSize: '0.88rem',
                fontWeight: 800
              }}
            >
              <Plus size={18} />
              <span>Receive Customer Fabric</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Success & Error Notifications */}
      {successMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 18px',
          backgroundColor: '#dcfce7',
          color: '#166534',
          borderRadius: '10px',
          border: '1px solid #bbf7d0',
          fontWeight: 700,
          fontSize: '0.88rem'
        }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 18px',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          borderRadius: '10px',
          border: '1px solid #fecaca',
          fontWeight: 700,
          fontSize: '0.88rem'
        }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Summary Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px'
      }}>
        <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Received
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
            {summary.totalReceived} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>M</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Across {summary.totalCount} receipts
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
            Available in Store
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#15803d', marginTop: '6px' }}>
            {summary.totalAvailableInStore} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>M</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#166534', marginTop: '2px' }}>
            Ready for issue or return
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
            Held with Tailors
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#b45309', marginTop: '6px' }}>
            {summary.totalWithTailors} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>M</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: '2px' }}>
            Active cutting / stitching
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
            Actual Consumed
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1d4ed8', marginTop: '6px' }}>
            {summary.totalConsumed} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>M</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#1e40af', marginTop: '2px' }}>
            Finished garment assemblies
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#faf5ff', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase' }}>
            Tailor Returns to Store
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#7e22ce', marginTop: '6px' }}>
            {summary.totalReturnedToStore} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>M</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b21a8', marginTop: '2px' }}>
            Reusable pieces returned
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#f0fdfa', borderRadius: '10px', border: '1px solid #99f6e4' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#115e59', textTransform: 'uppercase' }}>
            Returned to Customer
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f766e', marginTop: '6px' }}>
            {summary.totalReturnedToCustomer} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>M</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#115e59', marginTop: '2px' }}>
            Handed back upon delivery
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#fff1f2', borderRadius: '10px', border: '1px solid #fecdd3' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9f1239', textTransform: 'uppercase' }}>
            Wastage / Scrap
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#be123c', marginTop: '6px' }}>
            {summary.totalWaste} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>M</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#9f1239', marginTop: '2px' }}>
            Cutting trimmings / defect
          </div>
        </div>
      </div>

      {/* 4. Search and Filters Bar */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search customer, order #, code, fabric..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="touch-input"
            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', boxSizing: 'border-box' }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ minWidth: '150px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="touch-input"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: '#ffffff' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_STORE">In Store Balance (&gt; 0)</option>
            <option value="WITH_TAILOR">With Tailor (&gt; 0)</option>
            <option value="CONSUMED">Fully Consumed</option>
            <option value="RETURNED_TO_CUSTOMER">Returned to Customer</option>
          </select>
        </div>

        {/* Fabric Type Filter */}
        <div style={{ minWidth: '140px' }}>
          <select
            value={fabricTypeFilter}
            onChange={(e) => setFabricTypeFilter(e.target.value)}
            className="touch-input"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: '#ffffff' }}
          >
            <option value="ALL">All Fabric Types</option>
            {FABRIC_TYPES.map(ft => (
              <option key={ft} value={ft}>{ft}</option>
            ))}
          </select>
        </div>

        {/* Branch Filter */}
        {activeBranch === 'ALL' && (meta?.branches || []).length > 0 && (
          <div style={{ minWidth: '140px' }}>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="touch-input"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: '#ffffff' }}
            >
              <option value="ALL">All Branches</option>
              {meta.branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="touch-input"
            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            title="Received From Date"
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="touch-input"
            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            title="Received To Date"
          />
        </div>

        {/* Reset Filter Button */}
        {(searchQuery || statusFilter !== 'ALL' || fabricTypeFilter !== 'ALL' || branchFilter !== 'ALL' || fromDate || toDate) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setFabricTypeFilter('ALL');
              setBranchFilter('ALL');
              setFromDate('');
              setToDate('');
            }}
            className="btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.8rem' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* 5. Fabric Items Table */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
            <div>Loading customer fabrics...</div>
          </div>
        ) : fabrics.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Inbox size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: 800 }}>
              No Customer Fabric Records Found
            </h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem' }}>
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search filters or dates.'
                : 'Register customer-provided fabric against tailoring orders to begin tracking.'}
            </p>
            {isManager && (
              <button
                onClick={handleOpenReceiveModal}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                <Plus size={16} /> Receive First Customer Fabric
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-main)' }}>Fabric Code</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-main)' }}>Customer & Order</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-main)' }}>Fabric Details</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-main)', textAlign: 'right' }}>Total Recv</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: '#15803d', textAlign: 'right' }}>In Store</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: '#b45309', textAlign: 'right' }}>With Tailor</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: '#1d4ed8', textAlign: 'right' }}>Consumed</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-main)' }}>Status</th>
                  <th style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-main)', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fabrics.map((item, idx) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fbfcfd'
                    }}
                  >
                    {/* Code & Date */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--jb-navy)' }}>{item.code}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(item.dateReceived).toLocaleDateString()}
                      </div>
                      {item.branchName && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          📍 {item.branchName}
                        </div>
                      )}
                    </td>

                    {/* Customer & Order */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.customerName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.customerPhone}</div>
                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#f1f5f9',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          color: '#334155'
                        }}>
                          Order #{item.orderNumber}
                        </span>
                        {item.assignedTailorName && (
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            ✂ {item.assignedTailorName}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Fabric / Material Details */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        {item.photoUrl ? (
                          <div
                            onClick={() => setViewingPhotoUrl(item.photoUrl)}
                            style={{
                              cursor: 'pointer',
                              position: 'relative',
                              width: '42px',
                              height: '42px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1.5px solid #cbd5e1',
                              flexShrink: 0,
                              backgroundColor: '#f1f5f9'
                            }}
                            title="Click to view full photo"
                          >
                            <img
                              src={item.photoUrl.startsWith('http') || item.photoUrl.startsWith('data:') ? item.photoUrl : `${API_URL}${item.photoUrl}`}
                              alt={item.materialName || item.fabricType}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              background: 'rgba(0,0,0,0.6)',
                              color: '#ffffff',
                              padding: '1px 3px',
                              borderRadius: '3px 0 0 0',
                              fontSize: '9px',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              <Eye size={10} />
                            </div>
                          </div>
                        ) : null}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: item.fabricColour?.toLowerCase() || '#94a3b8',
                              border: '1px solid #cbd5e1',
                              display: 'inline-block'
                            }} />
                            <strong>{item.materialName || item.fabricType}</strong>
                            {item.materialCategory && item.materialCategory !== 'Fabric' && (
                              <span style={{ fontSize: '0.7rem', backgroundColor: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', color: '#475569', fontWeight: 700 }}>
                                {item.materialCategory}
                              </span>
                            )}
                            <span style={{ color: 'var(--text-muted)' }}>• {item.fabricColour}</span>
                          </div>
                          {item.fabricDescription && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {item.fabricDescription}
                            </div>
                          )}
                          {item.conditionOnReceipt && (
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                              Condition: <span style={{ fontWeight: 700, color: item.conditionOnReceipt === 'Damaged' ? '#dc2626' : '#15803d' }}>{item.conditionOnReceipt}</span>
                            </div>
                          )}
                          {/* Customer Reported Purchase Price */}
                          {item.customerPurchasePrice !== null && item.customerPurchasePrice !== undefined ? (
                            <div style={{ fontSize: '0.73rem', color: '#0369a1', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                              <span>
                                🏷 Price: <strong>{item.customerPurchaseCurrency || 'LKR'} {Number(item.customerPurchasePrice).toLocaleString()}</strong> {item.customerPurchasePriceType === 'PER_UNIT' ? `/${item.unit}` : '(Total)'}
                              </span>
                              {item.customerPurchaseReceiptUrl && (
                                <a
                                  href={`${API_URL}${item.customerPurchaseReceiptUrl}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#0284c7', textDecoration: 'underline', fontWeight: 700 }}
                                  title="View Customer Bill / Receipt"
                                >
                                  [Receipt]
                                </a>
                              )}
                            </div>
                          ) : null}
                          {(item.notes || item.conditionNotes) && (
                            <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '2px', fontStyle: 'italic' }}>
                              Note: {item.notes || item.conditionNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Total Recv */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800 }}>
                      {item.receivedQty} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{item.unit}</span>
                    </td>

                    {/* In Store Qty */}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: item.availableQty > 0 ? '#dcfce7' : '#f1f5f9',
                        color: item.availableQty > 0 ? '#15803d' : '#94a3b8',
                        fontWeight: 900,
                        fontSize: '0.88rem'
                      }}>
                        {item.availableQty} {item.unit}
                      </span>
                    </td>

                    {/* With Tailor Qty */}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: item.tailorBalanceQty > 0 ? '#fef3c7' : '#f1f5f9',
                        color: item.tailorBalanceQty > 0 ? '#b45309' : '#94a3b8',
                        fontWeight: 900,
                        fontSize: '0.88rem'
                      }}>
                        {item.tailorBalanceQty} {item.unit}
                      </span>
                    </td>

                    {/* Consumed Qty */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>
                      {item.consumedQty} <span style={{ fontSize: '0.75rem' }}>{item.unit}</span>
                      {item.wasteQty > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#dc2626' }}>
                          +{item.wasteQty} scrap
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        backgroundColor:
                          item.status === 'AVAILABLE' ? '#dcfce7' :
                          item.status === 'ISSUED' ? '#fef3c7' :
                          item.status === 'PARTIALLY_ISSUED' ? '#e0e7ff' :
                          item.status === 'CONSUMED' ? '#dbeafe' :
                          item.status === 'RETURNED_TO_CUSTOMER' ? '#ccfbf1' : '#f1f5f9',
                        color:
                          item.status === 'AVAILABLE' ? '#15803d' :
                          item.status === 'ISSUED' ? '#b45309' :
                          item.status === 'PARTIALLY_ISSUED' ? '#3730a3' :
                          item.status === 'CONSUMED' ? '#1e40af' :
                          item.status === 'RETURNED_TO_CUSTOMER' ? '#0f766e' : '#475569'
                      }}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {/* Issue to Tailor */}
                        <button
                          onClick={() => handleOpenActionModal(item, 'ISSUE')}
                          disabled={item.availableQty <= 0.0001}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: item.availableQty > 0.0001 ? '#ffffff' : '#f1f5f9',
                            color: item.availableQty > 0.0001 ? '#0f172a' : '#94a3b8',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: item.availableQty > 0.0001 ? 'pointer' : 'not-allowed'
                          }}
                          title="Issue store fabric to tailor"
                        >
                          Issue
                        </button>

                        {/* Tailor Return to Store (Only Manager/Admin/CEO) */}
                        {isManager && (
                          <button
                            onClick={() => handleOpenActionModal(item, 'TAILOR_RETURN')}
                            disabled={item.tailorBalanceQty <= 0.0001}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #bbf7d0',
                              backgroundColor: item.tailorBalanceQty > 0.0001 ? '#f0fdf4' : '#f1f5f9',
                              color: item.tailorBalanceQty > 0.0001 ? '#15803d' : '#94a3b8',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: item.tailorBalanceQty > 0.0001 ? 'pointer' : 'not-allowed'
                            }}
                            title="Confirm reusable fabric returned by tailor to store"
                          >
                            Return Store
                          </button>
                        )}

                        {/* Record Consumption */}
                        <button
                          onClick={() => handleOpenActionModal(item, 'CONSUME')}
                          disabled={item.tailorBalanceQty <= 0.0001}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #bfdbfe',
                            backgroundColor: item.tailorBalanceQty > 0.0001 ? '#eff6ff' : '#f1f5f9',
                            color: item.tailorBalanceQty > 0.0001 ? '#1d4ed8' : '#94a3b8',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: item.tailorBalanceQty > 0.0001 ? 'pointer' : 'not-allowed'
                          }}
                          title="Record actual fabric consumed in stitching"
                        >
                          Consume
                        </button>

                        {/* Return to Customer (Only Manager/Admin/CEO) */}
                        {isManager && (
                          <button
                            onClick={() => handleOpenActionModal(item, 'RETURN_CUSTOMER')}
                            disabled={item.availableQty <= 0.0001}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #99f6e4',
                              backgroundColor: item.availableQty > 0.0001 ? '#f0fdfa' : '#f1f5f9',
                              color: item.availableQty > 0.0001 ? '#0f766e' : '#94a3b8',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: item.availableQty > 0.0001 ? 'pointer' : 'not-allowed'
                            }}
                            title="Return unused fabric back to customer"
                          >
                            Return Cust
                          </button>
                        )}

                        {/* View Movement History */}
                        <button
                          onClick={() => handleOpenActionModal(item, 'HISTORY')}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#ffffff',
                            color: '#475569',
                            cursor: 'pointer'
                          }}
                          title="View complete fabric ledger history"
                        >
                          <History size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.pages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: '#ffffff'
          }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} - {Math.min(pagination.total, pagination.page * pagination.pageSize)} of {pagination.total} records
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Previous
              </button>
              <span style={{ padding: '6px 12px', fontWeight: 700, fontSize: '0.85rem' }}>
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL 1: RECEIVE CUSTOMER FABRIC
      ======================================================== */}
      {isReceiveModalOpen && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-card" style={{ maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(217, 4, 41, 0.1)',
                  color: 'var(--jb-crimson)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Scissors size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Receive Customer Fabric</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Register fabric or other materials provided by a customer for their order.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsReceiveModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitReceive}>
              {/* A. Customer & Order Details */}
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Building size={16} color="var(--jb-navy)" />
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    A. Customer & Order Details
                  </h4>
                </div>

                {/* Branch selection */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Branch *
                  </label>
                  <select
                    value={receiveForm.branchId}
                    onChange={(e) => setReceiveForm({ ...receiveForm, branchId: e.target.value })}
                    className="touch-input"
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  >
                    <option value="">Select Branch</option>
                    {(meta?.branches && meta.branches.length > 0 ? meta.branches : [
                      { id: 1, name: 'JB Group (Main)' },
                      { id: 2, name: 'Bella Design' }
                    ]).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Customer Search & Select */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Customer *
                  </label>
                  {!selectedCustomer ? (
                    <div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Search customer by name or phone number..."
                          value={customerSearchText}
                          onChange={(e) => setCustomerSearchText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchCustomers(); } }}
                          className="touch-input"
                          style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                        />
                        <button
                          type="button"
                          onClick={handleSearchCustomers}
                          disabled={isSearchingCustomers}
                          className="btn-primary"
                          style={{ padding: '9px 16px', fontSize: '0.82rem' }}
                        >
                          {isSearchingCustomers ? 'Searching...' : 'Search'}
                        </button>
                      </div>

                      {customerSearchResults.length > 0 && (
                        <div style={{
                          marginTop: '8px',
                          maxHeight: '160px',
                          overflowY: 'auto',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                        }}>
                          {customerSearchResults.map(c => (
                            <div
                              key={c.id}
                              onClick={() => handleSelectCustomer(c)}
                              style={{
                                padding: '9px 12px',
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 800, color: 'var(--jb-navy)', fontSize: '0.85rem' }}>
                                  {c.name}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                  Phone: {c.primaryPhone || c.phone || 'N/A'} {c.email ? `• ${c.email}` : ''}
                                </div>
                              </div>
                              <span style={{ fontSize: '0.78rem', color: 'var(--jb-crimson)', fontWeight: 800 }}>Select</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <div style={{ fontWeight: 800, color: '#166534', fontSize: '0.88rem' }}>
                          ✓ {selectedCustomer.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#374151', marginTop: '2px' }}>
                          Primary Phone: <strong>{selectedCustomer.primaryPhone || selectedCustomer.phone || 'N/A'}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setSelectedOrder(null);
                          setCustomerOrders([]);
                          setReceiveForm(prev => ({
                            ...prev,
                            customerId: '',
                            customerName: '',
                            customerPhone: '',
                            orderId: '',
                            orderNumber: '',
                            orderStatus: ''
                          }));
                        }}
                        style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        Change Customer
                      </button>
                    </div>
                  )}
                </div>

                {/* Customer Phone (Auto-filled) */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Customer Phone (Auto-filled)
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={receiveForm.customerPhone || ''}
                    placeholder="Auto-filled from selected customer"
                    className="touch-input"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f1f5f9',
                      color: '#1e293b',
                      fontWeight: 700,
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                {/* Order Number & Status */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                    Order Number *
                  </label>
                  {!selectedOrder ? (
                    <div>
                      {customerOrders.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Choose from customer's existing orders:
                          </div>
                          <select
                            onChange={(e) => {
                              const found = customerOrders.find(o => String(o.id) === e.target.value);
                              if (found) handleSelectOrder(found);
                            }}
                            defaultValue=""
                            className="touch-input"
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                          >
                            <option value="" disabled>-- Select an Order --</option>
                            {customerOrders.map(o => (
                              <option key={o.id} value={o.id}>
                                Order #{o.orderNumber} ({o.dressType || 'Garment'}) — Status: {o.status}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Or Search Order */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: customerOrders.length > 0 ? '6px' : '0' }}>
                        <input
                          type="text"
                          placeholder={selectedCustomer ? "Search order number for this customer..." : "Search order number or customer..."}
                          value={orderSearchText}
                          onChange={(e) => setOrderSearchText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchOrders(); } }}
                          className="touch-input"
                          style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                        />
                        <button
                          type="button"
                          onClick={handleSearchOrders}
                          disabled={isSearchingOrders}
                          className="btn-primary"
                          style={{ padding: '9px 16px', fontSize: '0.82rem' }}
                        >
                          {isSearchingOrders ? 'Searching...' : 'Search'}
                        </button>
                      </div>

                      {orderSearchResults.length > 0 && (
                        <div style={{
                          marginTop: '8px',
                          maxHeight: '160px',
                          overflowY: 'auto',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                        }}>
                          {orderSearchResults.map(o => (
                            <div
                              key={o.id}
                              onClick={() => handleSelectOrder(o)}
                              style={{
                                padding: '9px 12px',
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 800, color: 'var(--jb-navy)', fontSize: '0.85rem' }}>
                                  Order #{o.orderNumber} • {o.dressType || 'Tailoring Garment'}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                  Customer: {o.customerName} ({o.customerPhone}) • Status: {o.status}
                                </div>
                              </div>
                              <span style={{ fontSize: '0.78rem', color: 'var(--jb-crimson)', fontWeight: 800 }}>Select</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#166534', fontSize: '0.88rem' }}>
                            ✓ Order #{selectedOrder.orderNumber} ({selectedOrder.dressType || 'Garment'})
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#374151', marginTop: '2px' }}>
                            Customer: <strong>{selectedOrder.customerName}</strong>
                          </div>
                        </div>
                        {/* Order Status Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563' }}>Status:</span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            backgroundColor:
                              selectedOrder.status === 'CONFIRMED' || selectedOrder.status === 'READY_FOR_DELIVERY' || selectedOrder.status === 'COMPLETED'
                                ? '#dcfce7'
                                : selectedOrder.status === 'IN_PROGRESS' || selectedOrder.status === 'MEASUREMENTS_PENDING'
                                ? '#fef3c7'
                                : '#e2e8f0',
                            color:
                              selectedOrder.status === 'CONFIRMED' || selectedOrder.status === 'READY_FOR_DELIVERY' || selectedOrder.status === 'COMPLETED'
                                ? '#15803d'
                                : selectedOrder.status === 'IN_PROGRESS' || selectedOrder.status === 'MEASUREMENTS_PENDING'
                                ? '#b45309'
                                : '#334155'
                          }}>
                            {selectedOrder.status}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrder(null);
                          setReceiveForm(prev => ({
                            ...prev,
                            orderId: '',
                            orderNumber: '',
                            orderStatus: ''
                          }));
                        }}
                        style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        Change Order
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* B. Material Details */}
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Scissors size={16} color="var(--jb-navy)" />
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    B. Material Details
                  </h4>
                </div>

                {/* Category and Material / Fabric Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '14px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                      Material Category *
                    </label>
                    <select
                      value={receiveForm.materialCategory}
                      onChange={(e) => setReceiveForm({ ...receiveForm, materialCategory: e.target.value })}
                      className="touch-input"
                      required
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                    >
                      {MATERIAL_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                      Material / Fabric Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Raw Silk / Cotton Voile / Pearl Buttons"
                      value={receiveForm.materialName}
                      onChange={(e) => setReceiveForm({ ...receiveForm, materialName: e.target.value })}
                      className="touch-input"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Colour and Description */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '14px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                      Colour *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Royal Blue / Maroon / Gold"
                      value={receiveForm.fabricColour}
                      onChange={(e) => setReceiveForm({ ...receiveForm, fabricColour: e.target.value })}
                      className="touch-input"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Pattern, texture, special marks, 2 pieces..."
                      value={receiveForm.fabricDescription}
                      onChange={(e) => setReceiveForm({ ...receiveForm, fabricDescription: e.target.value })}
                      className="touch-input"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Quantity, Unit & Date Received */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.2fr', gap: '14px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                      Quantity Received *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      placeholder="0.00"
                      value={receiveForm.receivedQty}
                      onChange={(e) => setReceiveForm({ ...receiveForm, receivedQty: e.target.value })}
                      className="touch-input"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem', fontWeight: 800 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                      Unit *
                    </label>
                    <select
                      value={receiveForm.unit}
                      onChange={(e) => setReceiveForm({ ...receiveForm, unit: e.target.value })}
                      className="touch-input"
                      required
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                    >
                      {MATERIAL_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                      Date Received *
                    </label>
                    <input
                      type="date"
                      required
                      value={receiveForm.dateReceived}
                      onChange={(e) => setReceiveForm({ ...receiveForm, dateReceived: e.target.value })}
                      className="touch-input"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Condition on Receipt & Notes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                      Condition on Receipt *
                    </label>
                    <select
                      value={receiveForm.conditionOnReceipt}
                      onChange={(e) => setReceiveForm({ ...receiveForm, conditionOnReceipt: e.target.value })}
                      className="touch-input"
                      required
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                    >
                      {CONDITIONS_ON_RECEIPT.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                      Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Unwashed, minor fold crease, special handling..."
                      value={receiveForm.notes}
                      onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                      className="touch-input"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* C. Material Photo – Camera + Gallery */}
              <div style={{
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Camera size={16} color="var(--jb-navy)" />
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      C. Material Photo – Camera + Gallery
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                    Optional
                  </span>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Capture or choose a photo of the customer's material. Supported formats: JPG, JPEG, PNG, WEBP (Max 20 MB).
                </p>

                {/* Hidden file input for gallery */}
                <input
                  type="file"
                  ref={galleryInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleGalleryFileSelect}
                />

                {!materialPhotoPreview ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setIsCameraModalOpen(true)}
                      className="btn-secondary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1.5px dashed #cbd5e1',
                        backgroundColor: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: 'var(--jb-navy)',
                        cursor: 'pointer'
                      }}
                    >
                      <Camera size={18} color="var(--jb-crimson)" />
                      <span>Take Photo 📷</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="btn-secondary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1.5px dashed #cbd5e1',
                        backgroundColor: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: 'var(--jb-navy)',
                        cursor: 'pointer'
                      }}
                    >
                      <Image size={18} color="#0284c7" />
                      <span>Choose from Gallery 🖼️</span>
                    </button>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #bbf7d0',
                    borderRadius: '8px',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={materialPhotoPreview}
                        alt="Material preview"
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '6px',
                          objectFit: 'cover',
                          border: '1px solid #cbd5e1'
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, color: '#166534', fontSize: '0.85rem' }}>
                          ✓ Material Photo Selected
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {materialPhotoFile ? materialPhotoFile.name : 'Captured photo ready to save'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setIsCameraModalOpen(true)}
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Camera size={14} /> Retake 📷
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Image size={14} /> Replace 🖼️
                      </button>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.78rem',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fca5a5',
                          borderRadius: '6px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* D. Registration Information */}
              <div style={{
                marginBottom: '18px',
                padding: '12px 14px',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                fontSize: '0.78rem',
                color: '#475569',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '10px'
              }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Registered By</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                    {user?.name || 'Authenticated User'} ({user?.role || 'MANAGER'})
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Date & Time</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Receipt Reference</div>
                  <div style={{ fontWeight: 800, color: 'var(--jb-navy)', marginTop: '2px' }}>
                    {selectedOrder ? `CF-${selectedOrder.orderNumber}-##` : 'Auto-generated on Save'}
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '9px 18px', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReceive}
                  className="btn-primary"
                  style={{ padding: '9px 24px', fontWeight: 800, fontSize: '0.85rem' }}
                >
                  {isSubmittingReceive ? 'Saving Material...' : 'Save Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: ACTION MODAL (Issue, Return, Consume, Waste)
      ======================================================== */}
      {selectedItem && activeActionModal && activeActionModal !== 'HISTORY' && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-card" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                {activeActionModal === 'ISSUE' && 'Issue Fabric to Tailor'}
                {activeActionModal === 'TAILOR_RETURN' && 'Record Tailor Reusable Return'}
                {activeActionModal === 'CONSUME' && 'Record Actual Consumption'}
                {activeActionModal === 'WASTE' && 'Record Cutting Wastage / Scrap'}
                {activeActionModal === 'RETURN_CUSTOMER' && 'Return Fabric to Customer'}
              </h3>
              <button
                onClick={() => { setActiveActionModal(null); setSelectedItem(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Context Info */}
            <div style={{
              padding: '12px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px',
              fontSize: '0.82rem'
            }}>
              <div>
                Fabric: <strong>{selectedItem.code}</strong> ({selectedItem.fabricType} • {selectedItem.fabricColour})
              </div>
              <div style={{ marginTop: '2px', color: 'var(--text-muted)' }}>
                Order: #{selectedItem.orderNumber} • Customer: {selectedItem.customerName}
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>
                  Customer-reported Purchase Price: {selectedItem.customerPurchasePrice !== null && selectedItem.customerPurchasePrice !== undefined ? (
                    <strong>{selectedItem.customerPurchaseCurrency || 'LKR'} {Number(selectedItem.customerPurchasePrice).toLocaleString()} {selectedItem.customerPurchasePriceType === 'PER_UNIT' ? `per ${selectedItem.unit}` : '(Total)'}</strong>
                  ) : (
                    <em style={{ color: '#94a3b8' }}>Not provided</em>
                  )}
                </span>
                {selectedItem.customerPurchaseReceiptUrl && (
                  <a
                    href={`${API_URL}${selectedItem.customerPurchaseReceiptUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0284c7', textDecoration: 'underline', fontWeight: 700 }}
                  >
                    [View Receipt / Bill]
                  </a>
                )}
              </div>
              <div style={{ marginTop: '6px', display: 'flex', gap: '14px', fontWeight: 800 }}>
                <span style={{ color: '#15803d' }}>
                  Available in Store: {selectedItem.availableQty} {selectedItem.unit}
                </span>
                <span style={{ color: '#b45309' }}>
                  With Tailor: {selectedItem.tailorBalanceQty} {selectedItem.unit}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitAction}>
              {/* Tailor Selection if issuing */}
              {activeActionModal === 'ISSUE' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                    Assign to Tailor
                  </label>
                  <select
                    value={actionTailorId}
                    onChange={(e) => setActionTailorId(e.target.value)}
                    className="touch-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                  >
                    <option value="">-- Use Order Assigned Tailor --</option>
                    {(meta?.tailors || []).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                  Quantity ({selectedItem.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  max={
                    activeActionModal === 'ISSUE' || activeActionModal === 'RETURN_CUSTOMER'
                      ? selectedItem.availableQty
                      : selectedItem.tailorBalanceQty
                  }
                  required
                  placeholder="0.00"
                  value={actionQty}
                  onChange={(e) => setActionQty(e.target.value)}
                  className="touch-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem', fontWeight: 800 }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Max allowed:{' '}
                  {activeActionModal === 'ISSUE' || activeActionModal === 'RETURN_CUSTOMER'
                    ? `${selectedItem.availableQty} ${selectedItem.unit} (Store)`
                    : `${selectedItem.tailorBalanceQty} ${selectedItem.unit} (Tailor)`}
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>
                  Reason / Notes {activeActionModal === 'WASTE' ? '*' : ''}
                </label>
                <input
                  type="text"
                  required={activeActionModal === 'WASTE'}
                  placeholder={
                    activeActionModal === 'ISSUE' ? 'e.g. Handed for pattern cutting' :
                    activeActionModal === 'TAILOR_RETURN' ? 'e.g. Extra 0.5m fabric left over after cutting' :
                    activeActionModal === 'CONSUME' ? 'e.g. Cut and stitched into dress' :
                    activeActionModal === 'WASTE' ? 'e.g. Cutting scrap / flaw trimmings' :
                    'e.g. Leftover fabric handed over to customer'
                  }
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="touch-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setActiveActionModal(null); setSelectedItem(null); }}
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className="btn-primary"
                  style={{
                    padding: '8px 22px',
                    backgroundColor:
                      activeActionModal === 'ISSUE' ? 'var(--jb-crimson)' :
                      activeActionModal === 'TAILOR_RETURN' ? '#15803d' :
                      activeActionModal === 'CONSUME' ? '#1d4ed8' :
                      activeActionModal === 'RETURN_CUSTOMER' ? '#0f766e' : '#dc2626'
                  }}
                >
                  {isSubmittingAction ? 'Saving...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: MOVEMENT HISTORY AUDIT TRAIL
      ======================================================== */}
      {selectedItem && activeActionModal === 'HISTORY' && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-card" style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={20} color="var(--jb-crimson)" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  Fabric Movement Audit Ledger
                </h3>
              </div>
              <button
                onClick={() => { setActiveActionModal(null); setSelectedItem(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              padding: '12px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px',
              fontSize: '0.82rem'
            }}>
              <div style={{ fontWeight: 800, color: 'var(--jb-navy)' }}>
                {selectedItem.code} • {selectedItem.fabricType} ({selectedItem.fabricColour})
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                Customer: {selectedItem.customerName} • Order #{selectedItem.orderNumber}
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>
                  Customer-reported Purchase Price: {selectedItem.customerPurchasePrice !== null && selectedItem.customerPurchasePrice !== undefined ? (
                    <strong>{selectedItem.customerPurchaseCurrency || 'LKR'} {Number(selectedItem.customerPurchasePrice).toLocaleString()} {selectedItem.customerPurchasePriceType === 'PER_UNIT' ? `per ${selectedItem.unit}` : '(Total)'}</strong>
                  ) : (
                    <em style={{ color: '#94a3b8' }}>Not provided</em>
                  )}
                </span>
                {selectedItem.customerPurchaseReceiptUrl && (
                  <a
                    href={`${API_URL}${selectedItem.customerPurchaseReceiptUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0284c7', textDecoration: 'underline', fontWeight: 700 }}
                  >
                    [View Receipt / Bill]
                  </a>
                )}
              </div>
            </div>

            {loadingHistory ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading movement history...
              </div>
            ) : historyMovements.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No movements recorded yet.
              </div>
            ) : (
              <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {historyMovements.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        backgroundColor:
                          m.movementType === 'RECEIPT' ? '#dcfce7' :
                          m.movementType === 'ISSUE_TO_TAILOR' ? '#fef3c7' :
                          m.movementType === 'TAILOR_RETURN' ? '#faf5ff' :
                          m.movementType === 'CONSUMPTION' ? '#eff6ff' :
                          m.movementType === 'RETURN_TO_CUSTOMER' ? '#f0fdfa' : '#fff1f2',
                        color:
                          m.movementType === 'RECEIPT' ? '#15803d' :
                          m.movementType === 'ISSUE_TO_TAILOR' ? '#b45309' :
                          m.movementType === 'TAILOR_RETURN' ? '#7e22ce' :
                          m.movementType === 'CONSUMPTION' ? '#1d4ed8' :
                          m.movementType === 'RETURN_TO_CUSTOMER' ? '#0f766e' : '#be123c'
                      }}>
                        {m.movementType.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                        {m.quantity} {selectedItem.unit}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                      Store: {m.previousAvailableQty} → <strong>{m.newAvailableQty}</strong> | Tailor: {m.previousTailorQty} → <strong>{m.newTailorQty}</strong>
                    </div>

                    {m.tailorName && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Tailor: {m.tailorName}
                      </div>
                    )}

                    {m.notes && (
                      <div style={{ fontSize: '0.78rem', color: '#334155', fontStyle: 'italic', marginTop: '2px' }}>
                        "{m.notes}"
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px', borderTop: '1px solid #f8fafc', paddingTop: '4px' }}>
                      <span>Recorded by: {m.performedByName || 'Staff'} ({m.performedByRole || 'STAFF'})</span>
                      <span>{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => { setActiveActionModal(null); setSelectedItem(null); }}
                className="btn-secondary"
                style={{ padding: '8px 18px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        title="Capture Customer Material Photo"
      />

      {/* Full Photo Viewer Lightbox Modal */}
      {viewingPhotoUrl && (
        <div
          className="inv-modal-overlay"
          onClick={() => setViewingPhotoUrl(null)}
          style={{ zIndex: 11000 }}
        >
          <div
            className="inv-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', padding: '16px', textAlign: 'center' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: 'var(--jb-navy)' }}>
                Customer Material Photo
              </h4>
              <button
                onClick={() => setViewingPhotoUrl(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ maxHeight: '70vh', overflow: 'hidden', borderRadius: '8px', backgroundColor: '#0f172a' }}>
              <img
                src={viewingPhotoUrl.startsWith('http') || viewingPhotoUrl.startsWith('data:') ? viewingPhotoUrl : `${API_URL}${viewingPhotoUrl}`}
                alt="Customer Material"
                style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setViewingPhotoUrl(null)}
                className="btn-secondary"
                style={{ padding: '6px 16px', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
