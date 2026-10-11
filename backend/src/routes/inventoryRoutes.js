const express = require('express');
const router = express.Router();
const inv = require('../controllers/inventoryController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireInv } = require('../config/inventoryPermissions');

// All inventory routes require a valid staff JWT.
// Fine-grained, role-based checks are enforced per route (requireInv) AND again inside
// the controller (deny()), so hiding buttons in the UI is never the only protection.
router.use(authenticateToken);

// Meta / dashboard / alerts
router.get('/meta', requireInv('VIEW_ITEMS'), inv.getMeta);
router.get('/dashboard', requireInv('VIEW_ITEMS'), inv.getDashboard);
router.get('/alerts', requireInv('VIEW_ITEMS'), inv.getAlerts);

// Material master
router.get('/items', requireInv('VIEW_ITEMS'), inv.listItems);
router.post('/items', requireInv('MANAGE_ITEMS'), inv.createItem);
router.get('/items/:id', requireInv('VIEW_ITEMS'), inv.getItem);
router.put('/items/:id', requireInv('MANAGE_ITEMS'), inv.updateItem);
router.patch('/items/:id/status', requireInv('DEACTIVATE_ITEMS'), inv.setItemStatus);
router.get('/items/:id/purchases', requireInv('VIEW_COSTS'), inv.getItemPurchases);

// Repeat stock purchase (direct verified receipt for existing SKU)
router.post('/purchases/receive', requireInv('STOCK_RECEIVE'), inv.recordRepeatPurchase);

// Opening stock registration (for existing SKU or new material)
router.post('/opening-stock', requireInv('STOCK_RECEIVE'), inv.recordOpeningStock);

// Stock ledger (manual movements: STOCK_IN, RETURN, ISSUE, WASTAGE, DAMAGED, ADJUSTMENT)
router.get('/movements', requireInv('VIEW_REPORTS'), inv.listMovements);
router.post('/movements', inv.createMovement); // per-type permission checked in controller

// Tailoring order integration
router.get('/orders/lookup', requireInv('MATERIAL_REQUEST'), inv.lookupOrders);
router.get('/requests', requireInv('MATERIAL_REQUEST'), inv.listRequests);
router.post('/requests', requireInv('MATERIAL_REQUEST'), inv.createRequest);
router.post('/requests/:id/issue', requireInv('MATERIAL_ISSUE'), inv.issueRequest);
router.post('/requests/:id/return', requireInv('MATERIAL_ISSUE'), inv.returnRequest);
router.post('/requests/:id/wastage', requireInv('MATERIAL_ISSUE'), inv.recordRequestWastage);
router.post('/requests/:id/complete', requireInv('MATERIAL_ISSUE'), inv.completeRequest);
router.post('/requests/:id/reject', requireInv('MATERIAL_ISSUE'), inv.rejectRequest);
router.post('/requests/:id/cancel', requireInv('MATERIAL_REQUEST'), inv.cancelRequest);

// Suppliers
router.get('/suppliers', requireInv('VIEW_COSTS'), inv.listSuppliers);
router.post('/suppliers', requireInv('SUPPLIER_MANAGE'), inv.createSupplier);
router.get('/suppliers/:id', requireInv('VIEW_COSTS'), inv.getSupplier);
router.put('/suppliers/:id', requireInv('SUPPLIER_MANAGE'), inv.updateSupplier);

// Purchase requisitions / orders / GRN
router.get('/purchase-orders', requireInv('VIEW_COSTS'), inv.listPurchaseOrders);
router.post('/purchase-orders', requireInv('PO_CREATE'), inv.createPurchaseOrder);
router.get('/purchase-orders/:id', requireInv('VIEW_COSTS'), inv.getPurchaseOrder);
router.post('/purchase-orders/:id/approve', requireInv('PO_APPROVE'), inv.approvePurchaseOrder);
router.post('/purchase-orders/:id/reject', requireInv('PO_APPROVE'), inv.rejectPurchaseOrder);
router.post('/purchase-orders/:id/cancel', requireInv('PO_CREATE'), inv.cancelPurchaseOrder);
router.post('/purchase-orders/:id/receive', requireInv('PO_RECEIVE'), inv.receivePurchaseOrder);

// Reports & audit
router.get('/reports/:type', requireInv('VIEW_REPORTS'), inv.getReport);
router.get('/audit-logs', requireInv('VIEW_AUDIT'), inv.listAuditLogs);

module.exports = router;
