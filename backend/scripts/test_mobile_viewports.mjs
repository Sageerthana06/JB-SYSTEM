import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:5173';
const DEBUG_PORT = 9224;
const SCREENSHOT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\709cadb7-ed99-4cbb-95ea-2245015f03f7';

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '414x896', width: 414, height: 896 },
  { name: '430x932', width: 430, height: 932 },
  { name: '1280x800 (Desktop)', width: 1280, height: 800 }
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getJson(url) {
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
    email: 'ceo@jbgroup.com',
    password: '@Bella202CEO6'
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
  console.log('🚀 Authenticating as CEO for Full ERP Verification...');
  let authData = await getAuthToken();

  if (!authData) {
    // Try alternate password
    const postData2 = JSON.stringify({ email: 'ceo@jbgroup.com', password: 'admin' });
    authData = await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData2) }
      }, (res) => {
        let b = ''; res.on('data', c => b += c);
        res.on('end', () => {
          try { resolve(JSON.parse(b)); } catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.write(postData2); req.end();
    });
  }

  console.log('🚀 Launching Headless Chrome...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    TARGET_URL
  ]);

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
    console.error('Failed to connect to Chrome debug port');
    chromeProc.kill();
    process.exit(1);
  }

  const tab = tabs.find(t => t.type === 'page') || tabs[0];
  const client = new CDPClient(tab.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('DOM.enable');

  await sleep(1500);

  // Inject session token if obtained
  if (authData && authData.token) {
    console.log(`✓ Injecting CEO session (User: ${authData.user?.name || authData.user?.email})...`);
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        localStorage.setItem('jb_token', '${authData.token}');
        localStorage.setItem('jb_user', JSON.stringify(${JSON.stringify(authData.user)}));
        window.location.reload();
      })()`
    });
    await sleep(3000);
  }

  const results = [];

  for (const vp of VIEWPORTS) {
    // Set device metrics
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: vp.width < 800
    });

    await sleep(500);

    // Evaluate scroll metrics and overflow
    const evalRes = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const doc = document.documentElement;
        const scrollW = doc.scrollWidth;
        const innerW = window.innerWidth;
        const clientW = doc.clientWidth;
        const hasHScroll = scrollW > innerW;

        // Check cards / tables display
        const desktopTable = document.querySelector('.sales-desktop-table');
        const mobileCards = document.querySelector('.sales-mobile-cards');
        const desktopTableVisible = desktopTable ? getComputedStyle(desktopTable).display !== 'none' : false;
        const mobileCardsVisible = mobileCards ? getComputedStyle(mobileCards).display !== 'none' : false;
        const hamburgerBtn = document.querySelector('.header-mobile-menu-btn');
        const hamburgerVisible = hamburgerBtn ? getComputedStyle(hamburgerBtn).display !== 'none' : false;
        const orderCardCount = document.querySelectorAll('.erp-mobile-order-card').length;

        return {
          scrollWidth: scrollW,
          innerWidth: innerW,
          clientWidth: clientW,
          hasHScroll,
          desktopTableVisible,
          mobileCardsVisible,
          hamburgerVisible,
          orderCardCount
        };
      })()`,
      returnByValue: true
    });

    const data = evalRes.result?.value;
    results.push({ viewport: vp.name, ...data });

    console.log(`\n📱 Viewport ${vp.name}:`);
    console.log(`   scrollWidth: ${data.scrollWidth}px | innerWidth: ${data.innerWidth}px | clientWidth: ${data.clientWidth}px`);
    console.log(`   Horizontal Scroll: ${data.hasHScroll ? '❌ YES (OVERFLOW)' : '✅ NO (ZERO OVERFLOW)'}`);
    console.log(`   Mobile Cards: ${data.mobileCardsVisible ? `✅ Visible (${data.orderCardCount} cards)` : 'Hidden'} | Desktop Table: ${data.desktopTableVisible ? 'Visible' : 'Hidden'}`);
    console.log(`   Hamburger Button: ${data.hamburgerVisible ? '✅ Visible' : 'Hidden'}`);

    if (vp.width <= 430) {
      await captureScreenshot(client, `mobile_view_${vp.width}px.png`);
    } else {
      await captureScreenshot(client, `desktop_view_${vp.width}px.png`);
    }
  }

  // TEST 2: Test Drawer Opening on 360px
  console.log('\n📱 Testing Mobile Navigation Drawer on 360x800...');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 360,
    height: 800,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(300);

  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.header-mobile-menu-btn');
      if (btn) btn.click();
    })()`
  });
  await sleep(600);

  const drawerRes = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const drawer = document.querySelector('.sidebar-drawer.open');
      const backdrop = document.querySelector('.sidebar-backdrop');
      const doc = document.documentElement;
      return {
        drawerOpen: Boolean(drawer),
        backdropVisible: Boolean(backdrop),
        scrollWidth: doc.scrollWidth,
        innerWidth: window.innerWidth,
        hasHScroll: doc.scrollWidth > window.innerWidth
      };
    })()`,
    returnByValue: true
  });
  console.log('   Drawer Open:', drawerRes.result?.value?.drawerOpen ? '✅ Yes' : 'No');
  console.log('   Backdrop Visible:', drawerRes.result?.value?.backdropVisible ? '✅ Yes' : 'No');
  console.log('   Zero H-Scroll with Drawer Open:', !drawerRes.result?.value?.hasHScroll ? '✅ YES' : '❌ NO');
  await captureScreenshot(client, 'mobile_drawer_open_360px.png');

  // Close drawer
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const closeBtn = document.querySelector('.sidebar-mobile-close-btn');
      if (closeBtn) closeBtn.click();
    })()`
  });
  await sleep(400);

  // TEST 3: Switch to Production Module on 360px
  console.log('\n📱 Testing Production ERP Kanban & Mobile Cards on 360x800...');
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      // Find Production menu button or simulate click
      const buttons = Array.from(document.querySelectorAll('button'));
      const prodBtn = buttons.find(b => b.textContent && b.textContent.includes('Production'));
      if (prodBtn) prodBtn.click();
    })()`
  });
  await sleep(1500);

  const prodRes = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const doc = document.documentElement;
      const prodDesktop = document.querySelector('.production-desktop-table');
      const prodMobile = document.querySelector('.production-mobile-cards');
      const kpis = document.querySelector('.kpi-cards-grid');
      const stages = document.querySelector('.journey-stages-container');

      return {
        scrollWidth: doc.scrollWidth,
        innerWidth: window.innerWidth,
        hasHScroll: doc.scrollWidth > window.innerWidth,
        prodDesktopVisible: prodDesktop ? getComputedStyle(prodDesktop).display !== 'none' : false,
        prodMobileVisible: prodMobile ? getComputedStyle(prodMobile).display !== 'none' : false,
        kpiCount: kpis ? kpis.children.length : 0,
        stagesFound: Boolean(stages)
      };
    })()`,
    returnByValue: true
  });
  const pData = prodRes.result?.value;
  console.log(`   scrollWidth: ${pData?.scrollWidth}px | innerWidth: ${pData?.innerWidth}px`);
  console.log(`   Zero H-Scroll in Production ERP: ${!pData?.hasHScroll ? '✅ YES' : '❌ NO'}`);
  console.log(`   Production Mobile Cards: ${pData?.prodMobileVisible ? '✅ Visible' : 'Hidden'} | Desktop Table: ${pData?.prodDesktopVisible ? 'Visible' : 'Hidden'}`);
  console.log(`   KPI Cards Count: ${pData?.kpiCount} | Stages Found: ${pData?.stagesFound ? '✅ Yes' : 'No'}`);
  await captureScreenshot(client, 'production_erp_360px.png');

  client.close();
  chromeProc.kill();

  console.log('\n=========================================');
  console.log('🏁 FINAL RESPONSIVENESS VERIFICATION SUMMARY:');
  const allPassed = results.every(r => !r.hasHScroll) && !drawerRes.result?.value?.hasHScroll && !pData?.hasHScroll;
  console.log(`ALL VIEWPORTS (360px - 430px & Desktop): ${allPassed ? '✅ 100% PASS - ZERO HORIZONTAL OVERFLOW' : '❌ FAIL'}`);
  console.log('=========================================');
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
