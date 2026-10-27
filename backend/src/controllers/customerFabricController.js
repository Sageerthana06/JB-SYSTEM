/**
 * Customer Fabric Management Controller — JB GROUP / Bella Design ERP
 *
 * =========================================================================
 * ARCHITECTURAL DESIGN & BUSINESS PURPOSE:
 * =========================================================================
 * This controller manages customer-owned fabrics and materials brought in
 * for bespoke dressmaking and tailoring orders.
 *
 * KEY RULES:
 * 1. Decoupled from Company Inventory:
 *    Customer-provided fabrics belong to the CLIENT, not the company.
 *    They are NEVER mixed with company stock and NEVER affect the
 *    company's inventory balance sheet, valuation, or Weighted Average Cost (WAC).
 *
 * 2. Complete Material Lifecycle:
 *    [ RECEIPT ]             -> Staff logs customer fabric arrival against an Order.
 *         │
 *         ▼
 *    [ ISSUE_TO_TAILOR ]     -> Fabric issued from company store to assigned Tailor.
 *         │
 *         ├──> [ TAILOR_RETURN ]      -> Tailor returns reusable leftover fabric to store.
 *         ├──> [ CONSUMPTION ]        -> Fabric permanently sewn into the garment.
 *         └──> [ WASTE_SCRAP ]        -> Off-cut scraps, trims, or damaged fabric.
 *         │
 *         ▼
 *    [ RETURN_TO_CUSTOMER ]  -> Unused leftover fabric returned to customer upon delivery.
 *
 * 3. Double-Entry Quantity Safety:
 *    - receivedQty = availableQty + tailorBalanceQty + consumedQty + returnedToCustomerQty + wasteQty
 *    - Concurrency protection via PostgreSQL row locking (SELECT ... FOR UPDATE).
 * =========================================================================
 */
const { pool } = require('../prisma');

/**
 * Floating-Point Epsilon Tolerance:
 * In JavaScript, binary floating-point arithmetic can produce tiny precision artifacts
 * (e.g. 0.30000000000000004 or 0.00000000001 instead of 0).
 * Any quantity <= EPS is treated as mathematically zero to prevent negative balances.
 */
const EPS = 0.0001;

/**
 * Rounds a quantity to 3 decimal places (millimeter precision for fabric meters).
 * Example: 2.1256 meters -> 2.126 meters.
 *
 * @param {number|string} n - Input number or numeric string
 * @returns {number} Rounded float with up to 3 decimal places
 */
const r3 = (n) => Math.round(Number(n) * 1000) / 1000;
const roundToThreeDecimals = r3; // Beginner-friendly alias

/**
 * Custom Error class with HTTP status code for customer fabric operations.
 */
class FabricError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Express Controller Route Wrapper:
 * Catches errors from async controller functions and translates PostgreSQL error codes
 * into clean, user-friendly JSON error responses:
 * - 23505: Unique constraint violation (duplicate key)
 * - 23514: Check constraint violation (e.g. quantity cannot be negative)
 */
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ success: false, message: e.message });
    }
    if (e.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'A duplicate record or duplicate transaction key was detected.'
      });
    }
    if (e.code === '23514') {
      return res.status(409).json({
        success: false,
        message: 'Quantity validation failed. Fabric balances cannot be negative.'
      });
    }
    console.error('[customerFabric]', e);
    return res.status(500).json({ success: false, message: 'Customer fabric operation failed.' });
  }
};

/**
 * Transaction Helper (`withTx`):
 * Safely executes database queries inside a PostgreSQL transaction.
 *
 * Flow:
 * 1. Checks out a client connection from `pool`.
 * 2. Executes `BEGIN`.
 * 3. Runs your transactional operations.
 * 4. Executes `COMMIT` on success.
 * 5. If any error occurs, automatically executes `ROLLBACK`.
 * 6. Always releases the client connection back to the pool in `finally`.
 *
 * @param {Function} fn - Async callback receiving the active client `c`
 * @returns {Promise<any>}
 */
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

/**
 * Role Check Helper:
 * Verifies if the authenticated user has management authority over customer fabrics.
 * Authorized roles: SUPER_ADMIN (CEO), ADMIN, and MANAGER.
 *
 * @param {Object} user - Decoded JWT user object (`req.user`)
 * @returns {boolean}
 */
const isFabricManager = (user) => {
  if (!user || !user.role) return false;
  const role = String(user.role).trim().toUpperCase();
  return role === 'SUPER_ADMIN' || role === 'CEO' || role === 'ADMIN' || role === 'MANAGER';
};

