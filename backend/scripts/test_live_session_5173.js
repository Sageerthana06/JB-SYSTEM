const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const os = require('os');
const jwt = require('jsonwebtoken');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  console.log('Testing live session restore on http://localhost:5173...');

  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'SUPER_ADMIN', branchId: null },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );

  const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_session_5173_'));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: uniqueProfileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const pageErrors = [];
  page.on('pageerror', err => {
    console.error('❌ [PAGE ERROR]', err.toString());
    pageErrors.push(err.toString());
  });

  // Navigate to 5173 first so origin is established
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

  // Set session tokens in localStorage (both jb_token and token for full compatibility)
  await page.evaluate((tok) => {
    localStorage.setItem('jb_token', tok);
    localStorage.setItem('token', tok);
    localStorage.setItem('user', JSON.stringify({
      id: 1,
      username: 'admin',
      role: 'SUPER_ADMIN',
      branchId: null
    }));
  }, token);

  // Reload page to test session restoration
  console.log('Reloading with active session in localStorage...');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2500));

  const domInfo = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      childCount: root ? root.childElementCount : 0,
      textLength: root ? root.innerText.length : 0,
      preview: root ? root.innerText.substring(0, 300).replace(/\n+/g, ' ') : ''
    };
  });

  console.log('\n=== RESTORED SESSION DOM INSPECTION ===');
  console.log('Root children:', domInfo.childCount);
  console.log('Root text length:', domInfo.textLength);
  console.log('Root text preview:', domInfo.preview);

  const screenshotPath = path.join(__dirname, 'live_browser_5173_authenticated.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();

  if (domInfo.childCount > 0 && domInfo.textLength > 50 && pageErrors.length === 0) {
    console.log('✅ PASS: Authenticated dashboard rendered cleanly on port 5173 with 0 page errors!');
    process.exit(0);
  } else {
    console.error('❌ FAIL: Session restoration failed or threw page errors.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

