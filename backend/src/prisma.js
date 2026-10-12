const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;

// Shared singleton pool optimized for Neon serverless Postgres
const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 60000
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = { prisma, pool };
