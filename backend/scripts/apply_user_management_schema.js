/**
 * JB GROUP — User Management, Employee, Password Reset, and Audit Schema Migration
 * 
 * SAFETY GUARANTEES:
 * - ADDITIVE ONLY: Uses CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS.
 * - NO DATA LOSS: Does not drop, truncate, or rewrite existing tables.
 * - IDEMPOTENT: Safe to run multiple times without duplicate records or errors.
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function applyMigration() {
  console.log('--- Starting User Management Schema Migration ---');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add lastLoginAt to User table
    console.log('1. Ensuring "lastLoginAt" column exists on "User"...');
    await client.query(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
    `);

    // 2. Create Employee table
    console.log('2. Ensuring "Employee" table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Employee" (
        "id" SERIAL PRIMARY KEY,
        "employeeId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT,
        "phone" TEXT,
        "role" TEXT NOT NULL,
        "branchId" INTEGER,
        "userId" INTEGER,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "Employee_employeeId_key" ON "Employee"("employeeId");`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key" ON "Employee"("userId") WHERE "userId" IS NOT NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS "Employee_branchId_idx" ON "Employee"("branchId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "Employee_role_idx" ON "Employee"("role");`);

    // Add foreign keys for Employee if missing
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Employee_branchId_fkey'
        ) THEN
          ALTER TABLE "Employee" 
          ADD CONSTRAINT "Employee_branchId_fkey" 
          FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Employee_userId_fkey'
        ) THEN
          ALTER TABLE "Employee" 
          ADD CONSTRAINT "Employee_userId_fkey" 
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 3. Create PasswordResetToken table
    console.log('3. Ensuring "PasswordResetToken" table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "tokenHash" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "usedAt" TIMESTAMP(3),
        "isUsed" BOOLEAN NOT NULL DEFAULT false,
        "requestedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_userId_fkey'
        ) THEN
          ALTER TABLE "PasswordResetToken" 
          ADD CONSTRAINT "PasswordResetToken_userId_fkey" 
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // 4. Create AuditLog table
    console.log('4. Ensuring "AuditLog" table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
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
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");`);

    // 5. Backfill/Synchronize existing User accounts into Employee records
    console.log('5. Backfilling Employee records for existing Users without employee link...');
    const existingUsers = await client.query(`
      SELECT u.id, u.name, u.email, u.role, u."branchId", u."isActive"
      FROM "User" u
      LEFT JOIN "Employee" e ON e."userId" = u.id
      WHERE e.id IS NULL
      ORDER BY u.id ASC;
    `);

    for (const u of existingUsers.rows) {
      const paddedId = String(u.id).padStart(3, '0');
      const employeeId = `EMP-${paddedId}`;
      const status = u.isActive ? 'ACTIVE' : 'INACTIVE';

      await client.query(`
        INSERT INTO "Employee" ("employeeId", "name", "email", "role", "branchId", "userId", "status", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT ("employeeId") DO UPDATE 
        SET "userId" = EXCLUDED."userId", "name" = EXCLUDED."name", "role" = EXCLUDED."role", "branchId" = EXCLUDED."branchId";
      `, [employeeId, u.name, u.email, u.role, u.branchId, u.id, status]);

      console.log(`   Linked User #${u.id} (${u.name}) -> ${employeeId}`);
    }

    await client.query('COMMIT');
    console.log('✅ User Management Schema Migration Completed Successfully!');

    // Show summary
    const empCount = await client.query('SELECT count(*) FROM "Employee";');
    const userCount = await client.query('SELECT count(*) FROM "User";');
    console.log(`Current Total Users: ${userCount.rows[0].count}`);
    console.log(`Current Total Employees: ${empCount.rows[0].count}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
