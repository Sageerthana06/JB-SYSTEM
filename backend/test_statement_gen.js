const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const sampleExpenses = [
  {
    id: 1,
    expenseNumber: 'EXP-2026-0001',
    title: 'Uruththiradevi November Salary',
    category: 'STAFF_SALARY',
    branchId: 1,
    branch: { id: 1, name: 'JB Group (Main)' },
    totalAmount: 45000.00,
    paidAmount: 45000.00,
    pendingAmount: 0.00,
    expenseDate: new Date('2026-11-15'),
    paidTo: 'Uruththiradevi',
    status: 'PAID'
  },
  {
    id: 2,
    expenseNumber: 'EXP-2026-0002',
    title: 'Kamalraj November Salary',
    category: 'STAFF_SALARY',
    branchId: 1,
    branch: { id: 1, name: 'JB Group (Main)' },
    totalAmount: 38725.00,
    paidAmount: 38725.00,
    pendingAmount: 0.00,
    expenseDate: new Date('2026-11-14'),
    paidTo: 'Kamalraj',
    status: 'PAID'
  },
  {
    id: 3,
    expenseNumber: 'EXP-2026-0003',
    title: 'Nirosha November Salary',
    category: 'STAFF_SALARY',
    branchId: 2,
    branch: { id: 2, name: 'Bella Design' },
    totalAmount: 20000.00,
    paidAmount: 20000.00,
    pendingAmount: 0.00,
    expenseDate: new Date('2026-11-10'),
    paidTo: 'Nirosha',
    status: 'PAID'
  }
];

