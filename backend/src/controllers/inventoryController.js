/**
 * Inventory & Material Management controller — JB GROUP
 *
 * Design rules
 *  - Every stock change goes through moveStock(), inside a DB transaction, with the
 *    item row locked (SELECT ... FOR UPDATE). Concurrent requests are serialized per item.
 *  - Idempotency: every stock-changing call carries an idempotencyKey. The key is checked
 *    AFTER the row lock is acquired and is also UNIQUE in the DB, so retries / double-clicks
 *    can never deduct stock twice.
 *  - Negative stock is rejected in code AND by DB CHECK constraints.
 *  - Lock ordering is always: request/PO row -> item rows (sorted by id) to avoid deadlocks.
 *  - Costing method: Weighted Average Cost (WAC). Receipts with a cost re-average the unit
 *    cost; issues/returns/write-offs are valued at the current WAC.
 *  - Existing order workflows are never modified: this module only READS the Order table.
 */
const { pool } = require('../prisma');
const { can, capabilitiesFor, PO_CEO_THRESHOLD, PRODUCTION } = require('../config/inventoryPermissions');

// ------------------------------------------------------------------ constants
const DEFAULT_CATEGORIES = ['Fabric', 'Lining', 'Thread', 'Buttons', 'Zippers', 'Embroidery Materials', 'Laces & Trims', 'Padding & Cups', 'Packaging'];
const DEFAULT_UNITS = ['Meter', 'Yard', 'Piece', 'Roll', 'Packet', 'Spool', 'Cone', 'Box', 'Kg', 'Gram', 'Dozen', 'Set'];
const BLOCKED_ORDER_STATUSES = ['CANCELLED', 'REJECTED', 'DELIVERED', 'COMPLETED'];
const MANUAL_TYPES = {
  STOCK_IN:   { perm: 'STOCK_RECEIVE',   sign: +1, prefix: 'SIN', reasonRequired: false },
  RETURN:     { perm: 'STOCK_RECEIVE',   sign: +1, prefix: 'RET', reasonRequired: true },
  ISSUE:      { perm: 'STOCK_ISSUE',     sign: -1, prefix: 'ISS', reasonRequired: true },
  WASTAGE:    { perm: 'STOCK_WRITE_OFF', sign: -1, prefix: 'WST', reasonRequired: true },
  DAMAGED:    { perm: 'STOCK_WRITE_OFF', sign: -1, prefix: 'DMG', reasonRequired: true },
  ADJUSTMENT: { perm: 'STOCK_ADJUST',    sign: 0,  prefix: 'ADJ', reasonRequired: true }
};
const CONSUMPTION_TYPES = ['ORDER_ISSUE', 'ISSUE', 'ORDER_RETURN'];
const LEAD_DAYS = Number(process.env.INVENTORY_LEAD_TIME_DAYS) || 14;
const COVER_DAYS = Number(process.env.INVENTORY_COVER_DAYS) || 30;
const EPS = 0.0001;

// ------------------------------------------------------------------ helpers
class InvError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ success: false, message: e.message });
    if (e.code === '23505') {
      let message = 'A duplicate record or already-processed request was detected.';
      if (e.constraint === 'InventoryItem_sku_key' || (e.detail && e.detail.toLowerCase().includes('sku'))) {
        message = 'A material with this SKU code already exists. Please choose a unique SKU.';
      } else if (e.constraint === 'Supplier_code_key' || (e.detail && e.detail.toLowerCase().includes('code'))) {
        message = 'A supplier with this code already exists. Please use a unique supplier code.';
      } else if (e.constraint === 'StockMovement_idempotencyKey_key' || (e.detail && e.detail.toLowerCase().includes('idempotencykey'))) {
        message = 'This stock movement request has already been processed.';
      } else if (e.constraint === 'OrderMaterialRequest_clientKey_key' || e.constraint === 'OrderMaterialRequest_requestNo_key') {
        message = 'This material request has already been submitted.';
      } else if (e.constraint === 'PurchaseOrder_clientKey_key' || e.constraint === 'PurchaseOrder_poNumber_key') {
        message = 'This purchase order has already been created.';
      } else if (e.constraint === 'GoodsReceipt_clientKey_key' || e.constraint === 'GoodsReceipt_grnNumber_key') {
        message = 'This goods receipt has already been recorded.';
      }
      return res.status(409).json({ success: false, message, detail: e.detail });
    }
    if (e.code === '23514') return res.status(409).json({ success: false, message: 'Rejected by stock safety rule (stock cannot go negative / quantities invalid).' });
    if (e.code === '23503') return res.status(409).json({ success: false, message: 'Record is referenced by other inventory records and cannot be changed this way.' });
    if (e.code === '42P01') return res.status(503).json({ success: false, message: 'Inventory module is not initialised yet. Run the inventory migration first.' });
    console.error('[inventory]', e);
    return res.status(500).json({ success: false, message: 'Inventory operation failed.' });
  }
};

async function withTx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

const r3 = (n) => Math.round(Number(n) * 1000) / 1000;
const r4 = (n) => Math.round(Number(n) * 10000) / 10000;

