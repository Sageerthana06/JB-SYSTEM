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

function waitForServer(url, timeout = 12000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      http.get(url, () => resolve()).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('Timeout'));
        else setTimeout(check, 300);
      });
    }
    check();
  });
}

async function captureView(roleName, userObj, filename) {
  console.log(`\nCapturing live dashboard for ${roleName}...`);
  const token = jwt.sign(userObj, JWT_SECRET, { expiresIn: '1h' });
  const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), `pup_shot_${roleName}_`));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: uniqueProfileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1050']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1050 });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await page.evaluate((tok, u) => {
    localStorage.setItem('jb_token', tok);
    localStorage.setItem('token', tok);
    localStorage.setItem('jb_user', JSON.stringify(u));
  }, token, userObj);

  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Click Finance in sidebar
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const fBtn = btns.find(b => {
      const s = b.querySelector('span');
      return s && s.innerText.trim() === 'Finance';
    });
    if (fBtn) fBtn.click();
  });

  await new Promise(r => setTimeout(r, 1000));
  await page.waitForFunction(() => !document.body.innerText.includes('Loading CEO Business Financial Health Telemetry'), { timeout: 20000 });
  await new Promise(r => setTimeout(r, 1000));

  const screenshotPath = path.join(__dirname, filename);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Saved screenshot: ${screenshotPath}`);

  const artifactDir = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\fa6cbc4b-65c1-46d7-9e4b-af31b48ba2db';
  if (fs.existsSync(artifactDir)) {
    fs.copyFileSync(screenshotPath, path.join(artifactDir, filename));
    console.log(`Copied to artifacts: ${filename}`);
  }

  await browser.close();
}

async function main() {
  console.log('Starting backend on port 5000...');
  const backend = spawn('node', ['backend/server.js'], {
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, PORT: '5000' }
  });

  await waitForServer('http://localhost:5000');
  console.log('Backend ready.');

  // 1. CEO Dashboard
  await captureView(
    'CEO',
    { id: 1, name: 'Jeyatheepan Joseph (CEO)', email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN', branchId: 1 },
    'reconciliation_ceo_dashboard.png'
  );

  // 2. Manager Dashboard (Branch 1)
  await captureView(
    'Manager',
    { id: 3, name: 'Manager', email: 'manager@jbgroup.com', role: 'MANAGER', branchId: 1 },
    'reconciliation_manager_dashboard.png'
  );

  // 3. Admin Dashboard (Branch 1)
  await captureView(
    'Admin',
    { id: 2, name: 'Admin', email: 'admin@jbgroup.com', role: 'ADMIN', branchId: 1 },
    'reconciliation_admin_dashboard.png'
  );

  backend.kill();
  console.log('All screenshots captured successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

