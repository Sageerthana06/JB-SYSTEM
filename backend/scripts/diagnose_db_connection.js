// Safe connectivity diagnostic. Prints NO secrets. Only runs SELECT 1 (read-only).
const path = require('path');
const dns = require('dns').promises;
const net = require('net');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const url = process.env.DATABASE_URL;
console.log('Env var names present:', ['DATABASE_URL', 'DIRECT_URL', 'POSTGRES_URL', 'DB_HOST'].filter(k => process.env[k]));
if (!url) { console.log('DATABASE_URL missing'); process.exit(1); }

let u;
try { u = new URL(url); } catch { console.log('DATABASE_URL is not a parseable URL'); process.exit(1); }
console.log('protocol:', u.protocol, '| host:', u.hostname, '| port:', u.port || '(default 5432)', '| db:', u.pathname.slice(1));
console.log('query param keys:', [...u.searchParams.keys()], '| sslmode:', u.searchParams.get('sslmode'));

const tcp = (host, port) => new Promise(res => {
  const t0 = Date.now();
  const s = net.connect({ host, port, timeout: 8000 });
  s.on('connect', () => { s.destroy(); res(`TCP OK (${Date.now() - t0}ms)`); });
  s.on('timeout', () => { s.destroy(); res('TCP TIMEOUT'); });
  s.on('error', e => res(`TCP ERROR ${e.code}`));
});

(async () => {
  try {
    const addrs = await dns.lookup(u.hostname, { all: true });
    console.log('DNS:', addrs.map(a => `${a.address} (v${a.family})`));
  } catch (e) { console.log('DNS ERROR', e.code); }
  console.log('Direct TCP test:', await tcp(u.hostname, Number(u.port) || 5432));

  for (let i = 1; i <= 3; i++) {
    const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 15000 });
    try {
      const t0 = Date.now();
      const r = await pool.query('SELECT 1 AS ok');
      console.log(`Attempt ${i}: SELECT 1 ->`, r.rows[0].ok, `(${Date.now() - t0}ms)`);
    } catch (e) {
      console.log(`Attempt ${i}: FAILED code=${e.code || '-'} msg=${String(e.message).slice(0, 120)}`);
    } finally { await pool.end().catch(() => {}); }
  }
})();
