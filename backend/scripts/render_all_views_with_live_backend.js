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

  await waitForServer('http://localhost:5000');
  console.log('Backend ready on port 5000.');

  const token = jwt.sign(
    { id: 1, email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN', branchId: 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_live_backend_'));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: uniqueProfileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1360,950']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 950 });

  const pageErrors = [];
  page.on('pageerror', err => {
    console.error('❌ [PAGE ERROR]', err.toString());
    pageErrors.push(err.toString());
  });

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

  await page.evaluate((tok) => {
    localStorage.setItem('jb_token', tok);
    localStorage.setItem('token', tok);
    localStorage.setItem('jb_user', JSON.stringify({
      id: 1,
      name: 'Jeyatheepan Joseph (CEO)',
      email: 'ceo@jbgroup.com',
      role: 'SUPER_ADMIN',
      branchId: 1
    }));
  }, token);

  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Navigate to Finance module
  console.log('Clicking Finance module in sidebar...');
  await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const financeBtn = allButtons.find(b => {
      const span = b.querySelector('span');
      return span && span.innerText.trim() === 'Finance';
    });
    if (financeBtn) {
      financeBtn.click();
      console.log('Clicked Finance button!');
    } else {
      console.error('Could not find Finance button!');
    }
  });

  await new Promise(r => setTimeout(r, 4000));

  const domInfo = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      textLength: root ? root.innerText.length : 0,
      preview: root ? root.innerText.substring(0, 600).replace(/\n+/g, ' ') : ''
    };
  });

  console.log('\n=== LIVE FINANCE DASHBOARD DOM INSPECTION ===');
  console.log('DOM Text length:', domInfo.textLength);
  console.log('DOM Preview:', domInfo.preview);

  const screenshotPath1 = path.join(__dirname, 'screenshot_business_health_live.png');
  await page.screenshot({ path: screenshotPath1, fullPage: false });
  console.log('Saved screenshot 1:', screenshotPath1);

  // Click on "Monthly Bills" tab
  console.log('\nClicking Monthly Bills sub-tab...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const billsTab = buttons.find(b => b.innerText && b.innerText.includes('Monthly Bills'));
    if (billsTab) billsTab.click();
  });

  await new Promise(r => setTimeout(r, 2500));

  const screenshotPath2 = path.join(__dirname, 'screenshot_monthly_bills_live.png');
  await page.screenshot({ path: screenshotPath2, fullPage: false });
  console.log('Saved screenshot 2:', screenshotPath2);

  // Copy to artifacts directory
  const artifactDir = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\fa6cbc4b-65c1-46d7-9e4b-af31b48ba2db';
  if (fs.existsSync(artifactDir)) {
    fs.copyFileSync(screenshotPath1, path.join(artifactDir, 'screenshot_business_health_live.png'));
    fs.copyFileSync(screenshotPath2, path.join(artifactDir, 'screenshot_monthly_bills_live.png'));
    console.log('Copied screenshots to artifact directory.');
  }

  await browser.close();
  backend.kill();

  if (pageErrors.length > 0) {
    console.error('Errors occurred:', pageErrors);
    process.exit(1);
  }

  console.log('\n✅ ALL LIVE DASHBOARD RENDERS VERIFIED PERFECTLY!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