function qty(v, label = 'Quantity') {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new InvError(400, `${label} must be a positive number.`);
  if (n > 1e7) throw new InvError(400, `${label} is unrealistically large.`);
  return r3(n);
}
function money(v, label = 'Unit cost') {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new InvError(400, `${label} must be zero or a positive number.`);
  return r4(n);
}
function text(v, max = 500) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function requireText(v, label, max = 500) {
  const s = text(v, max);
  if (!s) throw new InvError(400, `${label} is required.`);
  return s;
}
function idemKey(v) {
  const s = text(v, 120);
  if (!s || s.length < 8) throw new InvError(400, 'A valid idempotencyKey (min 8 chars) is required for stock-changing requests.');
  return s;
}
function intId(v, label = 'ID') {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new InvError(400, `Invalid ${label}.`);
  return n;
}
function deny(req, perm) {
  if (!can(req.user, perm)) throw new InvError(403, `Access denied. Your role (${req.user?.role}) cannot perform this inventory action.`);
}
function paging(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(q.pageSize, 10) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Tiny positional-parameter builder. Use '?' as placeholder inside add(). */
function filters() {
  const parts = [];
  const vals = [];
  return {
    vals,
    p(v) { vals.push(v); return '$' + vals.length; },
    add(sql, ...v) {
      let s = sql;
      v.forEach(x => { vals.push(x); s = s.replace('?', '$' + vals.length); });
      parts.push(s);
    },
    where() { return parts.length ? 'WHERE ' + parts.join(' AND ') : ''; },
    and() { return parts.length ? ' AND ' + parts.join(' AND ') : ''; }
  };
}

async function audit(c, req, action, entityType, entityId, details = {}) {
  await c.query(
    `INSERT INTO "InventoryAuditLog" ("action","entityType","entityId","userId","userName","userRole","details","ipAddress")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [action, entityType, entityId || null, req.user?.id || null, req.user?.name || null, req.user?.role || null,
      JSON.stringify(details), (req.headers['x-forwarded-for'] || req.ip || '').toString().slice(0, 100)]
  );
}

/** Sequential human-readable numbers (PO-2026-0001). Advisory lock prevents duplicates under concurrency. */
async function nextNumber(c, prefix, table, column) {
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['inv_seq_' + prefix]);
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const { rows } = await c.query(`SELECT "${column}" AS v FROM "${table}" WHERE "${column}" LIKE $1 ORDER BY id DESC LIMIT 1`, [like]);
  const last = rows[0] ? parseInt(String(rows[0].v).split('-').pop(), 10) || 0 : 0;
  return `${prefix}-${year}-${String(last + 1).padStart(4, '0')}`;
}

async function findMovementByKey(c, key) {
  if (!key) return null;
  const { rows } = await c.query('SELECT * FROM "StockMovement" WHERE "idempotencyKey" = $1', [key]);
  return rows[0] || null;
}

/**
 * THE stock primitive. Must be called inside withTx().
 * opts: { itemId, type, delta?, setTo?, unitCost?, referenceNo, reason, orderId, orderNumber,
 *         materialRequestId, purchaseOrderId, branchId, idempotencyKey, allowInactive }
 */
async function moveStock(c, req, opts) {
  const { rows } = await c.query('SELECT * FROM "InventoryItem" WHERE id = $1 FOR UPDATE', [opts.itemId]);
  const item = rows[0];
  if (!item) throw new InvError(404, 'Material not found.');

  const dup = await findMovementByKey(c, opts.idempotencyKey);
  if (dup) return { movement: dup, item, duplicate: true };

  const prev = Number(item.currentStock);
  let delta = opts.setTo !== undefined && opts.setTo !== null ? r3(Number(opts.setTo) - prev) : r3(opts.delta);
  if (!Number.isFinite(delta) || Math.abs(delta) < EPS) throw new InvError(400, 'No stock change — quantity results in zero difference.');
  if (!item.isActive && delta < 0 && !opts.allowInactive) throw new InvError(400, `Material ${item.sku} is inactive and cannot be issued.`);

  const next = r3(prev + delta);
  if (next < -EPS) {
    throw new InvError(409, `Insufficient stock for ${item.sku} (${item.name}). Available: ${prev} ${item.unit}, required: ${Math.abs(delta)} ${item.unit}.`);
  }
  const safeNext = Math.max(0, next);

  // Weighted Average Cost & Cost Status update on costed receipts
  let newCost = Number(item.unitCost);
  let newCostStatus = item.costStatus || 'KNOWN';
  let latestPurchaseCost = item.latestPurchaseCost;
  const receiptCost = opts.unitCost === undefined ? null : opts.unitCost;

  if (delta > 0 && receiptCost !== null && ['STOCK_IN', 'GRN_RECEIPT', 'OPENING', 'PURCHASE'].includes(opts.type)) {
    latestPurchaseCost = receiptCost;
    if (newCostStatus === 'PENDING_VALUATION') {
      if (prev <= EPS) {
        newCost = receiptCost;
        newCostStatus = 'KNOWN';
      } else {
        // Requirement 6: If historical stock cost is unknown, do not invent a cost or valuation; keep it marked PENDING_VALUATION
        newCost = 0;
        newCostStatus = 'PENDING_VALUATION';
      }
    } else {
      // Existing valuation is KNOWN
      newCost = prev <= EPS ? receiptCost : r4((prev * newCost + delta * receiptCost) / safeNext);
      newCostStatus = 'KNOWN';
    }
  }
  const movementCost = delta > 0 && receiptCost !== null ? receiptCost : Number(item.unitCost);

  await c.query(`UPDATE "InventoryItem" SET "currentStock" = $1, "unitCost" = $2, "costStatus" = $3,
    "latestPurchaseCost" = COALESCE($4, "latestPurchaseCost"), "updatedAt" = NOW() WHERE id = $5`,
    [safeNext, newCost, newCostStatus, latestPurchaseCost, item.id]);

  const ins = await c.query(
    `INSERT INTO "StockMovement" ("itemId","type","quantity","unitCost","previousStock","newStock","referenceNo","reason",
       "orderId","orderNumber","materialRequestId","purchaseOrderId","branchId","performedById","performedByName","idempotencyKey",
       "costStatus","supplierId")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [item.id, opts.type, delta, movementCost, prev, safeNext, opts.referenceNo || null, opts.reason || null,
      opts.orderId || null, opts.orderNumber || null, opts.materialRequestId || null, opts.purchaseOrderId || null,
      opts.branchId ?? item.branchId ?? null, req.user?.id || null, req.user?.name || null, opts.idempotencyKey || null,
      newCostStatus, opts.supplierId || null]
  );
  return { movement: ins.rows[0], item: { ...item, currentStock: safeNext, unitCost: newCost, costStatus: newCostStatus, latestPurchaseCost }, duplicate: false };
}

function stockStatus(i) {
  const s = Number(i.currentStock);
  if (s <= EPS) return 'OUT';
  if (s <= Number(i.minStockLevel)) return 'LOW';
  if (s <= Number(i.reorderLevel)) return 'REORDER';
  return 'OK';
}

function shapeItem(i, showCost) {
  const o = { ...i, stockStatus: stockStatus(i) };
  if (showCost) {
    if (i.costStatus === 'PENDING_VALUATION') {
      o.stockValue = 0;
    } else {
      o.stockValue = r4(Number(i.currentStock) * Number(i.unitCost));
    }
  } else {
    delete o.unitCost; delete o.supplierId; delete o.supplierName; delete o.stockValue; delete o.latestPurchaseCost;
  }
  return o;
}

function branchFilter(f, alias, branchId) {
  const b = parseInt(branchId, 10);
  if (Number.isInteger(b) && b > 0) f.add(`(${alias}."branchId" = ? OR ${alias}."branchId" IS NULL)`, b);
}

function dateRange(f, col, from, to) {
  if (from && !isNaN(Date.parse(from))) f.add(`${col} >= ?::date`, from);
  if (to && !isNaN(Date.parse(to))) f.add(`${col} < (?::date + INTERVAL '1 day')`, to);
}

// =================================================================== META
exports.getMeta = handle(async (req, res) => {
  deny(req, 'VIEW_ITEMS');
  const [cats, units, branches, tailors, suppliers] = await Promise.all([
    pool.query('SELECT DISTINCT category AS v FROM "InventoryItem" ORDER BY 1'),
    pool.query('SELECT DISTINCT unit AS v FROM "InventoryItem" ORDER BY 1'),
    pool.query('SELECT id, name FROM "Branch" ORDER BY id'),
    pool.query(`SELECT id, name, role FROM "User" WHERE role = 'TAILOR' AND "isActive" = true ORDER BY name`),
    pool.query('SELECT id, code, name FROM "Supplier" WHERE "isActive" = true ORDER BY name')
  ]);
  const merge = (base, extra) => [...new Set([...base, ...extra.rows.map(r => r.v).filter(Boolean)])];
  res.json({
    success: true,
    data: {
      capabilities: capabilitiesFor(req.user),
      categories: merge(DEFAULT_CATEGORIES, cats),
      units: merge(DEFAULT_UNITS, units),
      branches: branches.rows,
      tailors: tailors.rows,
      suppliers: suppliers.rows,
      manualMovementTypes: Object.keys(MANUAL_TYPES).filter(t => can(req.user, MANUAL_TYPES[t].perm)),
      costingMethod: 'WEIGHTED_AVERAGE_COST',
      poCeoThreshold: PO_CEO_THRESHOLD,
      reorderPolicy: { leadTimeDays: LEAD_DAYS, coverDays: COVER_DAYS }
    }
  });
});

// =================================================================== DASHBOARD
exports.getDashboard = handle(async (req, res) => {
  deny(req, 'VIEW_ITEMS');
  const showCost = can(req.user, 'VIEW_COSTS');
  const f = filters();
  branchFilter(f, 'i', req.query.branchId);
  const where = f.where();

  const spendF = filters();
  branchFilter(spendF, 'm', req.query.branchId);
  const spendWhere = spendF.where();

  const [totals, cats, pos, reqs, usage, trend, recent, spend] = await Promise.all([
    pool.query(`SELECT
        COUNT(*)::int AS "totalItems",
        COUNT(*) FILTER (WHERE i."isActive")::int AS "activeItems",
        COALESCE(SUM(i."currentStock" * i."unitCost") FILTER (WHERE i."isActive" AND i."costStatus" = 'KNOWN'), 0) AS "stockValue",
        COALESCE(SUM(i."currentStock") FILTER (WHERE i."isActive"), 0) AS "totalStockQty",
        COUNT(*) FILTER (WHERE i."isActive" AND i."currentStock" <= 0)::int AS "outOfStock",
        COUNT(*) FILTER (WHERE i."isActive" AND i."currentStock" > 0 AND i."currentStock" <= i."minStockLevel")::int AS "lowStock",
        COUNT(*) FILTER (WHERE i."isActive" AND i."currentStock" <= i."reorderLevel")::int AS "reorderDue",
        COUNT(*) FILTER (WHERE i."isActive" AND i."costStatus" = 'PENDING_VALUATION')::int AS "pendingValuation",
        COUNT(DISTINCT i.category) FILTER (WHERE i."isActive")::int AS "categories"
      FROM "InventoryItem" i ${where}`, f.vals),
    pool.query(`SELECT i.category, COUNT(*)::int AS items, COALESCE(SUM(i."currentStock" * i."unitCost") FILTER (WHERE i."costStatus" = 'KNOWN'),0) AS value
      FROM "InventoryItem" i ${where ? where + ' AND' : 'WHERE'} i."isActive" GROUP BY i.category ORDER BY value DESC`, f.vals),
    pool.query(`SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING_APPROVAL')::int AS "pendingApproval",
        COUNT(*) FILTER (WHERE status IN ('APPROVED','PARTIALLY_RECEIVED'))::int AS "awaitingReceipt",
        COALESCE(SUM("totalAmount") FILTER (WHERE status IN ('PENDING_APPROVAL','APPROVED','PARTIALLY_RECEIVED')),0) AS "openValue"
      FROM "PurchaseOrder"`),
    pool.query(`SELECT
        COUNT(*) FILTER (WHERE status IN ('REQUESTED','PARTIALLY_ISSUED'))::int AS "pendingRequests",
        COALESCE(SUM("issuedQty" - "returnedQty" - COALESCE("damagedQty", 0) - "wastageQty") FILTER (WHERE status IN ('REQUESTED','PARTIALLY_ISSUED','ISSUED')), 0) AS "issuedToTailors"
      FROM "OrderMaterialRequest"`),
    pool.query(`SELECT
        COALESCE(SUM(-m.quantity) FILTER (WHERE m.type = ANY($1)), 0) AS "usageQty",
        COALESCE(SUM(-m.quantity * m."unitCost") FILTER (WHERE m.type = ANY($1)), 0) AS "usageValue",
        COALESCE(SUM(-m.quantity * m."unitCost") FILTER (WHERE m.type IN ('WASTAGE','DAMAGED')), 0) AS "writeOffValue",
        COUNT(DISTINCT m."orderId") FILTER (WHERE m.type IN ('ORDER_ISSUE'))::int AS "ordersServed"
      FROM "StockMovement" m WHERE m."createdAt" >= date_trunc('month', NOW())`, [CONSUMPTION_TYPES]),
    pool.query(`SELECT to_char(date_trunc('month', m."createdAt"), 'YYYY-MM') AS month,
        COALESCE(SUM(-m.quantity * m."unitCost") FILTER (WHERE m.type = ANY($1)), 0) AS "usageValue",
        COALESCE(SUM(m.quantity * m."unitCost") FILTER (WHERE m.type IN ('GRN_RECEIPT','STOCK_IN')), 0) AS "receiptValue"
      FROM "StockMovement" m WHERE m."createdAt" >= date_trunc('month', NOW()) - INTERVAL '5 months'
      GROUP BY 1 ORDER BY 1`, [CONSUMPTION_TYPES]),
    pool.query(`SELECT m.id, m.type, m.quantity, m."newStock", m."referenceNo", m."orderNumber", m."performedByName", m."createdAt",
        i.sku, i.name, i.unit FROM "StockMovement" m JOIN "InventoryItem" i ON i.id = m."itemId"
      ORDER BY m."createdAt" DESC LIMIT 8`),
    // Verified purchase spend: confirmed GRN receipts + direct stock-ins with purchase prices (branch-filtered, duplicate-safe)
    pool.query(`
      WITH verified_purchases AS (
        SELECT m.id, m.quantity, m."unitCost",
          ROUND((m.quantity * m."unitCost")::numeric, 2)::float AS "totalCost",
          m."createdAt", m."referenceNo" AS "grnNumber"
        FROM "StockMovement" m
        ${spendWhere ? spendWhere + ' AND' : 'WHERE'}
          m.type = 'GRN_RECEIPT' AND m.quantity > 0 AND m."unitCost" > 0

        UNION ALL

        SELECT m.id, m.quantity, m."unitCost",
          ROUND((m.quantity * m."unitCost")::numeric, 2)::float AS "totalCost",
          m."createdAt", COALESCE(m."referenceNo", 'Direct Receipt') AS "grnNumber"
        FROM "StockMovement" m
        ${spendWhere ? spendWhere + ' AND' : 'WHERE'}
          m.type IN ('STOCK_IN', 'PURCHASE') AND m.quantity > 0 AND m."unitCost" > 0
          AND NOT EXISTS (
            SELECT 1 FROM "GoodsReceipt" g
            WHERE g."grnNumber" = m."referenceNo"
               OR (m."purchaseOrderId" IS NOT NULL AND g."purchaseOrderId" = m."purchaseOrderId")
          )
      )
      SELECT
        COALESCE(SUM("totalCost"), 0)::float AS "total",
        COUNT(DISTINCT "grnNumber")::int AS "receiptCount",
        COUNT(*)::int AS "itemCount",
        COALESCE(SUM("totalCost") FILTER (WHERE "createdAt" >= date_trunc('month', NOW())), 0)::float AS "selectedMonthSpend",
        COUNT(DISTINCT "grnNumber") FILTER (WHERE "createdAt" >= date_trunc('month', NOW()))::int AS "selectedMonthReceiptCount"
      FROM verified_purchases`, spendF.vals)
  ]);

  const t = totals.rows[0];
  const spendRow = spend.rows[0] || {};
  const data = {
    ...t,
    ...pos.rows[0],
    ...reqs.rows[0],
    monthly: usage.rows[0],
    categories: cats.rows,
    trend: trend.rows,
    recentMovements: recent.rows,
    purchaseSpend: {
      available: true,
      total: Number(spendRow.total || 0),
      receiptCount: Number(spendRow.receiptCount || 0),
      itemCount: Number(spendRow.itemCount || 0),
      currentMonthSpend: Number(spendRow.selectedMonthSpend || 0),
      currentMonthReceiptCount: Number(spendRow.selectedMonthReceiptCount || 0)
    }
  };
  if (!showCost) {
    delete data.stockValue; delete data.openValue; delete data.purchaseSpend;
    data.categories = data.categories.map(({ value, ...rest }) => rest);
    data.monthly = { usageQty: data.monthly.usageQty, ordersServed: data.monthly.ordersServed };
    data.trend = [];
  }
  res.json({ success: true, data });
});

// =================================================================== ALERTS / REORDER
async function computeAlerts(branchId) {
  const f = filters();
  const typesParam = f.p(CONSUMPTION_TYPES);
  branchFilter(f, 'i', branchId);
  const { rows } = await pool.query(
    `WITH usage AS (
       SELECT "itemId", SUM(-quantity) AS used FROM "StockMovement"
       WHERE type = ANY(${typesParam}) AND "createdAt" >= NOW() - INTERVAL '30 days' GROUP BY "itemId")
     SELECT i.*, s.name AS "supplierName", COALESCE(u.used, 0) AS "used30"
     FROM "InventoryItem" i
     LEFT JOIN usage u ON u."itemId" = i.id
     LEFT JOIN "Supplier" s ON s.id = i."supplierId"
     WHERE i."isActive" AND i."currentStock" <= GREATEST(i."reorderLevel", i."minStockLevel") ${f.and()}
     ORDER BY (i."currentStock" <= 0) DESC, i."currentStock" / NULLIF(GREATEST(i."reorderLevel", i."minStockLevel"), 0) ASC NULLS FIRST`,
    f.vals
  );
  return rows.map(i => {
    const avgDaily = Math.max(0, Number(i.used30)) / 30;
    const target = Math.max(Number(i.reorderLevel) * 2, Number(i.minStockLevel) + avgDaily * (LEAD_DAYS + COVER_DAYS));
    const suggested = Math.max(0, Math.ceil(target - Number(i.currentStock)));
    return {
      ...i,
      stockStatus: stockStatus(i),
      avgDailyUsage: r3(avgDaily),
      daysOfCover: avgDaily > 0 ? Math.floor(Number(i.currentStock) / avgDaily) : null,
      suggestedReorderQty: suggested,
      suggestedReorderValue: r4(suggested * Number(i.unitCost))
    };
  });
}

exports.getAlerts = handle(async (req, res) => {
  deny(req, 'VIEW_ITEMS');
  const showCost = can(req.user, 'VIEW_COSTS');
  const alerts = (await computeAlerts(req.query.branchId)).map(a => {
    if (showCost) return a;
    const { unitCost, suggestedReorderValue, supplierName, ...rest } = a;
    return rest;
  });
  res.json({
    success: true,
    data: alerts,
    policy: `Suggested qty = max(2 × reorder level, min stock + avg daily usage × ${LEAD_DAYS + COVER_DAYS} days) − current stock. Avg usage = last 30 days.`
  });
});

// =================================================================== ITEMS
const ITEM_SORTS = {
  name: 'i.name', sku: 'i.sku', category: 'i.category', stock: 'i."currentStock"',
  value: '(i."currentStock" * i."unitCost")', updated: 'i."updatedAt"', location: 'i."storageLocation"'
};

exports.listItems = handle(async (req, res) => {
  deny(req, 'VIEW_ITEMS');
  const showCost = can(req.user, 'VIEW_COSTS');
  const q = req.query;
  const { page, pageSize, offset } = paging(q);
  const f = filters();

  if (q.search) {
    const s = `%${String(q.search).trim()}%`;
    f.add('(i.sku ILIKE ? OR i.name ILIKE ? OR COALESCE(i.description,\'\') ILIKE ? OR COALESCE(i."storageLocation",\'\') ILIKE ?)', s, s, s, s);
  }
  if (q.category && q.category !== 'ALL') f.add('i.category = ?', q.category);
  if (q.supplierId) f.add('i."supplierId" = ?', intId(q.supplierId, 'supplier'));
  // Production roles only ever see active materials
  const status = PRODUCTION.includes(req.user.role) ? 'active' : (q.status || 'active');
  if (status === 'active') f.add('i."isActive" = true');
  else if (status === 'inactive') f.add('i."isActive" = false');
  if (q.stock === 'out') f.add('i."currentStock" <= 0');
  else if (q.stock === 'low') f.add('i."currentStock" > 0 AND i."currentStock" <= i."minStockLevel"');
  else if (q.stock === 'reorder') f.add('i."currentStock" <= GREATEST(i."reorderLevel", i."minStockLevel")');
  else if (q.stock === 'ok') f.add('i."currentStock" > GREATEST(i."reorderLevel", i."minStockLevel")');
  dateRange(f, 'i."updatedAt"', q.from, q.to);
  branchFilter(f, 'i', q.branchId);

  const sortCol = ITEM_SORTS[q.sort] || ITEM_SORTS.name;
  const dir = String(q.dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const where = f.where();

  const [rows, count] = await Promise.all([
    pool.query(`SELECT i.*, s.name AS "supplierName", b.name AS "branchName"
      FROM "InventoryItem" i LEFT JOIN "Supplier" s ON s.id = i."supplierId" LEFT JOIN "Branch" b ON b.id = i."branchId"
      ${where} ORDER BY ${sortCol} ${dir}, i.id ASC LIMIT ${pageSize} OFFSET ${offset}`, f.vals),
    pool.query(`SELECT COUNT(*)::int AS total FROM "InventoryItem" i ${where}`, f.vals)
  ]);
  res.json({
    success: true,
    data: rows.rows.map(i => shapeItem(i, showCost)),
    pagination: { page, pageSize, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / pageSize) }
  });
});

exports.getItem = handle(async (req, res) => {
  deny(req, 'VIEW_ITEMS');
  const id = intId(req.params.id, 'material');
  const showCost = can(req.user, 'VIEW_COSTS');
  const { rows } = await pool.query(`SELECT i.*, s.name AS "supplierName", b.name AS "branchName"
    FROM "InventoryItem" i LEFT JOIN "Supplier" s ON s.id = i."supplierId" LEFT JOIN "Branch" b ON b.id = i."branchId"
    WHERE i.id = $1`, [id]);
  if (!rows[0]) throw new InvError(404, 'Material not found.');
  let movements = [];
  if (can(req.user, 'VIEW_REPORTS')) {
    movements = (await pool.query(`SELECT * FROM "StockMovement" WHERE "itemId" = $1 ORDER BY "createdAt" DESC, id DESC LIMIT 50`, [id])).rows;
  }
  res.json({ success: true, data: { ...shapeItem(rows[0], showCost), movements } });
});

function readItemBody(b, partial = false) {
  const out = {};
  const set = (k, v) => { if (v !== undefined) out[k] = v; };
  if (!partial || b.sku !== undefined) set('sku', requireText(b.sku, 'SKU / material code', 40).toUpperCase().replace(/\s+/g, '-'));
  if (!partial || b.name !== undefined) set('name', requireText(b.name, 'Material name', 150));
  if (!partial || b.category !== undefined) set('category', requireText(b.category, 'Category', 60));
  if (!partial || b.unit !== undefined) set('unit', requireText(b.unit, 'Unit', 30));
  if (b.description !== undefined) set('description', text(b.description, 1000));
  if (b.colour !== undefined) set('colour', text(b.colour, 60));
  if (b.storageLocation !== undefined) set('storageLocation', text(b.storageLocation, 120));
  for (const k of ['minStockLevel', 'reorderLevel']) {
    if (b[k] !== undefined && b[k] !== '') {
      const n = Number(b[k]);
      if (!Number.isFinite(n) || n < 0) throw new InvError(400, `${k} must be zero or positive.`);
      out[k] = r3(n);
    }
  }
  if (b.supplierId !== undefined) out.supplierId = b.supplierId ? intId(b.supplierId, 'supplier') : null;
  if (b.branchId !== undefined) out.branchId = b.branchId ? intId(b.branchId, 'branch') : null;
  return out;
}

exports.createItem = handle(async (req, res) => {
  deny(req, 'MANAGE_ITEMS');
  const b = req.body || {};
  const data = readItemBody(b);
  const opening = b.openingStock === undefined || b.openingStock === '' ? 0 : Number(b.openingStock);
  if (!Number.isFinite(opening) || opening < 0) throw new InvError(400, 'Opening stock must be zero or positive.');
  const cost = money(b.unitCost) ?? 0;

  const result = await withTx(async (c) => {
    // 1. Idempotency & Unique check: Check if an item with this SKU already exists
    const existing = (await c.query('SELECT * FROM "InventoryItem" WHERE UPPER(sku) = UPPER($1)', [data.sku])).rows[0];
    if (existing) {
      // If the exact same material was already created (repeated submission / double-click retry)
      if (existing.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
          existing.category === data.category &&
          existing.createdById === req.user.id) {
        return { item: existing, duplicate: true };
      }
      // Genuine duplicate SKU entered by user
      throw new InvError(409, `A material with SKU "${data.sku}" already exists (${existing.name}). Please use a unique SKU.`);
    }

    const ins = await c.query(
      `INSERT INTO "InventoryItem" ("sku","name","category","description","unit","colour","openingStock","currentStock",
         "minStockLevel","reorderLevel","unitCost","storageLocation","supplierId","branchId","createdById")
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [data.sku, data.name, data.category, data.description || null, data.unit, data.colour || null, r3(opening),
        data.minStockLevel || 0, data.reorderLevel || 0, cost, data.storageLocation || null,
        data.supplierId || null, data.branchId || null, req.user.id]
    );
    let item = ins.rows[0];
    if (opening > 0) {
      const mv = await moveStock(c, req, {
        itemId: item.id, type: 'OPENING', delta: r3(opening), unitCost: cost,
        referenceNo: `OPEN-${item.sku}`, reason: 'Opening stock', idempotencyKey: `opening:${item.id}`
      });
      item = mv.item;
    }
    await audit(c, req, 'ITEM_CREATED', 'InventoryItem', item.id, { sku: item.sku, openingStock: opening, unitCost: cost });
    return { item, duplicate: false };
  });

  res.status(result.duplicate ? 200 : 201).json({
    success: true,
    duplicate: result.duplicate,
    message: result.duplicate ? 'This material was already created.' : 'Material created.',
    data: shapeItem(result.item, true)
  });
});

exports.updateItem = handle(async (req, res) => {
  deny(req, 'MANAGE_ITEMS');
  const id = intId(req.params.id, 'material');
  const b = req.body || {};
  if (b.currentStock !== undefined || b.openingStock !== undefined) {
    throw new InvError(400, 'Stock quantities cannot be edited directly. Use a stock receipt or an approved adjustment.');
  }
  const data = readItemBody(b, true);
  // Unit cost edits are a sensitive valuation change -> adjustment permission
  if (b.unitCost !== undefined) { deny(req, 'STOCK_ADJUST'); data.unitCost = money(b.unitCost); }
  const keys = Object.keys(data);
  if (!keys.length) throw new InvError(400, 'Nothing to update.');

  const item = await withTx(async (c) => {
    const before = (await c.query('SELECT * FROM "InventoryItem" WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!before) throw new InvError(404, 'Material not found.');

    // Check SKU collision if SKU changed
    if (data.sku && data.sku.toUpperCase() !== before.sku.toUpperCase()) {
      const existingSku = (await c.query('SELECT id, name FROM "InventoryItem" WHERE UPPER(sku) = UPPER($1) AND id <> $2', [data.sku, id])).rows[0];
      if (existingSku) {
        throw new InvError(409, `A material with SKU "${data.sku}" already exists (${existingSku.name}). Please use a unique SKU.`);
      }
    }

    const sets = keys.map((k, idx) => `"${k}" = $${idx + 1}`).join(', ');
    const upd = await c.query(`UPDATE "InventoryItem" SET ${sets}, "updatedAt" = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map(k => data[k]), id]);
    const changes = {};
    keys.forEach(k => { if (String(before[k]) !== String(upd.rows[0][k])) changes[k] = { from: before[k], to: upd.rows[0][k] }; });
    await audit(c, req, 'ITEM_UPDATED', 'InventoryItem', id, { sku: before.sku, changes });
    return upd.rows[0];
  });
  res.json({ success: true, message: 'Material updated.', data: shapeItem(item, can(req.user, 'VIEW_COSTS')) });
});

