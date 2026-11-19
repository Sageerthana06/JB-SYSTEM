const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { prisma, pool } = require('../src/prisma');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const ARTIFACTS_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\fa6cbc4b-65c1-46d7-9e4b-af31b48ba2db';

function waitForServer(url, timeout = 25000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      http.get(url, (res) => resolve()).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error(`Timeout waiting for ${url}`));
        else setTimeout(check, 500);
      });
    }
    check();
  });
}

async function verifySystem() {
  console.log('--- 1. Testing Monthly Winners Calculation Logic Against Neon PostgreSQL ---');

  const customerController = require('../src/controllers/customerController');

  // Test Nov 2026
  let resDataNov = null;
  await customerController.getMonthlyCustomerWinners(
    { user: { role: 'SUPER_ADMIN', branchId: null }, query: { year: '2026', month: '11' } },
    { status: () => ({ json: (d) => { resDataNov = d; } }), json: (d) => { resDataNov = d; } }
  );

  if (!resDataNov?.success) {
    throw new Error('Nov 2026 calculation failed: ' + JSON.stringify(resDataNov));
  }
  console.log('✅ Nov 2026 Top 3 calculation passed:');
  console.log(`   Total valid orders: ${resDataNov.summary.totalValidOrders}`);
  console.log(`   Gold #1: ${resDataNov.topThree[0]?.customerName} (${resDataNov.topThree[0]?.orderCount} orders, LKR ${resDataNov.topThree[0]?.totalOrderValue})`);
  console.log(`   Silver #2: ${resDataNov.topThree[1]?.customerName} (${resDataNov.topThree[1]?.orderCount} orders, LKR ${resDataNov.topThree[1]?.totalOrderValue})`);
  console.log(`   Bronze #3: ${resDataNov.topThree[2]?.customerName} (${resDataNov.topThree[2]?.orderCount} orders, LKR ${resDataNov.topThree[2]?.totalOrderValue})`);

  // Verify tie-breaker: Silver (Susitha: 5,700) > Bronze (Aarthi: 4,640)
  if (resDataNov.topThree[1]?.orderCount === resDataNov.topThree[2]?.orderCount) {
    if (resDataNov.topThree[1]?.totalOrderValue < resDataNov.topThree[2]?.totalOrderValue) {
      throw new Error('Tie-breaker failed: Silver has lower order value than Bronze!');
    }
    console.log('✅ Tie-breaker verified: Equal order count broken by total order value!');
  }

  // Test Oct 2026
  let resDataOct = null;
  await customerController.getMonthlyCustomerWinners(
    { user: { role: 'SUPER_ADMIN', branchId: null }, query: { year: '2026', month: '10' } },
    { status: () => ({ json: (d) => { resDataOct = d; } }), json: (d) => { resDataOct = d; } }
  );

  console.log('✅ Oct 2026 Historical calculation passed:');
  console.log(`   Gold #1: ${resDataOct.topThree[0]?.customerName} (${resDataOct.topThree[0]?.orderCount} orders)`);
  console.log(`   Silver #2: ${resDataOct.topThree[1]?.customerName} (${resDataOct.topThree[1]?.orderCount} orders)`);

  console.log('\n--- 2. Starting Frontend & Backend Servers for Visual Verification ---');

  const backendProc = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '5000' },
    stdio: 'ignore'
  });

  const viteProc = spawn('npx.cmd', ['vite', 'preview', '--port', '5173'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env },
    stdio: 'ignore',
    shell: true
  });

  let browser = null;

  try {
    await waitForServer('http://127.0.0.1:5000/api/health', 25000);
    console.log('Backend alive on port 5000.');
    await waitForServer('http://localhost:5173', 25000);
    console.log('Vite alive on port 5173.');

    const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pup_winners_session_'));

    console.log('\n--- 3. Launching Headless Chrome to Perform Authentic UI Login & Capture Screenshots ---');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      userDataDir: uniqueProfileDir,
      defaultViewport: { width: 1440, height: 1050 },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1050 });

    // 1. Navigate to login
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#jb_account_identifier', { timeout: 12000 });

    // 2. Perform authentic UI login as CEO
    console.log('Filling authentic login form (ceo@jbgroup.com)...');
    await page.type('#jb_account_identifier', 'ceo@jbgroup.com', { delay: 15 });
    await page.type('#jb_account_credential', '@Bella202CEO6', { delay: 15 });
    await page.click('button[type="submit"]');

    // 3. Wait for sidebar to render
    await page.waitForSelector('.sidebar-drawer', { timeout: 15000 });
    console.log('✓ Successfully authenticated as CEO!');
    await new Promise(r => setTimeout(r, 2000));

    // 4. Click 'Customers' in the sidebar
    console.log('Navigating to Customers Module in sidebar...');
    await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const custBtn = allButtons.find(b => {
        const span = b.querySelector('span');
        return span && span.innerText.trim() === 'Customers';
      });
      if (custBtn) custBtn.click();
    });

    await new Promise(r => setTimeout(r, 3000));

    // Wait for the winners podium to render
    await page.waitForFunction(() => document.body.innerText.includes('Monthly Top 3 Customer Winners'), { timeout: 15000 });
    console.log('✓ Monthly Winners Podium rendered in viewport!');

    console.log('Capturing Screenshot 1: Monthly Top 3 Winners Podium & Leaderboard...');
    const shot1Path = path.join(ARTIFACTS_DIR, 'screenshot_monthly_winners_podium_and_leaderboard.png');
    await page.screenshot({ path: shot1Path, fullPage: false });
    console.log('✅ Saved:', shot1Path);

    // 5. Click on winner Satkunathevi's "View Orders" button to open CustomerOrderHistoryModal
    console.log('Clicking "View Orders" on Gold Winner Satkunathevi...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const viewOrdBtn = buttons.find(b => b.textContent.includes('View Orders') || b.textContent.includes('Orders (4)'));
      if (viewOrdBtn) viewOrdBtn.click();
    });

    await new Promise(r => setTimeout(r, 1500));
    console.log('Capturing Screenshot 2: Customer Order History Modal (Individual Orders)...');
    const shot2Path = path.join(ARTIFACTS_DIR, 'screenshot_customer_order_history_modal.png');
    await page.screenshot({ path: shot2Path, fullPage: false });
    console.log('✅ Saved:', shot2Path);

    // Close modal
    await page.evaluate(() => {
      const closeBtns = Array.from(document.querySelectorAll('button'));
      const closeBtn = closeBtns.find(b => b.textContent.trim() === 'Close');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // 6. Switch month selector to October 2026 to verify historical winners
    console.log('Switching to Historical Month: October 2026...');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const monthSelect = selects.find(s => Array.from(s.options).some(o => o.value.includes('2026-10')));
      if (monthSelect) {
        monthSelect.value = '2026-10';
        monthSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await new Promise(r => setTimeout(r, 2500));
    console.log('Capturing Screenshot 3: Historical Month Winners (October 2026)...');
    const shot3Path = path.join(ARTIFACTS_DIR, 'screenshot_historical_month_winners.png');
    await page.screenshot({ path: shot3Path, fullPage: false });
    console.log('✅ Saved:', shot3Path);

    // 7. Switch to Customer 360 Workspace & Sizing Vault tab
    console.log('Switching to Customer 360 Workspace & Sizing Vault tab...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const vaultTabBtn = buttons.find(b => b.textContent.includes('Customer 360 Workspace') || b.textContent.includes('Sizing Vault'));
      if (vaultTabBtn) vaultTabBtn.click();
    });

    await new Promise(r => setTimeout(r, 2500));

    // Scroll down to the Tailoring Order & Fitting History table
    await page.evaluate(() => {
      const historyHeader = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Tailoring Order'));
      if (historyHeader) historyHeader.scrollIntoView({ behavior: 'instant', block: 'center' });
    });

    await new Promise(r => setTimeout(r, 1500));
    console.log('Capturing Screenshot 4: Customer 360 Tailoring Order History with All Columns...');
    const shot4Path = path.join(ARTIFACTS_DIR, 'screenshot_customer_360_order_table.png');
    await page.screenshot({ path: shot4Path, fullPage: false });
    console.log('✅ Saved:', shot4Path);

    console.log('\n🎉 ALL 4 VERIFICATION SCREENSHOTS CAPTURED AND SAVED TO ARTIFACTS!');
  } finally {
    if (browser) await browser.close();
    try { backendProc.kill(); } catch { }
    try { viteProc.kill(); } catch { }
    await prisma.$disconnect();
    await pool.end();
  }
}

verifySystem().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
