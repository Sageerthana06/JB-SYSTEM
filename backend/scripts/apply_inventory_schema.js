/**
 * JB GROUP — Inventory & Material Management schema migration (ADDITIVE ONLY)
 *
 * SAFETY GUARANTEES
 *  - Only CREATE TABLE / CREATE INDEX / ADD CONSTRAINT ... IF NOT EXISTS.
 *  - No DROP, no ALTER of existing columns, no data rewrites on existing tables.
 *  - Runs inside a single transaction: either everything is created or nothing is.
 *  - Idempotent: safe to run multiple times.
 *  - Constraint / index names follow Prisma conventions so `schema.prisma`
 *    matches the database exactly (no drift if Prisma tooling is used later).
 *
 * Usage:
 *   node scripts/apply_inventory_schema.js            -> dry run (prints SQL, changes nothing)
 *   node scripts/apply_inventory_schema.js --apply    -> executes the migration
 */
require('dotenv').config();
const { Pool } = require('pg');

const STATEMENTS = [
  // ---------------------------------------------------------------- Supplier
  `CREATE TABLE IF NOT EXISTS "Supplier" (
    "id" SERIAL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "category" TEXT,
    "paymentTerms" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_code_key" ON "Supplier"("code")`,

  // ----------------------------------------------------------- InventoryItem
  `CREATE TABLE IF NOT EXISTS "InventoryItem" (
    "id" SERIAL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "colour" TEXT,
    "openingStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStockLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storageLocation" TEXT,
    "supplierId" INTEGER,
    "branchId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryItem_currentStock_nonneg" CHECK ("currentStock" >= 0)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_sku_key" ON "InventoryItem"("sku")`,
  `CREATE INDEX IF NOT EXISTS "InventoryItem_category_idx" ON "InventoryItem"("category")`,
  `CREATE INDEX IF NOT EXISTS "InventoryItem_branchId_idx" ON "InventoryItem"("branchId")`,
  `CREATE INDEX IF NOT EXISTS "InventoryItem_supplierId_idx" ON "InventoryItem"("supplierId")`,

  // ------------------------------------------------- OrderMaterialRequest
  `CREATE TABLE IF NOT EXISTS "OrderMaterialRequest" (
    "id" SERIAL PRIMARY KEY,
    "requestNo" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "requestedQty" DOUBLE PRECISION NOT NULL,
    "issuedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wastageQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consumedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedById" INTEGER,
    "requestedByName" TEXT,
    "issuedById" INTEGER,
    "issuedByName" TEXT,
    "issuedAt" TIMESTAMP(3),
    "branchId" INTEGER,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "clientKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderMaterialRequest_qty_valid" CHECK (
      "requestedQty" > 0 AND "issuedQty" >= 0 AND "returnedQty" >= 0 AND "wastageQty" >= 0
      AND "returnedQty" + "wastageQty" <= "issuedQty" + 0.0001
    )
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "OrderMaterialRequest_requestNo_key" ON "OrderMaterialRequest"("requestNo")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "OrderMaterialRequest_clientKey_key" ON "OrderMaterialRequest"("clientKey")`,
  `CREATE INDEX IF NOT EXISTS "OrderMaterialRequest_orderId_idx" ON "OrderMaterialRequest"("orderId")`,
  `CREATE INDEX IF NOT EXISTS "OrderMaterialRequest_itemId_idx" ON "OrderMaterialRequest"("itemId")`,
  `CREATE INDEX IF NOT EXISTS "OrderMaterialRequest_status_idx" ON "OrderMaterialRequest"("status")`,

  // ------------------------------------------------------- PurchaseOrder
  `CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
    "id" SERIAL PRIMARY KEY,
    "poNumber" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "branchId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedDate" TIMESTAMP(3),
    "notes" TEXT,
    "requestedById" INTEGER,
    "requestedByName" TEXT,
    "approvedById" INTEGER,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByName" TEXT,
    "rejectionReason" TEXT,
    "clientKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_clientKey_key" ON "PurchaseOrder"("clientKey")`,
  `CREATE INDEX IF NOT EXISTS "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId")`,
  `CREATE INDEX IF NOT EXISTS "PurchaseOrder_status_idx" ON "PurchaseOrder"("status")`,

  `CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
    "id" SERIAL PRIMARY KEY,
    "purchaseOrderId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantityOrdered" DOUBLE PRECISION NOT NULL,
    "quantityReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "PurchaseOrderItem_qty_valid" CHECK (
      "quantityOrdered" > 0 AND "quantityReceived" >= 0 AND "quantityReceived" <= "quantityOrdered" + 0.0001
    )
  )`,
  `CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId")`,
  `CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_itemId_idx" ON "PurchaseOrderItem"("itemId")`,

  // ------------------------------------------------- GoodsReceipt (GRN)
  `CREATE TABLE IF NOT EXISTS "GoodsReceipt" (
    "id" SERIAL PRIMARY KEY,
    "grnNumber" TEXT NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "supplierInvoiceNo" TEXT,
    "invoiceAmount" DOUBLE PRECISION,
    "lines" JSONB NOT NULL,
    "notes" TEXT,
    "receivedById" INTEGER,
    "receivedByName" TEXT,
    "clientKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GoodsReceipt_grnNumber_key" ON "GoodsReceipt"("grnNumber")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GoodsReceipt_clientKey_key" ON "GoodsReceipt"("clientKey")`,
  `CREATE INDEX IF NOT EXISTS "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId")`,

  // ------------------------------------------------- StockMovement (ledger)
  `CREATE TABLE IF NOT EXISTS "StockMovement" (
    "id" SERIAL PRIMARY KEY,
    "itemId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "previousStock" DOUBLE PRECISION NOT NULL,
    "newStock" DOUBLE PRECISION NOT NULL,
    "referenceNo" TEXT,
    "reason" TEXT,
    "orderId" INTEGER,
    "orderNumber" TEXT,
    "materialRequestId" INTEGER,
    "purchaseOrderId" INTEGER,
    "branchId" INTEGER,
    "performedById" INTEGER,
    "performedByName" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_newStock_nonneg" CHECK ("newStock" >= 0)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StockMovement_idempotencyKey_key" ON "StockMovement"("idempotencyKey")`,
  `CREATE INDEX IF NOT EXISTS "StockMovement_itemId_createdAt_idx" ON "StockMovement"("itemId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "StockMovement_type_idx" ON "StockMovement"("type")`,
  `CREATE INDEX IF NOT EXISTS "StockMovement_orderId_idx" ON "StockMovement"("orderId")`,
  `CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_idx" ON "StockMovement"("createdAt")`,

  // --------------------------------------------------- InventoryAuditLog
  `CREATE TABLE IF NOT EXISTS "InventoryAuditLog" (
    "id" SERIAL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "userId" INTEGER,
    "userName" TEXT,
    "userRole" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "InventoryAuditLog_entityType_entityId_idx" ON "InventoryAuditLog"("entityType", "entityId")`,
  `CREATE INDEX IF NOT EXISTS "InventoryAuditLog_createdAt_idx" ON "InventoryAuditLog"("createdAt")`
];

