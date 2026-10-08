import { spawn } from 'child_process';
import http from 'http';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:5173';
const DEBUG_PORT = 9226;

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
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('[Browser Console]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
        } else if (msg.method === 'Runtime.exceptionThrown') {
          console.error('[Browser Exception]', msg.params.exceptionDetails?.text, msg.params.exceptionDetails?.exception?.description);
        } else if (msg.id && this.pending.has(msg.id)) {
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

async function run() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@jbgroup.com', password: 'Manager@Bella2026' })
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data?.token || loginJson.token;
  const user = loginJson.data?.user || loginJson.user;
  console.log('✓ Manager credentials ready:', user.name);

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

  await client.send('Runtime.enable');
  await client.send('Page.enable');

  await sleep(1000);
  console.log('Setting localStorage...');
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem('jb_token', '${token}');
      localStorage.setItem('jb_user', JSON.stringify(${JSON.stringify(user)}));
      location.reload();
    })()`
  });

  await sleep(2000);

  const directFetch = await client.send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        const token = localStorage.getItem('jb_token');
        const res = await fetch('http://localhost:5000/api/orders', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        return { ok: res.ok, status: res.status, success: data.success, orderCount: data.orders?.length };
      } catch (e) {
        return { error: e.message };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Direct browser fetch:', directFetch.result?.value);

  const reactState = await client.send('Runtime.evaluate', {
    expression: `(() => {
      return {
        hash: window.location.hash,
        pathname: window.location.pathname,
        tokenInStorage: !!localStorage.getItem('jb_token'),
        userInStorage: localStorage.getItem('jb_user'),
        bodySnippets: document.body.innerText.split('\\n').filter(s => s.trim().length > 0).slice(0, 15)
      };
    })()`,
    returnByValue: true
  });
  console.log('Browser React State:', reactState.result?.value);

  client.close();
  chromeProcess.kill();
  process.exit(0);
}

run().catch(console.error);
