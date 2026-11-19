const fs = require('fs');
const path = require('path');
const PDFDocument = require(require.resolve('pdfkit', { paths: [path.join(process.cwd(), 'backend')] }));

const sampleExpense = {
  id: 1,
  expenseNumber: 'EXP-2026-0001',
  title: 'Uruththiradevi November Salary',
  category: 'STAFF_SALARY',
  branchId: 1,
  branch: { id: 1, name: 'JB Group (Main)' },
  totalAmount: 45000.00,
  paidAmount: 45000.00,
  pendingAmount: 0.00,
  dueDate: new Date('2026-11-20'),
  expenseDate: new Date('2026-11-15'),
  paymentMethod: 'CASH',
  paidBy: 'Jeyatheepan Joseph (CEO)',
  paidTo: 'Uruththiradevi (Staff)',
  description: 'Monthly administrative staff salary disbursement for November 2026',
  notes: 'Approved by CEO. Cash handed over in person.',
  status: 'PAID',
  approvalStatus: 'APPROVED',
  approvedByName: 'Jeyatheepan Joseph (CEO)',
  createdByName: 'Jeyatheepan Joseph (CEO)',
  isRecurring: true,
  billingMonth: '2026-11',
  payments: [
    {
      paymentNumber: 'EXPP-2026-0001',
      amount: 45000.00,
      paymentDate: new Date('2026-11-15T10:30:00Z'),
      paymentMethod: 'CASH',
      paidBy: 'Jeyatheepan Joseph',
      paidTo: 'Uruththiradevi',
      notes: 'Full settlement paid on time'
    }
  ]
};

