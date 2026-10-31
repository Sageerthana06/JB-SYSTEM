const { prisma, pool } = require('../src/prisma');

async function check() {
  try {
    console.log('Connecting to database via backend pool...');
    const count = await prisma.user.count();
    console.log('Database connected! User count:', count);
  } catch (err) {
    console.error('Database connection failed:', err.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

check();
