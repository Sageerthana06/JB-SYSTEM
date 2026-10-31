const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'jb_secret_key_2026';

async function testAccess() {
  const res = await pool.query('SELECT id, name, email, role, "isActive" FROM "User" ORDER BY role, name');
  console.log('=== USERS IN SYSTEM ===');
  res.rows.forEach(u => {
    console.log(`[${u.role}] ID: ${u.id} | Name: ${u.name} | Email: ${u.email} | Active: ${u.isActive}`);
  });

  const { can, INVENTORY_PERMISSIONS } = require('../src/config/inventoryPermissions');
  
  const rolesToTest = ['SUPER_ADMIN', 'CEO', 'MANAGER', 'Manager', 'ADMIN', 'STAFF', 'TAILOR'];
  console.log('\n=== INVENTORY PERMISSION CAPABILITIES TEST ===');
  for (const r of rolesToTest) {
    const user = { id: 1, role: r, name: 'Test ' + r };
    const perms = Object.keys(INVENTORY_PERMISSIONS);
    const granted = perms.filter(p => can(user, p));
    console.log(`Role [${r}]: granted ${granted.length}/${perms.length} permissions`);
    console.log(`  - VIEW_ITEMS: ${can(user, 'VIEW_ITEMS')}`);
    console.log(`  - MANAGE_ITEMS: ${can(user, 'MANAGE_ITEMS')}`);
    console.log(`  - STOCK_RECEIVE: ${can(user, 'STOCK_RECEIVE')}`);
    console.log(`  - STOCK_ISSUE: ${can(user, 'STOCK_ISSUE')}`);
    console.log(`  - MATERIAL_ISSUE: ${can(user, 'MATERIAL_ISSUE')}`);
    console.log(`  - PO_APPROVE: ${can(user, 'PO_APPROVE')}`);
  }

  await pool.end();
}

testAccess().catch(console.error);
