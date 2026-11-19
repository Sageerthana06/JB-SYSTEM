const { prisma, pool } = require('../backend/src/prisma');
prisma.user.findMany({ select: { id: true, name: true, email: true, role: true } })
  .then(users => console.log('Users in DB:', users))
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });

