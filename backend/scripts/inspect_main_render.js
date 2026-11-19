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
      http.get(url, (res) => resolve()).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('Timeout'));
        else setTimeout(check, 300);
      });
    }
    check();
  });
}

async function main() {
  const backend = spawn('node', ['backend/server.js'], {
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, PORT: '5000' }
  });

  await waitForServer('http://localhost:5000');

  const token = jwt.sign(
    { id: 1, email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN', branchId: 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_inspect_main_'));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: uniqueProfileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1000']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });

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

  console.log('Searching for Finance button in sidebar...');
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const fBtn = btns.find(b => b.innerText && b.innerText.includes('Finance') && !b.innerText.includes('Salary'));
    if (fBtn) {
      fBtn.click();
      return true;
    }
    return false;
  });
  console.log('Finance button clicked:', clicked);

  await new Promise(r => setTimeout(r, 1000));
  console.log('Waiting for Business Health Telemetry to finish loading...');
  await page.waitForFunction(() => !document.body.innerText.includes('Loading CEO Business Financial Health Telemetry'), { timeout: 20000 });
  await new Promise(r => setTimeout(r, 1000));

  const mainText = await page.evaluate(() => {
    const m = document.querySelector('main');
    return m ? m.innerText : 'NO MAIN TAG FOUND';
  });

  console.log('\n=== MAIN CONTAINER TEXT CONTENT ===');
  console.log('Length:', mainText.length);
  console.log('Preview:\n', mainText.substring(0, 1500));

  const screenshotPath1 = path.join(__dirname, 'screenshot_business_health_live.png');
  await page.screenshot({ path: screenshotPath1, fullPage: false });

  // Now click on "Monthly Bills" tab inside Finance
  console.log('\nClicking Monthly Bills sub-tab...');
  const clickedBills = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bBtn = btns.find(b => b.innerText && b.innerText.includes('Monthly Bills'));
    if (bBtn) {
      bBtn.click();
      return true;
    }
    return false;
  });
  console.log('Monthly Bills tab clicked:', clickedBills);

  await new Promise(r => setTimeout(r, 2000));

  const billsMainText = await page.evaluate(() => {
    const m = document.querySelector('main');
    return m ? m.innerText : '';
  });

  console.log('\n=== MONTHLY BILLS CONTAINER TEXT ===');
  console.log('Length:', billsMainText.length);
  console.log('Preview:\n', billsMainText.substring(0, 600));

  const screenshotPath2 = path.join(__dirname, 'screenshot_monthly_bills_live.png');
  await page.screenshot({ path: screenshotPath2, fullPage: false });

  // Copy to artifacts directory
  const artifactDir = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\fa6cbc4b-65c1-46d7-9e4b-af31b48ba2db';
  if (fs.existsSync(artifactDir)) {
    fs.copyFileSync(screenshotPath1, path.join(artifactDir, 'screenshot_business_health_live.png'));
    fs.copyFileSync(screenshotPath2, path.join(artifactDir, 'screenshot_monthly_bills_live.png'));
    console.log('Copied screenshots to artifact directory.');
  }

  await browser.close();
  backend.kill();
  process.exit(0);
}

main().catch(console.error);