exports.setItemStatus = handle(async (req, res) => {
  deny(req, 'DEACTIVATE_ITEMS');
  const id = intId(req.params.id, 'material');
  const isActive = Boolean(req.body?.isActive);
  const item = await withTx(async (c) => {
    const upd = await c.query('UPDATE "InventoryItem" SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *', [isActive, id]);
    if (!upd.rows[0]) throw new InvError(404, 'Material not found.');
    await audit(c, req, isActive ? 'ITEM_ACTIVATED' : 'ITEM_DEACTIVATED', 'InventoryItem', id, { sku: upd.rows[0].sku });
    return upd.rows[0];
  });
  res.json({ success: true, message: `Material ${isActive ? 'activated' : 'deactivated'}.`, data: item });
});

// =================================================================== MANUAL STOCK MOVEMENTS
exports.createMovement = handle(async (req, res) => {
  const b = req.body || {};
  const type = String(b.type || '').toUpperCase();
  const def = MANUAL_TYPES[type];
  if (!def) throw new InvError(400, `Invalid movement type. Allowed: ${Object.keys(MANUAL_TYPES).join(', ')}`);
  deny(req, def.perm);

  const itemId = intId(b.itemId, 'material');
  const key = idemKey(b.idempotencyKey);
  const reason = def.reasonRequired ? requireText(b.reason, 'Reason', 500) : text(b.reason, 500);
  let delta = null;
  let setTo = null;
  if (type === 'ADJUSTMENT') {
    if (b.countedQuantity === undefined || b.countedQuantity === '') throw new InvError(400, 'Physical counted quantity is required for adjustments.');
    setTo = Number(b.countedQuantity);
    if (!Number.isFinite(setTo) || setTo < 0) throw new InvError(400, 'Counted quantity must be zero or positive.');
  } else {
    delta = def.sign * qty(b.quantity);
  }
  const unitCost = type === 'STOCK_IN' ? money(b.unitCost) : null;

  const result = await withTx(async (c) => {
    const dup = await findMovementByKey(c, key);
    if (dup) return { movement: dup, duplicate: true };
    const ref = text(b.referenceNo, 80) || await nextNumber(c, def.prefix, 'StockMovement', 'referenceNo');
    const mv = await moveStock(c, req, {
      itemId, type, delta, setTo, unitCost: unitCost === null ? undefined : unitCost,
      referenceNo: ref, reason, idempotencyKey: key
    });
    if (!mv.duplicate) {
      await audit(c, req, `STOCK_${type}`, 'InventoryItem', itemId, {
        movementId: mv.movement.id, referenceNo: ref, quantity: mv.movement.quantity,
        previousStock: mv.movement.previousStock, newStock: mv.movement.newStock, reason, idempotencyKey: key
      });
    }
    return mv;
  });
  res.status(result.duplicate ? 200 : 201).json({
    success: true,
    duplicate: result.duplicate,
    message: result.duplicate ? 'This request was already processed — no duplicate stock change made.' : 'Stock updated.',
    data: result.movement
  });
});

exports.listMovements = handle(async (req, res) => {
  deny(req, 'VIEW_REPORTS');
  const q = req.query;
  const { page, pageSize, offset } = paging(q);
  const f = movementFilters(q);
  const where = f.where();
  const [rows, count] = await Promise.all([
    pool.query(`SELECT m.*, i.sku, i.name AS "itemName", i.unit, i.category
      FROM "StockMovement" m JOIN "InventoryItem" i ON i.id = m."itemId"
      ${where} ORDER BY m."createdAt" DESC, m.id DESC LIMIT ${pageSize} OFFSET ${offset}`, f.vals),
    pool.query(`SELECT COUNT(*)::int AS total FROM "StockMovement" m JOIN "InventoryItem" i ON i.id = m."itemId" ${where}`, f.vals)
  ]);
  res.json({ success: true, data: rows.rows, pagination: { page, pageSize, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / pageSize) } });
});

function movementFilters(q) {
  const f = filters();
  if (q.itemId) f.add('m."itemId" = ?', intId(q.itemId, 'material'));
  if (q.type && q.type !== 'ALL') f.add('m.type = ANY(?)', String(q.type).split(',').map(s => s.trim().toUpperCase()));
  if (q.category && q.category !== 'ALL') f.add('i.category = ?', q.category);
  if (q.search) {
    const s = `%${String(q.search).trim()}%`;
    f.add('(i.sku ILIKE ? OR i.name ILIKE ? OR COALESCE(m."referenceNo",\'\') ILIKE ? OR COALESCE(m."orderNumber",\'\') ILIKE ? OR COALESCE(m.reason,\'\') ILIKE ? OR COALESCE(m."performedByName",\'\') ILIKE ?)', s, s, s, s, s, s);
  }
  dateRange(f, 'm."createdAt"', q.from, q.to);
  branchFilter(f, 'm', q.branchId);
  return f;
}

// =================================================================== ORDER LOOKUP (read-only)
exports.lookupOrders = handle(async (req, res) => {
  deny(req, 'MATERIAL_REQUEST');
  const f = filters();
  f.add('o.status::text <> ALL(?)', BLOCKED_ORDER_STATUSES);
  if (PRODUCTION.includes(req.user.role)) f.add('o."assignedTailorId" = ?', req.user.id);
  if (req.query.q) {
    const s = `%${String(req.query.q).trim()}%`;
    f.add('(o."orderNumber" ILIKE ? OR c.name ILIKE ?)', s, s);
  }
  const { rows } = await pool.query(
    `SELECT o.id, o."orderNumber", o.status, o."branchId", o."assignedTailorId", c.name AS "customerName", g."dressType", g."fabricSuppliedBy",
            u.id AS "tailorId", u.name AS "tailorName"
     FROM "Order" o JOIN "Customer" c ON c.id = o."customerId"
     LEFT JOIN "GarmentDetails" g ON g."orderId" = o.id
     LEFT JOIN "User" u ON u.id = o."assignedTailorId"
     ${f.where()} ORDER BY o."createdAt" DESC LIMIT 25`, f.vals);
  res.json({ success: true, data: rows });
});

// =================================================================== MATERIAL REQUESTS (tailoring integration)
async function loadOrder(c, { orderId, orderNumber }) {
  const { rows } = orderId
    ? await c.query('SELECT id, "orderNumber", status::text AS status, "assignedTailorId", "branchId" FROM "Order" WHERE id = $1', [intId(orderId, 'order')])
    : await c.query('SELECT id, "orderNumber", status::text AS status, "assignedTailorId", "branchId" FROM "Order" WHERE "orderNumber" = $1', [requireText(orderNumber, 'Order number', 60)]);
  if (!rows[0]) throw new InvError(404, 'Order not found.');
  return rows[0];
}

