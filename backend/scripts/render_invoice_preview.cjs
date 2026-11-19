const path = require('path');
const fs = require('fs');
const os = require('os');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const ARTIFACTS_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\fa6cbc4b-65c1-46d7-9e4b-af31b48ba2db';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pup_inv_'));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir: tmpDir,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--remote-debugging-port=0'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

  // Read the logo file
  const logoPath = path.join(__dirname, '..', '..', 'public', 'jb_group_logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
  const logoSrc = `data:image/png;base64,${logoBase64}`;

  // Complete HTML template mirroring DigitalInvoiceModal.jsx
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background-color: #f1f5f9;
        display: flex;
        justifyContent: center;
        align-items: center;
        min-height: 100vh;
        padding: 30px;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      .invoice-receipt-card {
        width: 100%;
        max-width: 480px;
        background-color: #ffffff;
        border-radius: 16px;
        padding: 24px 22px 20px 22px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
        border: 1.5px solid #93c5fd;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #0f172a;
        position: relative;
        overflow: hidden;
        isolation: isolate;
      }
      .whatsapp-pill {
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        gap: 6px;
        background-color: #0a2558;
        border-radius: 9999px;
        padding: 3px 10px 3px 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
        white-space: nowrap;
        flex-shrink: 0;
      }
    </style>
  </head>
  <body>
    <div class="invoice-receipt-card">
      <!-- Watermark -->
      <div style="position: absolute; top: 52%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; opacity: 0.13; z-index: 0; width: 310px; user-select: none;">
        <img src="${logoSrc}" alt="Watermark" style="width: 100%; height: auto; display: block;" />
      </div>

      <!-- 1. TOP HEADER & STAMP -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; position: relative; z-index: 1; width: 100%;">
        <!-- Left Column -->
        <div style="display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0;">
          <div style="display: flex; align-items: flex-start;">
            <img src="${logoSrc}" alt="JB GROUP" style="height: 52px; width: auto; object-fit: contain; flex-shrink: 0;" />
            <div style="width: 1.5px; height: 56px; background-color: #0a2558; margin: 0 8px; flex-shrink: 0;"></div>
            <div style="display: flex; flex-direction: column;">
              <div style="margin-bottom: 2px;">
                <span style="background-color: #0a2558; color: #ffffff; font-size: 0.68rem; font-weight: 700; padding: 2px 9px; border-radius: 9999px; display: inline-block;">
                  Headquarters
                </span>
              </div>
              <div style="font-size: 0.93rem; font-weight: 900; color: #0a2558; letter-spacing: 0.1px; line-height: 1.2; margin-bottom: 3px; white-space: nowrap;">
                JB GROUP (PVT) LTD
              </div>
              <div style="display: flex; align-items: flex-start; gap: 4px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#dc2626" stroke="#dc2626" style="flex-shrink: 0; margin-top: 2px;">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
                </svg>
                <div style="font-size: 0.74rem; color: #0f172a; line-height: 1.3;">
                  <div>First floor, No 71,</div>
                  <div>Thirugnanasampanthar Street,</div>
                  <div>Trincomalee. <span style="font-weight: 800; color: #0a2558;">Sri Lanka.</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Vertical Divider -->
        <div style="width: 1px; background-color: #bfdbfe; margin: 0 8px; align-self: stretch; flex-shrink: 0;"></div>

        <!-- Right Column -->
        <div style="display: flex; flex-direction: column; align-items: flex-end; flex: 0 0 auto; min-width: fit-content; gap: 8px;">
          <!-- Stamp -->
          <div style="border: 2.5px solid #dc2626; border-radius: 6px; padding: 3px 12px; transform: rotate(-6deg); background-color: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.04); text-align: center; margin-right: 2px;">
            <div style="color: #dc2626; font-weight: 900; font-size: 0.92rem; letter-spacing: 0.8px; line-height: 1.12;">
              <div>BALANCE</div>
              <div>DUE</div>
            </div>
          </div>

          <!-- WhatsApp Pills -->
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px; width: 100%;">
            <div class="whatsapp-pill">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0; display: block;">
                <circle cx="12" cy="12" r="11" fill="#25D366" />
                <path d="M17.5 14.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9 0 1.7 1.2 3.4 1.4 3.6.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.6-.4z" fill="#ffffff" />
              </svg>
              <span style="color: #ffffff; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.25px; white-space: nowrap; line-height: 1.2; font-variant-numeric: tabular-nums;">
                +94 72 627 8727
              </span>
            </div>

            <div class="whatsapp-pill">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0; display: block;">
                <circle cx="12" cy="12" r="11" fill="#25D366" />
                <path d="M17.5 14.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9 0 1.7 1.2 3.4 1.4 3.6.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.6-.4z" fill="#ffffff" />
              </svg>
              <span style="color: #ffffff; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.25px; white-space: nowrap; line-height: 1.2; font-variant-numeric: tabular-nums;">
                +44 7847 431970
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Red Accent Swoosh -->
      <div style="margin: 10px 0 6px 0; width: 100%;">
        <svg width="100%" height="8" viewBox="0 0 440 8" fill="none" style="display: block;">
          <path d="M 4 2 C 120 7, 280 8, 436 2" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" />
        </svg>
      </div>

      <!-- Divider 1 -->
      <div style="height: 1px; background-color: #93c5fd; margin: 6px 0 16px 0; position: relative; z-index: 1;"></div>

      <!-- 2. BILLED TO & INVOICE REFERENCE -->
      <div style="display: flex; justify-content: space-between; align-items: stretch; margin-bottom: 16px; font-size: 0.85rem; position: relative; z-index: 1;">
        <!-- Left Column -->
        <div style="flex: 1 1 auto; min-width: 0; padding-right: 8px;">
          <div style="font-size: 0.82rem; font-weight: 900; color: #0a2558; letter-spacing: 0.5px;">BILLED TO:</div>
          <div style="font-weight: 800; font-size: 1.22rem; color: #0f172a; margin-top: 3px; line-height: 1.2;">Vijitha</div>
          <div style="color: #0f172a; font-size: 0.94rem; font-weight: 600; margin-top: 3px; font-variant-numeric: tabular-nums;">+94759737340</div>
        </div>

        <!-- Vertical Divider -->
        <div style="width: 1px; background-color: #93c5fd; margin: 0 12px; align-self: stretch; flex-shrink: 0;"></div>

        <!-- Right Column -->
        <div style="flex: 0 0 auto; text-align: right; min-width: fit-content;">
          <div style="font-size: 0.82rem; font-weight: 900; color: #0a2558; letter-spacing: 0.5px;">INVOICE REFERENCE:</div>
          <div style="color: #0f172a; font-size: 0.92rem; margin-top: 3px;">Order No: <strong style="font-weight: 800; font-variant-numeric: tabular-nums;">JB-20261107-0003</strong></div>
          <div style="color: #0f172a; font-size: 0.98rem; margin-top: 2px;">Bill No: <strong style="font-weight: 900; font-size: 1.08rem; font-variant-numeric: tabular-nums;">255</strong></div>
          <div style="color: #0f172a; font-size: 0.88rem; margin-top: 2px; font-variant-numeric: tabular-nums;">Booked: 2026-11-07</div>
        </div>
      </div>

      <!-- 3. ITEMS TABLE -->
      <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 14px; position: relative; z-index: 1;">
        <thead>
          <tr style="border-top: 1px solid #93c5fd; border-bottom: 1px solid #93c5fd;">
            <th style="text-align: left; padding: 8px 4px; font-size: 0.95rem; font-weight: 800; color: #0a2558; width: 40%;">Description</th>
            <th style="text-align: center; padding: 8px 4px; font-size: 0.95rem; font-weight: 800; color: #0a2558; width: 18%;">Qty</th>
            <th style="text-align: right; padding: 8px 4px; font-size: 0.95rem; font-weight: 800; color: #0a2558; width: 20%;">Rate</th>
            <th style="text-align: right; padding: 8px 4px; font-size: 0.95rem; font-weight: 800; color: #0a2558; width: 22%;">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #93c5fd;">
            <td style="padding: 12px 4px; vertical-align: top;">
              <div style="font-weight: 800; font-size: 1.02rem; color: #0f172a;">Stitching</div>
              <div style="font-size: 0.88rem; color: #1d4ed8; font-weight: 600; margin-top: 2px;">Dress: Other</div>
            </td>
            <td style="text-align: center; padding: 12px 4px; font-size: 1.02rem; font-weight: 700; color: #0f172a; vertical-align: middle; font-variant-numeric: tabular-nums;">1</td>
            <td style="text-align: right; padding: 12px 4px; font-size: 0.92rem; font-weight: 700; color: #0f172a; vertical-align: middle;">
              <div style="line-height: 1.2;">
                <div>Rs.</div>
                <div style="font-variant-numeric: tabular-nums;">300.00</div>
              </div>
            </td>
            <td style="text-align: right; padding: 12px 4px; font-size: 1.05rem; font-weight: 800; color: #0f172a; vertical-align: middle; font-variant-numeric: tabular-nums;">Rs. 300.00</td>
          </tr>
        </tbody>
      </table>

      <!-- 4. TOTALS BLOCK -->
      <div style="display: flex; flex-direction: column; align-items: flex-end; position: relative; z-index: 1; margin-bottom: 18px;">
        <div style="width: 250px; display: flex; justify-content: space-between; font-size: 0.96rem; color: #0a2558; font-weight: 700; margin-bottom: 6px;">
          <span>Gross Subtotal:</span>
          <span style="font-variant-numeric: tabular-nums;">Rs. 300.00</span>
        </div>
        <div style="width: 250px; display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 900; color: #0f172a; margin-bottom: 6px;">
          <span>Net Payable:</span>
          <span style="font-variant-numeric: tabular-nums;">Rs. 300.00</span>
        </div>
        <div style="width: 250px; display: flex; justify-content: space-between; font-size: 1.05rem; font-weight: 800; color: #16a34a; margin-bottom: 6px;">
          <span>Amount Paid:</span>
          <span style="font-variant-numeric: tabular-nums;">Rs. 0.00</span>
        </div>
        <div style="width: 250px; display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 900; color: #dc2626;">
          <span>Balance Due:</span>
          <span style="font-variant-numeric: tabular-nums;">Rs. 300.00</span>
        </div>
      </div>

      <!-- 5. FOOTER GUARANTEE -->
      <div style="border-top: 1px solid #93c5fd; padding-top: 14px; text-align: center; font-size: 0.88rem; color: #0a2558; font-style: italic; font-weight: 500; position: relative; z-index: 1;">
        Fits guaranteed for 30 days. Thank you for choosing us!
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });

  const cardElement = await page.$('.invoice-receipt-card');
  const screenshotPath = path.join(ARTIFACTS_DIR, 'jb_invoice_preview_rendered.png');
  await cardElement.screenshot({ path: screenshotPath, omitBackground: false });
  console.log(`✓ Invoice preview screenshot saved to: ${screenshotPath}`);

  // Also generate crisp A4 PDF
  const pdfPath = path.join(ARTIFACTS_DIR, 'JB_GROUP_Invoice_A4_Verified.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
  });
  console.log(`✓ Invoice A4 PDF saved to: ${pdfPath}`);

  await browser.close();
}

main().catch(console.error);