// Foreign keys (added only if missing). ON DELETE rules never cascade into existing data.
const FOREIGN_KEYS = [
  ['InventoryItem', 'InventoryItem_supplierId_fkey', '"supplierId"', '"Supplier"("id")', 'SET NULL'],
  ['InventoryItem', 'InventoryItem_branchId_fkey', '"branchId"', '"Branch"("id")', 'SET NULL'],
  ['OrderMaterialRequest', 'OrderMaterialRequest_orderId_fkey', '"orderId"', '"Order"("id")', 'RESTRICT'],
  ['OrderMaterialRequest', 'OrderMaterialRequest_itemId_fkey', '"itemId"', '"InventoryItem"("id")', 'RESTRICT'],
  ['PurchaseOrder', 'PurchaseOrder_supplierId_fkey', '"supplierId"', '"Supplier"("id")', 'RESTRICT'],
  ['PurchaseOrder', 'PurchaseOrder_branchId_fkey', '"branchId"', '"Branch"("id")', 'SET NULL'],
  ['PurchaseOrderItem', 'PurchaseOrderItem_purchaseOrderId_fkey', '"purchaseOrderId"', '"PurchaseOrder"("id")', 'CASCADE'],
  ['PurchaseOrderItem', 'PurchaseOrderItem_itemId_fkey', '"itemId"', '"InventoryItem"("id")', 'RESTRICT'],
  ['GoodsReceipt', 'GoodsReceipt_purchaseOrderId_fkey', '"purchaseOrderId"', '"PurchaseOrder"("id")', 'RESTRICT'],
  ['StockMovement', 'StockMovement_itemId_fkey', '"itemId"', '"InventoryItem"("id")', 'RESTRICT'],
  ['StockMovement', 'StockMovement_orderId_fkey', '"orderId"', '"Order"("id")', 'SET NULL'],
  ['StockMovement', 'StockMovement_performedById_fkey', '"performedById"', '"User"("id")', 'SET NULL']
];

function fkSql([table, name, col, ref, onDelete]) {
  return `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
      ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY (${col}) REFERENCES ${ref} ON DELETE ${onDelete} ON UPDATE CASCADE;
    END IF;
  END $$;`;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const all = [...STATEMENTS, ...FOREIGN_KEYS.map(fkSql)];

  if (!apply) {
    console.log('-- DRY RUN: no changes made. Re-run with --apply to execute.\n');
    all.forEach(s => console.log(s.trim() + ';\n'));
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const before = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`);
    console.log('Existing tables:', before.rows.map(r => r.tablename).join(', '));

    await client.query('BEGIN');
    for (const sql of all) await client.query(sql);
    await client.query('COMMIT');

    const after = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`);
    const missing = before.rows.map(r => r.tablename).filter(t => !after.rows.some(a => a.tablename === t));
    if (missing.length) throw new Error('SAFETY CHECK FAILED — tables disappeared: ' + missing.join(', '));
    console.log('[OK] Inventory schema applied. Tables now:', after.rows.map(r => r.tablename).join(', '));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[FAILED] Migration rolled back. No changes were made.', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