exports.createRequest = handle(async (req, res) => {
  deny(req, 'MATERIAL_REQUEST');
  const b = req.body || {};
  const lines = Array.isArray(b.items) ? b.items : [{ itemId: b.itemId, quantity: b.quantity, notes: b.notes }];
  if (!lines.length || lines.length > 30) throw new InvError(400, 'Provide between 1 and 30 material lines.');
  const clientKey = text(b.clientKey, 100);

  const out = await withTx(async (c) => {
    if (clientKey) {
      const dup = await c.query('SELECT * FROM "OrderMaterialRequest" WHERE "clientKey" LIKE $1 ORDER BY id', [`${clientKey}:%`]);
      if (dup.rows.length) return { rows: dup.rows, duplicate: true };
    }
    const order = await loadOrder(c, b);
    if (BLOCKED_ORDER_STATUSES.includes(order.status)) throw new InvError(409, `Order ${order.orderNumber} is ${order.status}; materials cannot be requested.`);
    if (PRODUCTION.includes(req.user.role) && order.assignedTailorId !== req.user.id) {
      throw new InvError(403, `Order ${order.orderNumber} is not assigned to you.`);
    }

    let tailorId = b.tailorId !== undefined && b.tailorId !== null ? intId(b.tailorId, 'tailor') : order.assignedTailorId;
    let tailorName = text(b.tailorName, 100);
    if (tailorId && !tailorName) {
      const tUser = (await c.query('SELECT name FROM "User" WHERE id = $1', [tailorId])).rows[0];
      if (tUser) tailorName = tUser.name;
    }

    const created = [];
    for (let idx = 0; idx < lines.length; idx++) {
      const l = lines[idx];
      const itemId = intId(l.itemId, 'material');
      const q = qty(l.quantity, 'Requested quantity');
      const item = (await c.query('SELECT id, sku, "isActive" FROM "InventoryItem" WHERE id = $1', [itemId])).rows[0];
      if (!item) throw new InvError(404, `Material #${itemId} not found.`);
      if (!item.isActive) throw new InvError(400, `Material ${item.sku} is inactive.`);
      const requestNo = await nextNumber(c, 'MR', 'OrderMaterialRequest', 'requestNo');
      const ins = await c.query(
        `INSERT INTO "OrderMaterialRequest" ("requestNo","orderId","orderNumber","itemId","requestedQty","requestedById","requestedByName","branchId","notes","clientKey","tailorId","tailorName")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [requestNo, order.id, order.orderNumber, itemId, q, req.user.id, req.user.name, order.branchId, text(l.notes || b.notes, 500),
          clientKey ? `${clientKey}:${idx}` : null, tailorId || null, tailorName || null]
      );
      created.push(ins.rows[0]);
      await audit(c, req, 'MATERIAL_REQUESTED', 'OrderMaterialRequest', ins.rows[0].id, { requestNo, orderNumber: order.orderNumber, itemId, quantity: q, tailorId, tailorName });
    }
    return { rows: created, duplicate: false };
  });
  res.status(out.duplicate ? 200 : 201).json({
    success: true, duplicate: out.duplicate,
    message: out.duplicate ? 'Request already submitted.' : `${out.rows.length} material request(s) submitted.`,
    data: out.rows
  });
});

exports.listRequests = handle(async (req, res) => {
  deny(req, 'MATERIAL_REQUEST');
  const q = req.query;
  const { page, pageSize, offset } = paging(q);
  const f = filters();
  const ownOnly = !can(req.user, 'VIEW_ALL_REQUESTS') || q.mine === 'true';
  if (ownOnly) f.add('r."requestedById" = ?', req.user.id);
  if (q.status === 'OPEN') f.add('r.status IN (\'REQUESTED\',\'PARTIALLY_ISSUED\')');
  else if (q.status === 'ATTENTION') f.add('(o.status::text IN (\'CANCELLED\',\'REJECTED\') AND r."issuedQty" - r."returnedQty" - r."wastageQty" > 0.0001 AND r.status NOT IN (\'COMPLETED\',\'CANCELLED\'))');
  else if (q.status && q.status !== 'ALL') f.add('r.status = ?', q.status);
  if (q.orderId) f.add('r."orderId" = ?', intId(q.orderId, 'order'));
  if (q.search) {
    const s = `%${String(q.search).trim()}%`;
    f.add('(r."requestNo" ILIKE ? OR r."orderNumber" ILIKE ? OR i.sku ILIKE ? OR i.name ILIKE ? OR COALESCE(r."requestedByName",\'\') ILIKE ?)', s, s, s, s, s);
  }
  dateRange(f, 'r."createdAt"', q.from, q.to);
  branchFilter(f, 'r', q.branchId);
  const where = f.where();
  const base = `FROM "OrderMaterialRequest" r
    JOIN "InventoryItem" i ON i.id = r."itemId"
    JOIN "Order" o ON o.id = r."orderId"
    LEFT JOIN "Customer" cu ON cu.id = o."customerId"
    LEFT JOIN "User" t ON t.id = COALESCE(r."tailorId", o."assignedTailorId")`;
  const [rows, count] = await Promise.all([
    pool.query(`SELECT r.*, i.sku, i.name AS "itemName", i.unit, i."currentStock", o.status::text AS "orderStatus",
      COALESCE(cu.name, 'Walk-in Customer') AS "customerName",
      COALESCE(r."tailorName", t.name, 'Unassigned') AS "tailorName"
      ${base} ${where} ORDER BY CASE WHEN r.status IN ('REQUESTED','PARTIALLY_ISSUED') THEN 0 ELSE 1 END, r."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}`, f.vals),
    pool.query(`SELECT COUNT(*)::int AS total ${base} ${where}`, f.vals)
  ]);
  const data = rows.rows.map(r => {
    const requested = Number(r.requestedQty || 0);
    const issued = Number(r.issuedQty || 0);
    const returned = Number(r.returnedQty || 0);
    const damaged = Number(r.damagedQty || 0);
    const wastage = Number(r.wastageQty || 0);
    const remainingToIssue = r3(Math.max(0, requested - issued));
    const outstandingWithTailor = r3(Math.max(0, issued - returned - damaged - wastage));
    return {
      ...r,
      requestedQty: requested,
      issuedQty: issued,
      returnedQty: returned,
      damagedQty: damaged,
      wastageQty: wastage,
      remainingToIssue,
      outstandingWithTailor,
      withTailor: outstandingWithTailor,
      needsReturn: ['CANCELLED', 'REJECTED'].includes(r.orderStatus) && outstandingWithTailor > EPS && !['COMPLETED', 'CANCELLED'].includes(r.status)
    };
  });
  res.json({ success: true, data, pagination: { page, pageSize, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / pageSize) } });
});

async function lockRequest(c, id) {
  const { rows } = await c.query('SELECT * FROM "OrderMaterialRequest" WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw new InvError(404, 'Material request not found.');
  return rows[0];
}
async function requestResponse(c, id) {
  const res = (await c.query(`SELECT r.*, i.sku, i.name AS "itemName", i.unit, i."currentStock",
    COALESCE(cu.name, 'Walk-in Customer') AS "customerName",
    COALESCE(r."tailorName", t.name, 'Unassigned') AS "tailorName"
    FROM "OrderMaterialRequest" r
    JOIN "InventoryItem" i ON i.id = r."itemId"
    JOIN "Order" o ON o.id = r."orderId"
    LEFT JOIN "Customer" cu ON cu.id = o."customerId"
    LEFT JOIN "User" t ON t.id = COALESCE(r."tailorId", o."assignedTailorId")
    WHERE r.id = $1`, [id])).rows[0];
  if (!res) return null;
  const requested = Number(res.requestedQty || 0);
  const issued = Number(res.issuedQty || 0);
  const returned = Number(res.returnedQty || 0);
  const damaged = Number(res.damagedQty || 0);
  const wastage = Number(res.wastageQty || 0);
  const remainingToIssue = r3(Math.max(0, requested - issued));
  const outstandingWithTailor = r3(Math.max(0, issued - returned - damaged - wastage));
  return {
    ...res,
    requestedQty: requested,
    issuedQty: issued,
    returnedQty: returned,
    damagedQty: damaged,
    wastageQty: wastage,
    remainingToIssue,
    outstandingWithTailor,
    withTailor: outstandingWithTailor
  };
}

exports.issueRequest = handle(async (req, res) => {
  deny(req, 'MATERIAL_ISSUE');
  const id = intId(req.params.id, 'request');
  const key = idemKey(req.body?.idempotencyKey);
  const q = qty(req.body?.quantity, 'Issue quantity');

  const out = await withTx(async (c) => {
    const r = await lockRequest(c, id);
    if (await findMovementByKey(c, key)) return { data: await requestResponse(c, id), duplicate: true };
    if (!['REQUESTED', 'PARTIALLY_ISSUED'].includes(r.status)) throw new InvError(409, `Request ${r.requestNo} is ${r.status}; nothing to issue.`);
    const order = await loadOrder(c, { orderId: r.orderId });
    if (BLOCKED_ORDER_STATUSES.includes(order.status)) throw new InvError(409, `Order ${order.orderNumber} is ${order.status}. Materials cannot be issued — cancel or reject this request.`);
    const remaining = r3(r.requestedQty - r.issuedQty);
    if (q > remaining + EPS) throw new InvError(409, `Cannot issue ${q}. Only ${remaining} remaining on request ${r.requestNo}.`);

    const mv = await moveStock(c, req, {
      itemId: r.itemId, type: 'ORDER_ISSUE', delta: -q, referenceNo: r.requestNo,
      reason: text(req.body?.notes, 300) || `Issued for order ${r.orderNumber}`,
      orderId: r.orderId, orderNumber: r.orderNumber, materialRequestId: r.id, branchId: order.branchId, idempotencyKey: key
    });
    const issued = r3(r.issuedQty + q);
    const status = issued >= r.requestedQty - EPS ? 'ISSUED' : 'PARTIALLY_ISSUED';
    await c.query(`UPDATE "OrderMaterialRequest" SET "issuedQty" = $1, "consumedQty" = $1 - "returnedQty", status = $2,
      "issuedById" = $3, "issuedByName" = $4, "issuedAt" = NOW(), "updatedAt" = NOW() WHERE id = $5`,
      [issued, status, req.user.id, req.user.name, id]);
    await audit(c, req, 'MATERIAL_ISSUED', 'OrderMaterialRequest', id, { requestNo: r.requestNo, orderNumber: r.orderNumber, quantity: q, movementId: mv.movement.id, idempotencyKey: key });
    return { data: await requestResponse(c, id), duplicate: false };
  });
  res.json({ success: true, duplicate: out.duplicate, message: out.duplicate ? 'Already issued — no duplicate deduction.' : 'Material issued and stock deducted.', data: out.data });
});

exports.returnRequest = handle(async (req, res) => {
  deny(req, 'MATERIAL_ISSUE');
  const id = intId(req.params.id, 'request');
  const key = idemKey(req.body?.idempotencyKey);
  const q = qty(req.body?.quantity, 'Return quantity');
  const condition = (req.body?.condition || 'REUSABLE').toUpperCase();
  if (!['REUSABLE', 'DAMAGED', 'WASTAGE'].includes(condition)) {
    throw new InvError(400, 'Invalid condition. Must be REUSABLE, DAMAGED, or WASTAGE.');
  }

  const out = await withTx(async (c) => {
    const r = await lockRequest(c, id);
    if (condition === 'REUSABLE') {
      if (await findMovementByKey(c, key)) return { data: await requestResponse(c, id), duplicate: true };
    } else {
      const dup = await c.query(`SELECT 1 FROM "InventoryAuditLog" WHERE action IN ('MATERIAL_DAMAGED_RETURN', 'MATERIAL_WASTAGE') AND details->>'idempotencyKey' = $1`, [key]);
      if (dup.rows.length) return { data: await requestResponse(c, id), duplicate: true };
    }
    if (!['PARTIALLY_ISSUED', 'ISSUED', 'COMPLETED'].includes(r.status)) throw new InvError(409, `Request ${r.requestNo} is ${r.status}; nothing to return.`);
    const outstanding = r3(r.issuedQty - r.returnedQty - (r.damagedQty || 0) - r.wastageQty);
    if (q > outstanding + EPS) throw new InvError(409, `Cannot return ${q}. Only ${outstanding} is outstanding with production.`);

    if (condition === 'REUSABLE') {
      const mv = await moveStock(c, req, {
        itemId: r.itemId, type: 'ORDER_RETURN', delta: q, referenceNo: r.requestNo,
        reason: text(req.body?.reason, 300) || `Returned reusable material from order ${r.orderNumber}`,
        orderId: r.orderId, orderNumber: r.orderNumber, materialRequestId: r.id, branchId: r.branchId, idempotencyKey: key, allowInactive: true
      });
      await c.query(`UPDATE "OrderMaterialRequest" SET "returnedQty" = "returnedQty" + $1, "consumedQty" = "issuedQty" - ("returnedQty" + $1),
        "updatedAt" = NOW() WHERE id = $2`, [q, id]);
      await audit(c, req, 'MATERIAL_RETURNED', 'OrderMaterialRequest', id, { requestNo: r.requestNo, orderNumber: r.orderNumber, quantity: q, condition: 'REUSABLE', movementId: mv.movement.id, idempotencyKey: key });
    } else if (condition === 'DAMAGED') {
      await c.query(`UPDATE "OrderMaterialRequest" SET "damagedQty" = "damagedQty" + $1, "updatedAt" = NOW() WHERE id = $2`, [q, id]);
      await audit(c, req, 'MATERIAL_DAMAGED_RETURN', 'OrderMaterialRequest', id, { requestNo: r.requestNo, orderNumber: r.orderNumber, itemId: r.itemId, quantity: q, condition: 'DAMAGED', reason: text(req.body?.reason, 300), idempotencyKey: key });
    } else if (condition === 'WASTAGE') {
      await c.query(`UPDATE "OrderMaterialRequest" SET "wastageQty" = "wastageQty" + $1, "updatedAt" = NOW() WHERE id = $2`, [q, id]);
      await audit(c, req, 'MATERIAL_WASTAGE', 'OrderMaterialRequest', id, { requestNo: r.requestNo, orderNumber: r.orderNumber, itemId: r.itemId, quantity: q, condition: 'WASTAGE', reason: text(req.body?.reason, 300), idempotencyKey: key });
    }
    return { data: await requestResponse(c, id), duplicate: false };
  });
  res.json({
    success: true,
    duplicate: out.duplicate,
    message: out.duplicate ? 'Already recorded — no duplicate.' : (condition === 'REUSABLE' ? 'Reusable return recorded and stock restored.' : `${condition} recorded against tailor issue.`),
    data: out.data
  });
});

/** Production wastage on already-issued material. Stock was deducted at issue, so only the classification changes. */
exports.recordRequestWastage = handle(async (req, res) => {
  deny(req, 'MATERIAL_ISSUE');
  const id = intId(req.params.id, 'request');
  const key = idemKey(req.body?.idempotencyKey);
  const q = qty(req.body?.quantity, 'Wastage quantity');
  const reason = requireText(req.body?.reason, 'Wastage reason', 300);

  const out = await withTx(async (c) => {
    const r = await lockRequest(c, id);
    const dup = await c.query(`SELECT 1 FROM "InventoryAuditLog" WHERE action = 'MATERIAL_WASTAGE' AND details->>'idempotencyKey' = $1`, [key]);
    if (dup.rows.length) return { data: await requestResponse(c, id), duplicate: true };
    if (!['PARTIALLY_ISSUED', 'ISSUED', 'COMPLETED'].includes(r.status)) throw new InvError(409, `Request ${r.requestNo} is ${r.status}.`);
    const outstanding = r3(r.issuedQty - r.returnedQty - (r.damagedQty || 0) - r.wastageQty);
    if (q > outstanding + EPS) throw new InvError(409, `Cannot record ${q} wastage. Only ${outstanding} is outstanding.`);
    await c.query('UPDATE "OrderMaterialRequest" SET "wastageQty" = "wastageQty" + $1, "updatedAt" = NOW() WHERE id = $2', [q, id]);
    await audit(c, req, 'MATERIAL_WASTAGE', 'OrderMaterialRequest', id, { requestNo: r.requestNo, orderNumber: r.orderNumber, itemId: r.itemId, quantity: q, reason, idempotencyKey: key });
    return { data: await requestResponse(c, id), duplicate: false };
  });
  res.json({ success: true, duplicate: out.duplicate, message: 'Production wastage recorded.', data: out.data });
});

exports.completeRequest = handle(async (req, res) => {
  deny(req, 'MATERIAL_ISSUE');
  const id = intId(req.params.id, 'request');
  const data = await withTx(async (c) => {
    const r = await lockRequest(c, id);
    if (!['PARTIALLY_ISSUED', 'ISSUED'].includes(r.status)) throw new InvError(409, `Only issued requests can be closed (current: ${r.status}).`);
    await c.query(`UPDATE "OrderMaterialRequest" SET status = 'COMPLETED', "consumedQty" = "issuedQty" - "returnedQty", "updatedAt" = NOW() WHERE id = $1`, [id]);
    await audit(c, req, 'MATERIAL_REQUEST_CLOSED', 'OrderMaterialRequest', id, { requestNo: r.requestNo, issued: r.issuedQty, returned: r.returnedQty, damaged: r.damagedQty, wastage: r.wastageQty });
    return requestResponse(c, id);
  });
  res.json({ success: true, message: 'Request closed. Consumption finalised.', data });
});

exports.cancelRequest = handle(async (req, res) => {
  deny(req, 'MATERIAL_REQUEST');
  const id = intId(req.params.id, 'request');
  const data = await withTx(async (c) => {
    const r = await lockRequest(c, id);
    const isOwner = r.requestedById === req.user.id;
    if (!can(req.user, 'MATERIAL_ISSUE') && !isOwner) throw new InvError(403, 'You can only cancel your own requests.');
    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(r.status)) throw new InvError(409, `Request is already ${r.status}.`);
    const outstanding = r3(r.issuedQty - r.returnedQty - (r.damagedQty || 0) - r.wastageQty);
    if (outstanding > EPS) throw new InvError(409, `${outstanding} unit(s) are still with production. Record the return or wastage before cancelling.`);
    if (!can(req.user, 'MATERIAL_ISSUE') && r.issuedQty > EPS) throw new InvError(403, 'Issued requests can only be cancelled by store staff or a manager.');
    await c.query(`UPDATE "OrderMaterialRequest" SET status = 'CANCELLED', "consumedQty" = "issuedQty" - "returnedQty", "updatedAt" = NOW() WHERE id = $1`, [id]);
    await audit(c, req, 'MATERIAL_REQUEST_CANCELLED', 'OrderMaterialRequest', id, { requestNo: r.requestNo, reason: text(req.body?.reason, 300) });
    return requestResponse(c, id);
  });
  res.json({ success: true, message: 'Request cancelled.', data });
});

exports.rejectRequest = handle(async (req, res) => {
  deny(req, 'MATERIAL_ISSUE');
  const id = intId(req.params.id, 'request');
  const reason = requireText(req.body?.reason, 'Rejection reason', 300);
  const data = await withTx(async (c) => {
    const r = await lockRequest(c, id);
    if (r.status !== 'REQUESTED' || r.issuedQty > EPS) throw new InvError(409, 'Only un-issued requests can be rejected.');
    await c.query(`UPDATE "OrderMaterialRequest" SET status = 'REJECTED', "rejectionReason" = $1, "updatedAt" = NOW() WHERE id = $2`, [reason, id]);
    await audit(c, req, 'MATERIAL_REQUEST_REJECTED', 'OrderMaterialRequest', id, { requestNo: r.requestNo, reason });
    return requestResponse(c, id);
  });
  res.json({ success: true, message: 'Request rejected.', data });
});

// =================================================================== SUPPLIERS
exports.listSuppliers = handle(async (req, res) => {
  deny(req, 'VIEW_COSTS');
  const f = filters();
  if (req.query.search) {
    const s = `%${String(req.query.search).trim()}%`;
    f.add('(s.name ILIKE ? OR s.code ILIKE ? OR COALESCE(s."contactPerson",\'\') ILIKE ? OR COALESCE(s.phone,\'\') ILIKE ?)', s, s, s, s);
  }
  if (req.query.status === 'active') f.add('s."isActive" = true');
  else if (req.query.status === 'inactive') f.add('s."isActive" = false');
  const { rows } = await pool.query(
    `SELECT s.*,
       (SELECT COUNT(*)::int FROM "InventoryItem" i WHERE i."supplierId" = s.id) AS "itemCount",
       (SELECT COUNT(*)::int FROM "PurchaseOrder" p WHERE p."supplierId" = s.id) AS "poCount",
       (SELECT COALESCE(SUM(pi."quantityReceived" * pi."unitCost"),0) FROM "PurchaseOrderItem" pi
          JOIN "PurchaseOrder" p ON p.id = pi."purchaseOrderId" WHERE p."supplierId" = s.id) AS "totalPurchased",
       (SELECT MAX(p."createdAt") FROM "PurchaseOrder" p WHERE p."supplierId" = s.id) AS "lastOrderAt"
     FROM "Supplier" s ${f.where()} ORDER BY s."isActive" DESC, s.name ASC`, f.vals);
  res.json({ success: true, data: rows });
});

exports.getSupplier = handle(async (req, res) => {
  deny(req, 'VIEW_COSTS');
  const id = intId(req.params.id, 'supplier');
  const s = (await pool.query('SELECT * FROM "Supplier" WHERE id = $1', [id])).rows[0];
  if (!s) throw new InvError(404, 'Supplier not found.');
  const [pos, items] = await Promise.all([
    pool.query(`SELECT p.*, (SELECT COALESCE(SUM(pi."quantityReceived" * pi."unitCost"),0) FROM "PurchaseOrderItem" pi WHERE pi."purchaseOrderId" = p.id) AS "receivedValue"
      FROM "PurchaseOrder" p WHERE p."supplierId" = $1 ORDER BY p."createdAt" DESC LIMIT 100`, [id]),
    pool.query('SELECT id, sku, name, unit, "currentStock", "unitCost" FROM "InventoryItem" WHERE "supplierId" = $1 ORDER BY name', [id])
  ]);
  res.json({ success: true, data: { ...s, purchaseOrders: pos.rows, items: items.rows } });
});

function readSupplier(b) {
  return {
    name: requireText(b.name, 'Supplier name', 150),
    contactPerson: text(b.contactPerson, 100), phone: text(b.phone, 40), email: text(b.email, 120),
    address: text(b.address, 300), category: text(b.category, 80), paymentTerms: text(b.paymentTerms, 80),
    taxId: text(b.taxId, 60), notes: text(b.notes, 1000)
  };
}

exports.createSupplier = handle(async (req, res) => {
  deny(req, 'SUPPLIER_MANAGE');
  const d = readSupplier(req.body || {});
  const s = await withTx(async (c) => {
    let code = text(req.body?.code, 30);
    if (code) code = code.toUpperCase();
    else {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['inv_seq_SUP']);
      const last = (await c.query(`SELECT code FROM "Supplier" WHERE code LIKE 'SUP-%' ORDER BY id DESC LIMIT 1`)).rows[0];
      code = `SUP-${String((last ? parseInt(last.code.split('-').pop(), 10) || 0 : 0) + 1).padStart(4, '0')}`;
    }
    const ins = await c.query(`INSERT INTO "Supplier" ("code","name","contactPerson","phone","email","address","category","paymentTerms","taxId","notes")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [code, d.name, d.contactPerson, d.phone, d.email, d.address, d.category, d.paymentTerms, d.taxId, d.notes]);
    await audit(c, req, 'SUPPLIER_CREATED', 'Supplier', ins.rows[0].id, { code, name: d.name });
    return ins.rows[0];
  });
  res.status(201).json({ success: true, message: 'Supplier added.', data: s });
});

exports.updateSupplier = handle(async (req, res) => {
  deny(req, 'SUPPLIER_MANAGE');
  const id = intId(req.params.id, 'supplier');
  const d = readSupplier(req.body || {});
  const isActive = req.body?.isActive === undefined ? null : Boolean(req.body.isActive);
  const s = await withTx(async (c) => {
    const upd = await c.query(`UPDATE "Supplier" SET name=$1,"contactPerson"=$2,phone=$3,email=$4,address=$5,category=$6,"paymentTerms"=$7,
      "taxId"=$8,notes=$9,"isActive"=COALESCE($10,"isActive"),"updatedAt"=NOW() WHERE id=$11 RETURNING *`,
      [d.name, d.contactPerson, d.phone, d.email, d.address, d.category, d.paymentTerms, d.taxId, d.notes, isActive, id]);
    if (!upd.rows[0]) throw new InvError(404, 'Supplier not found.');
    await audit(c, req, 'SUPPLIER_UPDATED', 'Supplier', id, { name: d.name, isActive });
    return upd.rows[0];
  });
  res.json({ success: true, message: 'Supplier updated.', data: s });
});

// =================================================================== PURCHASE ORDERS
exports.listPurchaseOrders = handle(async (req, res) => {
  deny(req, 'VIEW_COSTS');
  const q = req.query;
  const { page, pageSize, offset } = paging(q);
  const f = filters();
  if (q.status === 'OPEN') f.add('p.status IN (\'PENDING_APPROVAL\',\'APPROVED\',\'PARTIALLY_RECEIVED\')');
  else if (q.status && q.status !== 'ALL') f.add('p.status = ?', q.status);
  if (q.supplierId) f.add('p."supplierId" = ?', intId(q.supplierId, 'supplier'));
  if (q.search) {
    const s = `%${String(q.search).trim()}%`;
    f.add('(p."poNumber" ILIKE ? OR s.name ILIKE ? OR COALESCE(p."requestedByName",\'\') ILIKE ?)', s, s, s);
  }
  dateRange(f, 'p."createdAt"', q.from, q.to);
  const where = f.where();
  const [rows, count] = await Promise.all([
    pool.query(`SELECT p.*, s.name AS "supplierName", s.code AS "supplierCode",
        (SELECT COUNT(*)::int FROM "PurchaseOrderItem" pi WHERE pi."purchaseOrderId" = p.id) AS "lineCount",
        (SELECT COALESCE(SUM(pi."quantityReceived" * pi."unitCost"),0) FROM "PurchaseOrderItem" pi WHERE pi."purchaseOrderId" = p.id) AS "receivedValue"
      FROM "PurchaseOrder" p JOIN "Supplier" s ON s.id = p."supplierId" ${where}
      ORDER BY CASE p.status WHEN 'PENDING_APPROVAL' THEN 0 WHEN 'APPROVED' THEN 1 WHEN 'PARTIALLY_RECEIVED' THEN 2 ELSE 3 END, p."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}`, f.vals),
    pool.query(`SELECT COUNT(*)::int AS total FROM "PurchaseOrder" p JOIN "Supplier" s ON s.id = p."supplierId" ${where}`, f.vals)
  ]);
  res.json({ success: true, data: rows.rows, pagination: { page, pageSize, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / pageSize) } });
});

