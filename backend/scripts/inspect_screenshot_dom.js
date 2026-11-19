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

async function inspect() {
  const backend = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '5000' },
    stdio: 'ignore'
  });

  const vite = spawn('npx.cmd', ['vite', '--port', '5173'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env },
    stdio: 'ignore',
    shell: true
  });

  try {
    await waitForServer('http://127.0.0.1:5000/api/health');
    await waitForServer('http://localhost:5173');

    const ceoUser = {
      id: 1,
      email: 'ceo@jbgroup.com',
      role: 'SUPER_ADMIN',
      name: 'CEO Executive',
      branchId: 1
    };
    const token = jwt.sign(ceoUser, JWT_SECRET, { expiresIn: '1h' });

    const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pup_inspect_'));
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      userDataDir: uniqueProfileDir,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1050']
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
    page.on('pageerror', err => console.error('[BROWSER ERROR]', err.toString()));

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    await page.evaluate((tok, u) => {
      localStorage.setItem('jb_token', tok);
      localStorage.setItem('token', tok);
      localStorage.setItem('jb_user', JSON.stringify(u));
    }, token, ceoUser);

    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const html = await page.evaluate(() => document.body.innerHTML);
    console.log('Body HTML length:', html.length);
    console.log('Body HTML preview:', html.substring(0, 500));

    await browser.close();
  } finally {
    try { backend.kill(); } catch (e) {}
    try { vite.kill(); } catch (e) {}
  }
}

inspect().catch(console.error);

