require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  const client = await pool.connect();
  try {
    const custCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Customer' 
      ORDER BY ordinal_position;
    `);
    console.log('Customer columns:');
    custCols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

    const orderCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Order' 
      ORDER BY ordinal_position;
    `);
    console.log('Order columns:');
    orderCols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

    const garmentCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'GarmentDetails' 
      ORDER BY ordinal_position;
    `);
    console.log('GarmentDetails columns:');
    garmentCols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

    // Check constraints and foreign keys
    const fks = await client.query(`
      SELECT
        tc.table_name, kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('Order', 'GarmentDetails');
    `);
    console.log('Foreign keys:');
    fks.rows.forEach(r => console.log(`  - ${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}`));

    const custCount = await client.query('SELECT count(*) FROM "Customer";');
    const orderCount = await client.query('SELECT count(*) FROM "Order";');
    const userCount = await client.query('SELECT count(*) FROM "User";');
    console.log('\nData row counts:');
    console.log(`  - Users: ${userCount.rows[0].count}`);
    console.log(`  - Customers: ${custCount.rows[0].count}`);
    console.log(`  - Orders: ${orderCount.rows[0].count}`);
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(console.error);
