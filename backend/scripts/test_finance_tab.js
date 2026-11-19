const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function waitForServer(url, timeout = 12000) {
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

async function testFinance() {
  console.log('Testing Finance tab render...');
  const backend = spawn('node', ['backend/server.js'], {
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, PORT: '5000' }
  });

  const vite = spawn('npx.cmd', ['vite', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], {
    shell: true,
    stdio: 'pipe'
  });

  await waitForServer('http://localhost:5000');
  await waitForServer('http://127.0.0.1:5181');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => {
    console.error('Page error:', err.toString());
    errors.push(err.toString());
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('416') && !text.includes('favicon')) {
        console.error('Console error:', text);
        errors.push(text);
      }
    }
  });

  const ceo = { id: 1, name: 'CEO', email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN', branchId: null };
  const token = jwt.sign(ceo, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.method() === 'OPTIONS') {
      req.respond({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'access-control-allow-headers': '*'
        }
      });
    } else if (req.url().includes('/api/auth/me')) {
      req.respond({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: ceo })
      });
    } else {
      req.continue();
    }
  });

  await page.evaluateOnNewDocument((usr, tok) => {
    localStorage.setItem('jb_token', tok);
    localStorage.setItem('jb_user', JSON.stringify(usr));
  }, ceo, token);

  await page.goto('http://127.0.0.1:5181', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // Click on Finance in sidebar
  console.log('Clicking on Finance button in sidebar...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Finance') && !b.textContent.includes('Control'));
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 2000));

  const bodyText = await page.evaluate(() => document.body.innerText.trim());
  const hasFinanceContent = bodyText.includes('Business Financial & Operations Control') || bodyText.includes('Executive Dashboard') || bodyText.includes('Cash & Bank');

  console.log('Has Finance Content rendered?', hasFinanceContent ? '✅ YES!' : '❌ NO');
  console.log('Sample text:', bodyText.substring(0, 150).replace(/\n+/g, ' '));

  await page.screenshot({ path: path.join(__dirname, 'screenshot_finance_rendered.png') });
  console.log('Saved screenshot_finance_rendered.png');

  await browser.close();
  vite.kill();
  backend.kill();

  if (!hasFinanceContent || errors.length > 0) {
    console.error('FAIL: Finance tab had errors or did not render.');
    process.exit(1);
  } else {
    console.log('✅ PASS: Finance tab rendered successfully with 0 errors.');
    process.exit(0);
  }
}

testFinance().catch(err => {
  console.error(err);
  process.exit(1);
});

