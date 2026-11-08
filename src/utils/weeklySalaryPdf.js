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
const greenBg = [236, 253, 245];      // #ecfdf5
const amberWarning = [180, 83, 9];    // #b45309
const amberBg = [255, 251, 235];      // #fffbeb
const blueInfo = [30, 64, 175];       // #1e40af
const blueBg = [239, 246, 255];       // #eff6ff
const purpleBg = [243, 232, 255];     // #f3e8ff
const purpleText = [107, 33, 168];    // #6b21a8

/**
 * Format currency in LKR
 */
function formatLKR(amount) {
  const val = Number(amount || 0);
  return `LKR ${val.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Common Header Helper
 */
function drawSalaryReportHeader(doc, {
  reportTitle,
  reportSubtitle,
  weekRange,
  branchName,
  user,
  generatedAt,
  margin,
  contentWidth,
  pageWidth,
  startY = 10
}) {
  let y = startY;

  // Crimson accent strip
  doc.setFillColor(...accentCrimson);
  doc.rect(margin, y, contentWidth, 2.5, 'F');
  y += 5;

  // Brand Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...primaryNavy);
  doc.text('JB GROUP / BELLA DESIGN', margin, y + 4);

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
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text(
    `Generated: ${genDateStr} (Asia/Colombo) | By: ${user?.name || 'Authorized User'} (${user?.role || 'Management'})`,
    pageWidth - margin,
    y + 3.8,
    { align: 'right' }
  );

  y += 7.5;

  // Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...accentCrimson);
  doc.text(reportTitle.toUpperCase(), margin, y + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...textMuted);
  doc.text(reportSubtitle, margin, y + 7);

  // Meta Badges on right side
  const weekLabel = weekRange?.formattedRange ? `Week: ${weekRange.formattedRange}` : 'Current Week';
  const branchLabel = `Branch: ${branchName || 'Consolidated HQ (All Branches)'}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...blueInfo);
  doc.text(weekLabel, pageWidth - margin, y + 3, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textDark);
  doc.text(branchLabel, pageWidth - margin, y + 7, { align: 'right' });

  y += 11;

  // Divider line
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 3;

  return y;
}

/**
 * Add running page numbers across all pages
 */
function addSalaryPageNumbers(doc) {
  const totalPages = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 7, pageWidth - margin, pageHeight - 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...textMuted);
    doc.text(
      'JB GROUP (PVT) LTD  •  Weekly Tailor Salary Management Statement  •  Official Confidential Document',
      margin,
      pageHeight - 3.8
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 3.8, { align: 'right' });
  }
}

/**
 * Generate Complete Weekly Tailor Salary PDF
 */
