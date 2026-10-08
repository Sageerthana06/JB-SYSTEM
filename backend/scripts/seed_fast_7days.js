require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  console.log('--- Starting Seed ---');

  const branchRes = await pool.query('SELECT id FROM "Branch" LIMIT 1;');
  const branchId = branchRes.rows.length > 0 ? branchRes.rows[0].id : null;
  console.log('Branch ID:', branchId);

  const tailorRes = await pool.query('SELECT id FROM "User" WHERE role = \'TAILOR\' LIMIT 1;');
  const tailorId = tailorRes.rows.length > 0 ? tailorRes.rows[0].id : null;
  console.log('Tailor ID:', tailorId);

  // Fetch or create customer
  const custRes = await pool.query('SELECT id, name FROM "Customer" LIMIT 5;');
  let custIds = custRes.rows.map(r => r.id);
  console.log('Existing Customer IDs:', custIds);

  if (custIds.length === 0) {
    const newCust = await pool.query(`
      INSERT INTO "Customer" (name, "primaryPhone", email, address, "createdAt", "updatedAt")
      VALUES ('Kavitha Senthil', '0771234567', 'kavitha@gmail.com', 'Wellawatte, Colombo', NOW(), NOW())
      RETURNING id;
    `);
    custIds = [newCust.rows[0].id];
  }

  const items = [
    // Wed 2026-09-30
    { dayOffset: 6, date: '2026-09-30T10:30:00Z', dress: 'Bridal Lehenga', total: 65000, advance: 35000, status: 'AARI_EMBROIDERY', fabric: 'Raw Silk & Zari', color: 'Crimson Maroon' },
    { dayOffset: 6, date: '2026-09-30T15:00:00Z', dress: 'Saree Blouse', total: 18000, advance: 10000, status: 'STITCHING', fabric: 'Silk Brocade', color: 'Royal Blue' },
    // Thu 2026-10-01
    { dayOffset: 5, date: '2026-10-01T11:00:00Z', dress: 'Anarkali Suit', total: 32000, advance: 18000, status: 'CUTTING', fabric: 'Georgette', color: 'Emerald Green' },
    { dayOffset: 5, date: '2026-10-01T16:30:00Z', dress: 'Kurti / Tunic', total: 14000, advance: 14000, status: 'READY', fabric: 'Cotton Silk', color: 'Mustard Yellow' },
    // Fri 2026-10-02
    { dayOffset: 4, date: '2026-10-02T09:30:00Z', dress: 'Western Evening Gown', total: 48000, advance: 25000, status: 'STITCHING', fabric: 'Satin Organza', color: 'Champagne Gold' },
    { dayOffset: 4, date: '2026-10-02T14:15:00Z', dress: 'Saree Blouse', total: 16500, advance: 10000, status: 'AARI_EMBROIDERY', fabric: 'Velvet Silk', color: 'Plum Wine' },
    // Sat 2026-10-03
    { dayOffset: 3, date: '2026-10-03T10:00:00Z', dress: 'Bridal Lehenga', total: 78000, advance: 40000, status: 'CUTTING', fabric: 'Banarasi Brocade', color: 'Scarlet Red' },
    { dayOffset: 3, date: '2026-10-03T15:45:00Z', dress: 'Custom Designer Wear', total: 38000, advance: 20000, status: 'PENDING_PRODUCTION', fabric: 'French Lace', color: 'Lavender' },
    // Sun 2026-10-04
    { dayOffset: 2, date: '2026-10-04T11:15:00Z', dress: 'Anarkali Suit', total: 28000, advance: 15000, status: 'ORDER_CONFIRMED', fabric: 'Tussar Silk', color: 'Coral Peach' },
    { dayOffset: 2, date: '2026-10-04T16:00:00Z', dress: 'Skirt', total: 16000, advance: 10000, status: 'CUTTING', fabric: 'Pleated Chiffon', color: 'Midnight Navy' },
    // Mon 2026-10-05 (Yesterday)
    { dayOffset: 1, date: '2026-10-05T10:30:00Z', dress: 'Bridal Lehenga', total: 85000, advance: 50000, status: 'STITCHING', fabric: 'Zardozi Silk', color: 'Ruby Red' },
    { dayOffset: 1, date: '2026-10-05T14:00:00Z', dress: 'Saree Blouse', total: 22000, advance: 15000, status: 'CUTTING', fabric: 'Silk Cotton', color: 'Bottle Green' },
    // Tue 2026-10-06 (Today)
    { dayOffset: 0, date: '2026-10-06T08:30:00Z', dress: 'Evening Gown', total: 52000, advance: 30000, status: 'ORDER_CONFIRMED', fabric: 'Jacquard Silk', color: 'Silver Sapphire' },
    { dayOffset: 0, date: '2026-10-06T09:45:00Z', dress: 'Traditional Kurti', total: 19500, advance: 12000, status: 'ORDER_CONFIRMED', fabric: 'Linen Silk', color: 'Ivory Cream' },
    { dayOffset: 0, date: '2026-10-06T10:30:00Z', dress: 'Saree Blouse', total: 15000, advance: 15000, status: 'ORDER_CONFIRMED', fabric: 'Raw Silk', color: 'Golden Yellow' }
  ];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const custId = custIds[i % custIds.length];
    const orderNum = `ORD-2026-W${1000 + i}`;
    const ordDate = new Date(it.date);
    const balance = it.total - it.advance;
    const payStatus = balance === 0 ? 'Paid' : 'Partial';

    // Insert Order
    const ordRes = await pool.query(`
      INSERT INTO "Order" (
        "orderNumber", "orderDate", "customerId", "branchId",
        status, "totalAmount", "advancePayment", "balanceAmount",
        "serviceCharge", "additionalWorkCharge", "materialCharge", "discountAmount",
        "priceStatus", "priceAcceptedByCustomer", "paymentStatus",
        "assignedTailorId", "assignedBy", "assignedAt", "tailorAccepted",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4,
        $5::"OrderStatus", $6, $7, $8,
        $9, $10, $11, 0,
        'ACCEPTED', true, $12,
        $13, 'Sales Manager', $2, true,
        $2, $2
      ) RETURNING id;
    `, [
      orderNum, ordDate, custId, branchId,
      it.status, it.total, it.advance, balance,
      it.total * 0.6, it.total * 0.2, it.total * 0.2,
      payStatus, tailorId
    ]);

    const ordId = ordRes.rows[0].id;

    // Insert GarmentDetails
    await pool.query(`
      INSERT INTO "GarmentDetails" (
        "orderId", "dressType", quantity, occasion, "fabricType", "fabricColour",
        "liningRequired", "paddingCupRequired", "workRequired", "workDetails",
        "specialDesignInstructions", "measurementUnit", "fitPreference",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, 1, 'Event', $3, $4,
        true, true, true, 'Handcrafted detailing',
        'Tailored to precision fit', 'Inches', 'Regular',
        $5, $5
      );
    `, [ordId, it.dress, it.fabric, it.color, ordDate]);

    // Insert Payment
    if (it.advance > 0) {
      await pool.query(`
        INSERT INTO "Payment" (
          "orderId", amount, "paymentMethod", notes, "recordedBy", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'Cash / Card', 'Advance Payment', 'Cashier', $3, $3
        );
      `, [ordId, it.advance, ordDate]);
    }

    console.log(`Inserted order ${i + 1}/${items.length}: ${orderNum} (${it.dress} - LKR ${it.advance})`);
  }

  console.log('✅ Successfully finished seeding all 7 days of real orders!');
  await pool.end();
}

seed().catch(err => {
  console.error('Seed Error:', err);
  process.exit(1);
});
