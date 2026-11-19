const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function waitForServer(url, timeout = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      http.get(url, (res) => resolve()).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error(`Timeout waiting for ${url}`));
        else setTimeout(check, 300);
      });
    }
    check();
  });
}

async function main() {
  console.log('=== STARTING REAL PROJECT SERVERS ===');
  // 1. Backend server
  console.log('Spawning backend (node backend/server.js)...');
  const backend = spawn('node', ['backend/server.js'], {
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, PORT: '5000' }
  });

  backend.stdout.on('data', d => {
    const s = d.toString();
    if (s.includes('Server running') || s.includes('Connected') || s.includes('error')) {
      console.log('[Backend]', s.trim());
    }
  });
  backend.stderr.on('data', d => console.error('[Backend stderr]', d.toString().trim()));

  // 2. Vite dev server (npm run dev -> vite)
  console.log('Spawning frontend (npm run dev -> vite)...');
  const vite = spawn('npx.cmd', ['vite'], {
    shell: true,
    stdio: 'pipe'
  });

  vite.stdout.on('data', d => console.log('[Vite]', d.toString().trim()));
  vite.stderr.on('data', d => console.error('[Vite stderr]', d.toString().trim()));

  await waitForServer('http://localhost:5000');
  console.log('Backend verified at http://localhost:5000');
  await waitForServer('http://localhost:5173');
  console.log('Vite dev server verified at http://localhost:5173');

  // 3. Launch real browser
  console.log('\n=== OPENING BROWSER AT http://localhost:5173 ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const networkRequests = [];
  const failedRequests = [];
  const consoleLogs = [];
  const pageErrors = [];

  // Track all network requests
  page.on('requestfailed', req => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure() ? req.failure().errorText : 'Unknown failure'
    });
    console.error('❌ [NETWORK FAILED]', req.method(), req.url(), req.failure() ? req.failure().errorText : '');
  });

  page.on('response', res => {
    networkRequests.push({
      url: res.url(),
      status: res.status(),
      contentType: res.headers()['content-type']
    });
    if (res.status() >= 400) {
      console.error(`❌ [HTTP ${res.status()}]`, res.url());
    }
  });

  page.on('console', msg => {
    const logItem = { type: msg.type(), text: msg.text(), location: msg.location() };
    consoleLogs.push(logItem);
    console.log(`[Browser Console ${msg.type().toUpperCase()}]`, msg.text());
  });

  page.on('pageerror', err => {
    const errItem = { message: err.message, stack: err.stack };
    pageErrors.push(errItem);
    console.error('\n🔴🔴🔴 [FIRST RED PAGE ERROR CAUGHT] 🔴🔴🔴');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.error('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴\n');
  });

  console.log('Navigating without mocks to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });

  // Wait 4 seconds for all React effects and dynamic imports to run
  await new Promise(r => setTimeout(r, 4000));

  // Inspect #root
  const rootInfo = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      exists: !!root,
      innerHTML: root ? root.innerHTML.substring(0, 500) : '',
      childElementCount: root ? root.childElementCount : 0,
      innerText: root ? root.innerText.substring(0, 500) : ''
    };
  });

  console.log('\n=== DOM ROOT INSPECTION ===');
  console.log('Root element exists:', rootInfo.exists);
  console.log('Root child element count:', rootInfo.childElementCount);
  console.log('Root innerHTML preview:', rootInfo.innerHTML);
  console.log('Root innerText preview:', rootInfo.innerText);

  const screenshotPath = path.join(__dirname, 'actual_white_screen_reproduction.png');
  await page.screenshot({ path: screenshotPath });
  console.log('\nSaved screenshot to:', screenshotPath);

  // Write full diagnostic report to JSON file
  fs.writeFileSync(path.join(__dirname, 'diagnostic_report.json'), JSON.stringify({
    pageErrors,
    consoleLogs,
    failedRequests,
    rootInfo
  }, null, 2));

  await browser.close();
  vite.kill();
  backend.kill();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

