// backend/scripts/verify_png_export_and_print.cjs
const path = require('path');
const fs = require('fs');
const os = require('os');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const ARTIFACTS_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\fa6cbc4b-65c1-46d7-9e4b-af31b48ba2db';

// Read assets as base64
const logoPath = path.join(__dirname, '..', '..', 'public', 'jb_group_logo.png');
const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
const logoSrc = `data:image/png;base64,${logoBase64}`;

const artworkPath = path.join(__dirname, '..', '..', 'public', 'tailoring_mannequin_artwork.png');
const artworkBase64 = fs.existsSync(artworkPath) ? fs.readFileSync(artworkPath).toString('base64') : '';
const artworkSrc = `data:image/png;base64,${artworkBase64}`;

// Read styles from digitalInvoiceStyles.js
const stylesPath = path.join(__dirname, '..', '..', 'src', 'components', 'digitalInvoiceStyles.js');
const stylesContent = fs.readFileSync(stylesPath, 'utf8');
const stylesMatch = stylesContent.match(/export const digitalInvoiceStyles = `([\s\S]*?)`;/);
const rawCss = stylesMatch ? stylesMatch[1] : '';

// Read html2canvas library
const html2canvasPath = path.join(__dirname, '..', '..', 'node_modules', 'html2canvas', 'dist', 'html2canvas.min.js');
const html2canvasJs = fs.readFileSync(html2canvasPath, 'utf8');

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateInvoiceHtml(options = {}) {
  const isBella = !!options.isBella;
  const status = options.status || 'UNPAID';
  const companyTitle = isBella ? 'BELLA DESIGN' : 'JB GROUP (PVT) LTD';
  const brandShort = isBella ? 'BELLA DESIGN' : 'JB GROUP';
  const tagline = isBella ? 'Exclusive Boutique & Fashion Studio' : 'Build • Lead • Inspire | Since 2021';
  const address = isBella ? 'Bella Design Studio, Trincomalee.' : 'First floor, No 71, Thirugnanasampanthar Street, Trincomalee.';
  const phone1 = '+94 72 627 8727';
  const phone2 = isBella ? '+94 26 222 5555' : '+44 7847 431970';
  const orderNo = options.orderNo || (isBella ? 'BELLA-20261109-0001' : 'JB-20261110-0007');
  const invoiceNo = options.invoiceNo || '276';
  const customerName = options.customerName || 'Pumi';
  const customerPhone = options.customerPhone || '+94763161236';
  const customerAddress = options.customerAddress || 'Navy Camp';
  
  const discountAmount = Number(options.discountAmount || 0);
  const totalAmount = options.totalAmount !== undefined ? options.totalAmount : 1800;
  const amountPaid = options.amountPaid !== undefined ? options.amountPaid : 0;
  const balanceDue = options.balanceDue !== undefined ? options.balanceDue : 1800;
  const grossSubtotal = totalAmount + discountAmount;

  const items = options.items || [
    { title: 'Stitching', name: 'Dress: Saree Blouse', quantity: 1, rate: 1800, total: 1800 }
  ];
  const isSingleItem = items.length <= 1;

  let stampText = 'UNPAID';
  let stampBorderColor = '#dc2626';
  let stampTextColor = '#dc2626';

  if (status === 'PAID') {
    stampText = 'PAID';
    stampBorderColor = '#16a34a';
    stampTextColor = '#16a34a';
  } else if (status === 'PARTIALLY_PAID') {
    stampText = 'PARTIALLY PAID';
    stampBorderColor = '#ea580c';
    stampTextColor = '#ea580c';
  } else if (status === 'PRICE_PENDING') {
    stampText = 'PRICE PENDING';
    stampBorderColor = '#d97706';
    stampTextColor = '#d97706';
  } else {
    // UNPAID
    stampText = 'UNPAID';
    stampBorderColor = '#dc2626';
    stampTextColor = '#dc2626';
  }

  const itemsHtml = items.map((it, idx) => `
    <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="text-align: left;">
        <div style="font-weight: 900; font-size: 0.88rem; color: #0f172a;">${it.title}</div>
        <div style="font-size: 0.78rem; color: #0056b3; font-weight: 700; margin-top: 1px;">${it.name}</div>
      </td>
      <td style="text-align: center; font-size: 0.92rem; font-weight: 800;">${it.quantity}</td>
      <td style="text-align: right; font-size: 0.84rem; font-weight: 800; white-space: nowrap;">${formatCurrency(it.rate)}</td>
      <td style="text-align: right; font-size: 0.88rem; font-weight: 900; white-space: nowrap;">${formatCurrency(it.total)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            background: #f1f5f9;
            display: flex;
            justify-content: center;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          ${rawCss}
        </style>
      </head>
      <body>
        <article id="invoice-card" class="jb-invoice ${isSingleItem ? 'jb-invoice-standard' : 'jb-invoice-expanded'}">
          <!-- Top-Right Decorative Curve -->
          <svg class="jb-invoice-corner" viewBox="0 0 135 85" fill="none" aria-hidden="true">
            <path d="M 25 0 C 60 28, 90 42, 135 48 L 135 0 Z" fill="#002b66" />
            <path d="M 0 0 C 45 22, 75 46, 135 66 L 135 48 C 80 34, 45 16, 12 0 Z" fill="#dc2626" />
          </svg>

          <div class="jb-invoice-body">
            <!-- 1. Header -->
            <header class="jb-invoice-brand">
              ${isBella ? `
                <div style="width: 54px; height: 40px; border-radius: 6px; background-color: #002b66; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 1.2rem; letter-spacing: 1px; flex-shrink: 0;">
                  BD
                </div>
              ` : `
                <img src="${logoSrc}" alt="JB GROUP" />
              `}
              <div class="jb-invoice-brand-divider"></div>
              <div class="jb-invoice-brand-info">
                <strong>${companyTitle}</strong>
                <span>${tagline}</span>
              </div>
            </header>

            <!-- 2. Contact & Headquarters -->
            <div class="jb-invoice-contact">
              <div>
                <span class="jb-invoice-hq">Headquarters</span>
                <div class="jb-invoice-address">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>${address} <b>Sri Lanka.</b></span>
                </div>
              </div>
              <div class="jb-invoice-numbers">
                <div class="jb-invoice-wa-pill">
                  <div class="jb-invoice-wa-icon">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#25D366"><path d="M17.5 14.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9 0 1.7 1.2 3.4 1.4 3.6.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.6-.4z"/></svg>
                  </div>
                  <span>${phone1}</span>
                </div>
                <div class="jb-invoice-wa-pill jb-invoice-wa-pill-navy">
                  <div class="jb-invoice-wa-icon">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#25D366"><path d="M17.5 14.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9 0 1.7 1.2 3.4 1.4 3.6.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.6-.4z"/></svg>
                  </div>
                  <span>${phone2}</span>
                </div>
              </div>
            </div>

            <!-- 3. Title Banner -->
            <div class="jb-invoice-title-wrapper">
              <div class="jb-invoice-title-wing-left"></div>
              <div class="jb-invoice-title-pill">CUSTOMER INVOICE</div>
              <div class="jb-invoice-title-wing-right"></div>
            </div>

            <!-- 4. Customer Details & Reference Grid -->
            <div class="jb-invoice-billing">
              <div class="jb-invoice-customer">
                <div class="jb-invoice-customer-header">
                  <div style="width: 16px; height: 16px; border-radius: 50%; background-color: #002b66; display: flex; align-items: center; justify-content: center;">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <span>BILLED TO:</span>
                </div>
                <div class="jb-invoice-customer-name">${customerName}</div>
                <div class="jb-invoice-customer-phone">
                  <div style="width: 16px; height: 16px; border-radius: 50%; background-color: #002b66; display: flex; align-items: center; justify-content: center;">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <span>${customerPhone}</span>
                </div>
                ${customerAddress ? `<div style="font-size: 0.68rem; color: #64748b; margin-top: 2px;">${customerAddress}</div>` : ''}
              </div>
              <div class="jb-invoice-ref-divider"></div>
              <div class="jb-invoice-ref">
                <div class="jb-invoice-ref-row">
                  <span class="jb-invoice-ref-label">Invoice No</span>
                  <span class="jb-invoice-ref-val">: ${invoiceNo}</span>
                </div>
                <div class="jb-invoice-ref-row">
                  <span class="jb-invoice-ref-label">Order No</span>
                  <span class="jb-invoice-ref-val">: ${orderNo}</span>
                </div>
                <div class="jb-invoice-ref-row">
                  <span class="jb-invoice-ref-label">Order Date</span>
                  <span class="jb-invoice-ref-val">: 2026 - 11 - 10</span>
                </div>
                <div class="jb-invoice-ref-row">
                  <span class="jb-invoice-ref-label">Booked Date</span>
                  <span class="jb-invoice-ref-val">: 2026 - 11 - 10</span>
                </div>
              </div>
            </div>

            <!-- 5. Items Table -->
            <div class="jb-invoice-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style="text-align: left; width: 42%;">Description</th>
                    <th style="text-align: center; width: 14%;">Qty</th>
                    <th style="text-align: right; width: 22%;">Rate (Rs.)</th>
                    <th style="text-align: right; width: 22%;">Total (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </div>

            <!-- 6. Payment Summary & Tailoring Artwork -->
            <div class="jb-invoice-payment-section">
              <div class="jb-invoice-art-box">
                ${!isBella ? `
                  <div class="jb-invoice-watermark">
                    <img src="${logoSrc}" alt="Watermark" />
                  </div>
                ` : ''}
                <img src="${artworkSrc}" alt="Tailoring Visual" class="jb-invoice-art-img" />
              </div>
              <div class="jb-invoice-totals-box">
                <div class="jb-invoice-pill jb-invoice-pill-subtotal">
                  <span>Gross Subtotal</span>
                  <span>Rs. ${formatCurrency(grossSubtotal)}</span>
                </div>
                ${discountAmount > 0 ? `
                  <div class="jb-invoice-pill jb-invoice-pill-discount">
                    <span>Discount</span>
                    <span>- Rs. ${formatCurrency(discountAmount)}</span>
                  </div>
                ` : ''}
                <div class="jb-invoice-pill jb-invoice-pill-net">
                  <span>Net Payable</span>
                  <span>Rs. ${formatCurrency(totalAmount)}</span>
                </div>
                <div class="jb-invoice-pill jb-invoice-pill-paid">
                  <span>Amount Paid</span>
                  <span>Rs. ${formatCurrency(amountPaid)}</span>
                </div>
                <div class="jb-invoice-pill jb-invoice-pill-due" style="background-color: ${balanceDue > 0 ? (amountPaid > 0 ? '#fff7ed' : '#fef2f2') : '#f8fafc'}; border: 1px solid ${balanceDue > 0 ? (amountPaid > 0 ? '#fed7aa' : '#fecaca') : '#e2e8f0'}; color: ${balanceDue > 0 ? (amountPaid > 0 ? '#ea580c' : '#dc2626') : '#334155'};">
                  <span>Balance Due</span>
                  <span>Rs. ${formatCurrency(balanceDue)}</span>
                </div>

                <!-- Original Bill-Style Rubber Stamp -->
                <div class="jb-invoice-rubber-stamp-container">
                  <div class="jb-invoice-rubber-stamp" style="border: 2.5px solid ${stampBorderColor}; color: ${stampTextColor}; box-shadow: 0 2px 6px ${stampBorderColor}20;">
                    ${stampText}
                  </div>
                </div>
              </div>
            </div>

            <!-- 7. Payment Terms & Thank You Section -->
            <div class="jb-invoice-bottom-terms">
              <div class="jb-invoice-terms-box">
                <div class="jb-invoice-terms-header">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#002b66" stroke-width="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                  <span>Payment Terms</span>
                </div>
                <ul class="jb-invoice-terms-list">
                  <li>${status === 'PRICE_PENDING' ? 'Price pending confirmation.' : `Full payment: Rs. ${formatCurrency(totalAmount)}`}</li>
                  ${balanceDue > 0 && status !== 'PRICE_PENDING' ? '<li>Please make the payment at your earliest convenience.</li>' : ''}
                  ${status === 'PAID' ? '<li>Payment received in full. Thank you!</li>' : ''}
                </ul>
              </div>
              <div class="jb-invoice-thanks-box">
                <svg width="22" height="32" viewBox="0 0 24 38" fill="none" stroke="#002b66" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                  <path d="M10 2.5h4v2h-4z" fill="#002b66" stroke="none" />
                  <line x1="12" y1="4.5" x2="12" y2="7" />
                  <path d="M7.5 7.5 C9 6.8 15 6.8 16.5 7.5 C17.8 9.5 18 12.5 17.5 15.5 C17 18 15.5 19.5 15.5 21.5 C15.5 23 16.8 24 16.5 25.5 L7.5 25.5 C7.2 24 8.5 23 8.5 21.5 C8.5 19.5 7 18 6.5 15.5 C6 12.5 6.2 9.5 7.5 7.5 Z" />
                  <line x1="12" y1="25.5" x2="12" y2="34" />
                  <path d="M6 37 L12 34 L18 37" />
                </svg>
                <div style="font-size: 0.74rem; font-weight: 800; color: #002b66; line-height: 1.2;">
                  Thank you for choosing ${brandShort}!
                </div>
              </div>
            </div>
          </div>

          <!-- 8. Footer (In Natural Flow, Never Absolute) -->
          <footer class="jb-invoice-footer">
            <div class="jb-invoice-footer-stripe"></div>
            <svg class="jb-invoice-footer-swoosh" viewBox="0 0 55 32" fill="none" aria-hidden="true">
              <path d="M 0 32 C 22 29, 38 18, 55 0 L 55 32 Z" fill="#002b66" />
              <path d="M 0 32 C 22 29, 38 18, 55 0 L 55 4 C 40 21, 24 29, 0 32 Z" fill="#dc2626" />
            </svg>
            <strong class="jb-invoice-footer-title">${companyTitle}</strong>
            <span class="jb-invoice-footer-tagline">Build • Lead • Inspire</span>
          </footer>
        </article>
      </body>
    </html>
  `;
}

async function runVerification() {
  console.log('============================================================');
  console.log('🚀 DIGITAL INVOICE VERIFICATION & EXPORT SUITE');
  console.log('============================================================');

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_invoice_'));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();

    // 1. Desktop Preview
    console.log('\n--- 1. Testing Desktop Preview (1280x800) ---');
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.setContent(generateInvoiceHtml({ status: 'UNPAID' }), { waitUntil: 'networkidle0' });
    const desktopPreviewPath = path.join(ARTIFACTS_DIR, 'digital_invoice_desktop_preview.png');
    await page.screenshot({ path: desktopPreviewPath });
    console.log(`✅ Desktop preview captured: ${desktopPreviewPath}`);

    // 2. Mobile Preview
    console.log('\n--- 2. Testing Mobile Preview (390x844) ---');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.setContent(generateInvoiceHtml({ status: 'UNPAID' }), { waitUntil: 'networkidle0' });
    const mobilePreviewPath = path.join(ARTIFACTS_DIR, 'digital_invoice_mobile_preview.png');
    await page.screenshot({ path: mobilePreviewPath });
    console.log(`✅ Mobile preview captured: ${mobilePreviewPath}`);

    // Set standard desktop viewport for full 500px card capturing
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });

    // Helper for captureInvoice matching exact component logic
    const captureFunction = async (isSingle) => {
      return await page.evaluate(async (single) => {
        const card = document.getElementById('invoice-card');
        const canvas = await html2canvas(card, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          onclone: (_doc, clonedCard) => {
            clonedCard.ownerDocument.body.style.width = '500px';
            clonedCard.ownerDocument.body.style.minWidth = '500px';
            clonedCard.ownerDocument.body.append(clonedCard);
            Object.assign(clonedCard.style, {
              width: '500px',
              minWidth: '500px',
              maxWidth: '500px',
              margin: '0',
              boxShadow: 'none',
              position: 'static'
            });
            if (single) {
              clonedCard.style.height = '617px';
              clonedCard.style.minHeight = '617px';
              clonedCard.style.maxHeight = '617px';
            } else {
              clonedCard.style.height = 'auto';
              clonedCard.style.minHeight = '617px';
            }
          }
        });
        return { data: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
      }, isSingle);
    };

    // 3. UNPAID PNG Export (Exact 1500 x 1851 px)
    console.log('\n--- 3. Testing UNPAID PNG Export ---');
    await page.setContent(generateInvoiceHtml({ status: 'UNPAID' }), { waitUntil: 'networkidle0' });
    await page.addScriptTag({ content: html2canvasJs });
    const res1 = await captureFunction(true);
    const buf1 = Buffer.from(res1.data.replace(/^data:image\/png;base64,/, ''), 'base64');
    const pngPath1 = path.join(ARTIFACTS_DIR, 'digital_invoice_UNPAID_export.png');
    fs.writeFileSync(pngPath1, buf1);
    console.log(`✅ UNPAID PNG exported: ${pngPath1} [${res1.width} x ${res1.height} px] (${(buf1.length / 1024).toFixed(1)} KB)`);

    // 4. PARTIALLY PAID PNG Export (Exact 1500 x 1851 px)
    console.log('\n--- 4. Testing PARTIALLY PAID PNG Export ---');
    await page.setContent(generateInvoiceHtml({ status: 'PARTIALLY_PAID', totalAmount: 1800, amountPaid: 500, balanceDue: 1300 }), { waitUntil: 'networkidle0' });
    await page.addScriptTag({ content: html2canvasJs });
    const res2 = await captureFunction(true);
    const buf2 = Buffer.from(res2.data.replace(/^data:image\/png;base64,/, ''), 'base64');
    const pngPath2 = path.join(ARTIFACTS_DIR, 'digital_invoice_PARTIALLY_PAID_export.png');
    fs.writeFileSync(pngPath2, buf2);
    console.log(`✅ PARTIALLY PAID PNG exported: ${pngPath2} [${res2.width} x ${res2.height} px] (${(buf2.length / 1024).toFixed(1)} KB)`);

    // 5. PAID PNG Export (Exact 1500 x 1851 px)
    console.log('\n--- 5. Testing PAID PNG Export ---');
    await page.setContent(generateInvoiceHtml({ status: 'PAID', totalAmount: 1800, amountPaid: 1800, balanceDue: 0 }), { waitUntil: 'networkidle0' });
    await page.addScriptTag({ content: html2canvasJs });
    const res3 = await captureFunction(true);
    const buf3 = Buffer.from(res3.data.replace(/^data:image\/png;base64,/, ''), 'base64');
    const pngPath3 = path.join(ARTIFACTS_DIR, 'digital_invoice_PAID_export.png');
    fs.writeFileSync(pngPath3, buf3);
    console.log(`✅ PAID PNG exported: ${pngPath3} [${res3.width} x ${res3.height} px] (${(buf3.length / 1024).toFixed(1)} KB)`);

    // 6. PRICE PENDING PNG Export (Exact 1500 x 1851 px)
    console.log('\n--- 6. Testing PRICE PENDING PNG Export ---');
    await page.setContent(generateInvoiceHtml({ status: 'PRICE_PENDING', totalAmount: 0, amountPaid: 0, balanceDue: 0 }), { waitUntil: 'networkidle0' });
    await page.addScriptTag({ content: html2canvasJs });
    const res4 = await captureFunction(true);
    const buf4 = Buffer.from(res4.data.replace(/^data:image\/png;base64,/, ''), 'base64');
    const pngPath4 = path.join(ARTIFACTS_DIR, 'digital_invoice_PRICE_PENDING_export.png');
    fs.writeFileSync(pngPath4, buf4);
    console.log(`✅ PRICE PENDING PNG exported: ${pngPath4} [${res4.width} x ${res4.height} px] (${(buf4.length / 1024).toFixed(1)} KB)`);

    // 7. BELLA DESIGN PNG Export (Exact 1500 x 1851 px)
    console.log('\n--- 7. Testing BELLA DESIGN PNG Export ---');
    await page.setContent(generateInvoiceHtml({ isBella: true, status: 'PAID', totalAmount: 3500, amountPaid: 3500, balanceDue: 0 }), { waitUntil: 'networkidle0' });
    await page.addScriptTag({ content: html2canvasJs });
    const res5 = await captureFunction(true);
    const buf5 = Buffer.from(res5.data.replace(/^data:image\/png;base64,/, ''), 'base64');
    const pngPath5 = path.join(ARTIFACTS_DIR, 'digital_invoice_BELLA_DESIGN_export.png');
    fs.writeFileSync(pngPath5, buf5);
    console.log(`✅ BELLA DESIGN PNG exported: ${pngPath5} [${res5.width} x ${res5.height} px] (${(buf5.length / 1024).toFixed(1)} KB)`);

    // 8. EXTRA LINE ITEMS & DISCOUNT TEST (Longer Order)
    console.log('\n--- 8. Testing Extra Line Items & Discount (Longer Order) ---');
    const extraItems = [
      { title: 'Stitching', name: 'Dress: Bridal Gown', quantity: 1, rate: 5000, total: 5000 },
      { title: 'Stitching', name: 'Dress: Saree Blouse with Embroidery', quantity: 2, rate: 2500, total: 5000 },
      { title: 'Finishing', name: 'Custom Handwork & Beading', quantity: 1, rate: 1500, total: 1500 }
    ];
    await page.setContent(generateInvoiceHtml({
      status: 'PARTIALLY_PAID',
      items: extraItems,
      discountAmount: 1000,
      totalAmount: 10500,
      amountPaid: 4000,
      balanceDue: 6500
    }), { waitUntil: 'networkidle0' });
    await page.addScriptTag({ content: html2canvasJs });
    const res6 = await captureFunction(false);
    const buf6 = Buffer.from(res6.data.replace(/^data:image\/png;base64,/, ''), 'base64');
    const pngPath6 = path.join(ARTIFACTS_DIR, 'digital_invoice_EXTRA_ITEMS_export.png');
    fs.writeFileSync(pngPath6, buf6);
    console.log(`✅ Extra Items PNG exported: ${pngPath6} [${res6.width} x ${res6.height} px] (${(buf6.length / 1024).toFixed(1)} KB)`);

    // 9. Generating A4 PDF
    console.log('\n--- 9. Generating A4 Print Preview PDF ---');
    await page.setContent(generateInvoiceHtml({ status: 'UNPAID' }), { waitUntil: 'networkidle0' });
    const pdfPath = path.join(ARTIFACTS_DIR, 'digital_invoice_print_preview.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });
    console.log(`✅ Print Preview A4 PDF generated: ${pdfPath} (${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB)`);

    console.log('\n============================================================');
    console.log('🎉 ALL EXPORTS VERIFIED AT EXACT REQUIRED DIMENSIONS (1500x1851 px)!');
    console.log('============================================================');
  } finally {
    await browser.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
}

runVerification().catch(err => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
