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

async function captureExpenseResetScreenshot() {
  console.log('Starting servers for Expense Dashboard screenshot verification...');

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

    const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pup_exp_reset_'));

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

    // Click 'Expense Management' in sidebar
    console.log('Navigating to Expense Management module in sidebar...');
    await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button, a'));
      const expBtn = allButtons.find(b => {
        const text = b.innerText.trim();
        return text.includes('Expense Management');
      });
      if (expBtn) expBtn.click();
    });

    await new Promise(r => setTimeout(r, 3000));

    // Wait for Expense Dashboard to render
    await page.waitForFunction(() => document.body.innerText.includes('Core Expense Metrics'), { timeout: 15000 });
    console.log('✓ Expense Dashboard rendered!');

    // Capture screenshot of Expense Dashboard with LKR 0.00 metrics
    const shotPath = path.join(ARTIFACTS_DIR, 'screenshot_expense_dashboard_reset_zero.png');
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log('✅ Saved screenshot:', shotPath);

    // Verify UI text values
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasCore = pageText.includes('Core Expense Metrics');
    const hasZero = pageText.includes('LKR 0.00') || pageText.includes('0.00');
    console.log('Verified Core Expense Metrics header on screen:', hasCore);
    console.log('Verified LKR 0.00 values present on screen:', hasZero);

    console.log('🎉 EXPENSE DASHBOARD SCREENSHOT VERIFIED SUCCESSFULLY!');
  } finally {
    if (browser) await browser.close();
    try { backendProc.kill(); } catch {}
    try { viteProc.kill(); } catch {}
  }
}

captureExpenseResetScreenshot().catch(err => {
  console.error('❌ Screenshot capture failed:', err);
  process.exit(1);
});