async function poDetail(c, id) {
  const p = (await c.query(`SELECT p.*, s.name AS "supplierName", s.code AS "supplierCode", s.phone AS "supplierPhone", s.email AS "supplierEmail", s.address AS "supplierAddress"
    FROM "PurchaseOrder" p JOIN "Supplier" s ON s.id = p."supplierId" WHERE p.id = $1`, [id])).rows[0];
  if (!p) throw new InvError(404, 'Purchase order not found.');
  const [items, receipts] = await Promise.all([
    c.query(`SELECT pi.*, i.sku, i.name AS "itemName", i.unit FROM "PurchaseOrderItem" pi JOIN "InventoryItem" i ON i.id = pi."itemId"
      WHERE pi."purchaseOrderId" = $1 ORDER BY pi.id`, [id]),
    c.query('SELECT * FROM "GoodsReceipt" WHERE "purchaseOrderId" = $1 ORDER BY "createdAt"', [id])
  ]);
  return { ...p, items: items.rows, receipts: receipts.rows };
}

exports.getPurchaseOrder = handle(async (req, res) => {
  deny(req, 'VIEW_COSTS');
  res.json({ success: true, data: await poDetail(pool, intId(req.params.id, 'purchase order')) });
});

exports.createPurchaseOrder = handle(async (req, res) => {
  deny(req, 'PO_CREATE');
  const b = req.body || {};
  const supplierId = intId(b.supplierId, 'supplier');
  const lines = Array.isArray(b.items) ? b.items : [];
  if (!lines.length || lines.length > 50) throw new InvError(400, 'Add between 1 and 50 material lines.');
  const parsed = lines.map(l => ({ itemId: intId(l.itemId, 'material'), quantity: qty(l.quantity, 'Order quantity'), unitCost: money(l.unitCost) ?? 0 }));
  if (new Set(parsed.map(l => l.itemId)).size !== parsed.length) throw new InvError(400, 'Each material can appear only once per purchase order.');
  const clientKey = text(b.clientKey, 100);
  const expected = b.expectedDate && !isNaN(Date.parse(b.expectedDate)) ? b.expectedDate : null;

  const out = await withTx(async (c) => {
    if (clientKey) {
      const dup = (await c.query('SELECT id FROM "PurchaseOrder" WHERE "clientKey" = $1', [clientKey])).rows[0];
      if (dup) return { data: await poDetail(c, dup.id), duplicate: true };
    }
    const sup = (await c.query('SELECT id, "isActive" FROM "Supplier" WHERE id = $1', [supplierId])).rows[0];
    if (!sup) throw new InvError(404, 'Supplier not found.');
    if (!sup.isActive) throw new InvError(400, 'Supplier is inactive.');
    const found = await c.query('SELECT id FROM "InventoryItem" WHERE id = ANY($1)', [parsed.map(l => l.itemId)]);
    if (found.rows.length !== parsed.length) throw new InvError(404, 'One or more materials were not found.');
    const total = r4(parsed.reduce((s, l) => s + l.quantity * l.unitCost, 0));
    const poNumber = await nextNumber(c, 'PO', 'PurchaseOrder', 'poNumber');
    const ins = await c.query(`INSERT INTO "PurchaseOrder" ("poNumber","supplierId","branchId","totalAmount","expectedDate","notes","requestedById","requestedByName","clientKey")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [poNumber, supplierId, b.branchId ? intId(b.branchId, 'branch') : null, total, expected, text(b.notes, 1000), req.user.id, req.user.name, clientKey]);
    const poId = ins.rows[0].id;
    for (const l of parsed) {
      await c.query('INSERT INTO "PurchaseOrderItem" ("purchaseOrderId","itemId","quantityOrdered","unitCost") VALUES ($1,$2,$3,$4)', [poId, l.itemId, l.quantity, l.unitCost]);
    }
    await audit(c, req, 'PO_CREATED', 'PurchaseOrder', poId, { poNumber, supplierId, total, lines: parsed.length });
    return { data: await poDetail(c, poId), duplicate: false };
  });
  res.status(out.duplicate ? 200 : 201).json({ success: true, duplicate: out.duplicate, message: out.duplicate ? 'Purchase order already created.' : 'Purchase requisition submitted for approval.', data: out.data });
});

async function lockPO(c, id) {
  const p = (await c.query('SELECT * FROM "PurchaseOrder" WHERE id = $1 FOR UPDATE', [id])).rows[0];
  if (!p) throw new InvError(404, 'Purchase order not found.');
  return p;
}

exports.approvePurchaseOrder = handle(async (req, res) => {
  deny(req, 'PO_APPROVE');
  const id = intId(req.params.id, 'purchase order');
  const data = await withTx(async (c) => {
    const p = await lockPO(c, id);
    if (p.status !== 'PENDING_APPROVAL') throw new InvError(409, `PO ${p.poNumber} is ${p.status}; it cannot be approved.`);
    if (PO_CEO_THRESHOLD && p.totalAmount > PO_CEO_THRESHOLD && req.user.role !== 'SUPER_ADMIN') {
      throw new InvError(403, `PO value exceeds LKR ${PO_CEO_THRESHOLD.toLocaleString()}. CEO approval is required.`);
    }
    await c.query(`UPDATE "PurchaseOrder" SET status='APPROVED', "approvedById"=$1, "approvedByName"=$2, "approvedAt"=NOW(), "updatedAt"=NOW() WHERE id=$3`,
      [req.user.id, req.user.name, id]);
    await audit(c, req, 'PO_APPROVED', 'PurchaseOrder', id, { poNumber: p.poNumber, total: p.totalAmount, selfApproved: p.requestedById === req.user.id });
    return poDetail(c, id);
  });
  res.json({ success: true, message: 'Purchase order approved.', data });
});

exports.rejectPurchaseOrder = handle(async (req, res) => {
  deny(req, 'PO_APPROVE');
  const id = intId(req.params.id, 'purchase order');
  const reason = requireText(req.body?.reason, 'Rejection reason', 500);
  const data = await withTx(async (c) => {
    const p = await lockPO(c, id);
    if (p.status !== 'PENDING_APPROVAL') throw new InvError(409, `PO ${p.poNumber} is ${p.status}; it cannot be rejected.`);
    await c.query(`UPDATE "PurchaseOrder" SET status='REJECTED', "rejectedByName"=$1, "rejectionReason"=$2, "updatedAt"=NOW() WHERE id=$3`, [req.user.name, reason, id]);
    await audit(c, req, 'PO_REJECTED', 'PurchaseOrder', id, { poNumber: p.poNumber, reason });
    return poDetail(c, id);
  });
  res.json({ success: true, message: 'Purchase order rejected.', data });
});

exports.cancelPurchaseOrder = handle(async (req, res) => {
  deny(req, 'PO_CREATE');
  const id = intId(req.params.id, 'purchase order');
  const data = await withTx(async (c) => {
    const p = await lockPO(c, id);
    if (!['PENDING_APPROVAL', 'APPROVED'].includes(p.status)) throw new InvError(409, `PO ${p.poNumber} is ${p.status}; it cannot be cancelled.`);
    const rec = (await c.query('SELECT COALESCE(SUM("quantityReceived"),0) AS r FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = $1', [id])).rows[0];
    if (Number(rec.r) > EPS) throw new InvError(409, 'Goods have already been received against this PO.');
    if (p.status === 'APPROVED' && !can(req.user, 'PO_APPROVE')) throw new InvError(403, 'Only an approver can cancel an approved PO.');
    await c.query(`UPDATE "PurchaseOrder" SET status='CANCELLED', "rejectionReason"=COALESCE($1,"rejectionReason"), "updatedAt"=NOW() WHERE id=$2`, [text(req.body?.reason, 500), id]);
    await audit(c, req, 'PO_CANCELLED', 'PurchaseOrder', id, { poNumber: p.poNumber, reason: text(req.body?.reason, 500) });
    return poDetail(c, id);
  });
  res.json({ success: true, message: 'Purchase order cancelled.', data });
});

/** Goods Received Note — stock increases ONLY here, ONLY for verified quantities. */
exports.receivePurchaseOrder = handle(async (req, res) => {
  deny(req, 'PO_RECEIVE');
  const id = intId(req.params.id, 'purchase order');
  const b = req.body || {};
  const key = idemKey(b.idempotencyKey);
  if (b.verified !== true) throw new InvError(400, 'Received quantities must be physically verified (verified: true) before stock is updated.');
  const lines = (Array.isArray(b.lines) ? b.lines : [])
    .filter(l => l && Number(l.quantity) > 0)
    .map(l => ({ poItemId: intId(l.poItemId, 'PO line'), quantity: qty(l.quantity, 'Received quantity') }));
  if (!lines.length) throw new InvError(400, 'Enter at least one received quantity.');
  const invoiceAmount = money(b.invoiceAmount, 'Invoice amount');

  const out = await withTx(async (c) => {
    const p = await lockPO(c, id);
    const dup = (await c.query('SELECT id FROM "GoodsReceipt" WHERE "clientKey" = $1', [key])).rows[0];
    if (dup) return { data: await poDetail(c, id), duplicate: true };
    if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(p.status)) throw new InvError(409, `PO ${p.poNumber} is ${p.status}. Only approved POs can be received.`);

    const poItems = (await c.query('SELECT * FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = $1 FOR UPDATE', [id])).rows;
    const byId = new Map(poItems.map(pi => [pi.id, pi]));
    const grnNumber = await nextNumber(c, 'GRN', 'GoodsReceipt', 'grnNumber');
    const grnLines = [];

    const sorted = lines.map(l => ({ ...l, pi: byId.get(l.poItemId) })).sort((a, z) => (a.pi?.itemId || 0) - (z.pi?.itemId || 0));
    for (const l of sorted) {
      if (!l.pi) throw new InvError(400, `PO line #${l.poItemId} does not belong to ${p.poNumber}.`);
      const outstanding = r3(l.pi.quantityOrdered - l.pi.quantityReceived);
      if (l.quantity > outstanding + EPS) throw new InvError(409, `Line #${l.poItemId}: receiving ${l.quantity} exceeds outstanding ${outstanding}.`);
      const mv = await moveStock(c, req, {
        itemId: l.pi.itemId, type: 'GRN_RECEIPT', delta: l.quantity, unitCost: Number(l.pi.unitCost),
        referenceNo: grnNumber, reason: `Received against ${p.poNumber}`, purchaseOrderId: id,
        branchId: p.branchId, idempotencyKey: `${key}:${l.poItemId}`, allowInactive: true
      });
      await c.query('UPDATE "PurchaseOrderItem" SET "quantityReceived" = "quantityReceived" + $1 WHERE id = $2', [l.quantity, l.poItemId]);
      grnLines.push({ poItemId: l.poItemId, itemId: l.pi.itemId, quantity: l.quantity, unitCost: l.pi.unitCost, movementId: mv.movement.id });
    }
    await c.query(`INSERT INTO "GoodsReceipt" ("grnNumber","purchaseOrderId","supplierInvoiceNo","invoiceAmount","lines","notes","receivedById","receivedByName","clientKey")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [grnNumber, id, text(b.supplierInvoiceNo, 80), invoiceAmount, JSON.stringify(grnLines), text(b.notes, 1000), req.user.id, req.user.name, key]);
    const remaining = (await c.query('SELECT COUNT(*)::int AS n FROM "PurchaseOrderItem" WHERE "purchaseOrderId" = $1 AND "quantityReceived" < "quantityOrdered" - 0.0001', [id])).rows[0].n;
    const status = remaining === 0 ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    await c.query('UPDATE "PurchaseOrder" SET status = $1, "updatedAt" = NOW() WHERE id = $2', [status, id]);
    await audit(c, req, 'GOODS_RECEIVED', 'PurchaseOrder', id, { poNumber: p.poNumber, grnNumber, lines: grnLines, supplierInvoiceNo: text(b.supplierInvoiceNo, 80), invoiceAmount, idempotencyKey: key });
    return { data: await poDetail(c, id), duplicate: false };
  });
  res.json({ success: true, duplicate: out.duplicate, message: out.duplicate ? 'This GRN was already recorded.' : 'Goods received and stock updated.', data: out.data });
});

// =================================================================== REPORTS
const CONSUMPTION_GROUPS = {
  order:  { key: `COALESCE(m."orderNumber", 'Non-order issue')`, label: 'Order' },
  tailor: { key: `COALESCE(r."requestedByName", m."performedByName", 'Unknown')`, label: 'Tailor / Requested by' },
  branch: { key: `COALESCE(b.name, 'Unassigned')`, label: 'Branch' },
  date:   { key: `to_char(m."createdAt", 'YYYY-MM-DD')`, label: 'Date' },
  item:   { key: `i.category`, label: 'Category' }
};

exports.getReport = handle(async (req, res) => {
  deny(req, 'VIEW_REPORTS');
  const type = req.params.type;
  const q = req.query;
  const showCost = can(req.user, 'VIEW_COSTS');
  let rows = [];
  let summary = {};

  if (type === 'valuation') {
    deny(req, 'VIEW_COSTS');
    const f = filters();
    f.add('i."isActive" = true');
    if (q.category && q.category !== 'ALL') f.add('i.category = ?', q.category);
    branchFilter(f, 'i', q.branchId);
    rows = (await pool.query(`SELECT i.sku, i.name, i.category, i.unit, i."currentStock", i."unitCost",
        ROUND((i."currentStock" * i."unitCost")::numeric, 2)::float AS "stockValue", i."storageLocation", s.name AS "supplierName"
      FROM "InventoryItem" i LEFT JOIN "Supplier" s ON s.id = i."supplierId" ${f.where()} ORDER BY "stockValue" DESC`, f.vals)).rows;
    summary = { costingMethod: 'Weighted Average Cost', totalValue: r4(rows.reduce((s, r) => s + r.stockValue, 0)), items: rows.length };
  } else if (type === 'consumption') {
    const g = CONSUMPTION_GROUPS[q.groupBy] || CONSUMPTION_GROUPS.order;
    const f = filters();
    f.add('m.type = ANY(?)', CONSUMPTION_TYPES);
    dateRange(f, 'm."createdAt"', q.from, q.to);
    branchFilter(f, 'm', q.branchId);
    if (q.category && q.category !== 'ALL') f.add('i.category = ?', q.category);
    rows = (await pool.query(`SELECT ${g.key} AS "group", i.sku, i.name, i.unit,
        SUM(CASE WHEN m.type IN ('ORDER_ISSUE','ISSUE') THEN -m.quantity ELSE 0 END) AS issued,
        SUM(CASE WHEN m.type = 'ORDER_RETURN' THEN m.quantity ELSE 0 END) AS returned,
        SUM(-m.quantity) AS "netConsumed",
        ROUND(SUM(-m.quantity * m."unitCost")::numeric, 2)::float AS value
      FROM "StockMovement" m JOIN "InventoryItem" i ON i.id = m."itemId"
      LEFT JOIN "OrderMaterialRequest" r ON r.id = m."materialRequestId"
      LEFT JOIN "Branch" b ON b.id = m."branchId"
      ${f.where()} GROUP BY 1, i.sku, i.name, i.unit ORDER BY 1, value DESC`, f.vals)).rows;
    summary = { groupBy: g.label, totalValue: r4(rows.reduce((s, r) => s + Number(r.value), 0)), groups: new Set(rows.map(r => r.group)).size };
  } else if (type === 'wastage') {
    const f1 = filters();
    f1.add('m.type IN (\'WASTAGE\',\'DAMAGED\')');
    dateRange(f1, 'm."createdAt"', q.from, q.to);
    const store = (await pool.query(`SELECT m."createdAt" AS date, 'Store write-off' AS source, m.type, i.sku, i.name, i.unit, -m.quantity AS quantity,
        ROUND((-m.quantity * m."unitCost")::numeric, 2)::float AS value, m.reason, m."referenceNo" AS reference, m."performedByName" AS "recordedBy"
      FROM "StockMovement" m JOIN "InventoryItem" i ON i.id = m."itemId" ${f1.where()}`, f1.vals)).rows;
    const f2 = filters();
    f2.add('a.action = \'MATERIAL_WASTAGE\'');
    dateRange(f2, 'a."createdAt"', q.from, q.to);
    const prod = (await pool.query(`SELECT a."createdAt" AS date, 'Production wastage' AS source, 'PRODUCTION_WASTAGE' AS type, i.sku, i.name, i.unit,
        (a.details->>'quantity')::float AS quantity, ROUND(((a.details->>'quantity')::float * i."unitCost")::numeric, 2)::float AS value,
        a.details->>'reason' AS reason, a.details->>'orderNumber' AS reference, a."userName" AS "recordedBy"
      FROM "InventoryAuditLog" a JOIN "InventoryItem" i ON i.id = (a.details->>'itemId')::int ${f2.where()}`, f2.vals)).rows;
    rows = [...store, ...prod].sort((a, z) => new Date(z.date) - new Date(a.date));
    summary = { totalValue: r4(rows.reduce((s, r) => s + Number(r.value || 0), 0)), entries: rows.length, note: 'Production wastage valued at current weighted average cost.' };
  } else if (type === 'purchases') {
    deny(req, 'VIEW_COSTS');
    const f = filters();
    dateRange(f, 'p."createdAt"', q.from, q.to);
    if (q.supplierId) f.add('p."supplierId" = ?', intId(q.supplierId, 'supplier'));
    rows = (await pool.query(`SELECT p."poNumber", p."createdAt", s.name AS "supplierName", p.status, p."totalAmount",
        (SELECT COALESCE(SUM(pi."quantityReceived" * pi."unitCost"),0) FROM "PurchaseOrderItem" pi WHERE pi."purchaseOrderId" = p.id) AS "receivedValue",
        p."requestedByName", p."approvedByName", p."approvedAt",
        (SELECT string_agg(g."grnNumber" || COALESCE(' / Inv ' || g."supplierInvoiceNo", ''), ', ') FROM "GoodsReceipt" g WHERE g."purchaseOrderId" = p.id) AS receipts
      FROM "PurchaseOrder" p JOIN "Supplier" s ON s.id = p."supplierId" ${f.where()} ORDER BY p."createdAt" DESC`, f.vals)).rows;
    summary = { orders: rows.length, totalOrdered: r4(rows.reduce((s, r) => s + Number(r.totalAmount), 0)), totalReceived: r4(rows.reduce((s, r) => s + Number(r.receivedValue), 0)) };
  } else if (type === 'movements') {
    const f = movementFilters(q);
    rows = (await pool.query(`SELECT m."createdAt", m."referenceNo", m.type, i.sku, i.name, i.unit, m.quantity, m."previousStock", m."newStock",
        ${showCost ? 'm."unitCost",' : ''} m."orderNumber", m.reason, m."performedByName"
      FROM "StockMovement" m JOIN "InventoryItem" i ON i.id = m."itemId" ${f.where()} ORDER BY m."createdAt" DESC LIMIT 5000`, f.vals)).rows;
    summary = { entries: rows.length };
  } else if (type === 'low-stock') {
    rows = (await computeAlerts(q.branchId)).map(a => ({
      sku: a.sku, name: a.name, category: a.category, unit: a.unit, status: a.stockStatus, currentStock: a.currentStock,
      minStockLevel: a.minStockLevel, reorderLevel: a.reorderLevel, avgDailyUsage: a.avgDailyUsage, daysOfCover: a.daysOfCover,
      suggestedReorderQty: a.suggestedReorderQty, ...(showCost ? { suggestedReorderValue: a.suggestedReorderValue, supplierName: a.supplierName } : {})
    }));
    summary = { items: rows.length };
  } else if (type === 'requests') {
    const f = filters();
    dateRange(f, 'r."createdAt"', q.from, q.to);
    rows = (await pool.query(`SELECT r."requestNo", r."createdAt", r."orderNumber", r."tailorName", i.sku, i.name, i.unit, r."requestedQty", r."issuedQty",
        r."returnedQty", r."damagedQty", r."wastageQty", r."consumedQty", r.status, r."requestedByName", r."issuedByName"
      FROM "OrderMaterialRequest" r JOIN "InventoryItem" i ON i.id = r."itemId" ${f.where()} ORDER BY r."createdAt" DESC LIMIT 5000`, f.vals)).rows;
    summary = { entries: rows.length };
  } else if (type === 'purchase-spend') {
    return exports.getPurchaseSpendReport(req, res);
  } else {
    throw new InvError(400, 'Unknown report type.');
  }
  res.json({ success: true, data: rows, summary, generatedAt: new Date().toISOString() });
});

// =================================================================== AUDIT
exports.listAuditLogs = handle(async (req, res) => {
  deny(req, 'VIEW_AUDIT');
  const q = req.query;
  const { page, pageSize, offset } = paging(q);
  const f = filters();
  if (q.entityType && q.entityType !== 'ALL') f.add('a."entityType" = ?', q.entityType);
  if (q.action) f.add('a.action ILIKE ?', `%${q.action}%`);
  if (q.search) { const s = `%${q.search}%`; f.add('(COALESCE(a."userName",\'\') ILIKE ? OR a.details::text ILIKE ?)', s, s); }
  dateRange(f, 'a."createdAt"', q.from, q.to);
  const where = f.where();
  const [rows, count] = await Promise.all([
    pool.query(`SELECT a.* FROM "InventoryAuditLog" a ${where} ORDER BY a."createdAt" DESC, a.id DESC LIMIT ${pageSize} OFFSET ${offset}`, f.vals),
    pool.query(`SELECT COUNT(*)::int AS total FROM "InventoryAuditLog" a ${where}`, f.vals)
  ]);
  res.json({ success: true, data: rows.rows, pagination: { page, pageSize, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / pageSize) } });
});

// =================================================================== PURCHASE SPEND REPORT
exports.getPurchaseSpendReport = handle(async (req, res) => {
  deny(req, 'VIEW_COSTS');
  const branchId = req.query.branchId;
  const monthParam = req.query.month;

  const f = filters();
  branchFilter(f, 'm', branchId);
  const branchWhere = f.where();

  const cte = `
    WITH verified_purchases AS (
      SELECT
        m.id AS "movementId",
        m."itemId",
        i.sku,
        i.name AS "itemName",
        i.unit,
        i.category,
        m.type AS "sourceType",
        m.quantity,
        m."unitCost",
        ROUND((m.quantity * m."unitCost")::numeric, 2)::float AS "totalCost",
        m."createdAt",
        m."branchId",
        b.name AS "branchName",
        m."referenceNo" AS "grnNumber",
        COALESCE(g."supplierInvoiceNo", '') AS "supplierInvoiceNo",
        COALESCE(s.name, sup.name, '') AS "supplierName",
        COALESCE(po."poNumber", '') AS "poNumber",
        COALESCE(m."performedByName", g."receivedByName", 'Staff') AS "receivedByName"
      FROM "StockMovement" m
      JOIN "InventoryItem" i ON i.id = m."itemId"
      LEFT JOIN "GoodsReceipt" g ON g."grnNumber" = m."referenceNo" OR (m."purchaseOrderId" IS NOT NULL AND g."purchaseOrderId" = m."purchaseOrderId")
      LEFT JOIN "PurchaseOrder" po ON po.id = m."purchaseOrderId"
      LEFT JOIN "Supplier" s ON s.id = po."supplierId"
      LEFT JOIN "Supplier" sup ON sup.id = m."supplierId"
      LEFT JOIN "Branch" b ON b.id = m."branchId"
      ${branchWhere ? branchWhere + ' AND' : 'WHERE'}
        m.type = 'GRN_RECEIPT'
        AND m.quantity > 0
        AND m."unitCost" > 0

      UNION ALL

      SELECT
        m.id AS "movementId",
        m."itemId",
        i.sku,
        i.name AS "itemName",
        i.unit,
        i.category,
        m.type AS "sourceType",
        m.quantity,
        m."unitCost",
        ROUND((m.quantity * m."unitCost")::numeric, 2)::float AS "totalCost",
        m."createdAt",
        m."branchId",
        b.name AS "branchName",
        COALESCE(m."referenceNo", 'Direct Receipt') AS "grnNumber",
        COALESCE(m."referenceNo", '') AS "supplierInvoiceNo",
        COALESCE(sup.name, s.name, '') AS "supplierName",
        '' AS "poNumber",
        COALESCE(m."performedByName", 'Staff') AS "receivedByName"
      FROM "StockMovement" m
      JOIN "InventoryItem" i ON i.id = m."itemId"
      LEFT JOIN "Supplier" sup ON sup.id = m."supplierId"
      LEFT JOIN "Supplier" s ON s.id = i."supplierId"
      LEFT JOIN "Branch" b ON b.id = m."branchId"
      ${branchWhere ? branchWhere + ' AND' : 'WHERE'}
        m.type IN ('STOCK_IN', 'PURCHASE')
        AND m.quantity > 0
        AND m."unitCost" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "GoodsReceipt" g
          WHERE g."grnNumber" = m."referenceNo"
             OR (m."purchaseOrderId" IS NOT NULL AND g."purchaseOrderId" = m."purchaseOrderId")
        )
    )
  `;

  const [allTimeRes, monthlyRes] = await Promise.all([
    pool.query(`${cte}
      SELECT
        COALESCE(SUM("totalCost"), 0)::float AS "allTimeSpend",
        COUNT(DISTINCT "grnNumber")::int AS "allTimeReceiptCount",
        COUNT(*)::int AS "allTimeItemCount",
        MIN("createdAt") AS "earliestDate",
        MAX("createdAt") AS "latestDate"
      FROM verified_purchases`, f.vals),
    pool.query(`${cte}
      SELECT
        to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS "month",
        COALESCE(SUM("totalCost"), 0)::float AS "spend",
        COUNT(DISTINCT "grnNumber")::int AS "receiptCount",
        COUNT(*)::int AS "itemCount"
      FROM verified_purchases
      GROUP BY 1
      ORDER BY 1 DESC`, f.vals)
  ]);

  const allTime = allTimeRes.rows[0] || {};
  const rawMonths = monthlyRes.rows || [];

  const chronological = [...rawMonths].sort((a, b) => a.month.localeCompare(b.month));
  const monthMap = new Map();
  for (let idx = 0; idx < chronological.length; idx++) {
    const curr = chronological[idx];
    const prev = idx > 0 ? chronological[idx - 1] : null;
    const prevSpend = prev ? Number(prev.spend) : null;
    const diff = prevSpend !== null ? Number((curr.spend - prevSpend).toFixed(2)) : null;
    const pct = (prevSpend && prevSpend > 0) ? Number((((curr.spend - prevSpend) / prevSpend) * 100).toFixed(1)) : null;

    const [y, m] = curr.month.split('-');
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    const label = dateObj.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    monthMap.set(curr.month, {
      month: curr.month,
      year: parseInt(y, 10),
      monthNum: parseInt(m, 10),
      label,
      spend: Number(curr.spend),
      receiptCount: Number(curr.receiptCount),
      itemCount: Number(curr.itemCount),
      previousMonthSpend: prevSpend,
      changeAmount: diff,
      changePercentage: pct
    });
  }

  const monthlyBreakdown = Array.from(monthMap.values()).reverse();
  const availableMonths = monthlyBreakdown.map(m => m.month);

  const nowMonth = new Date().toISOString().slice(0, 7);
  let selectedMonth = monthParam || (availableMonths.includes(nowMonth) ? nowMonth : (availableMonths[0] || nowMonth));

  let selectedMonthData = monthMap.get(selectedMonth) || {
    month: selectedMonth,
    spend: 0,
    receiptCount: 0,
    itemCount: 0,
    changeAmount: null,
    changePercentage: null
  };

  let txQuery = '';
  let txVals = [...f.vals];
  if (selectedMonth && selectedMonth !== 'ALL') {
    txQuery = `${cte}
      SELECT * FROM verified_purchases
      WHERE to_char(date_trunc('month', "createdAt"), 'YYYY-MM') = $${txVals.length + 1}
      ORDER BY "createdAt" DESC, "movementId" DESC`;
    txVals.push(selectedMonth);
  } else {
    txQuery = `${cte}
      SELECT * FROM verified_purchases
      ORDER BY "createdAt" DESC, "movementId" DESC LIMIT 1000`;
  }

  const txRes = await pool.query(txQuery, txVals);

  const uncostedRes = await pool.query(`
    SELECT COUNT(*)::int AS count FROM "InventoryItem"
    WHERE "isActive" = true AND ("costStatus" = 'PENDING_VALUATION' OR "unitCost" = 0)
  `);
  const openingMovementsRes = await pool.query(`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(quantity), 0)::float AS qty FROM "StockMovement"
    WHERE type = 'OPENING'
  `);

  res.json({
    success: true,
    data: {
      allTimeSpend: Number(allTime.allTimeSpend || 0),
      allTimeReceiptCount: Number(allTime.allTimeReceiptCount || 0),
      allTimeItemCount: Number(allTime.allTimeItemCount || 0),
      earliestDate: allTime.earliestDate,
      latestDate: allTime.latestDate,
      selectedMonth,
      selectedMonthSpend: selectedMonthData.spend,
      selectedMonthReceiptCount: selectedMonthData.receiptCount,
      selectedMonthItemCount: selectedMonthData.itemCount,
      selectedMonthComparison: {
        previousMonthSpend: selectedMonthData.previousMonthSpend,
        changeAmount: selectedMonthData.changeAmount,
        changePercentage: selectedMonthData.changePercentage
      },
      monthlyBreakdown,
      availableMonths,
      transactions: txRes.rows,
      hasHistoricalData: availableMonths.length > 0,
      missingHistoricalAudit: {
        uncostedItemsCount: uncostedRes.rows[0].count,
        openingStockMovementsCount: openingMovementsRes.rows[0].count,
        openingStockQuantity: openingMovementsRes.rows[0].qty,
        explanation: 'Historical purchases made prior to ERP system deployment do not possess digital purchase orders, supplier invoices, or Goods Receipts in the database. Initial inventory was registered as Opening Stock. Opening balances are excluded from purchase spend to preserve strict accounting integrity.'
      }
    }
  });
});

// =================================================================== REPEAT STOCK PURCHASE / REORDER
exports.recordRepeatPurchase = handle(async (req, res) => {
  deny(req, 'STOCK_RECEIVE');
  const b = req.body || {};
  const itemId = intId(b.itemId, 'material');
  const q = qty(b.quantity, 'Purchase quantity');
  const cost = money(b.unitPurchaseCost, 'Unit purchase cost');
  if (cost === null || cost === undefined || cost < 0) {
    throw new InvError(400, 'Enter a valid unit purchase cost (LKR).');
  }
  if (b.receivedConfirmed !== true) {
    throw new InvError(400, 'You must physically verify and confirm receipt of materials before updating stock.');
  }
  const invoiceNo = requireText(b.supplierInvoiceNo, 'Supplier invoice number', 80);
  const key = idemKey(b.idempotencyKey);
  const supplierId = b.supplierId ? intId(b.supplierId, 'supplier') : null;

  const out = await withTx(async (c) => {
    // 1. Lock existing material
    const { rows: itemRows } = await c.query('SELECT * FROM "InventoryItem" WHERE id = $1 FOR UPDATE', [itemId]);
    const item = itemRows[0];
    if (!item) throw new InvError(404, 'Material not found.');

    // 2. Idempotency check on movement
    if (key) {
      const dupMv = await findMovementByKey(c, key);
      if (dupMv) {
        const itemFresh = (await c.query('SELECT * FROM "InventoryItem" WHERE id = $1', [itemId])).rows[0];
        return { item: shapeItem(itemFresh, true), duplicate: true, movement: dupMv };
      }
    }

    // 3. Resolve supplier
    let resolvedSupplierId = supplierId || item.supplierId;
    if (supplierId) {
      const sup = (await c.query('SELECT id, name FROM "Supplier" WHERE id = $1', [supplierId])).rows[0];
      if (!sup) throw new InvError(404, 'Supplier not found.');
    } else if (b.supplierName && String(b.supplierName).trim()) {
      const trimmed = String(b.supplierName).trim();
      const existingSup = (await c.query('SELECT id FROM "Supplier" WHERE LOWER(name) = LOWER($1)', [trimmed])).rows[0];
      if (existingSup) {
        resolvedSupplierId = existingSup.id;
      }
    }

    // 4. Create Purchase Order & Goods Receipt records for traceability
    const poNumber = await nextNumber(c, 'PO', 'PurchaseOrder', 'poNumber');
    const grnNumber = await nextNumber(c, 'GRN', 'GoodsReceipt', 'grnNumber');
    const totalAmount = r4(q * cost);

    // Fallback supplier if none attached
    const fallbackSupplierId = resolvedSupplierId || (await c.query('SELECT id FROM "Supplier" LIMIT 1')).rows[0]?.id;

    // Create PO in 'RECEIVED' status
    const poIns = await c.query(`
      INSERT INTO "PurchaseOrder" ("poNumber","supplierId","branchId","status","totalAmount","notes","requestedById","requestedByName","approvedById","approvedByName","approvedAt","clientKey")
      VALUES ($1, $2, $3, 'RECEIVED', $4, $5, $6, $7, $6, $7, NOW(), $8)
      RETURNING id
    `, [poNumber, fallbackSupplierId, b.branchId || item.branchId, totalAmount, text(b.notes, 500) || `Repeat Purchase - Inv #${invoiceNo}`, req.user.id, req.user.name, key ? `po-${key}` : null]);
    const poId = poIns.rows[0].id;

    // Create PO Item
    const poiIns = await c.query(`
      INSERT INTO "PurchaseOrderItem" ("purchaseOrderId","itemId","quantityOrdered","quantityReceived","unitCost")
      VALUES ($1, $2, $3, $3, $4) RETURNING id
    `, [poId, item.id, q, cost]);
    const poItemId = poiIns.rows[0].id;

    // Create GoodsReceipt
    const grnLines = [{ poItemId, itemId: item.id, quantity: q, unitCost: cost }];
    await c.query(`
      INSERT INTO "GoodsReceipt" ("grnNumber","purchaseOrderId","supplierInvoiceNo","invoiceAmount","lines","notes","receivedById","receivedByName","clientKey")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [grnNumber, poId, invoiceNo, totalAmount, JSON.stringify(grnLines), text(b.notes, 500), req.user.id, req.user.name, key ? `grn-${key}` : null]);

    // 5. Update Stock and WAC via moveStock
    const mv = await moveStock(c, req, {
      itemId: item.id,
      type: 'GRN_RECEIPT',
      delta: q,
      unitCost: cost,
      referenceNo: grnNumber,
      reason: `Reorder Stock - Inv #${invoiceNo} (${poNumber})`,
      purchaseOrderId: poId,
      branchId: b.branchId || item.branchId,
      supplierId: resolvedSupplierId,
      idempotencyKey: key
    });

    // 6. Link supplier to item if not previously set
    if (resolvedSupplierId && !item.supplierId) {
      await c.query('UPDATE "InventoryItem" SET "supplierId" = $1 WHERE id = $2', [resolvedSupplierId, item.id]);
    }

    // 7. Audit log
    await audit(c, req, 'STOCK_PURCHASE_RECEIVED', 'InventoryItem', item.id, {
      sku: item.sku,
      quantityReceived: q,
      unitPurchaseCost: cost,
      totalAmount,
      grnNumber,
      poNumber,
      supplierInvoiceNo: invoiceNo,
      previousStock: mv.item.previousStock,
      newStock: mv.item.currentStock,
      newWAC: mv.item.unitCost,
      costStatus: mv.item.costStatus
    });

    return {
      item: shapeItem(mv.item, true),
      duplicate: false,
      movement: mv.movement,
      grnNumber,
      poNumber
    };
  });

  res.status(out.duplicate ? 200 : 201).json({
    success: true,
    duplicate: out.duplicate,
    message: out.duplicate ? 'This purchase receipt was already processed.' : `Successfully received ${q} ${out.item?.unit || 'units'} of ${out.item?.sku}. Stock updated to ${out.item?.currentStock} ${out.item?.unit || 'units'}.`,
    data: out
  });
});

