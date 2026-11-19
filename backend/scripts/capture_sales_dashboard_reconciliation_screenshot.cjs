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

async function captureSalesDashboardScreenshots() {
  console.log('Starting servers for Sales Dashboard reconciliation verification...');

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
    console.log('Vite preview alive on port 5173.');

    const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pup_sales_recon_'));

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      userDataDir: uniqueProfileDir,
      defaultViewport: { width: 1440, height: 1100 },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });

    // Navigate to login
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#jb_account_identifier', { timeout: 12000 });

    // Login as CEO
    console.log('Authenticating as CEO...');
    await page.type('#jb_account_identifier', 'ceo@jbgroup.com', { delay: 15 });
    await page.type('#jb_account_credential', '@Bella202CEO6', { delay: 15 });
    await page.click('button[type="submit"]');

    await page.waitForSelector('.sidebar-drawer', { timeout: 15000 });
    console.log('✓ Successfully authenticated!');
    await new Promise(r => setTimeout(r, 2000));

    // Navigate to Sales Dashboard in sidebar
    console.log('Navigating to Sales Dashboard...');
    await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button, a'));
      const salesBtn = allButtons.find(b => {
        const text = b.innerText.trim();
        return text.split('\n')[0].trim() === 'Sales';
      });
      if (salesBtn) salesBtn.click();
    });

    await new Promise(r => setTimeout(r, 3000));

    // Wait for Sales & Payment Summary Section
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('sales & payment summary'), { timeout: 15000 });
    console.log('✓ Sales & Payment Summary rendered on screen!');

    // 1. Capture All Time view
    const shotPathAll = path.join(ARTIFACTS_DIR, 'screenshot_sales_payment_summary_reconciled_all.png');
    await page.screenshot({ path: shotPathAll, fullPage: false });
    console.log('✅ Saved All Time screenshot:', shotPathAll);

    // 2. Click "This Month" filter button
    console.log('Clicking "This Month" filter...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const monthBtn = buttons.find(b => b.innerText.trim() === 'This Month');
      if (monthBtn) monthBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    const shotPathMonth = path.join(ARTIFACTS_DIR, 'screenshot_sales_payment_summary_reconciled_month.png');
    await page.screenshot({ path: shotPathMonth, fullPage: false });
    console.log('✅ Saved This Month screenshot:', shotPathMonth);

    // 3. Click "Today" filter button
    console.log('Clicking "Today" filter...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const todayBtn = buttons.find(b => b.innerText.trim() === 'Today');
      if (todayBtn) todayBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    const shotPathToday = path.join(ARTIFACTS_DIR, 'screenshot_sales_payment_summary_reconciled_today.png');
    await page.screenshot({ path: shotPathToday, fullPage: false });
    console.log('✅ Saved Today screenshot:', shotPathToday);

    // 4. Reset to All Time and capture full page
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const allBtn = buttons.find(b => b.innerText.trim() === 'All Time');
      if (allBtn) allBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    const shotPathFull = path.join(ARTIFACTS_DIR, 'screenshot_sales_dashboard_full_reconciled.png');
    await page.screenshot({ path: shotPathFull, fullPage: true });
    console.log('✅ Saved Full Reconciled Sales Dashboard screenshot:', shotPathFull);

    console.log('🎉 ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
  } finally {
    if (browser) await browser.close();
    try { backendProc.kill(); } catch {}
    try { viteProc.kill(); } catch {}
  }
}

captureSalesDashboardScreenshots().catch(err => {
  console.error('❌ Screenshot capture failed:', err);
  process.exit(1);
});
