require('dotenv').config();
const { prisma } = require('../src/prisma');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const AUTHORIZED_ACCOUNTS = [
  {
    name: 'Jeyatheepan Joseph (CEO)',
    email: 'ceo@jbgroup.com',
    password: '@Bella202CEO6',
    role: 'SUPER_ADMIN',
    branchId: 1
  },
  {
    name: 'Manager',
    email: 'manager@jbgroup.com',
    password: 'Manager@Bella2026',
    role: 'MANAGER',
    branchId: 1
  },
  {
    name: 'Pushpamalar',
    email: 'pushpamalar@jbgroup.com',
    password: 'Pushpa@Tailor2026',
    role: 'TAILOR',
    branchId: 1
  },
  {
    name: 'Uruththiradevi',
    email: 'uruththiradevi@jbgroup.com',
    password: 'Uruthi@Tailor2026',
    role: 'TAILOR',
    branchId: 1
  },
  {
    name: 'Susitha',
    email: 'susitha@jbgroup.com',
    password: 'Susitha@Tailor2026',
    role: 'TAILOR',
    branchId: 1
  }
];

async function setup() {
  console.log('=== SETTING UP AUTHORIZED ERP LOGINS ===\n');

  // 1. Update/Set the 5 requested accounts
  for (const acc of AUTHORIZED_ACCOUNTS) {
    const hashedPassword = await bcrypt.hash(acc.password, SALT_ROUNDS);
    const updated = await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        name: acc.name,
        password: hashedPassword,
        role: acc.role,
        isActive: true,
        branchId: acc.branchId
      },
      create: {
        name: acc.name,
        email: acc.email,
        password: hashedPassword,
        role: acc.role,
        isActive: true,
        branchId: acc.branchId
      }
    });
    console.log(`✓ Active Account Ready: [${acc.role}] ${acc.name} (${acc.email})`);
  }

  // 2. Deactivate any other tailor accounts so ONLY Pushpamalar, Uruththiradevi, and Susitha appear as tailors
  const deactivated = await prisma.user.updateMany({
    where: {
      role: 'TAILOR',
      email: {
        notIn: ['pushpamalar@jbgroup.com', 'uruththiradevi@jbgroup.com', 'susitha@jbgroup.com']
      }
    },
    data: {
      isActive: false
    }
  });
  console.log(`\n✓ Other tailors deactivated: ${deactivated.count} account(s)`);

  // 3. Verify active tailors in database
  const activeTailors = await prisma.user.findMany({
    where: { role: 'TAILOR', isActive: true },
    select: { id: true, name: true, email: true, role: true, isActive: true }
  });
  console.log('\n=== CURRENT ACTIVE TAILORS IN SYSTEM ===');
  console.table(activeTailors);

  // 4. Test API login for all 5 accounts
  console.log('\n=== TESTING LIVE API LOGIN FOR ALL 5 ACCOUNTS ===');
  for (const acc of AUTHORIZED_ACCOUNTS) {
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, password: acc.password })
      });
      const data = await res.json();
      if (data.success && data.data?.token) {
        console.log(`✅ [${acc.role.padEnd(11)}] ${acc.email.padEnd(28)} -> LOGIN OK (Token generated)`);
      } else {
        console.error(`❌ [${acc.role.padEnd(11)}] ${acc.email.padEnd(28)} -> FAILED: ${data.message}`);
      }
    } catch (err) {
      console.error(`❌ [${acc.role.padEnd(11)}] ${acc.email.padEnd(28)} -> Network Error: ${err.message}`);
    }
  }

  process.exit(0);
}

setup().catch(e => {
  console.error(e);
  process.exit(1);
});
