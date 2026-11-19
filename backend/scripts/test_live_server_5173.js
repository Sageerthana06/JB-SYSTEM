const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  console.log('Testing LIVE Vite server at http://localhost:5173...');

  const uniqueProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_live_5173_'));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: uniqueProfileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('[Browser Error]', msg.text());
      consoleErrors.push(msg.text());
    } else {
      console.log(`[Browser ${msg.type()}]`, msg.text());
    }
  });

  page.on('pageerror', err => {
    console.error('❌ [PAGE ERROR]', err.toString());
    pageErrors.push(err.toString());
  });

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));

  const rootInfo = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      exists: !!root,
      childCount: root ? root.childElementCount : 0,
      textLength: root ? root.innerText.length : 0,
      preview: root ? root.innerText.substring(0, 200).replace(/\n+/g, ' ') : ''
    };
  });

  console.log('\n=== LIVE DOM INSPECTION ===');
  console.log('Root element exists:', rootInfo.exists);
  console.log('Root child element count:', rootInfo.childCount);
  console.log('Root text length:', rootInfo.textLength);
  console.log('Root preview text:', rootInfo.preview);

  const screenshotPath = path.join(__dirname, 'live_browser_5173_after_fix.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();

  console.log('\n=== AUDIT VERDICT ===');
  if (rootInfo.childCount > 0 && pageErrors.length === 0) {
    console.log('✅ PASS: Application mounted successfully with 0 page errors!');
    process.exit(0);
  } else {
    console.error('❌ FAIL: Still white screen or errors occurred.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
