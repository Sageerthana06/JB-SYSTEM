import jsPDFModule, { jsPDF } from 'jspdf';

const PDFDoc = jsPDF || jsPDFModule.jsPDF || jsPDFModule;

// Harmonious Brand Palette — JB GROUP / Bella Design
const primaryNavy = [15, 23, 42];      // #0f172a
const accentCrimson = [217, 4, 41];   // #d90429 (JB Crimson)
const textDark = [30, 41, 59];        // #1e293b
const textMuted = [100, 116, 139];    // #64748b
const borderLight = [226, 232, 240];  // #e2e8f0
const bgLight = [248, 250, 252];      // #f8fafc
const greenSuccess = [22, 101, 52];   // #166534
const amberWarning = [180, 83, 9];    // #b45309
const blueInfo = [30, 64, 175];       // #1e40af

/**
 * Common Header and Footer Helper for Daily Reports
 */
function setupDocLayout(doc, { orientation = 'landscape' } = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  return { pageWidth, pageHeight, margin, contentWidth };
}

/**
 * Format currency in LKR
 */
function formatLKR(amount) {
  const val = Number(amount || 0);
  return `LKR ${val.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Render running page numbers on all pages
 */
function addPageNumbers(doc, footerNote = 'Official Confidential Daily ERP Report') {
  const totalPages = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text(`JB GROUP / Bella Design ERP  •  ${footerNote}`, margin, pageHeight - 4.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 4.5, { align: 'right' });
  }
}

/**
 * Draw Top Report Header
 */
function drawReportHeader(doc, {
  reportTitle,
  reportSubtitle,
  date,
  branchName,
  user,
  generatedAt,
  margin,
  contentWidth,
  pageWidth,
  startY = 12
}) {
  let y = startY;

  // Crimson accent strip
  doc.setFillColor(...accentCrimson);
  doc.rect(margin, y, contentWidth, 3, 'F');
  y += 5.5;

  // Brand Name & Generation Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...primaryNavy);
  doc.text('JB GROUP / BELLA DESIGN', margin, y + 4.5);

  const genDateStr = generatedAt
    ? new Date(generatedAt).toLocaleString('en-US', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : new Date().toLocaleString();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text(
    `Generated: ${genDateStr} (Asia/Colombo)  |  By: ${user?.name || 'Authorized User'} (${user?.role || 'Management'})`,
    pageWidth - margin,
    y + 4.5,
    { align: 'right' }
  );

  y += 8;

  // Report Specific Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...accentCrimson);
  doc.text(reportTitle.toUpperCase(), margin, y + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...textMuted);
  doc.text(reportSubtitle, margin, y + 7.5);

  y += 11;

  // Parameters Box
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 11, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryNavy);
  doc.text('REPORT PARAMETERS:', margin + 4, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textDark);
  doc.text(
    `Selected Date: ${date}    |    Scope / Branch: ${branchName || 'All Branches'}    |    Timezone: Asia/Colombo (UTC+05:30)`,
    margin + 4,
    y + 8.5
  );

  y += 14;
  return y;
}

/**
 * Draw KPI Summary Cards Grid
 */
function drawKpiGrid(doc, kpis, { startY, margin, contentWidth }) {
  const cardGap = 3;
  const count = kpis.length;
  const cardWidth = (contentWidth - ((count - 1) * cardGap)) / count;
  let y = startY;

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + cardGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, y, cardWidth, 13.5, 1.2, 1.2, 'FD');

    // Left indicator bar
    doc.setFillColor(...(kpi.color || primaryNavy));
    doc.rect(cardX, y, 1.5, 13.5, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...textMuted);
    doc.text(kpi.label, cardX + 3.2, y + 3.8);

    // Value
    doc.setFontSize(8.5);
    doc.setTextColor(...(kpi.color || primaryNavy));
    doc.text(String(kpi.val), cardX + 3.2, y + 8.6);

    // Subtitle / note
    if (kpi.sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.4);
      doc.setTextColor(...textMuted);
      doc.text(kpi.sub, cardX + 3.2, y + 11.8);
    }
  });

  return y + 17;
}

/**
 * -------------------------------------------------------------
 * 1. DAILY ORDERS REPORT PDF
 * -------------------------------------------------------------
 */
export function generateDailyOrdersPDF({ date, branchName, records = [], summary = {}, user = {}, generatedAt = new Date() }) {
  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const { pageWidth, pageHeight, margin, contentWidth } = setupDocLayout(doc);

  let currentY = drawReportHeader(doc, {
    reportTitle: 'Daily Orders Report',
    reportSubtitle: 'Booked orders, assigned craftsmen, garment specs, and order balance positions for the day',
    date,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth
  });

  // KPI summary cards
  const kpis = [
    { label: 'TOTAL ORDERS', val: summary.totalOrders || records.length, sub: 'Booked on date', color: primaryNavy },
    { label: 'NEW ORDERS VALUE', val: formatLKR(summary.totalAmount), sub: 'Gross order value', color: blueInfo },
    { label: 'ADVANCE COLLECTED', val: formatLKR(summary.totalAdvance), sub: 'On these orders', color: greenSuccess },
    { label: 'OUTSTANDING BALANCE', val: formatLKR(summary.totalBalance), sub: 'Balance to collect', color: amberWarning },
    { label: 'PAID IN FULL', val: summary.byPaymentStatus?.Paid || 0, sub: 'Zero balance orders', color: greenSuccess },
    { label: 'UNPAID / PARTIAL', val: (summary.byPaymentStatus?.Partial || 0) + (summary.byPaymentStatus?.Unpaid || 0), sub: 'Balance due', color: accentCrimson }
  ];
  currentY = drawKpiGrid(doc, kpis, { startY: currentY, margin, contentWidth });

  // Columns definition (Total = 273mm)
  const columns = [
    { header: 'ORDER #', width: 28 },
    { header: 'CUSTOMER & PHONE', width: 44 },
    { header: 'GARMENT & QTY', width: 34 },
    { header: 'ASSIGNED TAILOR', width: 34 },
    { header: 'BRANCH', width: 30 },
    { header: 'STATUS', width: 27 },
    { header: 'AMOUNT (LKR)', width: 26, align: 'right' },
    { header: 'ADVANCE', width: 24, align: 'right' },
    { header: 'BALANCE', width: 26, align: 'right' }
  ];

  function drawTableHeader() {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    columns.forEach(col => {
      const posX = col.align === 'right' ? curX + col.width - 2 : curX + 2;
      doc.text(col.header, posX, currentY + 4.8, { align: col.align || 'left' });
      curX += col.width;
    });
    currentY += 7;
  }

  if (records.length === 0) {
    currentY += 4;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(185, 28, 28);
    doc.text('No orders found for the selected date and branch filter.', margin + 8, currentY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27);
    doc.text('Try selecting a different date or branch view.', margin + 8, currentY + 14);
  } else {
    drawTableHeader();

    records.forEach((row, idx) => {
      const rowHeight = 8;
      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        currentY = margin;
        currentY = drawReportHeader(doc, {
          reportTitle: 'Daily Orders Report (Continued)',
          reportSubtitle: 'Page continuation',
          date,
          branchName,
          user,
          generatedAt,
          margin,
          contentWidth,
          pageWidth,
          startY: margin
        });
        drawTableHeader();
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.15);
      doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(...textDark);

      let curX = margin;
      // 1. Order Number
      doc.setFont('helvetica', 'bold');
      doc.text(row.orderNumber || '-', curX + 2, currentY + 5.2);
      curX += 28;

      // 2. Customer & Phone
      doc.setFont('helvetica', 'normal');
      const custText = `${row.customerName || 'Walk-in'} (${row.customerPhone || '-'})`;
      doc.text(doc.splitTextToSize(custText, 40)[0] || '-', curX + 2, currentY + 5.2);
      curX += 44;

      // 3. Garment & Qty
      doc.text(`${row.dressType || 'Garment'} (${row.quantity || 1})`, curX + 2, currentY + 5.2);
      curX += 34;

      // 4. Assigned Tailor
      doc.text(row.assignedTailor || 'Unassigned', curX + 2, currentY + 5.2);
      curX += 34;

      // 5. Branch
      doc.text(row.branchName || '-', curX + 2, currentY + 5.2);
      curX += 30;

      // 6. Status
      doc.setFont('helvetica', 'bold');
      doc.text(row.status || '-', curX + 2, currentY + 5.2);
      curX += 27;

      // 7. Amount
      doc.setFont('helvetica', 'normal');
      doc.text(Number(row.totalAmount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 }), curX + 26 - 2, currentY + 5.2, { align: 'right' });
      curX += 26;

      // 8. Advance
      doc.text(Number(row.advancePayment || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 }), curX + 24 - 2, currentY + 5.2, { align: 'right' });
      curX += 24;

      // 9. Balance
      doc.setFont('helvetica', 'bold');
      if (row.balanceAmount > 0) doc.setTextColor(185, 28, 28);
      else doc.setTextColor(...greenSuccess);
      doc.text(Number(row.balanceAmount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 }), curX + 26 - 2, currentY + 5.2, { align: 'right' });

      currentY += rowHeight;
    });

    // Grand Totals Row
    if (currentY + 10 > pageHeight - 16) {
      doc.addPage();
      currentY = margin + 10;
    }
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setDrawColor(...borderLight);
    doc.line(margin, currentY + 8, margin + contentWidth, currentY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...primaryNavy);
    doc.text(`GRAND TOTALS (${records.length} Orders):`, margin + 4, currentY + 5.2);

    const totalAmtStr = Number(summary.totalAmount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 });
    const totalAdvStr = Number(summary.totalAdvance || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 });
    const totalBalStr = Number(summary.totalBalance || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 });

    doc.text(totalAmtStr, margin + 28 + 44 + 34 + 34 + 30 + 27 + 26 - 2, currentY + 5.2, { align: 'right' });
    doc.text(totalAdvStr, margin + 28 + 44 + 34 + 34 + 30 + 27 + 26 + 24 - 2, currentY + 5.2, { align: 'right' });
    doc.setTextColor(185, 28, 28);
    doc.text(totalBalStr, margin + 28 + 44 + 34 + 34 + 30 + 27 + 26 + 24 + 26 - 2, currentY + 5.2, { align: 'right' });
  }

  addPageNumbers(doc, 'Daily Orders Report');
  if (typeof window !== 'undefined' || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test')) {
    doc.save(`JB_Daily_Orders_${date}.pdf`);
  }
  return doc;
}

/**
 * -------------------------------------------------------------
 * 2. DAILY ATTENDANCE REPORT PDF
 * -------------------------------------------------------------
 */
export function generateDailyAttendancePDF({ date, branchName, records = [], summary = {}, user = {}, generatedAt = new Date() }) {
  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const { pageWidth, pageHeight, margin, contentWidth } = setupDocLayout(doc);

  let currentY = drawReportHeader(doc, {
    reportTitle: 'Daily Attendance Report',
    reportSubtitle: 'Employee presence, clock-in & clock-out timestamps, and branch attendance rate',
    date,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth
  });

  // KPI summary cards
  const kpis = [
    { label: 'TOTAL TEAM ROSTER', val: summary.totalStaff || records.length, sub: 'Registered active staff', color: primaryNavy },
    { label: 'PRESENT / ACTIVE', val: summary.present || 0, sub: 'Currently clocked-in', color: greenSuccess },
    { label: 'CHECKED OUT', val: summary.checkedOut || 0, sub: 'Shift concluded', color: blueInfo },
    { label: 'ABSENT', val: summary.absent || 0, sub: 'Marked absent', color: accentCrimson },
    { label: 'NOT MARKED', val: summary.notMarked || 0, sub: 'No telemetry logged', color: amberWarning },
    { label: 'ATTENDANCE RATE', val: `${summary.attendanceRate || 0}%`, sub: 'Turnout percentage', color: greenSuccess }
  ];
  currentY = drawKpiGrid(doc, kpis, { startY: currentY, margin, contentWidth });

  const columns = [
    { header: 'EMPLOYEE NAME', width: 55 },
    { header: 'ROLE', width: 35 },
    { header: 'BRANCH', width: 45 },
    { header: 'STATUS', width: 35 },
    { header: 'CHECK-IN TIME', width: 35 },
    { header: 'CHECK-OUT TIME', width: 35 },
    { header: 'RECORDED BY', width: 33 }
  ];

  function drawTableHeader() {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    columns.forEach(col => {
      doc.text(col.header, curX + 2, currentY + 4.8);
      curX += col.width;
    });
    currentY += 7;
  }

  if (records.length === 0) {
    currentY += 4;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(185, 28, 28);
    doc.text('No attendance records found for this date.', margin + 8, currentY + 8);
  } else {
    drawTableHeader();

    records.forEach((row, idx) => {
      const rowHeight = 7.5;
      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        currentY = margin;
        currentY = drawReportHeader(doc, {
          reportTitle: 'Daily Attendance Report (Continued)',
          reportSubtitle: 'Page continuation',
          date,
          branchName,
          user,
          generatedAt,
          margin,
          contentWidth,
          pageWidth,
          startY: margin
        });
        drawTableHeader();
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.15);
      doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(...textDark);

      let curX = margin;
      // Employee Name
      doc.setFont('helvetica', 'bold');
      doc.text(row.employeeName || '-', curX + 2, currentY + 5);
      curX += 55;

      // Role
      doc.setFont('helvetica', 'normal');
      doc.text(row.role || '-', curX + 2, currentY + 5);
      curX += 35;

      // Branch
      doc.text(row.branchName || '-', curX + 2, currentY + 5);
      curX += 45;

      // Status
      doc.setFont('helvetica', 'bold');
      if (row.attendanceStatus === 'Present') doc.setTextColor(...greenSuccess);
      else if (row.attendanceStatus === 'Checked Out') doc.setTextColor(...blueInfo);
      else if (row.attendanceStatus === 'Absent') doc.setTextColor(...accentCrimson);
      else doc.setTextColor(...amberWarning);
      doc.text(row.attendanceStatus || '-', curX + 2, currentY + 5);
      curX += 35;

      // Check In
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      doc.text(row.checkInTime || '-', curX + 2, currentY + 5);
      curX += 35;

      // Check Out
      doc.text(row.checkOutTime || '-', curX + 2, currentY + 5);
      curX += 35;

      // Recorded By
      doc.text(row.markedBy || '-', curX + 2, currentY + 5);

      currentY += rowHeight;
    });
  }

  addPageNumbers(doc, 'Daily Attendance Report');
  if (typeof window !== 'undefined' || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test')) {
    doc.save(`JB_Daily_Attendance_${date}.pdf`);
  }
  return doc;
}

/**
 * -------------------------------------------------------------
 * 3. DAILY PAYMENTS REPORT PDF
 * -------------------------------------------------------------
 */
export function generateDailyPaymentsPDF({ date, branchName, records = [], summary = {}, user = {}, generatedAt = new Date() }) {
  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const { pageWidth, pageHeight, margin, contentWidth } = setupDocLayout(doc);

  let currentY = drawReportHeader(doc, {
    reportTitle: 'Daily Payments & Collections Report',
    reportSubtitle: 'Actual cash/bank receipts on date, method breakdown, and current outstanding order positions',
    date,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth
  });

  // KPI summary cards
  const kpis = [
    { label: 'TOTAL COLLECTED TODAY', val: formatLKR(summary.totalCollected), sub: 'Actual inflows on date', color: greenSuccess },
    { label: 'PAYMENT TRANSACTIONS', val: summary.transactionCount || records.length, sub: 'Logged payment entries', color: primaryNavy },
    { label: 'FULLY SETTLED ORDERS', val: summary.fullySettledCount || 0, sub: 'Orders reached zero balance', color: blueInfo },
    { label: 'PARTIAL PAYMENTS', val: summary.partialPaymentCount || 0, sub: 'Orders with remaining bal', color: amberWarning },
    { label: 'ACTIVE BALANCE REMAINING', val: formatLKR(summary.totalOutstandingOnActiveOrders), sub: 'Outstanding on these orders', color: accentCrimson }
  ];
  currentY = drawKpiGrid(doc, kpis, { startY: currentY, margin, contentWidth });

  const columns = [
    { header: 'RECEIPT / TIME', width: 26 },
    { header: 'ORDER #', width: 28 },
    { header: 'CUSTOMER & PHONE', width: 44 },
    { header: 'PAYMENT METHOD', width: 28 },
    { header: 'AMOUNT COLLECTED', width: 34, align: 'right' },
    { header: 'ORDER TOTAL', width: 28, align: 'right' },
    { header: 'OUTSTANDING BAL', width: 31, align: 'right' },
    { header: 'PAY STATUS', width: 24 },
    { header: 'BRANCH', width: 30 }
  ];

  function drawTableHeader() {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    columns.forEach(col => {
      const posX = col.align === 'right' ? curX + col.width - 2 : curX + 2;
      doc.text(col.header, posX, currentY + 4.8, { align: col.align || 'left' });
      curX += col.width;
    });
    currentY += 7;
  }

  if (records.length === 0) {
    currentY += 4;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(185, 28, 28);
    doc.text('No payment receipts recorded for the selected date and branch filter.', margin + 8, currentY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27);
    doc.text('Collections are registered in real time as cashier deposits and transfers are confirmed.', margin + 8, currentY + 14);
  } else {
    drawTableHeader();

    records.forEach((row, idx) => {
      const rowHeight = 7.8;
      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        currentY = margin;
        currentY = drawReportHeader(doc, {
          reportTitle: 'Daily Payments Report (Continued)',
          reportSubtitle: 'Page continuation',
          date,
          branchName,
          user,
          generatedAt,
          margin,
          contentWidth,
          pageWidth,
          startY: margin
        });
        drawTableHeader();
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.15);
      doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(...textDark);

      let curX = margin;
      // Receipt / Time
      doc.text(`${row.paymentTime || '-'}`, curX + 2, currentY + 5.2);
      curX += 26;

      // Order #
      doc.setFont('helvetica', 'bold');
      doc.text(row.orderNumber || '-', curX + 2, currentY + 5.2);
      curX += 28;

      // Customer
      doc.setFont('helvetica', 'normal');
      const custText = `${row.customerName || 'Customer'} (${row.customerPhone || '-'})`;
      doc.text(doc.splitTextToSize(custText, 40)[0] || '-', curX + 2, currentY + 5.2);
      curX += 44;

      // Method
      doc.text(row.paymentMethod || 'Cash', curX + 2, currentY + 5.2);
      curX += 28;

      // Amount Collected Today
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...greenSuccess);
      doc.text(Number(row.amountCollected || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 }), curX + 34 - 2, currentY + 5.2, { align: 'right' });
      curX += 34;

      // Order Total
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      doc.text(Number(row.orderTotal || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 }), curX + 28 - 2, currentY + 5.2, { align: 'right' });
      curX += 28;

      // Current Outstanding Bal
      doc.setFont('helvetica', 'bold');
      if (row.currentOutstandingBalance > 0) doc.setTextColor(185, 28, 28);
      else doc.setTextColor(...greenSuccess);
      doc.text(Number(row.currentOutstandingBalance || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 }), curX + 31 - 2, currentY + 5.2, { align: 'right' });
      curX += 31;

      // Payment Status
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      doc.text(row.orderPaymentStatus || '-', curX + 2, currentY + 5.2);
      curX += 24;

      // Branch
      doc.text(row.branchName || '-', curX + 2, currentY + 5.2);

      currentY += rowHeight;
    });

    // Grand Total Row
    if (currentY + 10 > pageHeight - 16) {
      doc.addPage();
      currentY = margin + 10;
    }
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setDrawColor(...borderLight);
    doc.line(margin, currentY + 8, margin + contentWidth, currentY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...primaryNavy);
    doc.text(`TOTAL REVENUE COLLECTED TODAY (${records.length} Transactions):`, margin + 4, currentY + 5.2);

    const totalCollectedStr = Number(summary.totalCollected || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 });
    doc.setTextColor(...greenSuccess);
    doc.text(totalCollectedStr, margin + 26 + 28 + 44 + 28 + 34 - 2, currentY + 5.2, { align: 'right' });
  }

  addPageNumbers(doc, 'Daily Payments Report');
  if (typeof window !== 'undefined' || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test')) {
    doc.save(`JB_Daily_Payments_${date}.pdf`);
  }
  return doc;
}

/**
 * -------------------------------------------------------------
 * 4. DAILY PRODUCTION REPORT PDF
 * -------------------------------------------------------------
 */
export function generateDailyProductionPDF({ date, branchName, data = {}, summary = {}, user = {}, generatedAt = new Date() }) {
  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const { pageWidth, pageHeight, margin, contentWidth } = setupDocLayout(doc);

  let currentY = drawReportHeader(doc, {
    reportTitle: 'Daily Production & Manufacturing Report',
    reportSubtitle: 'Stage progression, completed craftsman tasks, orders marked ready/delivered, and pending WIP',
    date,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth
  });

  const kpis = [
    { label: 'COMPLETED TASKS TODAY', val: summary.completedTasksCount || 0, sub: 'Finished steps', color: greenSuccess },
    { label: 'ORDERS MOVED TO READY', val: summary.readyOrdersCount || 0, sub: 'QC cleared for pickup', color: blueInfo },
    { label: 'DELIVERED TO CUSTOMERS', val: summary.deliveredOrdersCount || 0, sub: 'Handed over on date', color: [15, 118, 110] },
    { label: 'STAGE TRANSITIONS', val: summary.stageTransitionsCount || 0, sub: 'Production movements', color: primaryNavy },
    { label: 'ACTIVE WORK-IN-PROGRESS', val: summary.pendingWipCount || 0, sub: 'Pending in production', color: amberWarning }
  ];
  currentY = drawKpiGrid(doc, kpis, { startY: currentY, margin, contentWidth });

  const stageTransitions = data.stageTransitions || [];
  const readyOrders = data.readyOrders || [];
  const deliveredOrders = data.deliveredOrders || [];
  const pendingWip = data.pendingWip || [];

  // Section 1: Ready & Delivered Orders (High Priority)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryNavy);
  doc.text(`1. ORDERS CLEARED TO READY & DELIVERED ON ${date}:`, margin, currentY + 4);
  currentY += 6;

  const milestoneCols = [
    { header: 'ORDER #', width: 30 },
    { header: 'CUSTOMER', width: 50 },
    { header: 'GARMENT TYPE', width: 50 },
    { header: 'ASSIGNED TAILOR', width: 50 },
    { header: 'MILESTONE STATUS', width: 45 },
    { header: 'TIMESTAMP', width: 48 }
  ];

  function drawMilestoneHeader() {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, currentY, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    let curX = margin;
    milestoneCols.forEach(col => {
      doc.text(col.header, curX + 2, currentY + 4.5);
      curX += col.width;
    });
    currentY += 6.5;
  }

  const milestones = [
    ...readyOrders.map(r => ({ ...r, milestone: 'READY FOR PICKUP', time: r.updatedAt })),
    ...deliveredOrders.map(d => ({ ...d, milestone: 'DELIVERED TO CLIENT', time: d.deliveredAt }))
  ];

  if (milestones.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text('No orders transitioned to Ready or Delivered on this specific date.', margin + 2, currentY + 4);
    currentY += 8;
  } else {
    drawMilestoneHeader();
    milestones.forEach((m, idx) => {
      const rowHeight = 7;
      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        currentY = margin + 10;
        drawMilestoneHeader();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      }
      doc.setDrawColor(...borderLight);
      doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(...textDark);

      let curX = margin;
      doc.setFont('helvetica', 'bold');
      doc.text(m.orderNumber || '-', curX + 2, currentY + 4.8);
      curX += 30;

      doc.setFont('helvetica', 'normal');
      doc.text(m.customerName || 'Customer', curX + 2, currentY + 4.8);
      curX += 50;

      doc.text(m.dressType || 'Garment', curX + 2, currentY + 4.8);
      curX += 50;

      doc.text(m.assignedTailor || 'Tailor', curX + 2, currentY + 4.8);
      curX += 50;

      doc.setFont('helvetica', 'bold');
      if (m.milestone.includes('DELIVERED')) doc.setTextColor(15, 118, 110);
      else doc.setTextColor(...blueInfo);
      doc.text(m.milestone, curX + 2, currentY + 4.8);
      curX += 45;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      doc.text(m.time || '-', curX + 2, currentY + 4.8);

      currentY += rowHeight;
    });
    currentY += 4;
  }

  // Section 2: Production Stage Progression on Date
  if (currentY + 25 > pageHeight - 16) {
    doc.addPage();
    currentY = margin + 10;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryNavy);
  doc.text(`2. STAGE PROGRESSIONS & CRAFTSMAN LOGS (${stageTransitions.length} movements):`, margin, currentY + 4);
  currentY += 6;

  const progCols = [
    { header: 'ORDER #', width: 28 },
    { header: 'CUSTOMER & GARMENT', width: 55 },
    { header: 'PREVIOUS STAGE', width: 38 },
    { header: 'NEW STAGE', width: 40 },
    { header: 'CRAFTSMAN', width: 40 },
    { header: 'TIME LOGGED', width: 32 },
    { header: 'NOTES', width: 40 }
  ];

  function drawProgHeader() {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, currentY, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    let curX = margin;
    progCols.forEach(col => {
      doc.text(col.header, curX + 2, currentY + 4.5);
      curX += col.width;
    });
    currentY += 6.5;
  }

  if (stageTransitions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text('No stage transition records logged on this date.', margin + 2, currentY + 4);
    currentY += 8;
  } else {
    drawProgHeader();
    stageTransitions.forEach((s, idx) => {
      const rowHeight = 7;
      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        currentY = margin + 10;
        drawProgHeader();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      }
      doc.setDrawColor(...borderLight);
      doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...textDark);

      let curX = margin;
      doc.setFont('helvetica', 'bold');
      doc.text(s.orderNumber || '-', curX + 2, currentY + 4.8);
      curX += 28;

      doc.setFont('helvetica', 'normal');
      doc.text(`${s.customerName} • ${s.dressType}`, curX + 2, currentY + 4.8);
      curX += 55;

      doc.text(s.previousStage || '-', curX + 2, currentY + 4.8);
      curX += 38;

      doc.setFont('helvetica', 'bold');
      doc.text(s.stage || '-', curX + 2, currentY + 4.8);
      curX += 40;

      doc.setFont('helvetica', 'normal');
      doc.text(s.assignedTo || '-', curX + 2, currentY + 4.8);
      curX += 40;

      doc.text(s.time || '-', curX + 2, currentY + 4.8);
      curX += 32;

      doc.text(s.notes && s.notes !== '-' ? doc.splitTextToSize(s.notes, 38)[0] : '-', curX + 2, currentY + 4.8);

      currentY += rowHeight;
    });
    currentY += 4;
  }

  // Section 3: Active WIP Snapshot
  if (currentY + 25 > pageHeight - 16) {
    doc.addPage();
    currentY = margin + 10;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryNavy);
  doc.text(`3. ACTIVE PRODUCTION WORK-IN-PROGRESS (${pendingWip.length} Pending Orders):`, margin, currentY + 4);
  currentY += 6;

  const wipCols = [
    { header: 'ORDER #', width: 30 },
    { header: 'CUSTOMER', width: 55 },
    { header: 'GARMENT TYPE', width: 55 },
    { header: 'CURRENT STAGE', width: 45 },
    { header: 'ASSIGNED TAILOR', width: 45 },
    { header: 'BRANCH', width: 43 }
  ];

  function drawWipHeader() {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, currentY, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    let curX = margin;
    wipCols.forEach(col => {
      doc.text(col.header, curX + 2, currentY + 4.5);
      curX += col.width;
    });
    currentY += 6.5;
  }

  if (pendingWip.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text('No active work-in-progress orders pending in production.', margin + 2, currentY + 4);
  } else {
    drawWipHeader();
    pendingWip.forEach((w, idx) => {
      const rowHeight = 7;
      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        currentY = margin + 10;
        drawWipHeader();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      }
      doc.setDrawColor(...borderLight);
      doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...textDark);

      let curX = margin;
      doc.setFont('helvetica', 'bold');
      doc.text(w.orderNumber || '-', curX + 2, currentY + 4.8);
      curX += 30;

      doc.setFont('helvetica', 'normal');
      doc.text(w.customerName || 'Customer', curX + 2, currentY + 4.8);
      curX += 55;

      doc.text(w.dressType || 'Garment', curX + 2, currentY + 4.8);
      curX += 55;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...amberWarning);
      doc.text(w.status || '-', curX + 2, currentY + 4.8);
      curX += 45;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      doc.text(w.assignedTailor || 'Unassigned', curX + 2, currentY + 4.8);
      curX += 45;

      doc.text(w.branchName || '-', curX + 2, currentY + 4.8);

      currentY += rowHeight;
    });
  }

  addPageNumbers(doc, 'Daily Production Report');
  if (typeof window !== 'undefined' || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test')) {
    doc.save(`JB_Daily_Production_${date}.pdf`);
  }
  return doc;
}

/**
 * -------------------------------------------------------------
 * 5. COMBINED DAILY BUSINESS SUMMARY PDF
 * -------------------------------------------------------------
 */
export function generateDailyBusinessSummaryPDF({ date, branchName, data = {}, user = {}, generatedAt = new Date() }) {
  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const { pageWidth, pageHeight, margin, contentWidth } = setupDocLayout(doc);

  const kpis = data.businessSummary?.executiveKpis || {};
  const orders = data.orders || { summary: {}, records: [] };
  const attendance = data.attendance || { summary: {}, records: [] };
  const payments = data.payments || { summary: {}, records: [] };
  const production = data.production || { summary: {}, data: {} };

  let currentY = drawReportHeader(doc, {
    reportTitle: 'Daily Business Summary (Executive Briefing)',
    reportSubtitle: 'Comprehensive multi-departmental snapshot: Sales & Orders, Revenue Collections, Workforce Attendance, and Production Progress',
    date,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth
  });

  // Top 5 Multi-departmental Executive KPIs
  const topKpis = [
    { label: 'DAILY NEW ORDERS', val: kpis.newOrdersCount || 0, sub: `Value: ${formatLKR(kpis.newOrdersValue)}`, color: primaryNavy },
    { label: 'DAILY CASH / BANK INFLOW', val: formatLKR(kpis.paymentsCollected), sub: `${kpis.paymentTransactions || 0} Transactions`, color: greenSuccess },
    { label: 'WORKFORCE ATTENDANCE', val: `${kpis.staffPresent || 0} / ${kpis.totalStaff || 0}`, sub: `${kpis.attendanceRate || 0}% Staff Turnout`, color: blueInfo },
    { label: 'READY & DELIVERED', val: (kpis.readyOrders || 0) + (kpis.deliveredOrders || 0), sub: `${kpis.readyOrders || 0} Ready • ${kpis.deliveredOrders || 0} Delivered`, color: [15, 118, 110] },
    { label: 'ACTIVE WORK-IN-PROGRESS', val: kpis.activeWipCount || 0, sub: 'Orders in production pipeline', color: amberWarning }
  ];
  currentY = drawKpiGrid(doc, topKpis, { startY: currentY, margin, contentWidth });

  // 2-Column Executive Matrix
  const colWidth = (contentWidth - 6) / 2;

  // Function to render a section box
  function renderSummaryBox(x, y, width, height, title, items, badge) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

    // Section header
    doc.setFillColor(...bgLight);
    doc.roundedRect(x, y, width, 7, 1.5, 1.5, 'F');
    doc.rect(x, y + 5, width, 2, 'F'); // square bottom of header
    doc.setDrawColor(...borderLight);
    doc.line(x, y + 7, x + width, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...primaryNavy);
    doc.text(title, x + 3.5, y + 4.8);

    if (badge) {
      doc.setFontSize(6.5);
      doc.setTextColor(...accentCrimson);
      doc.text(badge, x + width - 3.5, y + 4.8, { align: 'right' });
    }

    let lineY = y + 11.5;
    items.forEach(item => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...textDark);
      doc.text(item.label, x + 3.5, lineY);

      doc.setFont('helvetica', 'bold');
      if (item.highlight) doc.setTextColor(...(item.highlightColor || greenSuccess));
      else doc.setTextColor(...primaryNavy);
      doc.text(String(item.val), x + width - 3.5, lineY, { align: 'right' });
      lineY += 5.2;
    });
  }

  // Row 1: Left = Orders Snapshot, Right = Revenue Collections Snapshot
  const boxHeight = 44;
  const ordersItems = [
    { label: 'Total Orders Logged on Date:', val: `${orders.summary.totalOrders || 0} Orders` },
    { label: 'Total Gross Order Value:', val: formatLKR(orders.summary.totalAmount), highlight: true, highlightColor: blueInfo },
    { label: 'Advance Payment Collected for Orders:', val: formatLKR(orders.summary.totalAdvance) },
    { label: 'Remaining Balance on These Orders:', val: formatLKR(orders.summary.totalBalance), highlight: true, highlightColor: amberWarning },
    { label: 'Orders Settled in Full (Zero Balance):', val: `${orders.summary.byPaymentStatus?.Paid || 0} Orders` },
    { label: 'Orders with Balances Due:', val: `${(orders.summary.byPaymentStatus?.Partial || 0) + (orders.summary.byPaymentStatus?.Unpaid || 0)} Orders` }
  ];

  const paymentsItems = [
    { label: 'Actual Cash / Bank Received Today:', val: formatLKR(payments.summary.totalCollected), highlight: true, highlightColor: greenSuccess },
    { label: 'Payment Transactions Count:', val: `${payments.summary.transactionCount || 0} Entries` },
    { label: 'Fully Settled Order Transactions:', val: `${payments.summary.fullySettledCount || 0} Completed` },
    { label: 'Partial Installments Received:', val: `${payments.summary.partialPaymentCount || 0} Installments` },
    { label: 'Cash Collections Total:', val: formatLKR(payments.summary.byMethod?.Cash || 0) },
    { label: 'Active Balance on Receiving Orders:', val: formatLKR(payments.summary.totalOutstandingOnActiveOrders), highlight: true, highlightColor: accentCrimson }
  ];

  renderSummaryBox(margin, currentY, colWidth, boxHeight, '1. ORDERS & SALES OVERVIEW', ordersItems, `${orders.records?.length || 0} Records`);
  renderSummaryBox(margin + colWidth + 6, currentY, colWidth, boxHeight, '2. CASH & PAYMENT INFLOWS', paymentsItems, `${payments.records?.length || 0} Receipts`);

  currentY += boxHeight + 4;

  // Row 2: Left = Workforce Attendance Snapshot, Right = Production Manufacturing Snapshot
  const attItems = [
    { label: 'Total Active Workforce Assigned:', val: `${attendance.summary.totalStaff || 0} Employees` },
    { label: 'Present / On Duty Today:', val: `${attendance.summary.present || 0} Staff`, highlight: true, highlightColor: greenSuccess },
    { label: 'Completed Shift & Checked Out:', val: `${attendance.summary.checkedOut || 0} Staff`, highlight: true, highlightColor: blueInfo },
    { label: 'Absences Recorded:', val: `${attendance.summary.absent || 0} Absent`, highlight: true, highlightColor: accentCrimson },
    { label: 'Unmarked Roster Records:', val: `${attendance.summary.notMarked || 0} Pending` },
    { label: 'Overall Branch Attendance Rate:', val: `${attendance.summary.attendanceRate || 0}% Turnout`, highlight: true, highlightColor: greenSuccess }
  ];

  const prodItems = [
    { label: 'Craftsman Tasks Finished Today:', val: `${production.summary.completedTasksCount || 0} Tasks`, highlight: true, highlightColor: greenSuccess },
    { label: 'Orders Cleared by QC to READY:', val: `${production.summary.readyOrdersCount || 0} Ready`, highlight: true, highlightColor: blueInfo },
    { label: 'Orders Delivered / Handed to Clients:', val: `${production.summary.deliveredOrdersCount || 0} Delivered`, highlight: true, highlightColor: [15, 118, 110] },
    { label: 'Production Stage Transitions Logged:', val: `${production.summary.stageTransitionsCount || 0} Movements` },
    { label: 'Active Work-in-Progress (WIP Pipeline):', val: `${production.summary.pendingWipCount || 0} In Progress`, highlight: true, highlightColor: amberWarning },
    { label: 'Cutting & Stitching WIP Load:', val: `${(production.summary.wipByStage?.CUTTING || 0) + (production.summary.wipByStage?.STITCHING || 0)} Garments` }
  ];

  renderSummaryBox(margin, currentY, colWidth, boxHeight, '3. STAFF ATTENDANCE & ROSTER', attItems, `${attendance.summary.attendanceRate || 0}% Turnout`);
  renderSummaryBox(margin + colWidth + 6, currentY, colWidth, boxHeight, '4. PRODUCTION & MANUFACTURING PIPELINE', prodItems, `${production.summary.pendingWipCount || 0} Active WIP`);

  currentY += boxHeight + 6;

  // Executive Sign-off Footer Box
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...primaryNavy);
  doc.text('EXECUTIVE CERTIFICATION & AUDIT STATEMENT:', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);
  doc.text(
    `This report aggregates certified production and ledger entries for ${date} in accordance with JB GROUP PVT LTD / Bella Design operational policies. All financial receipts, attendance clock-ins, and production movements are logged directly from live PostgreSQL database records with strict Asia/Colombo date boundaries.`,
    margin + 4,
    currentY + 8.5,
    { maxWidth: contentWidth - 8 }
  );

  // ==============================================================
  // PAGE 2: DETAILED REGISTERS (ORDERS, ATTENDANCE, PAYMENTS)
  // ==============================================================
  doc.addPage();
  currentY = margin;

  currentY = drawReportHeader(doc, {
    reportTitle: 'Daily Operational Ledger (Orders, Attendance & Payments)',
    reportSubtitle: 'Itemized transaction records and workforce presence for the selected date',
    date,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth,
    startY: margin
  });

  // Table 1: Orders (max 8 rows or summary)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...primaryNavy);
  doc.text(`1. ORDERS REGISTER (${orders.records?.length || 0} Orders):`, margin, currentY + 3);
  currentY += 5;

  const orderCols = [
    { header: 'ORDER #', width: 35 },
    { header: 'CUSTOMER & PHONE', width: 65 },
    { header: 'GARMENT & QTY', width: 50 },
    { header: 'STATUS', width: 45 },
    { header: 'AMOUNT (LKR)', width: 38, align: 'right' },
    { header: 'BALANCE (LKR)', width: 40, align: 'right' }
  ];

  doc.setFillColor(...primaryNavy);
  doc.rect(margin, currentY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  let curOX = margin;
  orderCols.forEach(col => {
    const px = col.align === 'right' ? curOX + col.width - 2 : curOX + 2;
    doc.text(col.header, px, currentY + 4.2, { align: col.align || 'left' });
    curOX += col.width;
  });
  currentY += 6;

  if (!orders.records || orders.records.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text('No orders booked on this date.', margin + 2, currentY + 4);
    currentY += 7;
  } else {
    orders.records.slice(0, 8).forEach((r, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, 6, 'F');
      }
      doc.setDrawColor(...borderLight);
      doc.line(margin, currentY + 6, margin + contentWidth, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...textDark);

      let x = margin;
      doc.setFont('helvetica', 'bold');
      doc.text(r.orderNumber || '-', x + 2, currentY + 4.2);
      x += 35;

      doc.setFont('helvetica', 'normal');
      doc.text(`${r.customerName || 'Customer'} (${r.customerPhone || '-'})`, x + 2, currentY + 4.2);
      x += 65;

      doc.text(`${r.dressType || 'Garment'} (${r.quantity || 1})`, x + 2, currentY + 4.2);
      x += 50;

      doc.setFont('helvetica', 'bold');
      doc.text(r.status || '-', x + 2, currentY + 4.2);
      x += 45;

      doc.setFont('helvetica', 'normal');
      doc.text(Number(r.totalAmount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 }), x + 38 - 2, currentY + 4.2, { align: 'right' });
      x += 38;

      if (r.balanceAmount > 0) doc.setTextColor(185, 28, 28);
      else doc.setTextColor(...greenSuccess);
      doc.text(Number(r.balanceAmount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 }), x + 40 - 2, currentY + 4.2, { align: 'right' });

      currentY += 6;
    });

    if (orders.records.length > 8) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(...textMuted);
      doc.text(`... and ${orders.records.length - 8} more orders (Download dedicated Orders PDF for full register)`, margin + 2, currentY + 4);
      currentY += 6;
    }
  }

  currentY += 4;

  // Table 2: Payments
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...primaryNavy);
  doc.text(`2. PAYMENTS RECEIVED TODAY (${payments.records?.length || 0} Receipts):`, margin, currentY + 3);
  currentY += 5;

  const payCols = [
    { header: 'TIME', width: 30 },
    { header: 'ORDER #', width: 35 },
    { header: 'CUSTOMER', width: 65 },
    { header: 'METHOD', width: 40 },
    { header: 'RECEIVED TODAY (LKR)', width: 50, align: 'right' },
    { header: 'OUTSTANDING BAL (LKR)', width: 53, align: 'right' }
  ];

  doc.setFillColor(...primaryNavy);
  doc.rect(margin, currentY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  let curPX = margin;
  payCols.forEach(col => {
    const px = col.align === 'right' ? curPX + col.width - 2 : curPX + 2;
    doc.text(col.header, px, currentY + 4.2, { align: col.align || 'left' });
    curPX += col.width;
  });
  currentY += 6;

  if (!payments.records || payments.records.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text('No payments recorded on this date.', margin + 2, currentY + 4);
    currentY += 7;
  } else {
    payments.records.slice(0, 8).forEach((p, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, 6, 'F');
      }
      doc.setDrawColor(...borderLight);
      doc.line(margin, currentY + 6, margin + contentWidth, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...textDark);

      let x = margin;
      doc.text(p.paymentTime || '-', x + 2, currentY + 4.2);
      x += 30;

      doc.setFont('helvetica', 'bold');
      doc.text(p.orderNumber || '-', x + 2, currentY + 4.2);
      x += 35;

      doc.setFont('helvetica', 'normal');
      doc.text(p.customerName || 'Customer', x + 2, currentY + 4.2);
      x += 65;

      doc.text(p.paymentMethod || 'Cash', x + 2, currentY + 4.2);
      x += 40;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...greenSuccess);
      doc.text(Number(p.amountCollected || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 }), x + 50 - 2, currentY + 4.2, { align: 'right' });
      x += 50;

      if (p.currentOutstandingBalance > 0) doc.setTextColor(185, 28, 28);
      else doc.setTextColor(...greenSuccess);
      doc.text(Number(p.currentOutstandingBalance || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 }), x + 53 - 2, currentY + 4.2, { align: 'right' });

      currentY += 6;
    });

    if (payments.records.length > 8) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(...textMuted);
      doc.text(`... and ${payments.records.length - 8} more payments (Download dedicated Payments PDF for full breakdown)`, margin + 2, currentY + 4);
      currentY += 6;
    }
  }

  currentY += 4;

  // Table 3: Attendance
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...primaryNavy);
  doc.text(`3. WORKFORCE ATTENDANCE ROSTER (${attendance.records?.length || 0} Staff):`, margin, currentY + 3);
  currentY += 5;

  const attCols = [
    { header: 'EMPLOYEE NAME', width: 65 },
    { header: 'ROLE', width: 45 },
    { header: 'BRANCH', width: 55 },
    { header: 'STATUS (PRESENT / ABSENT)', width: 60 },
    { header: 'CHECK-IN TIME', width: 48 }
  ];

  doc.setFillColor(...primaryNavy);
  doc.rect(margin, currentY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  let curAX = margin;
  attCols.forEach(col => {
    doc.text(col.header, curAX + 2, currentY + 4.2);
    curAX += col.width;
  });
  currentY += 6;

  if (!attendance.records || attendance.records.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text('No attendance data available.', margin + 2, currentY + 4);
  } else {
    attendance.records.slice(0, 10).forEach((a, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, 5.8, 'F');
      }
      doc.setDrawColor(...borderLight);
      doc.line(margin, currentY + 5.8, margin + contentWidth, currentY + 5.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...textDark);

      let x = margin;
      doc.setFont('helvetica', 'bold');
      doc.text(a.employeeName || '-', x + 2, currentY + 4.2);
      x += 65;

      doc.setFont('helvetica', 'normal');
      doc.text(a.role || '-', x + 2, currentY + 4.2);
      x += 45;

      doc.text(a.branchName || '-', x + 2, currentY + 4.2);
      x += 55;

      doc.setFont('helvetica', 'bold');
      if (a.attendanceStatus === 'Present') doc.setTextColor(...greenSuccess);
      else if (a.attendanceStatus === 'Checked Out') doc.setTextColor(...blueInfo);
      else if (a.attendanceStatus === 'Absent') doc.setTextColor(...accentCrimson);
      else doc.setTextColor(...amberWarning);
      doc.text(a.attendanceStatus || '-', x + 2, currentY + 4.2);
      x += 60;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      doc.text(a.checkInTime || '-', x + 2, currentY + 4.2);

      currentY += 5.8;
    });
  }

  addPageNumbers(doc, 'Daily Business Summary (Executive Briefing)');
  if (typeof window !== 'undefined' || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test')) {
    doc.save(`JB_Daily_Business_Summary_${date}.pdf`);
  }
  return doc;
}
