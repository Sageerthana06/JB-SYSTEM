require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedSalesData() {
  console.log('--- Seeding Real 7-Day Sales & Order Data ---');

  // 1. Ensure branch exists
  const branchRes = await pool.query('SELECT id FROM "Branch" LIMIT 1;');
  let branchId = branchRes.rows.length > 0 ? branchRes.rows[0].id : null;
  if (!branchId) {
    const newBranch = await pool.query(`
      INSERT INTO "Branch" (name, address, phone, status, "createdAt", "updatedAt")
      VALUES ('Bella Design Main Branch', 'Colombo, Sri Lanka', '0112345678', 'ACTIVE', NOW(), NOW())
      RETURNING id;
    `);
    branchId = newBranch.rows[0].id;
  }

  // 2. Ensure Tailor User exists
  const tailorRes = await pool.query('SELECT id FROM "User" WHERE role = \'TAILOR\' LIMIT 1;');
  const tailorId = tailorRes.rows.length > 0 ? tailorRes.rows[0].id : null;

  // 3. Customers to ensure
  const sampleCustomers = [
    { name: 'Kavitha Senthil', phone: '0771234561', email: 'kavitha.s@gmail.com', address: 'Wellawatte, Colombo 06' },
    { name: 'Ananya Sharma', phone: '0772345672', email: 'ananya.sharma@yahoo.com', address: 'Bambalapitiya, Colombo 04' },
    { name: 'Priyanka Senanayake', phone: '0773456783', email: 'priyanka.s@gmail.com', address: 'Kollupitiya, Colombo 03' },
    { name: 'Nirosha Fernando', phone: '0774567894', email: 'nirosha.f@gmail.com', address: 'Mount Lavinia, Colombo' },
    { name: 'Roshini Jayawardena', phone: '0775678905', email: 'roshini.j@gmail.com', address: 'Dehiwala, Colombo' },
    { name: 'Fathima Rizwana', phone: '0776789016', email: 'rizwana.f@gmail.com', address: 'Maradana, Colombo 10' },
    { name: 'Thulasi Ramanathan', phone: '0777890127', email: 'thulasi.r@gmail.com', address: 'Jaffna Town / Colombo' },
    { name: 'Sanduni Wickramasinghe', phone: '0778901238', email: 'sanduni.w@gmail.com', address: 'Nugegoda, Colombo' }
  ];

  const customerMap = {};
  for (const c of sampleCustomers) {
    let res = await pool.query('SELECT id FROM "Customer" WHERE "primaryPhone" = $1;', [c.phone]);
    if (res.rows.length === 0) {
      res = await pool.query(`
        INSERT INTO "Customer" (name, "primaryPhone", email, address, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id;
      `, [c.name, c.phone, c.email, c.address]);
    }
    customerMap[c.phone] = res.rows[0].id;
  }

  // 4. Create orders across last 7 days:
  // Today = 2026-10-06
  // Day 0: 2026-09-30 (Wed)
  // Day 1: 2026-10-01 (Thu)
  // Day 2: 2026-10-02 (Fri)
  // Day 3: 2026-10-03 (Sat)
  // Day 4: 2026-10-04 (Sun)
  // Day 5: 2026-10-05 (Mon)
  // Day 6: 2026-10-06 (Tue - Today)

  const ordersData = [
    // Wed (2026-09-30)
    {
      date: new Date('2026-09-30T10:30:00Z'),
      customerPhone: '0771234561',
      dressType: 'Bridal Lehenga',
      quantity: 1,
      totalAmount: 65000,
      advancePayment: 35000,
      balanceAmount: 30000,
      status: 'AARI_EMBROIDERY',
      paymentStatus: 'Partial',
      fabricType: 'Pure Raw Silk with Gold Zari',
      fabricColour: 'Crimson Maroon & Gold',
      occasion: 'Wedding Ceremony',
      notes: 'Heavy handwork with zardosi and aari embroidery.'
    },
    {
      date: new Date('2026-09-30T14:15:00Z'),
      customerPhone: '0772345672',
      dressType: 'Saree Blouse',
      quantity: 2,
      totalAmount: 22000,
      advancePayment: 12000,
      balanceAmount: 10000,
      status: 'STITCHING',
      paymentStatus: 'Partial',
      fabricType: 'Kanchipuram Silk Brocade',
      fabricColour: 'Royal Blue & Magenta',
      occasion: 'Temple Function',
      notes: 'Princess cut, potli buttons at back.'
    },

    // Thu (2026-10-01)
    {
      date: new Date('2026-10-01T11:00:00Z'),
      customerPhone: '0773456783',
      dressType: 'Anarkali Suit',
      quantity: 1,
      totalAmount: 32000,
      advancePayment: 18000,
      balanceAmount: 14000,
      status: 'CUTTING',
      paymentStatus: 'Partial',
      fabricType: 'Georgette with Heavy Threadwork',
      fabricColour: 'Emerald Green',
      occasion: 'Sangeet Night',
      notes: 'Floor length with full flare and churidar.'
    },
    {
      date: new Date('2026-10-01T16:45:00Z'),
      customerPhone: '0774567894',
      dressType: 'Kurti / Tunic',
      quantity: 2,
      totalAmount: 14500,
      advancePayment: 14500,
      balanceAmount: 0,
      status: 'READY',
      paymentStatus: 'Paid',
      fabricType: 'Chanderi Cotton Silk',
      fabricColour: 'Mustard Yellow & Teal',
      occasion: 'Casual Festive',
      notes: 'Straight fit with side slits and wooden buttons.'
    },

    // Fri (2026-10-02)
    {
      date: new Date('2026-10-02T09:45:00Z'),
      customerPhone: '0775678905',
      dressType: 'Western Evening Gown',
      quantity: 1,
      totalAmount: 48000,
      advancePayment: 25000,
      balanceAmount: 23000,
      status: 'STITCHING',
      paymentStatus: 'Partial',
      fabricType: 'Satin Organza with Sequin Sheen',
      fabricColour: 'Champagne Gold',
      occasion: 'Annual Gala Banquet',
      notes: 'Corset structured bodice with draped cowl waistline.'
    },
    {
      date: new Date('2026-10-02T15:20:00Z'),
      customerPhone: '0776789016',
      dressType: 'Saree Blouse',
      quantity: 1,
      totalAmount: 16500,
      advancePayment: 10000,
      balanceAmount: 6500,
      status: 'AARI_EMBROIDERY',
      paymentStatus: 'Partial',
      fabricType: 'Velvet Silk',
      fabricColour: 'Deep Plum Wine',
      occasion: 'Reception Party',
      notes: 'Elbow sleeves with intricate peacock feather motif.'
    },

    // Sat (2026-10-03)
    {
      date: new Date('2026-10-03T10:15:00Z'),
      customerPhone: '0777890127',
      dressType: 'Bridal Lehenga',
      quantity: 1,
      totalAmount: 78000,
      advancePayment: 40000,
      balanceAmount: 38000,
      status: 'CUTTING',
      paymentStatus: 'Partial',
      fabricType: 'Banarasi Brocade & Velvet Dupatta',
      fabricColour: 'Scarlet Red & Antique Gold',
      occasion: 'Grand Wedding Muhurtham',
      notes: 'Double dupatta setting with latkan tassels.'
    },
    {
      date: new Date('2026-10-03T14:30:00Z'),
      customerPhone: '0778901238',
      dressType: 'Custom Designer Wear',
      quantity: 1,
      totalAmount: 38000,
      advancePayment: 20000,
      balanceAmount: 18000,
      status: 'PENDING_PRODUCTION',
      paymentStatus: 'Partial',
      fabricType: 'French Lace & Silk Crepe',
      fabricColour: 'Pastel Lilac Lavender',
      occasion: 'Engagement Ceremony',
      notes: 'Fusion Indo-Western draped silhouette.'
    },

    // Sun (2026-10-04)
    {
      date: new Date('2026-10-04T11:45:00Z'),
      customerPhone: '0771234561',
      dressType: 'Anarkali Suit',
      quantity: 1,
      totalAmount: 26000,
      advancePayment: 15000,
      balanceAmount: 11000,
      status: 'ORDER_CONFIRMED',
      paymentStatus: 'Partial',
      fabricType: 'Tussar Silk with Resham Work',
      fabricColour: 'Coral Peach',
      occasion: 'Family Gathering',
      notes: 'Angrakha style overlap neckline.'
    },
    {
      date: new Date('2026-10-04T16:00:00Z'),
      customerPhone: '0772345672',
      dressType: 'Skirt',
      quantity: 1,
      totalAmount: 18000,
      advancePayment: 10000,
      balanceAmount: 8000,
      status: 'CUTTING',
      paymentStatus: 'Partial',
      fabricType: 'Pleated Chiffon Silk',
      fabricColour: 'Midnight Navy Blue',
      occasion: 'Cocktail Evening',
      notes: 'High waisted pleated flare with pockets.'
    },

    // Mon (2026-10-05 - Yesterday)
    {
      date: new Date('2026-10-05T10:00:00Z'),
      customerPhone: '0773456783',
      dressType: 'Bridal Lehenga',
      quantity: 1,
      totalAmount: 85000,
      advancePayment: 50000,
      balanceAmount: 35000,
      status: 'STITCHING',
      paymentStatus: 'Partial',
      fabricType: 'Heritage Zardozi Silk',
      fabricColour: 'Royal Ruby & Rose Gold',
      occasion: 'Destination Wedding',
      notes: 'Custom bride and groom initials embroidered in hem.'
    },
    {
      date: new Date('2026-10-05T13:30:00Z'),
      customerPhone: '0774567894',
      dressType: 'Saree Blouse',
      quantity: 2,
      totalAmount: 24000,
      advancePayment: 15000,
      balanceAmount: 9000,
      status: 'CUTTING',
      paymentStatus: 'Partial',
      fabricType: 'Silk Cotton with Mirror Work',
      fabricColour: 'Bottle Green & Burnt Orange',
      occasion: 'Navaratri Celebrations',
      notes: 'Deep sweetheart neck with dori.'
    },

    // Tue (2026-10-06 - Today)
    {
      date: new Date('2026-10-06T08:15:00Z'),
      customerPhone: '0775678905',
      dressType: 'Evening Gown',
      quantity: 1,
      totalAmount: 52000,
      advancePayment: 30000,
      balanceAmount: 22000,
      status: 'ORDER_CONFIRMED',
      paymentStatus: 'Partial',
      fabricType: 'Metallic Jacquard Silk',
      fabricColour: 'Silver Onyx & Sapphire',
      occasion: 'Awards Ceremony',
      notes: 'Cape sleeves with hand-embellished collar.'
    },
    {
      date: new Date('2026-10-06T09:40:00Z'),
      customerPhone: '0776789016',
      dressType: 'Traditional Kurti',
      quantity: 2,
      totalAmount: 19500,
      advancePayment: 12000,
      balanceAmount: 7500,
      status: 'ORDER_CONFIRMED',
      paymentStatus: 'Partial',
      fabricType: 'Linen Silk Handloom',
      fabricColour: 'Ivory Cream & Rust Red',
      occasion: 'Office Formal Wear',
      notes: 'Collar neck with wooden loop buttons.'
    },
    {
      date: new Date('2026-10-06T10:15:00Z'),
      customerPhone: '0777890127',
      dressType: 'Saree Blouse',
      quantity: 1,
      totalAmount: 15000,
      advancePayment: 15000,
      balanceAmount: 0,
      status: 'ORDER_CONFIRMED',
      paymentStatus: 'Paid',
      fabricType: 'Raw Silk',
      fabricColour: 'Golden Yellow',
      occasion: 'Festival Puja',
      notes: 'Classic U back with handmade latkans.'
    }
  ];

  let orderCount = 0;
  for (const ord of ordersData) {
    const custId = customerMap[ord.customerPhone];
    const orderNum = `ORD-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;

    const orderRes = await pool.query(`
      INSERT INTO "Order" (
        "orderNumber", "orderDate", "customerId", "branchId",
        status, "totalAmount", "advancePayment", "balanceAmount",
        "serviceCharge", "additionalWorkCharge", "materialCharge", "discountAmount",
        "priceStatus", "priceAcceptedByCustomer", "paymentStatus",
        "assignedTailorId", "assignedBy", "assignedAt", "tailorAccepted",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        'ACCEPTED', true, $13,
        $14, 'System Sales Manager', $2, true,
        $2, $2
      ) RETURNING id;
    `, [
      orderNum, ord.date, custId, branchId,
      ord.status, ord.totalAmount, ord.advancePayment, ord.balanceAmount,
      ord.totalAmount * 0.6, ord.totalAmount * 0.2, ord.totalAmount * 0.2, 0,
      ord.paymentStatus,
      tailorId,
    ]);

    const newOrderId = orderRes.rows[0].id;

    // Insert GarmentDetails
    await pool.query(`
      INSERT INTO "GarmentDetails" (
        "orderId", "dressType", quantity, occasion, "fabricType", "fabricColour",
        "liningRequired", "paddingCupRequired", "workRequired", "workDetails",
        "specialDesignInstructions", "measurementUnit", "fitPreference",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        true, true, true, $7,
        $7, 'Inches', 'Regular',
        $8, $8
      );
    `, [
      newOrderId, ord.dressType, ord.quantity, ord.occasion, ord.fabricType, ord.fabricColour,
      ord.notes, ord.date
    ]);

    // Insert Payment Record
    if (ord.advancePayment > 0) {
      await pool.query(`
        INSERT INTO "Payment" (
          "orderId", amount, "paymentMethod", notes, "recordedBy", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'Cash / Card', 'Initial advance payment on booking', 'Cashier Divya', $3, $3
        );
      `, [newOrderId, ord.advancePayment, ord.date]);
    }

    // Insert Production History
    await pool.query(`
      INSERT INTO "ProductionHistory" (
        "orderId", stage, "previousStage", notes, "createdAt"
      ) VALUES (
        $1, $2, 'ORDER_CONFIRMED', 'Order registered in system and assigned to Master Tailor.', $3
      );
    `, [newOrderId, ord.status, ord.date]);

    orderCount++;
  }

  console.log(`✅ Successfully seeded ${orderCount} realistic active orders and payments across the last 7 days!`);
  await pool.end();
}

seedSalesData().catch(console.error);
