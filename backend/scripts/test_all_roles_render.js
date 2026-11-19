const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function waitForServer(url, timeout = 12000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      http.get(url, (res) => {
        resolve();
      }).on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for ${url}`));
        } else {
          setTimeout(check, 300);
        }
      });
    }
    check();
  });
}

async function main() {
  console.log('Starting backend server on port 5000...');
  const backend = spawn('node', ['backend/server.js'], {
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, PORT: '5000' }
  });

  backend.stdout.on('data', d => {
    const s = d.toString();
    if (s.includes('running') || s.includes('connected')) console.log('[Backend]', s.trim());
  });

  console.log('Spawning vite dev server on port 5180...');
  const vite = spawn('npx.cmd', ['vite', '--host', '127.0.0.1', '--port', '5180', '--strictPort'], {
    shell: true,
    stdio: 'pipe'
  });

  await waitForServer('http://localhost:5000');
  console.log('Backend ready.');
  await waitForServer('http://127.0.0.1:5180');
  console.log('Vite ready.');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const rolesToTest = [
    { name: 'SUPER_ADMIN (CEO)', user: { id: 1, name: 'CEO', email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN', branchId: null } },
    { name: 'ADMIN', user: { id: 2, name: 'Admin', email: 'admin@jbgroup.com', role: 'ADMIN', branchId: 1 } },
    { name: 'MANAGER (Branch 1)', user: { id: 3, name: 'Manager 1', email: 'manager@jbgroup.com', role: 'MANAGER', branchId: 1 } },
    { name: 'MANAGER (Branch 2)', user: { id: 4, name: 'Manager 2', email: 'manager2@jbgroup.com', role: 'MANAGER', branchId: 2 } }
  ];

  const results = [];

  for (const t of rolesToTest) {
    console.log(`\n========================================`);
    console.log(`Testing: ${t.name}`);
    console.log(`========================================`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', err => {
      console.error(`  ❌ [PAGE_ERROR in ${t.name}]`, err.toString());
      console.error(err.stack);
      pageErrors.push(err.toString());
    });

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        if (!text.includes('416') && !text.includes('favicon')) {
          console.error(`  ❌ [CONSOLE_ERROR in ${t.name}]`, text);
          consoleErrors.push(text);
        }
      }
    });

    const token = jwt.sign(t.user, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

    // Mock /api/auth/me response in puppeteer request interception so user is guaranteed valid
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (req.method() === 'OPTIONS') {
        req.respond({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'access-control-allow-headers': '*'
          }
        });
      } else if (req.url().includes('/api/auth/me')) {
        req.respond({
          status: 200,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-credentials': 'true'
          },
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: t.user })
        });
      } else {
        req.continue();
      }
    });

    await page.evaluateOnNewDocument((usr, tok) => {
      localStorage.setItem('jb_token', tok);
      localStorage.setItem('jb_user', JSON.stringify(usr));
    }, t.user, token);

    try {
      await page.goto('http://127.0.0.1:5180', { waitUntil: 'networkidle2', timeout: 15000 });
    } catch (e) {
      console.warn('Navigation notice:', e.message);
    }

    await new Promise(r => setTimeout(r, 2000));

    const html = await page.content();
    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    const isWhiteScreen = bodyText.length === 0 || (!bodyText.includes('Dashboard') && !bodyText.includes('Orders') && !bodyText.includes('Sales'));

    console.log(`  Body text length: ${bodyText.length}`);
    console.log(`  Sample: "${bodyText.substring(0, 150).replace(/\n+/g, ' ')}"`);
    console.log(`  Is White Screen? ${isWhiteScreen ? '❌ YES - WHITE SCREEN!' : '✅ NO - CONTENT RENDERED'}`);

    // Take screenshot of each
    const screenshotPath = path.join(__dirname, `screenshot_${t.user.role}_branch${t.user.branchId || 'ALL'}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`  Screenshot saved to: ${screenshotPath}`);

    results.push({
      role: t.name,
      isWhiteScreen,
      bodyLength: bodyText.length,
      errors: pageErrors.length + consoleErrors.length
    });

    await page.close();
  }

  await browser.close();
  vite.kill();
  backend.kill();

  console.log('\n\n========================================');
  console.log('FINAL DASHBOARD RENDERING AUDIT REPORT:');
  console.log('========================================');
  console.table(results);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