export function generateWeeklySalaryPDF({
  reportData,
  user = {},
  branchName = 'Consolidated HQ (All Branches)',
  generatedAt = new Date()
}) {
  if (!reportData) {
    throw new Error('Report data is required to generate PDF');
  }

  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();   // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);        // 273 mm

  const summary = reportData.summary || {};
  const weekRange = reportData.weekRange || {};
  const orderTotals = reportData.orderTotals || {};
  const tailorStatements = reportData.tailorStatements || [];
  const rawAllocations = reportData.allocations || [];

  // =========================================================================
  // PAGE 1: EXECUTIVE SUMMARY & INDIVIDUAL TAILOR STATEMENTS
  // =========================================================================
  let currentY = drawSalaryReportHeader(doc, {
    reportTitle: 'Weekly Tailor Salary Management & Disbursement Audit',
    reportSubtitle: 'Authoritative piece-rate payroll statements, 50/25/25 business allocations, and job settlement records',
    weekRange,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth,
    startY: 10
  });

  // --- 1. Top KPI Summary Grid (2 Rows x 4 Cards) ---
  const kpisRow1 = [
    { label: 'TOTAL EARNED (WEEK)', val: formatLKR(summary.totalEarnedInWeek), sub: 'Work completed in week', color: primaryNavy, bg: [241, 245, 249] },
    { label: 'SALARY PAYABLE', val: formatLKR(summary.totalPayable), sub: 'Customer paid in full', color: greenSuccess, bg: greenBg },
    { label: 'HELD (CUSTOMER DUE)', val: formatLKR(summary.totalHeldOnCustomerPayment), sub: 'Customer payment pending', color: amberWarning, bg: amberBg },
    { label: 'WORK PENDING', val: formatLKR(summary.totalWorkPending), sub: 'In-progress assignments', color: textMuted, bg: bgLight }
  ];

  const kpisRow2 = [
    { label: 'SALARY PAID (WEEK)', val: formatLKR(summary.totalPaidInWeek), sub: 'Disbursed in week period', color: purpleText, bg: purpleBg },
    { label: 'CARRIED FORWARD', val: formatLKR(summary.totalCarriedForward), sub: 'Prior week eligible unpaid', color: blueInfo, bg: blueBg },
    { label: 'ACTIVE TAILORS', val: `${summary.participatingTailorsCount || tailorStatements.length} Active`, sub: 'Craftsmen with allocations', color: primaryNavy, bg: [241, 245, 249] },
    { label: 'TOTAL ALLOCATIONS', val: `${reportData.allAllocationsCount || rawAllocations.length} Jobs`, sub: 'Cutting & Stitching total', color: primaryNavy, bg: [241, 245, 249] }
  ];

  const cardWidth = (contentWidth - 9) / 4; // 4 cards with 3mm gaps
  const cardHeight = 15;

  const drawKpiRow = (row, startYPos) => {
    row.forEach((item, idx) => {
      const cardX = margin + idx * (cardWidth + 3);
      doc.setFillColor(...item.bg);
      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.2);
      doc.roundedRect(cardX, startYPos, cardWidth, cardHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.4);
      doc.setTextColor(...item.color);
      doc.text(item.label, cardX + 3, startYPos + 4.2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.8);
      doc.setTextColor(...primaryNavy);
      doc.text(String(item.val), cardX + 3, startYPos + 9.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(...textMuted);
      doc.text(item.sub, cardX + 3, startYPos + 13.2);
    });
  };

  drawKpiRow(kpisRow1, currentY);
  currentY += cardHeight + 2.5;
  drawKpiRow(kpisRow2, currentY);
  currentY += cardHeight + 4;

  // --- 2. Business Allocation Formula & Reconciliation Box ---
  doc.setFillColor(...blueBg);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, currentY, contentWidth, 12, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...blueInfo);
  doc.text('BUSINESS ALLOCATION RULE (50% OFFICE • 25% CUTTING • 25% STITCHING)', margin + 3.5, currentY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...textDark);
  const formulaDesc =
    `Total Agreed Order Value: ${formatLKR(orderTotals.totalAgreedOrderValue)} (100%)  •  ` +
    `Office Overhead: ${formatLKR(orderTotals.totalOfficeAllocation)} (50%)  •  ` +
    `Cutting Pool: ${formatLKR(orderTotals.totalCuttingAllocation)} (25%)  •  ` +
    `Stitching Pool: ${formatLKR(orderTotals.totalStitchingAllocation)} (25%)  •  ` +
    `Tailor Allocation: ${formatLKR(orderTotals.totalTailorAllocation)} (50%)`;
  doc.text(formulaDesc, margin + 3.5, currentY + 8);

  const reconEquation =
    `Reconciliation: Salary Payable (${formatLKR(summary.totalPayable)}) + Customer Holds (${formatLKR(summary.totalHeldOnCustomerPayment)}) = Total Earned (${formatLKR(summary.totalEarnedInWeek)})`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(...greenSuccess);
  doc.text(reconEquation, margin + 3.5, currentY + 11);

  currentY += 15;

  // --- 3. Individual Tailor Statements Summary Table ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...primaryNavy);
  doc.text('INDIVIDUAL TAILOR STATEMENTS (WEEKLY SUMMARY)', margin, currentY + 2);
  currentY += 4.5;

  const stmtCols = [
    { header: '#', width: 10, align: 'left' },
    { header: 'TAILOR NAME', width: 48, align: 'left' },
    { header: 'BRANCH', width: 34, align: 'left' },
    { header: 'JOBS', width: 16, align: 'center' },
    { header: 'EARNED (WEEK)', width: 33, align: 'right' },
    { header: 'PAYABLE NOW', width: 33, align: 'right' },
    { header: 'HELD (CUST DUE)', width: 33, align: 'right' },
    { header: 'WORK PENDING', width: 33, align: 'right' },
    { header: 'PAID (WEEK)', width: 33, align: 'right' }
  ];

  const drawStmtHeader = (yPos) => {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, yPos, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    stmtCols.forEach(col => {
      const posX = col.align === 'right' ? curX + col.width - 2 : col.align === 'center' ? curX + col.width / 2 : curX + 2;
      doc.text(col.header, posX, yPos + 4.5, { align: col.align || 'left' });
      curX += col.width;
    });
    return yPos + 6.5;
  };

  currentY = drawStmtHeader(currentY);

  tailorStatements.forEach((t, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, currentY, contentWidth, 6, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...textDark);

    let curX = margin;
    // #
    doc.text(String(idx + 1), curX + 2, currentY + 4.2);
    curX += stmtCols[0].width;

    // Name
    doc.setFont('helvetica', 'bold');
    doc.text(String(t.tailorName || 'Tailor'), curX + 2, currentY + 4.2);
    curX += stmtCols[1].width;

    // Branch
    doc.setFont('helvetica', 'normal');
    doc.text(String(t.branchName || branchName), curX + 2, currentY + 4.2);
    curX += stmtCols[2].width;

    // Jobs
    doc.text(String(t.jobsCount || 0), curX + stmtCols[3].width / 2, currentY + 4.2, { align: 'center' });
    curX += stmtCols[3].width;

    // Earned
    doc.setFont('helvetica', 'bold');
    doc.text(formatLKR(t.totalEarnedInWeek), curX + stmtCols[4].width - 2, currentY + 4.2, { align: 'right' });
    curX += stmtCols[4].width;

    // Payable
    doc.setTextColor(...greenSuccess);
    doc.text(formatLKR(t.totalPayable), curX + stmtCols[5].width - 2, currentY + 4.2, { align: 'right' });
    curX += stmtCols[5].width;

    // Held
    doc.setTextColor(...amberWarning);
    doc.text(formatLKR(t.totalHeld), curX + stmtCols[6].width - 2, currentY + 4.2, { align: 'right' });
    curX += stmtCols[6].width;

    // Pending
    doc.setTextColor(...textMuted);
    doc.text(formatLKR(t.totalWorkPending), curX + stmtCols[7].width - 2, currentY + 4.2, { align: 'right' });
    curX += stmtCols[7].width;

    // Paid
    doc.setTextColor(...purpleText);
    doc.text(formatLKR(t.totalPaidInWeek), curX + stmtCols[8].width - 2, currentY + 4.2, { align: 'right' });

    currentY += 6;
  });

  // Table Totals Row
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...primaryNavy);

  let curX = margin;
  doc.text('TOTAL ACTIVE TAILORS', curX + 2, currentY + 4.5);
  curX += stmtCols[0].width + stmtCols[1].width + stmtCols[2].width;

  const totalAssignedJobs = tailorStatements.reduce((s, t) => s + (t.jobsCount || 0), 0);
  doc.text(String(totalAssignedJobs), curX + stmtCols[3].width / 2, currentY + 4.5, { align: 'center' });
  curX += stmtCols[3].width;

  doc.text(formatLKR(summary.totalEarnedInWeek), curX + stmtCols[4].width - 2, currentY + 4.5, { align: 'right' });
  curX += stmtCols[4].width;

  doc.setTextColor(...greenSuccess);
  doc.text(formatLKR(summary.totalPayable), curX + stmtCols[5].width - 2, currentY + 4.5, { align: 'right' });
  curX += stmtCols[5].width;

  doc.setTextColor(...amberWarning);
  doc.text(formatLKR(summary.totalHeldOnCustomerPayment), curX + stmtCols[6].width - 2, currentY + 4.5, { align: 'right' });
  curX += stmtCols[6].width;

  doc.setTextColor(...textMuted);
  doc.text(formatLKR(summary.totalWorkPending), curX + stmtCols[7].width - 2, currentY + 4.5, { align: 'right' });
  curX += stmtCols[7].width;

  doc.setTextColor(...purpleText);
  doc.text(formatLKR(summary.totalPaidInWeek), curX + stmtCols[8].width - 2, currentY + 4.5, { align: 'right' });

  currentY += 9;

  // =========================================================================
  // SUBSEQUENT PAGES: COMPLETE ASSIGNED JOBS BREAKDOWN BY TAILOR
  // =========================================================================

  const jobCols = [
    { header: '#', width: 9, align: 'left' },
    { header: 'ORDER #', width: 30, align: 'left' },
    { header: 'WORK TYPE', width: 22, align: 'center' },
    { header: 'GARMENT SPEC', width: 35, align: 'left' },
    { header: 'CUSTOMER NAME', width: 40, align: 'left' },
    { header: 'ORDER VAL', width: 26, align: 'right' },
    { header: 'ALLOCATION (25%)', width: 30, align: 'right' },
    { header: 'CUSTOMER PAYMENT', width: 45, align: 'left' },
    { header: 'SALARY STATUS', width: 36, align: 'center' }
  ];

  const drawJobTableHeader = (yPos) => {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, yPos, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let jX = margin;
    jobCols.forEach(col => {
      const posX = col.align === 'right' ? jX + col.width - 2 : col.align === 'center' ? jX + col.width / 2 : jX + 2;
      doc.text(col.header, posX, yPos + 4.5, { align: col.align || 'left' });
      jX += col.width;
    });
    return yPos + 6.5;
  };

  // Iterate over each tailor and print their complete jobs register
  tailorStatements.forEach((tailor, tIdx) => {
    doc.addPage();
    currentY = drawSalaryReportHeader(doc, {
      reportTitle: `Tailor Statement: ${tailor.tailorName || 'Tailor'} (#${tailor.tailorId})`,
      reportSubtitle: `Complete verified piece-rate allocation ledger (${tailor.jobsCount || 0} assigned jobs)`,
      weekRange,
      branchName: tailor.branchName || branchName,
      user,
      generatedAt,
      margin,
      contentWidth,
      pageWidth,
      startY: 10
    });

    // Tailor Mini Summary Card
    doc.setFillColor(...blueBg);
    doc.setDrawColor(...borderLight);
    doc.roundedRect(margin, currentY, contentWidth, 12, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...primaryNavy);
    doc.text(`CRAFTSMAN: ${tailor.tailorName} (${tailor.branchName || branchName})`, margin + 3.5, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...textDark);
    const tailorMetricsLine =
      `Assigned Jobs: ${tailor.jobsCount}  |  ` +
      `Total Earned (Week): ${formatLKR(tailor.totalEarnedInWeek)}  |  ` +
      `Payable Now: ${formatLKR(tailor.totalPayable)}  |  ` +
      `Held (Customer Due): ${formatLKR(tailor.totalHeld)}  |  ` +
      `Work Pending: ${formatLKR(tailor.totalWorkPending)}  |  ` +
      `Paid in Week: ${formatLKR(tailor.totalPaidInWeek)}`;
    doc.text(tailorMetricsLine, margin + 3.5, currentY + 9);

    currentY += 15;

    // Jobs Table for this tailor
    currentY = drawJobTableHeader(currentY);

    const jobs = tailor.jobs || [];
    jobs.forEach((job, jIdx) => {
      const rowHeight = 6.2;
      // Auto page break if table exceeds page
      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        currentY = drawSalaryReportHeader(doc, {
          reportTitle: `Tailor Statement: ${tailor.tailorName} (Continued)`,
          reportSubtitle: 'Complete assigned jobs breakdown continuation',
          weekRange,
          branchName: tailor.branchName || branchName,
          user,
          generatedAt,
          margin,
          contentWidth,
          pageWidth,
          startY: 10
        });
        currentY = drawJobTableHeader(currentY);
      }

      const isEven = jIdx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(...textDark);

      let jX = margin;
      // 1. #
      doc.text(String(jIdx + 1), jX + 2, currentY + 4.2);
      jX += jobCols[0].width;

      // 2. Order #
      doc.setFont('helvetica', 'bold');
      doc.text(String(job.orderNumber || '-'), jX + 2, currentY + 4.2);
      jX += jobCols[1].width;

      // 3. Work Type (with badge color)
      doc.setFont('helvetica', 'bold');
      if (job.workType === 'CUTTING') {
        doc.setTextColor(...blueInfo);
      } else {
        doc.setTextColor(...purpleText);
      }
      doc.text(String(job.workTypeName || job.workType), jX + jobCols[2].width / 2, currentY + 4.2, { align: 'center' });
      jX += jobCols[2].width;

      // 4. Garment Spec
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      const garmentText = String(job.dressType || 'Garment').slice(0, 24);
      doc.text(garmentText, jX + 2, currentY + 4.2);
      jX += jobCols[3].width;

      // 5. Customer Name
      const customerText = String(job.customerName || 'Customer').slice(0, 24);
      doc.text(customerText, jX + 2, currentY + 4.2);
      jX += jobCols[4].width;

      // 6. Order Value
      doc.text(formatLKR(job.agreedPrice), jX + jobCols[5].width - 2, currentY + 4.2, { align: 'right' });
      jX += jobCols[5].width;

      // 7. Salary (25%)
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryNavy);
      doc.text(formatLKR(job.allocatedAmount), jX + jobCols[6].width - 2, currentY + 4.2, { align: 'right' });
      jX += jobCols[6].width;

      // 8. Customer Payment
      doc.setFont('helvetica', 'normal');
      if (job.isCustomerFullyPaid) {
        doc.setTextColor(...greenSuccess);
        doc.text('Paid in Full', jX + 2, currentY + 4.2);
      } else if (Number(job.customerTotalPaid) > 0) {
        doc.setTextColor(...amberWarning);
        doc.text(`Partial (Due: ${formatLKR(job.customerBalanceDue)})`, jX + 2, currentY + 4.2);
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text(`Unpaid (Due: ${formatLKR(job.customerBalanceDue)})`, jX + 2, currentY + 4.2);
      }
      jX += jobCols[7].width;

      // 9. Salary Status Badge
      doc.setFont('helvetica', 'bold');
      if (job.status === 'PAYABLE') {
        doc.setTextColor(...greenSuccess);
        doc.text('PAYABLE', jX + jobCols[8].width / 2, currentY + 4.2, { align: 'center' });
      } else if (job.status === 'ON_HOLD_CUSTOMER_PAYMENT') {
        doc.setTextColor(...amberWarning);
        doc.text('HELD (CUST UNPAID)', jX + jobCols[8].width / 2, currentY + 4.2, { align: 'center' });
      } else if (job.status === 'WORK_PENDING') {
        doc.setTextColor(...textMuted);
        doc.text('WORK PENDING', jX + jobCols[8].width / 2, currentY + 4.2, { align: 'center' });
      } else if (job.status === 'PAID') {
        doc.setTextColor(...purpleText);
        doc.text('PAID', jX + jobCols[8].width / 2, currentY + 4.2, { align: 'center' });
      } else {
        doc.setTextColor(...textMuted);
        doc.text(String(job.status || '-'), jX + jobCols[8].width / 2, currentY + 4.2, { align: 'center' });
      }

      currentY += rowHeight;
    });

    // Subtotal Row for this tailor
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, currentY, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...primaryNavy);

    let subX = margin;
    doc.text(`SUBTOTAL FOR ${tailor.tailorName.toUpperCase()} (${jobs.length} JOBS)`, subX + 2, currentY + 4.5);
    subX += jobCols[0].width + jobCols[1].width + jobCols[2].width + jobCols[3].width + jobCols[4].width + jobCols[5].width;

    const tailorTotalAllocated = jobs.reduce((s, j) => s + (j.allocatedAmount || 0), 0);
    doc.text(formatLKR(tailorTotalAllocated), subX + jobCols[6].width - 2, currentY + 4.5, { align: 'right' });
    subX += jobCols[6].width;

    doc.setTextColor(...greenSuccess);
    doc.text(`Payable: ${formatLKR(tailor.totalPayable)}`, subX + 2, currentY + 4.5);
    subX += jobCols[7].width;

    doc.setTextColor(...amberWarning);
    doc.text(`Held: ${formatLKR(tailor.totalHeld)}`, subX + jobCols[8].width / 2, currentY + 4.5, { align: 'center' });

    currentY += 8;
  });

  // =========================================================================
  // FINAL PAGE: UNASSIGNED WORK & MANAGEMENT AUDIT RECONCILIATION
  // =========================================================================
  const unassignedJobs = rawAllocations.filter(a => !a.tailorId);
  doc.addPage();
  currentY = drawSalaryReportHeader(doc, {
    reportTitle: 'Weekly Salary Final Audit & Management Sign-Off',
    reportSubtitle: 'Reconciliation certification, unassigned work ledger, and executive sign-off sheet',
    weekRange,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth,
    startY: 10
  });

  if (unassignedJobs.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...amberWarning);
    doc.text(`UNASSIGNED ALLOCATIONS REQUIRING CRAFTSMAN DISPATCH (${unassignedJobs.length} JOBS)`, margin, currentY + 2);
    currentY += 4.5;

    currentY = drawJobTableHeader(currentY);

    unassignedJobs.forEach((job, uIdx) => {
      const isEven = uIdx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, currentY, contentWidth, 5.8, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(...textDark);

      let jX = margin;
      doc.text(String(uIdx + 1), jX + 2, currentY + 4);
      jX += jobCols[0].width;

      doc.setFont('helvetica', 'bold');
      doc.text(String(job.orderNumber || '-'), jX + 2, currentY + 4);
      jX += jobCols[1].width;

      doc.text(String(job.workTypeName || job.workType), jX + jobCols[2].width / 2, currentY + 4, { align: 'center' });
      jX += jobCols[2].width;

      doc.setFont('helvetica', 'normal');
      doc.text(String(job.dressType || 'Garment').slice(0, 24), jX + 2, currentY + 4);
      jX += jobCols[3].width;

      doc.text(String(job.customerName || 'Customer').slice(0, 24), jX + 2, currentY + 4);
      jX += jobCols[4].width;

      doc.text(formatLKR(job.agreedPrice), jX + jobCols[5].width - 2, currentY + 4, { align: 'right' });
      jX += jobCols[5].width;

      doc.setFont('helvetica', 'bold');
      doc.text(formatLKR(job.allocatedAmount), jX + jobCols[6].width - 2, currentY + 4, { align: 'right' });
      jX += jobCols[6].width;

      doc.setFont('helvetica', 'normal');
      doc.text(job.isCustomerFullyPaid ? 'Paid in Full' : `Due: ${formatLKR(job.customerBalanceDue)}`, jX + 2, currentY + 4);
      jX += jobCols[7].width;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textMuted);
      doc.text('UNASSIGNED', jX + jobCols[8].width / 2, currentY + 4, { align: 'center' });

      currentY += 5.8;
    });

    currentY += 6;
  }

  // --- Final Management Certification & Audit Block ---
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, currentY, contentWidth, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...primaryNavy);
  doc.text('EXECUTIVE AUDIT & RECONCILIATION CERTIFICATION', margin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...textDark);
  const certP1 =
    'This document represents the authoritative Weekly Tailor Salary register generated from live PostgreSQL database records. ' +
    'All allocations strictly conform to the 50% Company Overhead, 25% Cutting Tailor, and 25% Stitching Tailor allocation formula. ' +
    'Salary allocations are certified PAYABLE only upon verified work completion and full customer settlement.';
  doc.text(certP1, margin + 4, currentY + 9, { maxWidth: contentWidth - 8 });

  // Signature lines
  const sigY = currentY + 22;
  const colWidth = (contentWidth - 16) / 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);

  // Sign 1: Branch Manager
  doc.line(margin + 4, sigY, margin + 4 + colWidth - 8, sigY);
  doc.text('Prepared By: Branch Manager / Accountant', margin + 4, sigY + 3.5);

  // Sign 2: Production Supervisor
  doc.line(margin + 8 + colWidth, sigY, margin + 8 + (colWidth * 2) - 8, sigY);
  doc.text('Verified By: Production Floor Supervisor', margin + 8 + colWidth, sigY + 3.5);

  // Sign 3: CEO
  doc.line(margin + 12 + (colWidth * 2), sigY, margin + 12 + (colWidth * 3) - 8, sigY);
  doc.text('Approved for Payout: CEO / Executive Director', margin + 12 + (colWidth * 2), sigY + 3.5);

  // Add Page numbers to all pages
  addSalaryPageNumbers(doc);

  // Save filename format
  const startStr = weekRange.startDateStr || 'start';
  const endStr = weekRange.endDateStr || 'end';
  const fileName = `JB_GROUP_Weekly_Tailor_Salary_${startStr}_to_${endStr}.pdf`;

  return { doc, fileName };
}

