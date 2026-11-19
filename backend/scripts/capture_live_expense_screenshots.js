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
      http.get(url, (res) => {
        resolve();
      }).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error(`Timeout waiting for ${url}`));
        else setTimeout(check, 400);
      });
    }
    check();
  });
}

async function captureExpenseScreenshots() {
  console.log('Starting backend server for screenshot capture...');
  const backendProc = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '5000' },
    stdio: 'ignore'
  });

  console.log('Starting frontend server...');
  const viteProc = spawn('npx.cmd', ['vite', 'preview', '--port', '5173'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env },
    stdio: 'ignore',
    shell: true
  });

  try {
    await waitForServer('http://127.0.0.1:5000/api/health');
    console.log('Backend is alive on port 5000.');
    await waitForServer('http://localhost:5173');
    console.log('Vite is alive on port 5173.');

    const ceoUser = {
      id: 1,
      email: 'ceo@jbgroup.com',
      role: 'SUPER_ADMIN',
      name: 'CEO Executive',
      branchId: 1
    };

    const managerUser = {
      id: 3,
      email: 'manager@jbgroup.com',
      role: 'MANAGER',
      name: 'Branch Manager',
      branchId: 1
    };

    // 1. Capture CEO Expense Dashboard
    console.log('\n[1/4] Capturing CEO Expense Dashboard...');
    await captureModule('CEO', ceoUser, 'screenshot_expense_dashboard_ceo.png', async (page) => {
      // Just wait for dashboard to render
      await new Promise(r => setTimeout(r, 2000));
    });

    // 2. Capture Category Section (Shop Rent)
    console.log('\n[2/4] Capturing Shop Rent Category Section...');
    await captureModule('CEO', ceoUser, 'screenshot_expense_category_section.png', async (page) => {
      // Click Shop Rent tab
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const rentBtn = btns.find(b => b.innerText.includes('Shop Rent'));
        if (rentBtn) rentBtn.click();
      });
      await new Promise(r => setTimeout(r, 2000));
    });

    // 3. Capture Monthly Reports View
    console.log('\n[3/4] Capturing Monthly Reports View...');
    await captureModule('CEO', ceoUser, 'screenshot_expense_monthly_report.png', async (page) => {
      // Click Monthly Reports tab
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const repBtn = btns.find(b => b.innerText.includes('Monthly Reports'));
        if (repBtn) repBtn.click();
      });
      await new Promise(r => setTimeout(r, 2000));
    });

    // 4. Capture Manager Dashboard (Branch Locked)
    console.log('\n[4/4] Capturing Manager Locked View...');
    await captureModule('MANAGER', managerUser, 'screenshot_expense_manager_locked.png', async (page) => {
      await new Promise(r => setTimeout(r, 2000));
    });

    console.log('\nAll screenshots captured and saved to artifacts directory.');
  } finally {
    try { backendProc.kill(); } catch (e) {}
    try { viteProc.kill(); } catch (e) {}
  }
}

async function captureModule(roleName, userObj, filename, customAction) {
  const token = jwt.sign(userObj, JWT_SECRET, { expiresIn: '1h' });
  const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), `pup_exp_${roleName}_`));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: uniqueProfileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1050']
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log(`[PAGE LOG ${roleName}]`, msg.type(), msg.text()));
    page.on('pageerror', err => console.error(`[PAGE ERROR ${roleName}]`, err.toString()));
    await page.setViewport({ width: 1400, height: 1050 });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    await page.evaluate((tok, u) => {
      localStorage.setItem('jb_token', tok);
      localStorage.setItem('token', tok);
      localStorage.setItem('jb_user', JSON.stringify(u));
    }, token, userObj);

    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    // Click Expense Management in sidebar
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const expBtn = btns.find(b => {
        const s = b.querySelector('span');
        return s && s.innerText.trim() === 'Expense Management';
      });
      if (expBtn) expBtn.click();
    });

    await new Promise(r => setTimeout(r, 2000));

    if (customAction) {
      await customAction(page);
    }

    const artifactPath = path.join(ARTIFACTS_DIR, filename);
    await page.screenshot({ path: artifactPath, fullPage: false });
    console.log(`Saved screenshot: ${artifactPath} (${fs.statSync(artifactPath).size} bytes)`);
  } finally {
    await browser.close();
    try { fs.rmSync(uniqueProfileDir, { recursive: true, force: true }); } catch (e) {}
  }
}

captureExpenseScreenshots().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
