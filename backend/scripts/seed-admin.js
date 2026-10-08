/**
 * Seed Script — JB GROUP / Bella Design ERP
 * Creates the initial SUPER_ADMIN (CEO) user and sample role users for testing.
 * Run once: node scripts/seed-admin.js
 */
require('dotenv/config');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;

const users = [
  {
    name: 'Jeyatheepan Joseph',
    email: 'ceo@jbgroup.com',
    password: '@Bella202CEO6',

    role: 'SUPER_ADMIN'
  },
  {
    name: 'admin',
    email: 'admin@jbgroup.com',
    password: 'Admin@Bella2026',
    role: 'ADMIN'
  },
  {
    name: 'manager',
    email: 'manager@jbgroup.com',
    password: 'Manager@Bella2026',
    role: 'MANAGER'
  },
  {
    name: 'Staff',
    email: 'staff@jbgroup.com',
    password: 'Staff@Bella2026',
    role: 'STAFF'
  },
  {
    name: 'Subangini Rajan',
    email: 'tailor@jbgroup.com',
    password: 'Tailor@Bella2026',
    role: 'TAILOR'
  },
  {
    name: 'Thuvaragan Nadesan',
    email: 'cutting@jbgroup.com',
    password: 'Cutting@Bella2026',
    role: 'CUTTING'
  },
  {
    name: 'Tharani Sivakumar',
    email: 'embroidery@jbgroup.com',
    password: 'Embroidery@Bella2026',
    role: 'EMBROIDERY'
  },
  {
    name: 'Divya Perera',
    email: 'Manager@jbgroup.com',
    password: 'Manager@Bella2026',
    role: 'MANAGER'
  }
];

async function main() {
  console.log('Seeding branches...\n');

  // Seed a default branch
  let mainBranch = await prisma.branch.findFirst({ where: { name: 'Bella Design Main Branch' } });
  if (!mainBranch) {
    mainBranch = await prisma.branch.create({
      data: {
        name: 'Bella Design Main Branch',
        address: 'Colombo, Sri Lanka',
        phone: '0112345678',
        status: 'ACTIVE'
      }
    });
    console.log(`✓  Created branch: ${mainBranch.name}`);
  } else {
    console.log(`✓  Branch exists: ${mainBranch.name}`);
  }

  console.log('\nSeeding users...\n');
  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    const hashedPassword = await bcrypt.hash(u.password, SALT_ROUNDS);

    if (existing) {
      await prisma.user.update({
        where: { email: u.email },
        data: {
          name: u.name,
          password: hashedPassword,
          role: u.role,
          isActive: true,
          branchId: mainBranch.id
        }
      });
      console.log(`✓  Updated: ${u.email} (${u.role})`);
    } else {
      await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hashedPassword,
          role: u.role,
          isActive: true,
          branchId: mainBranch.id
        }
      });
      console.log(`✓  Created: ${u.email} (${u.role})`);
    }
  }
  console.log('\nSeed complete.\n');
  console.log('--- LOGIN CREDENTIALS ---');
  users.forEach(u => console.log(`  ${u.role.padEnd(14)} ${u.email.padEnd(28)} ${u.password}`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