exports.getItemPurchases = handle(async (req, res) => {
  deny(req, 'VIEW_COSTS');
  const id = intId(req.params.id, 'material');
  const { rows } = await pool.query(`
    SELECT sm.id, sm."quantity", sm."unitCost", sm."previousStock", sm."newStock",
      sm."referenceNo", sm."reason", sm."createdAt", sm."costStatus",
      COALESCE(sup.name, s.name, '') AS "supplierName",
      COALESCE(gr."supplierInvoiceNo", '') AS "supplierInvoiceNo",
      COALESCE(gr."grnNumber", sm."referenceNo") AS "grnNumber",
      COALESCE(po."poNumber", '') AS "poNumber"
    FROM "StockMovement" sm
    JOIN "InventoryItem" i ON i.id = sm."itemId"
    LEFT JOIN "Supplier" sup ON sup.id = sm."supplierId"
    LEFT JOIN "Supplier" s ON s.id = i."supplierId"
    LEFT JOIN "PurchaseOrder" po ON po.id = sm."purchaseOrderId"
    LEFT JOIN "GoodsReceipt" gr ON gr."purchaseOrderId" = po.id OR gr."grnNumber" = sm."referenceNo"
    WHERE sm."itemId" = $1 AND sm.type IN ('GRN_RECEIPT', 'STOCK_IN', 'PURCHASE')
    ORDER BY sm."createdAt" DESC, sm.id DESC LIMIT 50
  `, [id]);

  res.json({ success: true, data: rows });
});

