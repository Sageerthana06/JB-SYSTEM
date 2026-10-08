import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:5173';
const DEBUG_PORT = 9227;
const SCREENSHOT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\709cadb7-ed99-4cbb-95ea-2245015f03f7';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
  close() { if (this.ws) this.ws.close(); }
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
  console.log('🚀 Authenticating as CEO for Slip Verification...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ceo@jbgroup.com', password: '@Bella202CEO6' })
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data?.token || loginJson.token;
  const user = loginJson.data?.user || loginJson.user;
  console.log('   ✓ Logged in as:', user.name, `(${user.role})`);

  console.log('🌐 Launching Chrome...');
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    TARGET_URL
  ]);

  await sleep(2500);
  const tabs = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json`);
  const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
  const client = new CDPClient(pageTab.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await sleep(1000);

  console.log('🔑 Injecting CEO auth into localStorage...');
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem('jb_token', '${token}');
      localStorage.setItem('jb_user', JSON.stringify(${JSON.stringify(user)}));
      location.reload();
    })()`
  });

  await sleep(3500);

  // Set desktop viewport
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('⏳ Waiting for dashboard to stabilize...');
  for (let i = 0; i < 20; i++) {
    const textCheck = await client.send('Runtime.evaluate', {
      expression: `!document.body.innerText.includes('Loading orders...') && document.body.innerText.includes('Payment Slips')`,
      returnByValue: true
    });
    if (textCheck.result?.value) {
      console.log('   ✓ Dashboard ready!');
      break;
    }
    await sleep(500);
  }

  // Screenshot 1: Top Dashboard Alert Banner
  console.log('📸 Screenshot 1: Sales Dashboard with Top Alert Banner');
  await captureScreenshot(client, 'sales_dashboard_ceo_payment_slips_alert.png');

  // Scroll down to recent orders table
  await client.send('Runtime.evaluate', {
    expression: `window.scrollTo({ top: 850, behavior: 'instant' });`
  });
  await sleep(1000);

  // Screenshot 2: Click Payment Slips tab
  console.log('🔍 Clicking Payment Slips tab...');
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const tab = btns.find(b => b.innerText.includes('Payment Slips'));
      if (tab) tab.click();
    })()`
  });
  await sleep(1200);
  console.log('📸 Screenshot 2: Payment Slips Filtered Table');
  await captureScreenshot(client, 'sales_dashboard_ceo_payment_slips_filtered.png');

  // Open Order ORD-2026-0037
  console.log('🔍 Opening Order ORD-2026-0037 modal...');
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const reviewBtn = btns.find(b => b.innerText.includes('Review Slip') || b.innerText.includes('View'));
      if (reviewBtn) reviewBtn.click();
    })()`
  });
  await sleep(2000);

  // Screenshot 3: Modal with Customer Proofs & Verification Section
  console.log('📸 Screenshot 3: ViewOrderModal with Payment Slip & Actions');
  await captureScreenshot(client, 'view_order_modal_ceo_payment_proofs.png');

  // Screenshot 4: Slip Lightbox Modal
  console.log('🔍 Clicking slip preview for lightbox...');
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const img = document.querySelector('img[alt="Payment Slip Proof"]');
      if (img) img.parentElement.click();
    })()`
  });
  await sleep(1200);
  console.log('📸 Screenshot 4: Payment Slip Lightbox Preview');
  await captureScreenshot(client, 'payment_slip_ceo_lightbox_modal.png');

  // Close lightbox
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const xBtn = Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg') && b.closest('[style*="z-index: 3000"]'));
      if (xBtn) xBtn.click();
    })()`
  });
  await sleep(800);

  // Screenshot 5: Mobile Viewport 390px
  console.log('📱 Switching to mobile viewport (390px)...');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(1500);
  console.log('📸 Screenshot 5: Mobile Viewport Order Details & Bottom Bar');
  await captureScreenshot(client, 'mobile_view_order_modal_ceo_slip_section.png');

  console.log('🎉 Verification completed successfully!');
  client.close();
  chromeProcess.kill();
  process.exit(0);
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