function buildVoucherDoc(expense, outPath) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const primaryColor = '#0f172a';
  const accentColor = '#dc2626';
  const borderColor = '#cbd5e1';
  const tableBg = '#f8fafc';

  // Company Branch Name
  const branchName = expense.branchId === 2 ? 'BELLA DESIGN (PVT) LTD' : 'JB GROUP (PVT) LTD';
  const branchSubtitle = expense.branchId === 2 ? 'Exclusive Atelier & Design Studio' : 'Main Showroom & Executive Operations';
  const branchAddress = expense.branchId === 2 
    ? 'Branch 2 — Commercial Hub, Sri Lanka | Contact: +94 77 123 4568'
    : 'Branch 1 — Main Street, Colombo / Jaffna, Sri Lanka | Contact: +94 77 123 4567';

  // Header Bar
  doc.rect(40, 40, 515, 60).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text(branchName, 55, 48);
  doc.fontSize(8.5).font('Helvetica').fillColor('#cbd5e1').text(branchSubtitle, 55, 68);
  doc.text(branchAddress, 55, 80);

  // Voucher Title & Badge
  doc.rect(40, 105, 515, 34).fill(tableBg);
  doc.rect(40, 105, 515, 34).stroke(borderColor);
  doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold').text('PAYMENT & EXPENSE VOUCHER', 55, 114);

  // Status Badge
  const statusColors = {
    PAID: { bg: '#dcfce7', text: '#15803d' },
    PARTIALLY_PAID: { bg: '#fef3c7', text: '#b45309' },
    PENDING: { bg: '#ffedd5', text: '#c2410c' },
    OVERDUE: { bg: '#fee2e2', text: '#b91c1c' }
  };
  const sc = statusColors[expense.status] || { bg: '#f1f5f9', text: '#475569' };
  doc.roundedRect(455, 112, 85, 20, 4).fill(sc.bg);
  doc.fillColor(sc.text).fontSize(9).font('Helvetica-Bold').text(expense.status.replace('_', ' '), 455, 117, { width: 85, align: 'center' });

  // Metadata Card
  doc.rect(40, 145, 515, 100).fill('#ffffff');
  doc.rect(40, 145, 515, 100).stroke(borderColor);

  const metaLeft = 55;
  const metaCol2 = 300;
  let curY = 155;

  const renderField = (label, val, x, y) => {
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text(label.toUpperCase(), x, y);
    doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica').text(val || '—', x, y + 10);
  };

  renderField('Voucher Number', expense.expenseNumber, metaLeft, curY);
  renderField('Branch / Unit', expense.branch?.name || (expense.branchId === 1 ? 'JB Group (Main)' : 'Bella Design'), metaCol2, curY);

  curY += 28;
  renderField('Category', expense.category.replace(/_/g, ' '), metaLeft, curY);
  renderField('Payment Method', expense.paymentMethod || 'CASH', metaCol2, curY);

  curY += 28;
  renderField('Expense / Voucher Date', new Date(expense.expenseDate).toLocaleDateString('en-GB'), metaLeft, curY);
  renderField('Due Date', expense.dueDate ? new Date(expense.dueDate).toLocaleDateString('en-GB') : 'Immediate', metaCol2, curY);

  // Payee & Beneficiary Card
  curY = 255;
  doc.rect(40, curY, 515, 48).fill(tableBg);
  doc.rect(40, curY, 515, 48).stroke(borderColor);

  renderField('Paid To (Beneficiary / Vendor)', expense.paidTo || 'N/A', metaLeft, curY + 8);
  renderField('Disbursed By (Cashier / Officer)', expense.paidBy || expense.createdByName || 'N/A', metaCol2, curY + 8);

  // Particulars / Description
  curY = 312;
  doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('PARTICULARS & DISBURSEMENT DETAILS', 40, curY);
  curY += 16;
  doc.rect(40, curY, 515, 55).fill('#ffffff');
  doc.rect(40, curY, 515, 55).stroke(borderColor);

  doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(expense.title, 50, curY + 8);
  if (expense.description) {
    doc.fillColor('#475569').fontSize(8.5).font('Helvetica').text(expense.description, 50, curY + 22, { width: 495 });
  }
  if (expense.notes) {
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique').text(`Notes: ${expense.notes}`, 50, curY + 36, { width: 495 });
  }

  // Financial Breakdown Box
  curY = 385;
  doc.rect(40, curY, 515, 50).fill('#f1f5f9');
  doc.rect(40, curY, 515, 50).stroke(borderColor);

  const colWidth = 515 / 3;
  // Total Incurred
  doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('TOTAL INCURRED', 40, curY + 10, { width: colWidth, align: 'center' });
  doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text(`LKR ${Number(expense.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 40, curY + 24, { width: colWidth, align: 'center' });

  // Paid Amount
  doc.fillColor('#15803d').fontSize(8).font('Helvetica-Bold').text('AMOUNT PAID', 40 + colWidth, curY + 10, { width: colWidth, align: 'center' });
  doc.fillColor('#15803d').fontSize(13).font('Helvetica-Bold').text(`LKR ${Number(expense.paidAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 40 + colWidth, curY + 24, { width: colWidth, align: 'center' });

  // Pending Amount
  const pendColor = Number(expense.pendingAmount) > 0 ? '#ea580c' : '#64748b';
  doc.fillColor(pendColor).fontSize(8).font('Helvetica-Bold').text('BALANCE PENDING', 40 + colWidth * 2, curY + 10, { width: colWidth, align: 'center' });
  doc.fillColor(pendColor).fontSize(13).font('Helvetica-Bold').text(`LKR ${Number(expense.pendingAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 40 + colWidth * 2, curY + 24, { width: colWidth, align: 'center' });

  // Payment Settlements Table
  curY = 450;
  doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('SETTLEMENT / PAYMENT TRANSACTIONS', 40, curY);
  curY += 16;

  // Table Header
  doc.rect(40, curY, 515, 20).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  doc.text('REC #', 45, curY + 6);
  doc.text('DATE', 125, curY + 6);
  doc.text('METHOD', 190, curY + 6);
  doc.text('PAID BY', 255, curY + 6);
  doc.text('PAID TO', 330, curY + 6);
  doc.text('AMOUNT (LKR)', 445, curY + 6, { width: 100, align: 'right' });
  curY += 20;

  if (expense.payments && expense.payments.length > 0) {
    expense.payments.forEach((p, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(40, curY, 515, 18).fill(bg);
      doc.rect(40, curY, 515, 18).stroke('#e2e8f0');

      doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica');
      doc.text(p.paymentNumber, 45, curY + 5);
      doc.text(new Date(p.paymentDate).toLocaleDateString('en-GB'), 125, curY + 5);
      doc.text(p.paymentMethod || 'CASH', 190, curY + 5);
      doc.text(p.paidBy || '—', 255, curY + 5);
      doc.text(p.paidTo || '—', 330, curY + 5);
      doc.font('Helvetica-Bold').text(Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }), 445, curY + 5, { width: 100, align: 'right' });
      curY += 18;
    });
  } else {
    doc.rect(40, curY, 515, 24).fill('#ffffff');
    doc.rect(40, curY, 515, 24).stroke('#e2e8f0');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique').text('No settlements recorded yet. Full balance of LKR ' + Number(expense.pendingAmount).toLocaleString('en-US') + ' remains pending.', 50, curY + 8);
    curY += 24;
  }

  // Signatures Section (3 Signature Blocks)
  curY = Math.max(curY + 30, 660);

  const sigWidth = 145;
  const gap = 35;
  const s1X = 40;
  const s2X = s1X + sigWidth + gap;
  const s3X = s2X + sigWidth + gap;

  const renderSig = (x, title, name) => {
    doc.strokeColor('#94a3b8').lineWidth(1).moveTo(x, curY + 35).lineTo(x + sigWidth, curY + 35).stroke();
    doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(title, x, curY + 40, { width: sigWidth, align: 'center' });
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(name || 'Authorized Signatory', x, curY + 52, { width: sigWidth, align: 'center' });
  };

  renderSig(s1X, 'PREPARED BY', expense.createdByName || 'Cashier / Accountant');
  renderSig(s2X, 'CHECKED & APPROVED BY', expense.approvedByName || 'Manager / CEO');
  renderSig(s3X, 'RECEIVED BY', expense.paidTo || 'Beneficiary');

  // Bottom Footer Note
  doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text(
    `JB GROUP ENTERPRISE ERP — Computer generated voucher on ${new Date().toLocaleString('en-GB')}. No physical seal required.`,
    40,
    780,
    { width: 515, align: 'center' }
  );

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

const testOut = path.join(process.cwd(), 'scratch_test_voucher.pdf');
buildVoucherDoc(sampleExpense, testOut)
  .then(() => {
    console.log('SUCCESS! Voucher PDF created at:', testOut, 'size:', fs.statSync(testOut).size, 'bytes');
  })
  .catch(err => {
    console.error('ERROR creating PDF:', err);
  });