// =================================================================== OPENING STOCK REGISTRATION
exports.recordOpeningStock = handle(async (req, res) => {
  deny(req, 'STOCK_RECEIVE');
  const b = req.body || {};
  const isExisting = Boolean(b.itemId);
  const q = qty(b.quantity ?? b.openingStock, 'Physical quantity');
  const isCostKnown = b.isCostKnown !== false && b.costStatus !== 'PENDING_VALUATION';
  const costStatus = isCostKnown ? 'KNOWN' : 'PENDING_VALUATION';
  const unitCost = costStatus === 'KNOWN' ? (money(b.unitCost) ?? 0) : 0;
  const storageLocation = text(b.storageLocation, 120);
  const notes = text(b.notes, 500);
  const key = idemKey(b.idempotencyKey);

  const out = await withTx(async (c) => {
    let item;
    if (isExisting) {
      const itemId = intId(b.itemId, 'material');
      const { rows } = await c.query('SELECT * FROM "InventoryItem" WHERE id = $1 FOR UPDATE', [itemId]);
      item = rows[0];
      if (!item) throw new InvError(404, 'Material not found.');

      // Check if opening stock was already recorded for this item
      const existingOpening = await c.query('SELECT id FROM "StockMovement" WHERE "itemId" = $1 AND type = $2', [item.id, 'OPENING']);
      if (existingOpening.rows.length > 0 && !b.forceAdditional) {
        throw new InvError(409, `Opening stock has already been recorded for SKU ${item.sku}. To restock, use "Purchase Existing Product / Restock".`);
      }

      if (key) {
        const dup = await findMovementByKey(c, key);
        if (dup) return { item: shapeItem(item, true), duplicate: true, movement: dup };
      }

      const supplierId = b.supplierId ? intId(b.supplierId, 'supplier') : item.supplierId;
      await c.query(`UPDATE "InventoryItem" SET "storageLocation" = COALESCE($1, "storageLocation"),
        "supplierId" = COALESCE($2, "supplierId"),
        "openingStock" = "openingStock" + $3,
        "costStatus" = $4,
        "unitCost" = CASE WHEN $4 = 'KNOWN' AND "unitCost" <= 0.0001 THEN $5 ELSE "unitCost" END,
        "updatedAt" = NOW() WHERE id = $6`,
        [storageLocation, supplierId, q, costStatus, unitCost, item.id]);

      const mv = await moveStock(c, req, {
        itemId: item.id,
        type: 'OPENING',
        delta: q,
        unitCost: unitCost,
        referenceNo: `OPEN-${item.sku}`,
        reason: notes || 'Verified physical opening count',
        supplierId: supplierId,
        idempotencyKey: key || `opening:${item.id}:${Date.now()}`
      });
      item = mv.item;
    } else {
      const data = readItemBody(b);
      const existingSku = (await c.query('SELECT id FROM "InventoryItem" WHERE UPPER(sku) = UPPER($1)', [data.sku])).rows[0];
      if (existingSku) {
        throw new InvError(409, `SKU ${data.sku} already exists. Select this existing SKU instead to prevent duplicate product records.`);
      }

      const ins = await c.query(
        `INSERT INTO "InventoryItem" ("sku","name","category","description","unit","colour","openingStock","currentStock",
           "minStockLevel","reorderLevel","unitCost","storageLocation","supplierId","branchId","createdById","costStatus")
         VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [data.sku, data.name, data.category, data.description || null, data.unit, data.colour || null, q,
          data.minStockLevel || 0, data.reorderLevel || 0, unitCost, storageLocation || null,
          data.supplierId || null, data.branchId || null, req.user.id, costStatus]
      );
      item = ins.rows[0];

      if (q > 0) {
        const mv = await moveStock(c, req, {
          itemId: item.id,
          type: 'OPENING',
          delta: q,
          unitCost: unitCost,
          referenceNo: `OPEN-${item.sku}`,
          reason: notes || 'Verified opening inventory count',
          supplierId: data.supplierId || null,
          idempotencyKey: key || `opening:${item.id}`
        });
        item = mv.item;
      }
    }

    await audit(c, req, 'OPENING_STOCK_RECORDED', 'InventoryItem', item.id, {
      sku: item.sku,
      quantity: q,
      unitCost: unitCost,
      costStatus,
      isExisting
    });

    return { item: shapeItem(item, true), duplicate: false };
  });

  res.status(out.duplicate ? 200 : 201).json({
    success: true,
    duplicate: out.duplicate,
    message: out.duplicate ? 'Opening stock already recorded.' : `Opening stock of ${q} ${out.item?.unit || 'units'} registered for ${out.item?.sku}.`,
    data: out
  });
});