/**
 * Row-Level Lock Helper (`lockFabric`):
 * Locks a specific `CustomerFabric` row using PostgreSQL `FOR UPDATE`.
 *
 * Why this is essential:
 * If a tailor reports consumption while a manager records a return at the exact same millisecond,
 * row locking forces one transaction to wait for the other, preventing race conditions or
 * double-spend discrepancies.
 *
 * @param {Object} c - PostgreSQL transactional client
 * @param {number} id - CustomerFabric ID
 * @returns {Promise<Object>} The locked CustomerFabric database row
 */
async function lockFabric(c, id) {
  const { rows } = await c.query('SELECT * FROM "CustomerFabric" WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw new FabricError(404, 'Customer fabric record not found.');
  return rows[0];
}

// ===================================================================
// 1. ORDER & CUSTOMER LOOKUP FOR REGISTRATION
// ===================================================================
exports.lookupOrdersForFabric = handle(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const searchPattern = `%${q}%`;

  let queryText = `
    SELECT o.id, o."orderNumber", o.status, o."branchId", o."assignedTailorId",
           c.id AS "customerId", c.name AS "customerName", c."primaryPhone" AS "customerPhone",
           b.name AS "branchName",
           t.id AS "tailorId", t.name AS "tailorName",
           g."dressType", g."fabricType" AS "garmentFabricType", g."fabricColour" AS "garmentFabricColour"
    FROM "Order" o
    JOIN "Customer" c ON c.id = o."customerId"
    LEFT JOIN "Branch" b ON b.id = o."branchId"
    LEFT JOIN "User" t ON t.id = o."assignedTailorId"
    LEFT JOIN "GarmentDetails" g ON g."orderId" = o.id
    WHERE o.status::text NOT IN ('CANCELLED', 'REJECTED')
  `;
  const vals = [];

  if (req.query.customerId) {
    vals.push(parseInt(req.query.customerId, 10));
    queryText += ` AND o."customerId" = $${vals.length}`;
  }

  if (q) {
    vals.push(searchPattern, searchPattern, searchPattern);
    const p1 = vals.length - 2;
    const p2 = vals.length - 1;
    const p3 = vals.length;
    queryText += ` AND (o."orderNumber" ILIKE $${p1} OR c.name ILIKE $${p2} OR c."primaryPhone" ILIKE $${p3})`;
  }

  queryText += ` ORDER BY o."createdAt" DESC LIMIT 30`;

  const { rows } = await pool.query(queryText, vals);
  res.json({ success: true, data: rows });
});

