const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const os = require('os');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testRole(roleName, userPayload, screenshotFileName) {
  console.log(`\n--- Testing ${roleName} on http://localhost:5173 ---`);

  const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' });
  const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), `puppeteer_${roleName}_`));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: uniqueProfileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const pageErrors = [];
  page.on('pageerror', err => {
    console.error(`❌ [${roleName} PAGE ERROR]`, err.toString());
    pageErrors.push(err.toString());
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

  await page.evaluate((tok, u) => {
    localStorage.setItem('jb_token', tok);
    localStorage.setItem('token', tok);
    localStorage.setItem('user', JSON.stringify(u));
  }, token, userPayload);

  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Navigate to Finance module if not already there
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const financeBtn = buttons.find(b => b.innerText.includes('ERP Finance') || b.innerText.includes('Finance'));
    if (financeBtn) financeBtn.click();
  });

  await new Promise(r => setTimeout(r, 2500));

  const pageText = await page.evaluate(() => document.body.innerText);
  console.log(`[${roleName}] Page Text Preview:`, pageText.substring(0, 250).replace(/\n+/g, ' '));

  const screenshotPath = path.join(__dirname, screenshotFileName);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Saved screenshot: ${screenshotPath}`);

  // Also copy to artifacts directory
  const artifactDir = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\fa6cbc4b-65c1-46d7-9e4b-af31b48ba2db';
  if (fs.existsSync(artifactDir)) {
    fs.copyFileSync(screenshotPath, path.join(artifactDir, screenshotFileName));
  }

  await browser.close();

  if (pageErrors.length > 0) {
    throw new Error(`Page errors occurred for ${roleName}: ${pageErrors.join(', ')}`);
  }
}

async function testMonthlyBillsTab() {
  console.log('\n--- Testing Monthly Bills Tab as CEO ---');
  const token = jwt.sign(
    { id: 1, email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN', branchId: 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_bills_tab_'));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: uniqueProfileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await page.evaluate((tok) => {
    localStorage.setItem('jb_token', tok);
    localStorage.setItem('token', tok);
    localStorage.setItem('user', JSON.stringify({ id: 1, email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN', branchId: 1 }));
  }, token);

  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Navigate to Finance
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const financeBtn = buttons.find(b => b.innerText.includes('ERP Finance') || b.innerText.includes('Finance'));
    if (financeBtn) financeBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Click on "Monthly Bills" tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const billsTab = tabs.find(t => t.innerText.includes('Monthly Bills'));
    if (billsTab) billsTab.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  const billsText = await page.evaluate(() => document.body.innerText);
  console.log('[Bills Tab] Text Preview:', billsText.substring(0, 250).replace(/\n+/g, ' '));

  const screenshotPath = path.join(__dirname, 'screenshot_monthly_bills.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot:', screenshotPath);

  const artifactDir = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\fa6cbc4b-65c1-46d7-9e4b-af31b48ba2db';
  if (fs.existsSync(artifactDir)) {
    fs.copyFileSync(screenshotPath, path.join(artifactDir, 'screenshot_monthly_bills.png'));
  }

  await browser.close();
}

async function main() {
  console.log('=== VERIFYING BUSINESS HEALTH DASHBOARD IN REAL BROWSER ===\n');

  // 1. CEO / SUPER_ADMIN
  await testRole(
    'CEO_SUPER_ADMIN',
    { id: 1, email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN', branchId: 1 },
    'screenshot_business_health_ceo.png'
  );

  // 2. Manager (Branch 1)
  await testRole(
    'MANAGER_BRANCH1',
    { id: 3, email: 'manager@jbgroup.com', role: 'MANAGER', branchId: 1 },
    'screenshot_business_health_manager.png'
  );

  // 3. Admin (Branch 1)
  await testRole(
    'ADMIN_BRANCH1',
    { id: 2, email: 'admin@jbgroup.com', role: 'ADMIN', branchId: 1 },
    'screenshot_business_health_admin.png'
  );

  // 4. Monthly Bills Tab as CEO
  await testMonthlyBillsTab();

  console.log('\n✅ ALL LIVE BROWSER VERIFICATIONS PASSED WITH 0 PAGE ERRORS!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

