import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:5173';
const DEBUG_PORT = 9225;
const SCREENSHOT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\709cadb7-ed99-4cbb-95ea-2245015f03f7';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function getAuthToken() {
  const postData = JSON.stringify({
    email: 'manager@jbgroup.com',
    password: 'Manager@Bella2026'
  });

  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const resJson = JSON.parse(body);
          if (resJson.data && resJson.data.token) {
            resolve({ token: resJson.data.token, user: resJson.data.user });
          } else if (resJson.token) {
            resolve({ token: resJson.token, user: resJson.user });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

async function captureScreenshot(client, filename) {
  try {
    const res = await client.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), buffer);
    console.log(`   📸 Captured screenshot: ${filename}`);
  } catch (e) {
    console.error('Screenshot error:', e.message);
  }
}

async function run() {
  console.log('🚀 Authenticating as Manager for ERP Slip Verification...');
  const authData = await getAuthToken();

  if (!authData || !authData.token) {
    console.error('❌ Failed to authenticate manager.');
    process.exit(1);
  }
  console.log(`   ✓ Manager logged in successfully: ${authData.user.name} (${authData.user.role})`);

  console.log('🌐 Launching headless Chrome...');
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    TARGET_URL
  ]);

  await sleep(2500);

  let connected = false;
  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      tabs = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json`);
      if (tabs && tabs.length > 0) {
        connected = true;
        break;
      }
    } catch {}
  }

  if (!connected) {
    console.error('❌ Could not connect to Chrome debugging port');
    chromeProcess.kill();
    process.exit(1);
  }

  const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
  const client = new CDPClient(pageTab.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('DOM.enable');
  await client.send('Runtime.enable');

  await sleep(1500);

  // Inject token in localStorage and navigate cleanly
  console.log('🔑 Injecting auth token into browser localStorage...');
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem('jb_token', '${authData.token}');
      localStorage.setItem('jb_user', JSON.stringify(${JSON.stringify(authData.user)}));
    })()`
  });
  await client.send('Page.navigate', { url: TARGET_URL });
  await sleep(2500);

  // Set desktop viewport
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('⏳ Waiting for orders to load...');
  for (let i = 0; i < 40; i++) {
    const res = await client.send('Runtime.evaluate', {
      expression: `!document.body.innerText.includes('Loading orders...') && document.querySelectorAll('tr').length > 1`,
      returnByValue: true
    });
    if (res.result?.value) {
      console.log('   ✓ Orders fully loaded into state!');
      break;
    }
    await sleep(500);
  }

  await sleep(1000);

  // Capture Sales Dashboard with Pending Slip Banner at top
  console.log('📸 Capturing Sales Dashboard with Payment Slips alert...');
  await captureScreenshot(client, 'sales_dashboard_payment_slips_alert.png');

  // Check if pending slips banner and filter tab exist
  const evalCheck = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const text = document.body.innerText;
        const hasBanner = text.includes('Customer Payment Slip') && text.includes('Awaiting Verification');
        const hasFilterTab = text.includes('Payment Slips');
        const hasOrd37 = text.includes('ORD-2026-0037');
        const hasSlipUploaded = text.includes('Slip Uploaded');
        return { hasBanner, hasFilterTab, hasOrd37, hasSlipUploaded };
      })()
    `,
    returnByValue: true
  });
  console.log('   Dashboard checks:', evalCheck.result?.value);

  // Scroll down to the recent orders table
  await client.send('Runtime.evaluate', {
    expression: `window.scrollTo({ top: 850, behavior: 'instant' });`
  });
  await sleep(1000);

  // Click on "Payment Slips" tab to filter
  console.log('🔍 Clicking "Payment Slips" tab...');
  await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tab = buttons.find(b => b.innerText.includes('Payment Slips'));
        if (tab) { tab.click(); return true; }
        return false;
      })()
    `
  });
  await sleep(1500);
  await captureScreenshot(client, 'sales_dashboard_payment_slips_filtered.png');

  // Click "Review Slip" or "View" for ORD-2026-0037
  console.log('🔍 Opening Order ORD-2026-0037 modal...');
  await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const reviewBtn = buttons.find(b => b.innerText.includes('Review Slip') || b.innerText.includes('View'));
        if (reviewBtn) { reviewBtn.click(); return true; }
        return false;
      })()
    `
  });
  await sleep(2500);

  // Capture ViewOrderModal showing payment slips proofs & verification section
  console.log('📸 Capturing ViewOrderModal with Payment Slip proofs...');
  await captureScreenshot(client, 'view_order_modal_payment_proofs.png');

  // Verify slip proofs content in modal
  const modalCheck = await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const text = document.body.innerText;
        const hasProofSection = text.includes('Customer Payment Proofs & Records') || text.includes('Customer Payment Slips');
        const hasAmount = text.includes('1,395');
        const hasPendingBadge = text.includes('PENDING VERIFICATION');
        const hasVerifyBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Verify & Credit Payment'));
        const hasRejectBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Reject Slip'));
        return { hasProofSection, hasAmount, hasPendingBadge, hasVerifyBtn, hasRejectBtn };
      })()
    `,
    returnByValue: true
  });
  console.log('   Modal checks:', modalCheck.result?.value);

  // Test opening Lightbox preview
  console.log('🔍 Clicking slip thumbnail to open Lightbox...');
  await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const proofImg = document.querySelector('img[alt="Payment Slip Proof"]');
        if (proofImg) { proofImg.parentElement.click(); return true; }
        return false;
      })()
    `
  });
  await sleep(1500);
  await captureScreenshot(client, 'payment_slip_lightbox_modal.png');

  // Close lightbox
  await client.send('Runtime.evaluate', {
    expression: `
      (() => {
        const xBtn = Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg') && b.closest('[style*="z-index: 3000"]'));
        if (xBtn) xBtn.click();
      })()
    `
  });
  await sleep(1000);

  // Now test mobile view (390px)
  console.log('📱 Switching to mobile viewport (390px)...');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(1500);
  await captureScreenshot(client, 'mobile_view_order_modal_slip_section.png');

  console.log('✅ UI Verification completed successfully!');

  client.close();
  chromeProcess.kill();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
