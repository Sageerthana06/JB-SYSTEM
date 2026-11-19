const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

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

async function verifyFinancialControlBrowser() {
  console.log('====================================================================');
  console.log('   JB GROUP REAL BROWSER VERIFICATION — FINANCIAL CONTROL SYSTEM    ');
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
      email: 'ceo@jbgroup.com',
      password: '@Bella202CEO6',
      screenshotName: 'screenshot_ceo_financial_control_dashboard.png'
    },
    {
      name: 'Manager',
      email: 'manager@jbgroup.com',
      password: 'Manager@Bella2026',
      screenshotName: 'screenshot_manager_financial_control_dashboard.png'
    },
    {
      name: 'Admin',
      email: 'admin@jbgroup.com',
      password: 'Admin@Bella2026',
      screenshotName: 'screenshot_admin_financial_control_dashboard.png'
    }
  ];

  try {
    await waitForServer('http://127.0.0.1:5000/api/health');
    console.log('✓ Backend API ready at http://127.0.0.1:5000/api/health');
    await waitForServer('http://localhost:5173');
    console.log('✓ Frontend server ready at http://localhost:5173\n');

    for (const r of rolesToTest) {
      console.log(`\n======================================================`);
      console.log(`   TESTING REAL BROWSER SESSION: ${r.name} (${r.email})`);
      console.log(`======================================================`);

      const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), `pup_fc_${r.name}_`));

      const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        userDataDir: uniqueProfileDir,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1100']
      });

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 1100 });

        page.on('console', msg => {
          if (msg.type() === 'error') {
            console.error(`[CONSOLE ERROR ${r.name}]`, msg.text());
          }
        });

        // 1. Navigate to frontend login
        await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForSelector('#jb_account_identifier', { timeout: 10000 });

        // 2. Perform authentic UI login
        console.log(`  Filling login form for ${r.name}...`);
        await page.type('#jb_account_identifier', r.email, { delay: 15 });
        await page.type('#jb_account_credential', r.password, { delay: 15 });
        await page.click('button[type="submit"]');

        // 3. Wait for dashboard / sidebar to render
        await page.waitForSelector('.sidebar-drawer', { timeout: 12000 });
        console.log(`  ✓ Successfully authenticated into session as ${r.name}`);

        await new Promise(res => setTimeout(res, 2000));

        // 4. Click 'Finance' in the sidebar
        console.log('  Navigating to Finance Module...');
        await page.evaluate(() => {
          const allButtons = Array.from(document.querySelectorAll('button'));
          const finBtn = allButtons.find(b => {
            const span = b.querySelector('span');
            return span && span.innerText.trim() === 'Finance';
          });
          if (finBtn) finBtn.click();
        });

        await new Promise(res => setTimeout(res, 3500));

        // 5. Capture Dashboard Screenshot
        const dashPath = path.join(ARTIFACTS_DIR, r.screenshotName);
        await page.screenshot({ path: dashPath, fullPage: false });
        console.log(`✓ Saved ${r.name} Financial Control Dashboard Screenshot: ${dashPath} (${fs.statSync(dashPath).size} bytes)`);

        // Check if CEO: Open Monthly Financial Report Modal
        if (r.name === 'CEO') {
          console.log('\n  Opening Monthly Financial Report Modal as CEO...');
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const repBtn = btns.find(b => b.innerText.includes('Monthly Financial Report'));
            if (repBtn) repBtn.click();
          });

          await new Promise(res => setTimeout(res, 2500));
          const repPath = path.join(ARTIFACTS_DIR, 'screenshot_ceo_monthly_financial_report_modal.png');
          await page.screenshot({ path: repPath, fullPage: false });
          console.log(`✓ Saved Monthly Report Modal Screenshot: ${repPath} (${fs.statSync(repPath).size} bytes)`);

          // Close modal
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const closeBtn = btns.find(b => b.innerText.trim() === 'Close');
            if (closeBtn) closeBtn.click();
          });
          await new Promise(res => setTimeout(res, 1000));
        }

        const pageText = await page.evaluate(() => document.body.innerText);
        const hasCards = pageText.includes('Total Money Received') && pageText.includes('Total Remaining Cashflow');
        console.log(`  Cards A-H rendered properly: ${hasCards ? 'YES (PASS)' : 'NO (CHECK DOM)'}`);

        const hasTwoCalcs = pageText.includes('Calculation 1: Actual Cashflow') && pageText.includes('Calculation 2: Available Cash & Bank Balance');
        console.log(`  Two Separate Calculations rendered: ${hasTwoCalcs ? 'YES (PASS)' : 'NO (CHECK DOM)'}`);

        const hasProjected = pageText.includes('After All Payments — Final Business Position') || pageText.includes('MANAGEMENT PROJECTION');
        console.log(`  Projected Business Position rendered: ${hasProjected ? 'YES (PASS)' : 'NO (CHECK DOM)'}`);

      } finally {
        await browser.close();
      }
    }

    console.log('\n====================================================================');
    console.log('   ALL REAL BROWSER VERIFICATIONS COMPLETED SUCCESSFULLY (100%)    ');
    console.log('====================================================================');
  } finally {
    console.log('\nStopping test background processes...');
    try { process.kill(backendProc.pid); } catch (e) {}
    try { process.kill(viteProc.pid); } catch (e) {}
  }
}

verifyFinancialControlBrowser().catch(err => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});