// ===================================================================
// 2. LIST CUSTOMER FABRICS WITH FILTERS & SUMMARY BALANCES
// ===================================================================
exports.listCustomerFabrics = handle(async (req, res) => {
  const q = req.query;
  const isExport = q.all === 'true' || q.export === 'true';
  const page = isExport ? 1 : Math.max(1, parseInt(q.page, 10) || 1);
  const pageSize = isExport ? 10000 : Math.min(100, Math.max(1, parseInt(q.pageSize, 10) || 25));
  const offset = (page - 1) * pageSize;

  const conditions = [];
  const vals = [];
  let pIdx = 1;

  if (q.search) {
    const s = `%${String(q.search).trim()}%`;
    conditions.push(`(
      cf.code ILIKE $${pIdx} OR
      cf."orderNumber" ILIKE $${pIdx} OR
      cf."customerName" ILIKE $${pIdx} OR
      COALESCE(cf."customerPhone", '') ILIKE $${pIdx} OR
      cf."fabricType" ILIKE $${pIdx} OR
      cf."fabricColour" ILIKE $${pIdx}
    )`);
    vals.push(s);
    pIdx++;
  }

  if (q.customerId) {
    conditions.push(`cf."customerId" = $${pIdx}`);
    vals.push(parseInt(q.customerId, 10));
    pIdx++;
  }

  if (q.orderNumber) {
    conditions.push(`cf."orderNumber" ILIKE $${pIdx}`);
    vals.push(`%${String(q.orderNumber).trim()}%`);
    pIdx++;
  }

  if (q.fabricType && q.fabricType !== 'ALL') {
    conditions.push(`cf."fabricType" ILIKE $${pIdx}`);
    vals.push(String(q.fabricType).trim());
    pIdx++;
  }

  if (q.branchId && q.branchId !== 'ALL') {
    conditions.push(`cf."branchId" = $${pIdx}`);
    vals.push(parseInt(q.branchId, 10));
    pIdx++;
  }

  if (q.status && q.status !== 'ALL') {
    if (q.status === 'IN_STORE') {
      conditions.push(`cf."availableQty" > ${EPS}`);
    } else if (q.status === 'WITH_TAILOR') {
      conditions.push(`cf."tailorBalanceQty" > ${EPS}`);
    } else if (q.status === 'CONSUMED') {
      conditions.push(`cf."availableQty" <= ${EPS} AND cf."tailorBalanceQty" <= ${EPS} AND cf."consumedQty" > 0`);
    } else {
      conditions.push(`cf.status = $${pIdx}`);
      vals.push(q.status);
      pIdx++;
    }
  }

  if (q.from) {
    conditions.push(`cf."dateReceived" >= $${pIdx}::timestamp`);
    vals.push(q.from);
    pIdx++;
  }

  if (q.to) {
    conditions.push(`cf."dateReceived" <= $${pIdx}::timestamp + interval '1 day'`);
    vals.push(q.to);
    pIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get Summary Totals across all matching records
  const summaryQuery = `
    SELECT
      COUNT(*)::int AS "totalCount",
      COALESCE(SUM(cf."receivedQty"), 0) AS "totalReceived",
      COALESCE(SUM(cf."availableQty"), 0) AS "totalAvailableInStore",
      COALESCE(SUM(cf."tailorBalanceQty"), 0) AS "totalWithTailors",
      COALESCE(SUM(cf."consumedQty"), 0) AS "totalConsumed",
      COALESCE(SUM(cf."returnedToStoreQty"), 0) AS "totalReturnedToStore",
      COALESCE(SUM(cf."returnedToCustomerQty"), 0) AS "totalReturnedToCustomer",
      COALESCE(SUM(cf."wasteQty"), 0) AS "totalWaste"
    FROM "CustomerFabric" cf
    ${whereClause}
  `;

  // Main data rows with tailor info from Order
  const dataQuery = `
    SELECT
      cf.*,
      b.name AS "branchName",
      o.status::text AS "orderStatus",
      t.id AS "assignedTailorId",
      t.name AS "assignedTailorName"
    FROM "CustomerFabric" cf
    LEFT JOIN "Branch" b ON b.id = cf."branchId"
    LEFT JOIN "Order" o ON o.id = cf."orderId"
    LEFT JOIN "User" t ON t.id = o."assignedTailorId"
    ${whereClause}
    ORDER BY cf."createdAt" DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const [summaryRes, rowsRes] = await Promise.all([
    pool.query(summaryQuery, vals),
    pool.query(dataQuery, vals)
  ]);

  const summary = summaryRes.rows[0] || {};
  const total = summary.totalCount || 0;

  const data = rowsRes.rows.map(r => ({
    ...r,
    receivedQty: r3(r.receivedQty),
    availableQty: r3(r.availableQty),
    issuedQty: r3(r.issuedQty),
    tailorBalanceQty: r3(r.tailorBalanceQty),
    consumedQty: r3(r.consumedQty),
    returnedToStoreQty: r3(r.returnedToStoreQty),
    returnedToCustomerQty: r3(r.returnedToCustomerQty),
    wasteQty: r3(r.wasteQty)
  }));

  res.json({
    success: true,
    data,
    summary: {
      totalCount: Number(summary.totalCount || 0),
      totalReceived: r3(summary.totalReceived),
      totalAvailableInStore: r3(summary.totalAvailableInStore),
      totalWithTailors: r3(summary.totalWithTailors),
      totalConsumed: r3(summary.totalConsumed),
      totalReturnedToStore: r3(summary.totalReturnedToStore),
      totalReturnedToCustomer: r3(summary.totalReturnedToCustomer),
      totalWaste: r3(summary.totalWaste)
    },
    pagination: {
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize) || 1
    }
  });
});

// ===================================================================
// 3. GET SINGLE CUSTOMER FABRIC WITH FULL MOVEMENT HISTORY
// ===================================================================
exports.getCustomerFabricById = handle(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new FabricError(400, 'Invalid customer fabric ID.');
  }

  const { rows } = await pool.query(`
    SELECT
      cf.*,
      b.name AS "branchName",
      o.status::text AS "orderStatus",
      t.id AS "assignedTailorId",
      t.name AS "assignedTailorName"
    FROM "CustomerFabric" cf
    LEFT JOIN "Branch" b ON b.id = cf."branchId"
    LEFT JOIN "Order" o ON o.id = cf."orderId"
    LEFT JOIN "User" t ON t.id = o."assignedTailorId"
    WHERE cf.id = $1
  `, [id]);

  if (!rows[0]) {
    throw new FabricError(404, 'Customer fabric record not found.');
  }

  // Get complete movement history
  const movementsRes = await pool.query(`
    SELECT m.*, u.name AS "performedByName", u.role::text AS "performedByRole"
    FROM "CustomerFabricMovement" m
    LEFT JOIN "User" u ON u.id = m."performedById"
    WHERE m."customerFabricId" = $1
    ORDER BY m."createdAt" ASC
  `, [id]);

  res.json({
    success: true,
    data: {
      ...rows[0],
      movements: movementsRes.rows
    }
  });
});

// ===================================================================
// 4. REGISTER / RECEIVE CUSTOMER FABRIC (Only Super Admin, Admin, Manager)
// ===================================================================
exports.receiveCustomerFabric = handle(async (req, res) => {
  if (!isFabricManager(req.user)) {
    throw new FabricError(403, 'Access denied. Only Super Admin / CEO, Admin, or Manager can register customer fabric.');
  }

  const b = req.body || {};
  const customerId = parseInt(b.customerId, 10);
  const orderId = parseInt(b.orderId, 10);

  // Material details
  const ALLOWED_CATEGORIES = ['Fabric', 'Lining', 'Thread', 'Buttons', 'Zipper', 'Lace', 'Beads', 'Embroidery Materials', 'Other'];
  const materialCategory = ALLOWED_CATEGORIES.includes(b.materialCategory) ? b.materialCategory : (b.materialCategory || 'Fabric');
  const materialName = String(b.materialName || b.fabricType || '').trim();
  const fabricType = materialName || materialCategory; // Synchronize fabricType for existing reports/views
  const fabricColour = String(b.fabricColour || b.colour || '').trim();
  const fabricDescription = b.fabricDescription || b.description ? String(b.fabricDescription || b.description).trim() : null;
  const unit = String(b.unit || 'Meter').trim();
  const receivedQty = r3(b.receivedQty);
  const ALLOWED_CONDITIONS = ['New', 'Good', 'Damaged', 'Other'];
  const conditionOnReceipt = ALLOWED_CONDITIONS.includes(b.conditionOnReceipt) ? b.conditionOnReceipt : 'Good';
  const notes = b.notes ? String(b.notes).trim() : (b.conditionNotes ? String(b.conditionNotes).trim() : null);
  const conditionNotes = notes;
  const dateReceived = b.dateReceived ? new Date(b.dateReceived) : new Date();
  const branchId = b.branchId ? parseInt(b.branchId, 10) : (req.user.branchId || null);
  const photoUrl = b.photoUrl ? String(b.photoUrl).trim() : null;

  if (!customerId || customerId <= 0) throw new FabricError(400, 'Customer is required.');
  if (!orderId || orderId <= 0) throw new FabricError(400, 'Order is required.');
  if (!materialName) throw new FabricError(400, 'Material / Fabric name is required.');
  if (!fabricColour) throw new FabricError(400, 'Colour is required.');
  if (!receivedQty || receivedQty <= 0) throw new FabricError(400, 'Quantity received must be a positive number greater than 0.');
  if (!unit) throw new FabricError(400, 'Unit is required.');

  const result = await withTx(async (c) => {
    // 1. Verify Customer exists
    const custRes = await c.query('SELECT id, name, "primaryPhone" FROM "Customer" WHERE id = $1', [customerId]);
    if (!custRes.rows[0]) throw new FabricError(404, 'Customer record not found.');
    const customer = custRes.rows[0];

    // 2. Verify Order exists and belongs to customer
    const orderRes = await c.query('SELECT id, "orderNumber", "customerId", "branchId", "assignedTailorId", status::text AS status FROM "Order" WHERE id = $1', [orderId]);
    if (!orderRes.rows[0]) throw new FabricError(404, 'Order record not found.');
    const order = orderRes.rows[0];

    if (order.customerId !== customer.id) {
      throw new FabricError(400, 'The selected order does not belong to the selected customer.');
    }

    // 3. Get branch name
    let branchName = null;
    const finalBranchId = branchId || order.branchId;
    if (finalBranchId) {
      const brRes = await c.query('SELECT name FROM "Branch" WHERE id = $1', [finalBranchId]);
      if (brRes.rows[0]) branchName = brRes.rows[0].name;
    }

    // 4. Generate unique fabric tracking code
    // Count existing customer fabrics for this order to allow multiple receipts
    const countRes = await c.query('SELECT COUNT(*)::int AS count FROM "CustomerFabric" WHERE "orderId" = $1', [order.id]);
    const seq = (countRes.rows[0]?.count || 0) + 1;
    const padSeq = String(seq).padStart(2, '0');
    let code = `CF-${order.orderNumber}-${padSeq}`;

    // Ensure uniqueness
    const dupCheck = await c.query('SELECT id FROM "CustomerFabric" WHERE code = $1', [code]);
    if (dupCheck.rows.length > 0) {
      code = `CF-${order.orderNumber}-${padSeq}-${Date.now().toString().slice(-4)}`;
    }

    // 5. Insert CustomerFabric record
    const insertRes = await c.query(`
      INSERT INTO "CustomerFabric" (
        "code", "customerId", "customerName", "customerPhone",
        "orderId", "orderNumber", "fabricType", "fabricColour", "fabricDescription",
        "receivedQty", "availableQty", "issuedQty", "tailorBalanceQty", "consumedQty",
        "returnedToStoreQty", "returnedToCustomerQty", "wasteQty",
        "unit", "dateReceived", "conditionNotes", "branchId", "branchName",
        "receivedById", "receivedByName", "status",
        "photoUrl", "materialCategory", "materialName", "conditionOnReceipt", "notes"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $10, 0, 0, 0, 0, 0, 0,
        $11, $12, $13, $14, $15, $16, $17, 'AVAILABLE',
        $18, $19, $20, $21, $22
      ) RETURNING *
    `, [
      code, customer.id, customer.name, customer.primaryPhone,
      order.id, order.orderNumber, fabricType, fabricColour, fabricDescription,
      receivedQty, unit, dateReceived, conditionNotes, finalBranchId, branchName,
      req.user.id, req.user.name,
      photoUrl, materialCategory, materialName, conditionOnReceipt, notes
    ]);

    const fabric = insertRes.rows[0];

    // 6. Record Initial Receipt Movement
    const idempotencyKey = b.idempotencyKey || `RECEIPT:${fabric.id}:${Date.now()}`;
    const initialMovementNote = notes
      ? `Condition: ${conditionOnReceipt}. ${notes}`
      : `Condition: ${conditionOnReceipt}. Customer material received into store.`;

    await c.query(`
      INSERT INTO "CustomerFabricMovement" (
        "customerFabricId", "movementType", "quantity",
        "previousAvailableQty", "newAvailableQty",
        "previousTailorQty", "newTailorQty",
        "notes", "branchId",
        "performedById", "performedByName", "performedByRole", "idempotencyKey"
      ) VALUES (
        $1, 'RECEIPT', $2, 0, $2, 0, 0, $3, $4, $5, $6, $7, $8
      )
    `, [
      fabric.id, receivedQty,
      initialMovementNote,
      finalBranchId, req.user.id, req.user.name, req.user.role, idempotencyKey
    ]);

    return fabric;
  });

  res.status(201).json({
    success: true,
    message: `Customer fabric registered successfully (${result.code}).`,
    data: result
  });
});

// ===================================================================
// 5. ISSUE FABRIC TO TAILOR
// ===================================================================
exports.issueToTailor = handle(async (req, res) => {
  const id = parseInt(req.params?.id || req.body?.customerFabricId || req.body?.id, 10);
  const b = req.body || {};
  const qtyToIssue = r3(b.quantity);
  const notes = b.notes ? String(b.notes).trim() : 'Issued to tailor for stitching';
  const tailorIdInput = b.tailorId ? parseInt(b.tailorId, 10) : null;
  const idempotencyKey = b.idempotencyKey || `ISSUE:${id}:${Date.now()}`;

  if (!qtyToIssue || qtyToIssue <= 0) {
    throw new FabricError(400, 'Issued quantity must be greater than 0.');
  }

  const result = await withTx(async (c) => {
    // 1. Lock fabric row
    const fabric = await lockFabric(c, id);

    if (qtyToIssue > fabric.availableQty + EPS) {
      throw new FabricError(400, `Cannot issue ${qtyToIssue} ${fabric.unit}. Only ${fabric.availableQty} ${fabric.unit} available in store.`);
    }

    // 2. Resolve Tailor
    let tailorId = tailorIdInput;
    let tailorName = null;

    if (!tailorId) {
      // Lookup assigned tailor from Order
      const ordRes = await c.query('SELECT "assignedTailorId" FROM "Order" WHERE id = $1', [fabric.orderId]);
      tailorId = ordRes.rows[0]?.assignedTailorId || null;
    }

    if (tailorId) {
      const tRes = await c.query('SELECT name FROM "User" WHERE id = $1', [tailorId]);
      if (tRes.rows[0]) tailorName = tRes.rows[0].name;
    }

    // 3. Calculate new balances
    const prevAvailable = fabric.availableQty;
    const newAvailable = r3(Math.max(0, prevAvailable - qtyToIssue));
    const prevTailor = fabric.tailorBalanceQty;
    const newTailor = r3(prevTailor + qtyToIssue);
    const newIssuedTotal = r3(fabric.issuedQty + qtyToIssue);

    const newStatus = newAvailable > EPS ? 'PARTIALLY_ISSUED' : 'ISSUED';

    // 4. Update CustomerFabric
    const updateRes = await c.query(`
      UPDATE "CustomerFabric"
      SET "availableQty" = $1,
          "tailorBalanceQty" = $2,
          "issuedQty" = $3,
          "status" = $4,
          "updatedAt" = NOW()
      WHERE id = $5
      RETURNING *
    `, [newAvailable, newTailor, newIssuedTotal, newStatus, id]);

    // 5. Insert Movement Record
    await c.query(`
      INSERT INTO "CustomerFabricMovement" (
        "customerFabricId", "movementType", "quantity",
        "previousAvailableQty", "newAvailableQty",
        "previousTailorQty", "newTailorQty",
        "tailorId", "tailorName", "notes", "branchId",
        "performedById", "performedByName", "performedByRole", "idempotencyKey"
      ) VALUES (
        $1, 'ISSUE_TO_TAILOR', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
    `, [
      id, qtyToIssue, prevAvailable, newAvailable, prevTailor, newTailor,
      tailorId, tailorName, notes, fabric.branchId,
      req.user.id, req.user.name, req.user.role, idempotencyKey
    ]);

    return updateRes.rows[0];
  });

  res.json({
    success: true,
    message: `Issued ${qtyToIssue} to tailor successfully.`,
    data: result
  });
});

// ===================================================================
// 6. RECORD REUSABLE FABRIC RETURNED BY TAILOR TO STORE
// (Only CEO/Admin/Manager can confirm returns; tailors cannot directly book)
// ===================================================================
exports.recordTailorReturn = handle(async (req, res) => {
  if (!isFabricManager(req.user)) {
    throw new FabricError(403, 'Access denied. Only Super Admin / CEO, Admin, or Manager can confirm fabric returns.');
  }

  const id = parseInt(req.params?.id || req.body?.customerFabricId || req.body?.id, 10);
  const b = req.body || {};
  const qtyToReturn = r3(b.quantity);
  const notes = b.notes ? String(b.notes).trim() : 'Reusable fabric returned by tailor to store';
  const idempotencyKey = b.idempotencyKey || `TAILOR_RETURN:${id}:${Date.now()}`;

  if (!qtyToReturn || qtyToReturn <= 0) {
    throw new FabricError(400, 'Returned quantity must be greater than 0.');
  }

  const result = await withTx(async (c) => {
    const fabric = await lockFabric(c, id);

    if (qtyToReturn > fabric.tailorBalanceQty + EPS) {
      throw new FabricError(400, `Cannot return ${qtyToReturn} ${fabric.unit}. Tailor only holds ${fabric.tailorBalanceQty} ${fabric.unit}.`);
    }

    const prevAvailable = fabric.availableQty;
    const newAvailable = r3(prevAvailable + qtyToReturn);
    const prevTailor = fabric.tailorBalanceQty;
    const newTailor = r3(Math.max(0, prevTailor - qtyToReturn));
    const newReturnedToStore = r3(fabric.returnedToStoreQty + qtyToReturn);

    // Determine status
    let newStatus = fabric.status;
    if (newTailor <= EPS) {
      newStatus = (fabric.consumedQty > 0 || fabric.wasteQty > 0) ? 'PARTIALLY_CONSUMED' : 'AVAILABLE';
    }

    const updateRes = await c.query(`
      UPDATE "CustomerFabric"
      SET "availableQty" = $1,
          "tailorBalanceQty" = $2,
          "returnedToStoreQty" = $3,
          "status" = $4,
          "updatedAt" = NOW()
      WHERE id = $5
      RETURNING *
    `, [newAvailable, newTailor, newReturnedToStore, newStatus, id]);

    await c.query(`
      INSERT INTO "CustomerFabricMovement" (
        "customerFabricId", "movementType", "quantity",
        "previousAvailableQty", "newAvailableQty",
        "previousTailorQty", "newTailorQty",
        "notes", "branchId",
        "performedById", "performedByName", "performedByRole", "idempotencyKey"
      ) VALUES (
        $1, 'TAILOR_RETURN', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
    `, [
      id, qtyToReturn, prevAvailable, newAvailable, prevTailor, newTailor,
      notes, fabric.branchId,
      req.user.id, req.user.name, req.user.role, idempotencyKey
    ]);

    return updateRes.rows[0];
  });

  res.json({
    success: true,
    message: `Recorded ${qtyToReturn} returned to store. Available in store is now ${result.availableQty} ${result.unit}.`,
    data: result
  });
});

// ===================================================================
// 7. RECORD ACTUAL FABRIC CONSUMPTION IN PRODUCTION
// ===================================================================
exports.recordConsumption = handle(async (req, res) => {
  const id = parseInt(req.params?.id || req.body?.customerFabricId || req.body?.id, 10);
  const b = req.body || {};
  const qtyConsumed = r3(b.quantity);
  const notes = b.notes ? String(b.notes).trim() : 'Actual fabric consumed in stitching/garment assembly';
  const idempotencyKey = b.idempotencyKey || `CONSUMPTION:${id}:${Date.now()}`;

  if (!qtyConsumed || qtyConsumed <= 0) {
    throw new FabricError(400, 'Consumed quantity must be greater than 0.');
  }

  const result = await withTx(async (c) => {
    const fabric = await lockFabric(c, id);

    if (qtyConsumed > fabric.tailorBalanceQty + EPS) {
      throw new FabricError(400, `Cannot record consumption of ${qtyConsumed} ${fabric.unit}. Tailor only holds ${fabric.tailorBalanceQty} ${fabric.unit}.`);
    }

    const prevTailor = fabric.tailorBalanceQty;
    const newTailor = r3(Math.max(0, prevTailor - qtyConsumed));
    const newConsumed = r3(fabric.consumedQty + qtyConsumed);

    // If no fabric left anywhere (store = 0, tailor = 0), mark as CONSUMED
    let newStatus = fabric.status;
    if (fabric.availableQty <= EPS && newTailor <= EPS) {
      newStatus = 'CONSUMED';
    } else if (newTailor <= EPS && fabric.availableQty > EPS) {
      newStatus = 'AVAILABLE';
    }

    const updateRes = await c.query(`
      UPDATE "CustomerFabric"
      SET "tailorBalanceQty" = $1,
          "consumedQty" = $2,
          "status" = $3,
          "updatedAt" = NOW()
      WHERE id = $4
      RETURNING *
    `, [newTailor, newConsumed, newStatus, id]);

    await c.query(`
      INSERT INTO "CustomerFabricMovement" (
        "customerFabricId", "movementType", "quantity",
        "previousAvailableQty", "newAvailableQty",
        "previousTailorQty", "newTailorQty",
        "notes", "branchId",
        "performedById", "performedByName", "performedByRole", "idempotencyKey"
      ) VALUES (
        $1, 'CONSUMPTION', $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
    `, [
      id, qtyConsumed, fabric.availableQty, prevTailor, newTailor,
      notes, fabric.branchId,
      req.user.id, req.user.name, req.user.role, idempotencyKey
    ]);

    return updateRes.rows[0];
  });

  res.json({
    success: true,
    message: `Recorded ${qtyConsumed} fabric consumed in production.`,
    data: result
  });
});

// ===================================================================
// 8. RECORD CUTTING SCRAP / WASTAGE / DAMAGED FABRIC
// (Only CEO/Admin/Manager)
// ===================================================================
exports.recordWaste = handle(async (req, res) => {
  if (!isFabricManager(req.user)) {
    throw new FabricError(403, 'Access denied. Only Super Admin / CEO, Admin, or Manager can record damaged or waste customer fabric.');
  }

  const id = parseInt(req.params?.id || req.body?.customerFabricId || req.body?.id, 10);
  const b = req.body || {};
  const qtyWaste = r3(b.quantity);
  const notes = b.notes ? String(b.notes).trim() : 'Cutting wastage / damaged off-cut';
  const idempotencyKey = b.idempotencyKey || `WASTE:${id}:${Date.now()}`;

  if (!qtyWaste || qtyWaste <= 0) {
    throw new FabricError(400, 'Waste quantity must be greater than 0.');
  }

  const result = await withTx(async (c) => {
    const fabric = await lockFabric(c, id);

    if (qtyWaste > fabric.tailorBalanceQty + EPS) {
      throw new FabricError(400, `Cannot record waste of ${qtyWaste} ${fabric.unit}. Tailor only holds ${fabric.tailorBalanceQty} ${fabric.unit}.`);
    }

    const prevTailor = fabric.tailorBalanceQty;
    const newTailor = r3(Math.max(0, prevTailor - qtyWaste));
    const newWaste = r3(fabric.wasteQty + qtyWaste);

    let newStatus = fabric.status;
    if (fabric.availableQty <= EPS && newTailor <= EPS) {
      newStatus = 'CLOSED';
    }

    const updateRes = await c.query(`
      UPDATE "CustomerFabric"
      SET "tailorBalanceQty" = $1,
          "wasteQty" = $2,
          "status" = $3,
          "updatedAt" = NOW()
      WHERE id = $4
      RETURNING *
    `, [newTailor, newWaste, newStatus, id]);

    await c.query(`
      INSERT INTO "CustomerFabricMovement" (
        "customerFabricId", "movementType", "quantity",
        "previousAvailableQty", "newAvailableQty",
        "previousTailorQty", "newTailorQty",
        "notes", "branchId",
        "performedById", "performedByName", "performedByRole", "idempotencyKey"
      ) VALUES (
        $1, 'WASTE_SCRAP', $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
    `, [
      id, qtyWaste, fabric.availableQty, prevTailor, newTailor,
      notes, fabric.branchId,
      req.user.id, req.user.name, req.user.role, idempotencyKey
    ]);

    return updateRes.rows[0];
  });

  res.json({
    success: true,
    message: `Recorded ${qtyWaste} cutting scrap/wastage.`,
    data: result
  });
});

// ===================================================================
// 9. RETURN FABRIC BACK TO CUSTOMER
// (Only CEO/Admin/Manager can confirm returns to customer)
// ===================================================================
exports.returnToCustomer = handle(async (req, res) => {
  if (!isFabricManager(req.user)) {
    throw new FabricError(403, 'Access denied. Only Super Admin / CEO, Admin, or Manager can register returns to customer.');
  }

  const id = parseInt(req.params?.id || req.body?.customerFabricId || req.body?.id, 10);
  const b = req.body || {};
  const qtyToReturn = r3(b.quantity);
  const notes = b.notes ? String(b.notes).trim() : 'Unused/leftover fabric returned to customer upon delivery';
  const idempotencyKey = b.idempotencyKey || `RETURN_TO_CUSTOMER:${id}:${Date.now()}`;

  if (!qtyToReturn || qtyToReturn <= 0) {
    throw new FabricError(400, 'Returned quantity must be greater than 0.');
  }

  const result = await withTx(async (c) => {
    const fabric = await lockFabric(c, id);

    if (qtyToReturn > fabric.availableQty + EPS) {
      throw new FabricError(400, `Cannot return ${qtyToReturn} ${fabric.unit} to customer. Only ${fabric.availableQty} ${fabric.unit} available in store.`);
    }

    const prevAvailable = fabric.availableQty;
    const newAvailable = r3(Math.max(0, prevAvailable - qtyToReturn));
    const newReturnedToCust = r3(fabric.returnedToCustomerQty + qtyToReturn);

    let newStatus = fabric.status;
    if (newAvailable <= EPS && fabric.tailorBalanceQty <= EPS) {
      newStatus = 'RETURNED_TO_CUSTOMER';
    }

    const updateRes = await c.query(`
      UPDATE "CustomerFabric"
      SET "availableQty" = $1,
          "returnedToCustomerQty" = $2,
          "status" = $3,
          "updatedAt" = NOW()
      WHERE id = $4
      RETURNING *
    `, [newAvailable, newReturnedToCust, newStatus, id]);

    await c.query(`
      INSERT INTO "CustomerFabricMovement" (
        "customerFabricId", "movementType", "quantity",
        "previousAvailableQty", "newAvailableQty",
        "previousTailorQty", "newTailorQty",
        "notes", "branchId",
        "performedById", "performedByName", "performedByRole", "idempotencyKey"
      ) VALUES (
        $1, 'RETURN_TO_CUSTOMER', $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11
      )
    `, [
      id, qtyToReturn, prevAvailable, newAvailable, fabric.tailorBalanceQty,
      notes, fabric.branchId,
      req.user.id, req.user.name, req.user.role, idempotencyKey
    ]);

    return updateRes.rows[0];
  });

  res.json({
    success: true,
    message: `Successfully returned ${qtyToReturn} ${result.unit} to customer.`,
    data: result
  });
});
