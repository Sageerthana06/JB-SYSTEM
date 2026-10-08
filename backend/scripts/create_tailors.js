/**
 * Create Tailor Users Script — JB GROUP ERP
 * Creates 4 new tailor accounts:
 *   - PUSHPAMALAR   (tailor)
 *   - URUTHTHIRADEVI (tailor)
 *   - SUSITHA        (tailor)
 *   - SASIKALA       (tailor — main panel)
 * All assigned to Branch 1: JB Group (Main)
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
const BRANCH_ID = 1; // JB Group (Main)

const newTailors = [
  {
    name: 'Pushpamalar',
    email: 'pushpamalar@jbgroup.com',
    password: 'Pushpa@Tailor2026',
    role: 'TAILOR'
  },
  {
    name: 'Uruththiradevi',
    email: 'uruththiradevi@jbgroup.com',
    password: 'Uruthi@Tailor2026',
    role: 'TAILOR'
  },
  {
    name: 'Susitha',
    email: 'susitha@jbgroup.com',
    password: 'Susitha@Tailor2026',
    role: 'TAILOR'
  },
  {
    name: 'Sasikala',
    email: 'sasikala@jbgroup.com',
    password: 'Sasi@Tailor2026',
    role: 'TAILOR'
  }
];

async function main() {
  console.log('\n🧵  Creating Tailor Accounts — JB GROUP ERP\n');
  console.log(`📍  Branch: JB Group (Main) [ID: ${BRANCH_ID}]\n`);

  for (const u of newTailors) {
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
          branchId: BRANCH_ID
        }
      });
      console.log(`✅  Updated : ${u.name.padEnd(18)} ${u.email}`);
    } else {
      await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hashedPassword,
          role: u.role,
          isActive: true,
          branchId: BRANCH_ID
        }
      });
      console.log(`✅  Created : ${u.name.padEnd(18)} ${u.email}`);
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              LOGIN CREDENTIALS — TAILOR ACCOUNTS                ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  newTailors.forEach(u => {
    console.log(`║  ${u.name.padEnd(16)} │ ${u.email.padEnd(28)} │ ${u.password.padEnd(20)} ║`);
  });
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('\n✨  All tailor accounts ready!\n');
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