function buildStatementDoc(expenses, outPath, categoryTitle = 'Staff Salary Expenses', branchLabel = 'All Branches (Consolidated)') {
  // A4 Landscape: width = 841.89, height = 595.28
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 35, autoFirstPage: true });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 35;
  const contentWidth = pageWidth - margin * 2; // 771.89

  // Header Banner
  doc.rect(margin, margin, contentWidth, 54).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('JB GROUP ENTERPRISE — EXPENSE STATEMENT', margin + 15, margin + 10);
  doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text(
    `Category: ${categoryTitle}  |  Branch: ${branchLabel}  |  Generated: ${new Date().toLocaleString('en-GB')}`,
    margin + 15,
    margin + 32
  );

  // Compute Totals
  const totalIncurred = expenses.reduce((acc, e) => acc + Number(e.totalAmount || 0), 0);
  const totalPaid = expenses.reduce((acc, e) => acc + Number(e.paidAmount || 0), 0);
  const totalPending = expenses.reduce((acc, e) => acc + Number(e.pendingAmount || 0), 0);

  // KPI Summary Bar
  let curY = margin + 62;
  doc.rect(margin, curY, contentWidth, 38).fill('#f8fafc');
  doc.rect(margin, curY, contentWidth, 38).stroke('#cbd5e1');

  const kpiWidth = contentWidth / 4;
  const renderKpi = (label, val, col, x) => {
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text(label.toUpperCase(), x, curY + 7, { width: kpiWidth, align: 'center' });
    doc.fillColor(col).fontSize(11).font('Helvetica-Bold').text(val, x, curY + 19, { width: kpiWidth, align: 'center' });
  };

  renderKpi('Total Records', `${expenses.length} Vouchers`, '#0f172a', margin);
  renderKpi('Total Incurred', `LKR ${totalIncurred.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '#0f172a', margin + kpiWidth);
  renderKpi('Total Paid', `LKR ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '#15803d', margin + kpiWidth * 2);
  renderKpi('Total Pending', `LKR ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, totalPending > 0 ? '#ea580c' : '#64748b', margin + kpiWidth * 3);

  // Table Setup
  curY += 46;
  const cols = [
    { label: 'VOUCHER #', width: 90, align: 'left' },
    { label: 'DATE', width: 65, align: 'left' },
    { label: 'BRANCH', width: 95, align: 'left' },
    { label: 'EXPENSE TITLE & PARTICULARS', width: 200, align: 'left' },
    { label: 'PAID TO', width: 95, align: 'left' },
    { label: 'TOTAL (LKR)', width: 75, align: 'right' },
    { label: 'PAID (LKR)', width: 75, align: 'right' },
    { label: 'PENDING', width: 75, align: 'right' }
  ];

  const drawTableHeader = (y) => {
    doc.rect(margin, y, contentWidth, 20).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    let xOffset = margin + 6;
    cols.forEach(c => {
      doc.text(c.label, xOffset, y + 6, { width: c.width, align: c.align });
      xOffset += c.width;
    });
  };

  drawTableHeader(curY);
  curY += 20;

  expenses.forEach((e, idx) => {
    // Check if new page needed
    if (curY > pageHeight - margin - 50) {
      doc.addPage();
      curY = margin;
      drawTableHeader(curY);
      curY += 20;
    }

    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    doc.rect(margin, curY, contentWidth, 20).fill(rowBg);
    doc.rect(margin, curY, contentWidth, 20).stroke('#e2e8f0');

    doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica');
    let xOffset = margin + 6;

    // Voucher Number
    doc.font('Helvetica-Bold').text(e.expenseNumber, xOffset, curY + 6, { width: cols[0].width });
    xOffset += cols[0].width;

    // Date
    doc.font('Helvetica').text(new Date(e.expenseDate).toLocaleDateString('en-GB'), xOffset, curY + 6, { width: cols[1].width });
    xOffset += cols[1].width;

    // Branch
    const bName = e.branch?.name || (e.branchId === 1 ? 'JB Group (Main)' : 'Bella Design');
    doc.text(bName, xOffset, curY + 6, { width: cols[2].width });
    xOffset += cols[2].width;

    // Title
    doc.text(e.title || '—', xOffset, curY + 6, { width: cols[3].width, lineBreak: false });
    xOffset += cols[3].width;

    // Paid To
    doc.text(e.paidTo || '—', xOffset, curY + 6, { width: cols[4].width });
    xOffset += cols[4].width;

    // Total
    doc.font('Helvetica-Bold').text(Number(e.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }), xOffset, curY + 6, { width: cols[5].width, align: 'right' });
    xOffset += cols[5].width;

    // Paid
    doc.fillColor('#15803d').text(Number(e.paidAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }), xOffset, curY + 6, { width: cols[6].width, align: 'right' });
    xOffset += cols[6].width;

    // Pending
    const pCol = Number(e.pendingAmount) > 0 ? '#ea580c' : '#64748b';
    doc.fillColor(pCol).text(Number(e.pendingAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }), xOffset, curY + 6, { width: cols[7].width, align: 'right' });

    curY += 20;
  });

  // Totals Row
  doc.rect(margin, curY, contentWidth, 22).fill('#e2e8f0');
  doc.rect(margin, curY, contentWidth, 22).stroke('#94a3b8');
  doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
  doc.text('STATEMENT TOTALS:', margin + 10, curY + 7);

  let xOffset = margin + 6 + cols[0].width + cols[1].width + cols[2].width + cols[3].width + cols[4].width;
  doc.text(totalIncurred.toLocaleString('en-US', { minimumFractionDigits: 2 }), xOffset, curY + 7, { width: cols[5].width, align: 'right' });
  xOffset += cols[5].width;
  doc.fillColor('#15803d').text(totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 }), xOffset, curY + 7, { width: cols[6].width, align: 'right' });
  xOffset += cols[6].width;
  doc.fillColor(totalPending > 0 ? '#ea580c' : '#0f172a').text(totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 }), xOffset, curY + 7, { width: cols[7].width, align: 'right' });

  // Signatures on landscape
  curY = Math.min(curY + 35, pageHeight - margin - 40);
  const sWidth = 160;
  const sGap = (contentWidth - sWidth * 3) / 2;
  const sigs = [
    { title: 'PREPARED BY', sub: 'Accounts / Disbursement Officer' },
    { title: 'VERIFIED BY', sub: 'Branch Manager / Audit' },
    { title: 'APPROVED BY', sub: 'CEO / Managing Director' }
  ];

  sigs.forEach((s, i) => {
    const sx = margin + i * (sWidth + sGap);
    doc.strokeColor('#94a3b8').lineWidth(1).moveTo(sx, curY).lineTo(sx + sWidth, curY).stroke();
    doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(s.title, sx, curY + 5, { width: sWidth, align: 'center' });
    doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(s.sub, sx, curY + 15, { width: sWidth, align: 'center' });
  });

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

const out = path.join(__dirname, 'test_statement.pdf');
buildStatementDoc(sampleExpenses, out).then(() => {
  console.log('Landscape statement generated at:', out, 'size:', fs.statSync(out).size);
});
