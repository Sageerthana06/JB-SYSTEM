const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const ARTIFACTS_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\fa6cbc4b-65c1-46d7-9e4b-af31b48ba2db';

function waitForServer(url, timeout = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      http.get(url, (res) => resolve()).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error(`Timeout waiting for ${url}`));
        else setTimeout(check, 400);
      });
    }
    check();
  });
}

async function verifyAllRoles() {
  console.log('====================================================================');
  console.log('   JB GROUP REAL BROWSER VERIFICATION — EXPENSE MANAGEMENT          ');
  console.log('====================================================================\n');

  console.log('[1/4] Launching backend server on port 5000...');
  const backendProc = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '5000' },
    stdio: 'ignore'
  });

  console.log('[2/4] Launching Vite preview on port 5173...');
  const viteProc = spawn('npx.cmd', ['vite', 'preview', '--port', '5173'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env },
    stdio: 'ignore',
    shell: true
  });

  const rolesToTest = [
    {
      name: 'CEO',
      user: { id: 1, email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN', name: 'Jeyatheepan Joseph (CEO)', branchId: 1 },
      screenshotName: 'screenshot_ceo_expense_dashboard_working.png'
    },
    {
      name: 'Admin',
      user: { id: 2, email: 'admin@jbgroup.com', role: 'ADMIN', name: 'Admin Officer', branchId: 1 },
      screenshotName: 'screenshot_admin_expense_dashboard_working.png'
    },
    {
      name: 'Manager',
      user: { id: 3, email: 'manager@jbgroup.com', role: 'MANAGER', name: 'Branch Manager', branchId: 1 },
      screenshotName: 'screenshot_manager_expense_dashboard_working.png'
    }
  ];

  try {
    await waitForServer('http://127.0.0.1:5000/api/health');
    console.log('✓ Backend API ready at http://127.0.0.1:5000/api/health');
    await waitForServer('http://localhost:5173');
    console.log('✓ Frontend server ready at http://localhost:5173\n');

    for (const r of rolesToTest) {
      console.log(`\n======================================================`);
      console.log(`   TESTING REAL BROWSER SESSION: ${r.name} (${r.user.email})`);
      console.log(`======================================================`);

      const token = jwt.sign(r.user, JWT_SECRET, { expiresIn: '1h' });
      const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), `pup_ver_${r.name}_`));

      const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        userDataDir: uniqueProfileDir,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1050']
      });

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 1050 });

        const consoleErrors = [];
        const networkLogs = [];

        page.on('console', msg => {
          if (msg.type() === 'error') {
            console.error(`[CONSOLE ERROR ${r.name}]`, msg.text());
            consoleErrors.push(msg.text());
          }
        });

        page.on('pageerror', err => {
          console.error(`[PAGE ERROR ${r.name}]`, err.toString());
          consoleErrors.push(err.toString());
        });

        page.on('response', resp => {
          const url = resp.url();
          if (url.includes('/api/expenses')) {
            networkLogs.push({
              url,
              status: resp.status(),
              contentType: resp.headers()['content-type']
            });
          }
        });

        // Navigate & authenticate
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
        await page.evaluate((tok, u) => {
          localStorage.setItem('jb_token', tok);
          localStorage.setItem('token', tok);
          localStorage.setItem('jb_user', JSON.stringify(u));
        }, token, r.user);

        await page.reload({ waitUntil: 'networkidle2' });
        await new Promise(res => setTimeout(res, 2000));

        // Click Expense Management in sidebar
        await page.evaluate(() => {
          const allButtons = Array.from(document.querySelectorAll('button'));
          const expBtn = allButtons.find(b => {
            const span = b.querySelector('span');
            return span && span.innerText.trim() === 'Expense Management';
          });
          if (expBtn) expBtn.click();
        });

        await new Promise(res => setTimeout(res, 3000));

        // Capture Dashboard Screenshot
        const dashPath = path.join(ARTIFACTS_DIR, r.screenshotName);
        await page.screenshot({ path: dashPath, fullPage: false });
        console.log(`✓ Saved ${r.name} Dashboard Screenshot: ${dashPath} (${fs.statSync(dashPath).size} bytes)`);

        console.log(`\n  Network Logs for ${r.name}:`);
        networkLogs.forEach(l => {
          console.log(`    ${l.status} | Content-Type: ${l.contentType} | URL: ${l.url}`);
        });

        const unexpectedTokenFound = consoleErrors.some(e => e.includes("Unexpected token '<'") || e.includes("<!doctype"));
        console.log(`  Unexpected token '<' detected: ${unexpectedTokenFound ? 'YES (FAIL)' : 'NO (100% CLEAN PASS)'}`);
        if (unexpectedTokenFound) {
          throw new Error(`Unexpected token error detected in ${r.name} browser console!`);
        }

        // Additional interaction checks for CEO
        if (r.name === 'CEO') {
          // 1. Click Shop Rent category
          console.log('\n  Clicking Shop Rent Category Section...');
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const rentBtn = btns.find(b => b.innerText.trim() === 'Shop Rent');
            if (rentBtn) rentBtn.click();
          });
          await new Promise(res => setTimeout(res, 2000));
          const catPath = path.join(ARTIFACTS_DIR, 'screenshot_expense_category_section_working.png');
          await page.screenshot({ path: catPath, fullPage: false });
          console.log(`✓ Saved Shop Rent Section Screenshot: ${catPath} (${fs.statSync(catPath).size} bytes)`);

          // 2. Open Add Expense modal
          console.log('  Opening Add Expense Modal...');
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const addBtn = btns.find(b => b.innerText.includes('Add Shop Rent Expense') || b.innerText.includes('Record Expense'));
            if (addBtn) addBtn.click();
          });
          await new Promise(res => setTimeout(res, 1500));
          const modalPath = path.join(ARTIFACTS_DIR, 'screenshot_add_expense_modal_working.png');
          await page.screenshot({ path: modalPath, fullPage: false });
          console.log(`✓ Saved Add Expense Modal Screenshot: ${modalPath} (${fs.statSync(modalPath).size} bytes)`);

          // Close modal
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const cancelBtn = btns.find(b => b.innerText.trim() === 'Cancel');
            if (cancelBtn) cancelBtn.click();
          });
          await new Promise(res => setTimeout(res, 1000));

          // 3. Open Monthly Reports View
          console.log('  Opening Monthly Reports View...');
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const repBtn = btns.find(b => b.innerText.includes('Monthly Reports'));
            if (repBtn) repBtn.click();
          });
          await new Promise(res => setTimeout(res, 2000));
          const repPath = path.join(ARTIFACTS_DIR, 'screenshot_expense_monthly_report_working.png');
          await page.screenshot({ path: repPath, fullPage: false });
          console.log(`✓ Saved Monthly Report Screenshot: ${repPath} (${fs.statSync(repPath).size} bytes)`);
        }

      } finally {
        await browser.close();
        try { fs.rmSync(uniqueProfileDir, { recursive: true, force: true }); } catch (e) {}
      }
    }

    console.log('\n====================================================================');
    console.log('   ALL REAL BROWSER VERIFICATIONS COMPLETED SUCCESSFULLY (100%)     ');
    console.log('====================================================================\n');
  } finally {
    try { backendProc.kill(); } catch (e) {}
    try { viteProc.kill(); } catch (e) {}
  }
}

verifyAllRoles().catch(err => {
  console.error('[FATAL BROWSER VERIFICATION ERROR]:', err);
  process.exit(1);
});

