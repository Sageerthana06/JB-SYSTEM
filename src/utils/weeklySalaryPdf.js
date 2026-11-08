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
export function formatLKR(amount) {
  const val = Number(amount || 0);
  return `LKR ${val.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date in Asia/Colombo timezone
 */
export function formatColomboDate(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
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
    : new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' });

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
 * Draw Executive Sign-off block
 */
function drawSignOffBlock(doc, currentY, margin, contentWidth) {
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, currentY, contentWidth, 30, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...primaryNavy);
  doc.text('EXECUTIVE AUDIT & RECONCILIATION CERTIFICATION', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textDark);
  const certP1 =
    'This document represents the authoritative Weekly Tailor Salary record generated directly from PostgreSQL database records. ' +
    'Allocations strictly adhere to the 50% Company Overhead, 25% Cutting Tailor, and 25% Stitching Tailor formula. ' +
    'Salaries are certified payable only upon verified task completion and full customer invoice settlement.';
  doc.text(certP1, margin + 4, currentY + 8.5, { maxWidth: contentWidth - 8 });

  const sigY = currentY + 21;
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

  return currentY + 32;
}

// ============================================================================
// 1. REPORT: FULL COMBINED WEEKLY SALARY PDF (Existing)
// ============================================================================
export function generateWeeklySalaryPDF({
  reportData,
  user = {},
  branchName = 'Consolidated HQ (All Branches)',
  generatedAt = new Date()
}) {
  if (!reportData) throw new Error('Report data is required to generate PDF');

  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  const summary = reportData.summary || {};
  const weekRange = reportData.weekRange || {};
  const orderTotals = reportData.orderTotals || {};
  const tailorStatements = reportData.tailorStatements || [];
  const rawAllocations = reportData.allocations || [];

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

  const cardWidth = (contentWidth - 9) / 4;
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
    doc.text(String(idx + 1), curX + 2, currentY + 4.2);
    curX += stmtCols[0].width;

    doc.setFont('helvetica', 'bold');
    doc.text(String(t.tailorName || 'Tailor').slice(0, 24), curX + 2, currentY + 4.2);
    curX += stmtCols[1].width;

    doc.setFont('helvetica', 'normal');
    doc.text(String(t.branchName || branchName).slice(0, 18), curX + 2, currentY + 4.2);
    curX += stmtCols[2].width;

    doc.text(String(t.jobsCount || 0), curX + stmtCols[3].width / 2, currentY + 4.2, { align: 'center' });
    curX += stmtCols[3].width;

    doc.setFont('helvetica', 'bold');
    doc.text(formatLKR(t.totalEarnedInWeek), curX + stmtCols[4].width - 2, currentY + 4.2, { align: 'right' });
    curX += stmtCols[4].width;

    doc.setTextColor(...greenSuccess);
    doc.text(formatLKR(t.totalPayable), curX + stmtCols[5].width - 2, currentY + 4.2, { align: 'right' });
    curX += stmtCols[5].width;

    doc.setTextColor(...amberWarning);
    doc.text(formatLKR(t.totalHeld), curX + stmtCols[6].width - 2, currentY + 4.2, { align: 'right' });
    curX += stmtCols[6].width;

    doc.setTextColor(...textMuted);
    doc.text(formatLKR(t.totalWorkPending), curX + stmtCols[7].width - 2, currentY + 4.2, { align: 'right' });
    curX += stmtCols[7].width;

    doc.setTextColor(...purpleText);
    doc.text(formatLKR(t.totalPaidInWeek), curX + stmtCols[8].width - 2, currentY + 4.2, { align: 'right' });

    currentY += 6;
  });

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

  // Job columns definition
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

  // Subsequent pages for each tailor
  tailorStatements.forEach(tailor => {
    doc.addPage();
    let tailorY = drawSalaryReportHeader(doc, {
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

    doc.setFillColor(...blueBg);
    doc.setDrawColor(...borderLight);
    doc.roundedRect(margin, tailorY, contentWidth, 12, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...primaryNavy);
    doc.text(`CRAFTSMAN: ${tailor.tailorName} (${tailor.branchName || branchName})`, margin + 3.5, tailorY + 4.5);

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
    doc.text(tailorMetricsLine, margin + 3.5, tailorY + 9);

    tailorY += 15;
    tailorY = drawJobTableHeader(tailorY);

    const jobs = tailor.jobs || [];
    jobs.forEach((job, jIdx) => {
      const rowHeight = 6.2;
      if (tailorY + rowHeight > pageHeight - 16) {
        doc.addPage();
        tailorY = drawSalaryReportHeader(doc, {
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
        tailorY = drawJobTableHeader(tailorY);
      }

      const isEven = jIdx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, tailorY, contentWidth, rowHeight, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(...textDark);

      let jX = margin;
      doc.text(String(jIdx + 1), jX + 2, tailorY + 4.2);
      jX += jobCols[0].width;

      doc.setFont('helvetica', 'bold');
      doc.text(String(job.orderNumber || '-').slice(0, 18), jX + 2, tailorY + 4.2);
      jX += jobCols[1].width;

      doc.setFont('helvetica', 'bold');
      if (job.workType === 'CUTTING') doc.setTextColor(...blueInfo);
      else doc.setTextColor(...purpleText);
      doc.text(String(job.workTypeName || job.workType), jX + jobCols[2].width / 2, tailorY + 4.2, { align: 'center' });
      jX += jobCols[2].width;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      doc.text(String(job.dressType || 'Garment').slice(0, 24), jX + 2, tailorY + 4.2);
      jX += jobCols[3].width;

      doc.text(String(job.customerName || 'Customer').slice(0, 24), jX + 2, tailorY + 4.2);
      jX += jobCols[4].width;

      doc.text(formatLKR(job.agreedPrice), jX + jobCols[5].width - 2, tailorY + 4.2, { align: 'right' });
      jX += jobCols[5].width;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryNavy);
      doc.text(formatLKR(job.allocatedAmount), jX + jobCols[6].width - 2, tailorY + 4.2, { align: 'right' });
      jX += jobCols[6].width;

      doc.setFont('helvetica', 'normal');
      if (job.isCustomerFullyPaid) {
        doc.setTextColor(...greenSuccess);
        doc.text('Paid in Full', jX + 2, tailorY + 4.2);
      } else if (Number(job.customerTotalPaid) > 0) {
        doc.setTextColor(...amberWarning);
        doc.text(`Partial (Due: ${formatLKR(job.customerBalanceDue)})`, jX + 2, tailorY + 4.2);
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text(`Unpaid (Due: ${formatLKR(job.customerBalanceDue)})`, jX + 2, tailorY + 4.2);
      }
      jX += jobCols[7].width;

      doc.setFont('helvetica', 'bold');
      if (job.status === 'PAYABLE') {
        doc.setTextColor(...greenSuccess);
        doc.text('PAYABLE', jX + jobCols[8].width / 2, tailorY + 4.2, { align: 'center' });
      } else if (job.status === 'ON_HOLD_CUSTOMER_PAYMENT') {
        doc.setTextColor(...amberWarning);
        doc.text('HELD (CUST UNPAID)', jX + jobCols[8].width / 2, tailorY + 4.2, { align: 'center' });
      } else if (job.status === 'WORK_PENDING') {
        doc.setTextColor(...textMuted);
        doc.text('WORK PENDING', jX + jobCols[8].width / 2, tailorY + 4.2, { align: 'center' });
      } else if (job.status === 'PAID') {
        doc.setTextColor(...purpleText);
        doc.text('PAID', jX + jobCols[8].width / 2, tailorY + 4.2, { align: 'center' });
      } else {
        doc.setTextColor(...textMuted);
        doc.text(String(job.status || '-'), jX + jobCols[8].width / 2, tailorY + 4.2, { align: 'center' });
      }

      tailorY += rowHeight;
    });

    // Check overflow before subtotal row
    if (tailorY + 8 > pageHeight - 16) {
      doc.addPage();
      tailorY = drawSalaryReportHeader(doc, {
        reportTitle: `Tailor Statement: ${tailor.tailorName} (Subtotal)`,
        reportSubtitle: 'Subtotal summary continuation',
        weekRange,
        branchName: tailor.branchName || branchName,
        user,
        generatedAt,
        margin,
        contentWidth,
        pageWidth,
        startY: 10
      });
    }

    // Subtotal Row
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, tailorY, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...primaryNavy);

    let subX = margin;
    doc.text(`SUBTOTAL FOR ${tailor.tailorName.toUpperCase()} (${jobs.length} JOBS)`, subX + 2, tailorY + 4.5);
    subX += jobCols[0].width + jobCols[1].width + jobCols[2].width + jobCols[3].width + jobCols[4].width + jobCols[5].width;

    const tailorTotalAllocated = jobs.reduce((s, j) => s + (j.allocatedAmount || 0), 0);
    doc.text(formatLKR(tailorTotalAllocated), subX + jobCols[6].width - 2, tailorY + 4.5, { align: 'right' });
    subX += jobCols[6].width;

    doc.setTextColor(...greenSuccess);
    doc.text(`Payable: ${formatLKR(tailor.totalPayable)}`, subX + 2, tailorY + 4.5);
    subX += jobCols[7].width;

    doc.setTextColor(...amberWarning);
    doc.text(`Held: ${formatLKR(tailor.totalHeld)}`, subX + jobCols[8].width / 2, tailorY + 4.5, { align: 'center' });
  });

  // Final Page: Unassigned + Sign-off
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
      doc.text(String(job.orderNumber || '-').slice(0, 18), jX + 2, currentY + 4);
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

  // Check overflow before sign-off block
  if (currentY + 34 > pageHeight - 16) {
    doc.addPage();
    currentY = drawSalaryReportHeader(doc, {
      reportTitle: 'Weekly Salary Final Audit & Management Sign-Off',
      reportSubtitle: 'Executive sign-off sheet continuation',
      weekRange,
      branchName,
      user,
      generatedAt,
      margin,
      contentWidth,
      pageWidth,
      startY: 10
    });
  }

  drawSignOffBlock(doc, currentY, margin, contentWidth);
  addSalaryPageNumbers(doc);

  const startStr = weekRange.startDateStr || 'start';
  const endStr = weekRange.endDateStr || 'end';
  const fileName = `JB_GROUP_Weekly_Tailor_Salary_${startStr}_to_${endStr}.pdf`;

  return { doc, fileName };
}

// ============================================================================
// 2. REPORT: ALL SALARY ALLOCATIONS PDF
// ============================================================================
export function generateAllAllocationsPDF({
  reportData,
  user = {},
  branchName = 'Consolidated HQ (All Branches)',
  generatedAt = new Date()
}) {
  if (!reportData) throw new Error('Report data is required');

  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  const weekRange = reportData.weekRange || {};
  const orderTotals = reportData.orderTotals || {};
  const allocations = reportData.allocations || [];
  const summary = reportData.summary || {};

  let currentY = drawSalaryReportHeader(doc, {
    reportTitle: 'All Salary Allocations Ledger',
    reportSubtitle: `Complete piece-rate allocation ledger across all qualifying orders (${allocations.length} total allocations)`,
    weekRange,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth,
    startY: 10
  });

  // KPI Quick Summary Bar (5 mini cards)
  const kpiCols = [
    { label: 'ALLOCATIONS', val: `${allocations.length} Jobs`, color: primaryNavy, bg: [241, 245, 249] },
    { label: 'AGREED ORDERS', val: formatLKR(orderTotals.totalAgreedOrderValue), color: primaryNavy, bg: [241, 245, 249] },
    { label: 'SALARY PAYABLE', val: formatLKR(summary.totalPayable), color: greenSuccess, bg: greenBg },
    { label: 'CUSTOMER HELD', val: formatLKR(summary.totalHeldOnCustomerPayment), color: amberWarning, bg: amberBg },
    { label: 'WORK PENDING', val: formatLKR(summary.totalWorkPending), color: textMuted, bg: bgLight }
  ];

  const colW = (contentWidth - 12) / 5;
  kpiCols.forEach((c, idx) => {
    const cX = margin + idx * (colW + 3);
    doc.setFillColor(...c.bg);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.2);
    doc.roundedRect(cX, currentY, colW, 11, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...c.color);
    doc.text(c.label, cX + 2.5, currentY + 3.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryNavy);
    doc.text(c.val, cX + 2.5, currentY + 8.2);
  });

  currentY += 15;

  const allocCols = [
    { header: '#', width: 9, align: 'left' },
    { header: 'ORDER #', width: 28, align: 'left' },
    { header: 'TAILOR', width: 34, align: 'left' },
    { header: 'WORK', width: 20, align: 'center' },
    { header: 'GARMENT SPEC', width: 34, align: 'left' },
    { header: 'CUSTOMER NAME', width: 38, align: 'left' },
    { header: 'ORDER VAL', width: 25, align: 'right' },
    { header: 'SALARY (25%)', width: 26, align: 'right' },
    { header: 'CUSTOMER SETTLEMENT', width: 34, align: 'left' },
    { header: 'STATUS', width: 25, align: 'center' }
  ];

  const drawAllocTableHeader = (yPos) => {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, yPos, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let aX = margin;
    allocCols.forEach(col => {
      const posX = col.align === 'right' ? aX + col.width - 2 : col.align === 'center' ? aX + col.width / 2 : aX + 2;
      doc.text(col.header, posX, yPos + 4.5, { align: col.align || 'left' });
      aX += col.width;
    });
    return yPos + 6.5;
  };

  currentY = drawAllocTableHeader(currentY);

  let sumOrderVal = 0;
  let sumSalaryAlloc = 0;

  allocations.forEach((alloc, aIdx) => {
    const rowHeight = 6.2;
    if (currentY + rowHeight > pageHeight - 16) {
      doc.addPage();
      currentY = drawSalaryReportHeader(doc, {
        reportTitle: 'All Salary Allocations Ledger (Continued)',
        reportSubtitle: 'Authoritative piece-rate allocation ledger continuation',
        weekRange,
        branchName,
        user,
        generatedAt,
        margin,
        contentWidth,
        pageWidth,
        startY: 10
      });
      currentY = drawAllocTableHeader(currentY);
    }

    sumOrderVal += Number(alloc.agreedPrice || 0);
    sumSalaryAlloc += Number(alloc.allocatedAmount || 0);

    const isEven = aIdx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, currentY, contentWidth, rowHeight, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...textDark);

    let aX = margin;
    doc.text(String(aIdx + 1), aX + 2, currentY + 4.2);
    aX += allocCols[0].width;

    doc.setFont('helvetica', 'bold');
    doc.text(String(alloc.orderNumber || '-').slice(0, 18), aX + 2, currentY + 4.2);
    aX += allocCols[1].width;

    doc.setFont('helvetica', alloc.tailorId ? 'bold' : 'normal');
    if (!alloc.tailorId) doc.setTextColor(...textMuted);
    doc.text(String(alloc.tailorName || 'Unassigned').slice(0, 18), aX + 2, currentY + 4.2);
    aX += allocCols[2].width;

    doc.setFont('helvetica', 'bold');
    if (alloc.workType === 'CUTTING') doc.setTextColor(...blueInfo);
    else doc.setTextColor(...purpleText);
    doc.text(String(alloc.workTypeName || alloc.workType), aX + allocCols[3].width / 2, currentY + 4.2, { align: 'center' });
    aX += allocCols[3].width;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text(String(alloc.dressType || 'Garment').slice(0, 20), aX + 2, currentY + 4.2);
    aX += allocCols[4].width;

    doc.text(String(alloc.customerName || 'Customer').slice(0, 22), aX + 2, currentY + 4.2);
    aX += allocCols[5].width;

    doc.text(formatLKR(alloc.agreedPrice), aX + allocCols[6].width - 2, currentY + 4.2, { align: 'right' });
    aX += allocCols[6].width;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    doc.text(formatLKR(alloc.allocatedAmount), aX + allocCols[7].width - 2, currentY + 4.2, { align: 'right' });
    aX += allocCols[7].width;

    doc.setFont('helvetica', 'normal');
    if (alloc.isCustomerFullyPaid) {
      doc.setTextColor(...greenSuccess);
      doc.text('Paid in Full', aX + 2, currentY + 4.2);
    } else if (Number(alloc.customerTotalPaid) > 0) {
      doc.setTextColor(...amberWarning);
      doc.text(`Partial (Due: ${formatLKR(alloc.customerBalanceDue)})`, aX + 2, currentY + 4.2);
    } else {
      doc.setTextColor(220, 38, 38);
      doc.text(`Unpaid (Due: ${formatLKR(alloc.customerBalanceDue)})`, aX + 2, currentY + 4.2);
    }
    aX += allocCols[8].width;

    doc.setFont('helvetica', 'bold');
    if (alloc.status === 'PAYABLE') {
      doc.setTextColor(...greenSuccess);
      doc.text('PAYABLE', aX + allocCols[9].width / 2, currentY + 4.2, { align: 'center' });
    } else if (alloc.status === 'ON_HOLD_CUSTOMER_PAYMENT') {
      doc.setTextColor(...amberWarning);
      doc.text('HELD', aX + allocCols[9].width / 2, currentY + 4.2, { align: 'center' });
    } else if (alloc.status === 'WORK_PENDING') {
      doc.setTextColor(...textMuted);
      doc.text('PENDING', aX + allocCols[9].width / 2, currentY + 4.2, { align: 'center' });
    } else if (alloc.status === 'PAID') {
      doc.setTextColor(...purpleText);
      doc.text('PAID', aX + allocCols[9].width / 2, currentY + 4.2, { align: 'center' });
    } else {
      doc.setTextColor(...textMuted);
      doc.text(String(alloc.status || '-'), aX + allocCols[9].width / 2, currentY + 4.2, { align: 'center' });
    }

    currentY += rowHeight;
  });

  // Check overflow before Table Totals Row
  if (currentY + 12 > pageHeight - 16) {
    doc.addPage();
    currentY = drawSalaryReportHeader(doc, {
      reportTitle: 'All Salary Allocations Ledger (Totals)',
      reportSubtitle: 'Grand totals summary continuation',
      weekRange,
      branchName,
      user,
      generatedAt,
      margin,
      contentWidth,
      pageWidth,
      startY: 10
    });
  }

  // Table Totals Row
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...primaryNavy);

  let totX = margin;
  doc.text(`TOTAL ALLOCATIONS (${allocations.length} JOBS)`, totX + 2, currentY + 4.8);
  totX += allocCols[0].width + allocCols[1].width + allocCols[2].width + allocCols[3].width + allocCols[4].width + allocCols[5].width;

  doc.text(formatLKR(sumOrderVal / 2), totX + allocCols[6].width - 2, currentY + 4.8, { align: 'right' });
  totX += allocCols[6].width;

  doc.text(formatLKR(sumSalaryAlloc), totX + allocCols[7].width - 2, currentY + 4.8, { align: 'right' });
  totX += allocCols[7].width;

  doc.setTextColor(...greenSuccess);
  doc.text(`Payable: ${formatLKR(summary.totalPayable)}`, totX + 2, currentY + 4.8);
  totX += allocCols[8].width;

  doc.setTextColor(...amberWarning);
  doc.text(`Held: ${formatLKR(summary.totalHeldOnCustomerPayment)}`, totX + allocCols[9].width / 2, currentY + 4.8, { align: 'center' });

  addSalaryPageNumbers(doc);

  const startStr = weekRange.startDateStr || 'start';
  const endStr = weekRange.endDateStr || 'end';
  const fileName = `JB_GROUP_Salary_Allocations_${startStr}_to_${endStr}.pdf`;

  return { doc, fileName };
}

// ============================================================================
// 3. REPORT: INDIVIDUAL TAILOR STATEMENTS SUMMARY PDF
// ============================================================================
export function generateTailorsSummaryPDF({
  reportData,
  user = {},
  branchName = 'Consolidated HQ (All Branches)',
  generatedAt = new Date()
}) {
  if (!reportData) throw new Error('Report data is required');

  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  const summary = reportData.summary || {};
  const weekRange = reportData.weekRange || {};
  const tailorStatements = reportData.tailorStatements || [];

  let currentY = drawSalaryReportHeader(doc, {
    reportTitle: 'Individual Tailor Statements Summary',
    reportSubtitle: 'Executive summary of piece-rate allocations, payable balances, customer holds, and payout totals',
    weekRange,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth,
    startY: 10
  });

  const kpis = [
    { label: 'TOTAL EARNED (WEEK)', val: formatLKR(summary.totalEarnedInWeek), sub: 'Work completed in week', color: primaryNavy, bg: [241, 245, 249] },
    { label: 'SALARY PAYABLE', val: formatLKR(summary.totalPayable), sub: 'Customer paid in full', color: greenSuccess, bg: greenBg },
    { label: 'HELD ON CUSTOMER', val: formatLKR(summary.totalHeldOnCustomerPayment), sub: 'Customer balance due', color: amberWarning, bg: amberBg },
    { label: 'WORK PENDING', val: formatLKR(summary.totalWorkPending), sub: 'Incomplete tasks', color: textMuted, bg: bgLight },
    { label: 'ACTIVE TAILORS', val: `${tailorStatements.length} Craftsmen`, sub: 'Participating this week', color: primaryNavy, bg: [241, 245, 249] }
  ];

  const cWidth = (contentWidth - 12) / 5;
  kpis.forEach((k, idx) => {
    const kX = margin + idx * (cWidth + 3);
    doc.setFillColor(...k.bg);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.2);
    doc.roundedRect(kX, currentY, cWidth, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...k.color);
    doc.text(k.label, kX + 3, currentY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...primaryNavy);
    doc.text(k.val, kX + 3, currentY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...textMuted);
    doc.text(k.sub, kX + 3, currentY + 12.5);
  });

  currentY += 18;

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

  doc.setFillColor(...primaryNavy);
  doc.rect(margin, currentY, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);

  let curX = margin;
  stmtCols.forEach(col => {
    const posX = col.align === 'right' ? curX + col.width - 2 : col.align === 'center' ? curX + col.width / 2 : curX + 2;
    doc.text(col.header, posX, currentY + 4.5, { align: col.align || 'left' });
    curX += col.width;
  });
  currentY += 6.5;

  tailorStatements.forEach((t, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, currentY, contentWidth, 6.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...textDark);

    let rowX = margin;
    doc.text(String(idx + 1), rowX + 2, currentY + 4.5);
    rowX += stmtCols[0].width;

    doc.setFont('helvetica', 'bold');
    doc.text(String(t.tailorName || 'Tailor').slice(0, 24), rowX + 2, currentY + 4.5);
    rowX += stmtCols[1].width;

    doc.setFont('helvetica', 'normal');
    doc.text(String(t.branchName || branchName).slice(0, 18), rowX + 2, currentY + 4.5);
    rowX += stmtCols[2].width;

    doc.text(String(t.jobsCount || 0), rowX + stmtCols[3].width / 2, currentY + 4.5, { align: 'center' });
    rowX += stmtCols[3].width;

    doc.setFont('helvetica', 'bold');
    doc.text(formatLKR(t.totalEarnedInWeek), rowX + stmtCols[4].width - 2, currentY + 4.5, { align: 'right' });
    rowX += stmtCols[4].width;

    doc.setTextColor(...greenSuccess);
    doc.text(formatLKR(t.totalPayable), rowX + stmtCols[5].width - 2, currentY + 4.5, { align: 'right' });
    rowX += stmtCols[5].width;

    doc.setTextColor(...amberWarning);
    doc.text(formatLKR(t.totalHeld), rowX + stmtCols[6].width - 2, currentY + 4.5, { align: 'right' });
    rowX += stmtCols[6].width;

    doc.setTextColor(...textMuted);
    doc.text(formatLKR(t.totalWorkPending), rowX + stmtCols[7].width - 2, currentY + 4.5, { align: 'right' });
    rowX += stmtCols[7].width;

    doc.setTextColor(...purpleText);
    doc.text(formatLKR(t.totalPaidInWeek), rowX + stmtCols[8].width - 2, currentY + 4.5, { align: 'right' });

    currentY += 6.5;
  });

  // Table Totals
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...primaryNavy);

  let totX = margin;
  doc.text('TOTAL ACTIVE TAILORS', totX + 2, currentY + 4.8);
  totX += stmtCols[0].width + stmtCols[1].width + stmtCols[2].width;

  const totalAssignedJobs = tailorStatements.reduce((s, t) => s + (t.jobsCount || 0), 0);
  doc.text(String(totalAssignedJobs), totX + stmtCols[3].width / 2, currentY + 4.8, { align: 'center' });
  totX += stmtCols[3].width;

  doc.text(formatLKR(summary.totalEarnedInWeek), totX + stmtCols[4].width - 2, currentY + 4.8, { align: 'right' });
  totX += stmtCols[4].width;

  doc.setTextColor(...greenSuccess);
  doc.text(formatLKR(summary.totalPayable), totX + stmtCols[5].width - 2, currentY + 4.8, { align: 'right' });
  totX += stmtCols[5].width;

  doc.setTextColor(...amberWarning);
  doc.text(formatLKR(summary.totalHeldOnCustomerPayment), totX + stmtCols[6].width - 2, currentY + 4.8, { align: 'right' });
  totX += stmtCols[6].width;

  doc.setTextColor(...textMuted);
  doc.text(formatLKR(summary.totalWorkPending), totX + stmtCols[7].width - 2, currentY + 4.8, { align: 'right' });
  totX += stmtCols[7].width;

  doc.setTextColor(...purpleText);
  doc.text(formatLKR(summary.totalPaidInWeek), totX + stmtCols[8].width - 2, currentY + 4.8, { align: 'right' });

  currentY += 12;

  // Check overflow before sign-off block
  if (currentY + 34 > pageHeight - 16) {
    doc.addPage();
    currentY = drawSalaryReportHeader(doc, {
      reportTitle: 'Individual Tailor Statements Summary (Sign-Off)',
      reportSubtitle: 'Executive sign-off sheet continuation',
      weekRange,
      branchName,
      user,
      generatedAt,
      margin,
      contentWidth,
      pageWidth,
      startY: 10
    });
  }

  drawSignOffBlock(doc, currentY, margin, contentWidth);
  addSalaryPageNumbers(doc);

  const startStr = weekRange.startDateStr || 'start';
  const endStr = weekRange.endDateStr || 'end';
  const fileName = `JB_GROUP_Tailor_Statements_Summary_${startStr}_to_${endStr}.pdf`;

  return { doc, fileName };
}

// ============================================================================
// 4. REPORT: SINGLE TAILOR STATEMENT PDF (Dedicated for a specific tailor)
// ============================================================================
export function generateSingleTailorPDF({
  tailor,
  reportData,
  user = {},
  branchName = 'Consolidated HQ (All Branches)',
  generatedAt = new Date()
}) {
  if (!tailor) throw new Error('Tailor data is required');

  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  const weekRange = reportData?.weekRange || {};
  const tailorName = tailor.tailorName || 'Tailor';
  const jobs = tailor.jobs || [];

  let currentY = drawSalaryReportHeader(doc, {
    reportTitle: `Tailor Statement: ${tailorName.toUpperCase()} (#${tailor.tailorId})`,
    reportSubtitle: `Official piece-rate earnings statement (${tailor.jobsCount || jobs.length} assigned jobs)`,
    weekRange,
    branchName: tailor.branchName || branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth,
    startY: 10
  });

  // Tailor Summary Card
  doc.setFillColor(...blueBg);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryNavy);
  doc.text(`CRAFTSMAN: ${tailorName}  •  ${tailor.branchName || branchName}  •  ID #${tailor.tailorId}`, margin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...textDark);
  const metricsLine =
    `Assigned Jobs: ${tailor.jobsCount || jobs.length}  |  ` +
    `Total Earned (Week): ${formatLKR(tailor.totalEarnedInWeek)}  |  ` +
    `Payable Now: ${formatLKR(tailor.totalPayable)}  |  ` +
    `Held on Customer: ${formatLKR(tailor.totalHeld)}  |  ` +
    `Work Pending: ${formatLKR(tailor.totalWorkPending)}  |  ` +
    `Paid in Week: ${formatLKR(tailor.totalPaidInWeek)}`;
  doc.text(metricsLine, margin + 4, currentY + 10.5);

  currentY += 18;

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

  const drawHeader = (yPos) => {
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

  currentY = drawHeader(currentY);

  jobs.forEach((job, jIdx) => {
    const rowHeight = 6.2;
    if (currentY + rowHeight > pageHeight - 16) {
      doc.addPage();
      currentY = drawSalaryReportHeader(doc, {
        reportTitle: `Tailor Statement: ${tailorName} (Continued)`,
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
      currentY = drawHeader(currentY);
    }

    const isEven = jIdx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, currentY, contentWidth, rowHeight, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...textDark);

    let jX = margin;
    doc.text(String(jIdx + 1), jX + 2, currentY + 4.2);
    jX += jobCols[0].width;

    doc.setFont('helvetica', 'bold');
    doc.text(String(job.orderNumber || '-').slice(0, 18), jX + 2, currentY + 4.2);
    jX += jobCols[1].width;

    doc.setFont('helvetica', 'bold');
    if (job.workType === 'CUTTING') doc.setTextColor(...blueInfo);
    else doc.setTextColor(...purpleText);
    doc.text(String(job.workTypeName || job.workType), jX + jobCols[2].width / 2, currentY + 4.2, { align: 'center' });
    jX += jobCols[2].width;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textDark);
    doc.text(String(job.dressType || 'Garment').slice(0, 24), jX + 2, currentY + 4.2);
    jX += jobCols[3].width;

    doc.text(String(job.customerName || 'Customer').slice(0, 24), jX + 2, currentY + 4.2);
    jX += jobCols[4].width;

    doc.text(formatLKR(job.agreedPrice), jX + jobCols[5].width - 2, currentY + 4.2, { align: 'right' });
    jX += jobCols[5].width;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryNavy);
    doc.text(formatLKR(job.allocatedAmount), jX + jobCols[6].width - 2, currentY + 4.2, { align: 'right' });
    jX += jobCols[6].width;

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

    doc.setFont('helvetica', 'bold');
    if (job.status === 'PAYABLE') {
      doc.setTextColor(...greenSuccess);
      doc.text('PAYABLE', jX + jobCols[8].width / 2, tailorY + 4.2, { align: 'center' });
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

  // Check overflow before Subtotal and Receipt Sign-off Block
  if (currentY + 38 > pageHeight - 16) {
    doc.addPage();
    currentY = drawSalaryReportHeader(doc, {
      reportTitle: `Tailor Statement: ${tailorName} (Acknowledgment)`,
      reportSubtitle: 'Final subtotal and craftsman acknowledgment sign-off',
      weekRange,
      branchName: tailor.branchName || branchName,
      user,
      generatedAt,
      margin,
      contentWidth,
      pageWidth,
      startY: 10
    });
  }

  // Tailor Statement Subtotal Row
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...primaryNavy);

  let subX = margin;
  doc.text(`TOTAL FOR ${tailorName.toUpperCase()} (${jobs.length} JOBS)`, subX + 2, currentY + 4.5);
  subX += jobCols[0].width + jobCols[1].width + jobCols[2].width + jobCols[3].width + jobCols[4].width + jobCols[5].width;

  const totalAllocated = jobs.reduce((s, j) => s + (j.allocatedAmount || 0), 0);
  doc.text(formatLKR(totalAllocated), subX + jobCols[6].width - 2, currentY + 4.5, { align: 'right' });
  subX += jobCols[6].width;

  doc.setTextColor(...greenSuccess);
  doc.text(`Payable: ${formatLKR(tailor.totalPayable)}`, subX + 2, currentY + 4.5);
  subX += jobCols[7].width;

  doc.setTextColor(...amberWarning);
  doc.text(`Held: ${formatLKR(tailor.totalHeld)}`, subX + jobCols[8].width / 2, currentY + 4.5, { align: 'center' });

  currentY += 10;

  // Tailor Receipt Sign-off Block
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...primaryNavy);
  doc.text('TAILOR RECEIPT & DISBURSEMENT ACKNOWLEDGMENT', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textDark);
  doc.text(
    `I, ${tailorName}, hereby verify that the ${jobs.length} jobs listed above represent my actual work completed for the week. ` +
    `I acknowledge receipt and agreement with the payable balance of ${formatLKR(tailor.totalPayable)}.`,
    margin + 4,
    currentY + 8.5,
    { maxWidth: contentWidth - 8 }
  );

  const sigY = currentY + 16.5;
  const colW = (contentWidth - 12) / 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);

  doc.line(margin + 4, sigY, margin + 4 + colW - 8, sigY);
  doc.text(`Craftsman Signature: ${tailorName}`, margin + 4, sigY + 3.5);

  doc.line(margin + 8 + colW, sigY, margin + 8 + (colW * 2) - 8, sigY);
  doc.text('Authorised By: Branch Manager / Accountant', margin + 8 + colW, sigY + 3.5);

  addSalaryPageNumbers(doc);

  const safeTailorName = tailorName.replace(/[^a-zA-Z0-9]/g, '_');
  const startStr = weekRange.startDateStr || 'start';
  const endStr = weekRange.endDateStr || 'end';
  const fileName = `JB_GROUP_Tailor_Statement_${safeTailorName}_${startStr}_to_${endStr}.pdf`;

  return { doc, fileName };
}

// ============================================================================
// 5. REPORT: CUTTING VS STITCHING (25/25/50) BREAKDOWN PDF
// ============================================================================
export function generateCuttingVsStitchingPDF({
  reportData,
  user = {},
  branchName = 'Consolidated HQ (All Branches)',
  generatedAt = new Date()
}) {
  if (!reportData) throw new Error('Report data is required');

  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  const weekRange = reportData.weekRange || {};
  const orderTotals = reportData.orderTotals || {};
  const cvs = reportData.cuttingVsStitching || {};
  const office = cvs.office || {};
  const cutting = cvs.cutting || {};
  const stitching = cvs.stitching || {};

  let currentY = drawSalaryReportHeader(doc, {
    reportTitle: 'Cutting vs Stitching Allocation Report (25/25/50)',
    reportSubtitle: 'Mathematical analysis of piece-rate allocations across Office Overhead (50%), Cutting (25%), and Stitching (25%)',
    weekRange,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth,
    startY: 10
  });

  // Top Agreed Order Value Banner
  doc.setFillColor(...blueBg);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, currentY, contentWidth, 13, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...blueInfo);
  doc.text('TOTAL AGREED BESPOKE ORDER VALUE (100% POOL)', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryNavy);
  doc.text(formatLKR(orderTotals.totalAgreedOrderValue), margin + 4, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textDark);
  doc.text(
    `Across ${orderTotals.uniqueOrdersCount || 0} unique bespoke client orders in the selected period.`,
    margin + 80,
    currentY + 10
  );

  currentY += 18;

  // 3 Primary Allocation Cards
  const cardW = (contentWidth - 8) / 3;
  const cardH = 50;

  // Card 1: Office Overhead (50%)
  doc.setFillColor(...bgLight);
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, currentY, cardW, cardH, 2, 2, 'FD');
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, currentY, cardW, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text('OFFICE OVERHEAD (50%)', margin + 4, currentY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryNavy);
  doc.text(formatLKR(office.totalAllocated), margin + 4, currentY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...textDark);
  const officeDesc =
    'The 50% office allocation covers company operating expenses, profit margin, boutique facilities, electricity, water, and administrative management overhead. ' +
    'This share is strictly retained by the company and excluded from tailor payroll disbursements.';
  doc.text(officeDesc, margin + 4, currentY + 22, { maxWidth: cardW - 8 });

  // Card 2: Cutting Tailors (25%)
  const cX = margin + cardW + 4;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(2, 132, 199);
  doc.roundedRect(cX, currentY, cardW, cardH, 2, 2, 'FD');
  doc.setFillColor(2, 132, 199);
  doc.rect(cX, currentY, cardW, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199);
  doc.text('CUTTING TAILORS (25%)', cX + 4, currentY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryNavy);
  doc.text(formatLKR(cutting.totalAllocated), cX + 4, currentY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...textDark);
  doc.text(`Completed Cutting Jobs: ${cutting.completedCount || 0}`, cX + 4, currentY + 23);
  doc.setTextColor(...greenSuccess);
  doc.text(`Payable Now: ${formatLKR(cutting.payableAmount)}`, cX + 4, currentY + 28);
  doc.setTextColor(...amberWarning);
  doc.text(`Held on Customer: ${formatLKR(cutting.heldAmount)}`, cX + 4, currentY + 33);
  doc.setTextColor(...purpleText);
  doc.text(`Already Disbursed: ${formatLKR(cutting.paidAmount)}`, cX + 4, currentY + 38);
  doc.setTextColor(...textMuted);
  doc.text(`In-Progress Pending: ${cutting.pendingCount || 0} jobs`, cX + 4, currentY + 43);

  // Card 3: Stitching Tailors (25%)
  const sX = margin + (cardW * 2) + 8;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(124, 58, 237);
  doc.roundedRect(sX, currentY, cardW, cardH, 2, 2, 'FD');
  doc.setFillColor(124, 58, 237);
  doc.rect(sX, currentY, cardW, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(124, 58, 237);
  doc.text('STITCHING TAILORS (25%)', sX + 4, currentY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryNavy);
  doc.text(formatLKR(stitching.totalAllocated), sX + 4, currentY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...textDark);
  doc.text(`Completed Stitching Jobs: ${stitching.completedCount || 0}`, sX + 4, currentY + 23);
  doc.setTextColor(...greenSuccess);
  doc.text(`Payable Now: ${formatLKR(stitching.payableAmount)}`, sX + 4, currentY + 28);
  doc.setTextColor(...amberWarning);
  doc.text(`Held on Customer: ${formatLKR(stitching.heldAmount)}`, sX + 4, currentY + 33);
  doc.setTextColor(...purpleText);
  doc.text(`Already Disbursed: ${formatLKR(stitching.paidAmount)}`, sX + 4, currentY + 38);
  doc.setTextColor(...textMuted);
  doc.text(`In-Progress Pending: ${stitching.pendingCount || 0} jobs`, sX + 4, currentY + 43);

  currentY += cardH + 10;

  // Comparison Matrix Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryNavy);
  doc.text('ALLOCATION COMPARISON MATRIX', margin, currentY);
  currentY += 4;

  const mCols = [
    { header: 'ALLOCATION METRIC', width: 75, align: 'left' },
    { header: 'OFFICE (50%)', width: 48, align: 'right' },
    { header: 'CUTTING (25%)', width: 48, align: 'right' },
    { header: 'STITCHING (25%)', width: 48, align: 'right' },
    { header: 'TOTAL (100%)', width: 54, align: 'right' }
  ];

  doc.setFillColor(...primaryNavy);
  doc.rect(margin, currentY, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);

  let curX = margin;
  mCols.forEach(col => {
    const posX = col.align === 'right' ? curX + col.width - 2 : curX + 2;
    doc.text(col.header, posX, currentY + 4.5, { align: col.align || 'left' });
    curX += col.width;
  });
  currentY += 6.5;

  const rows = [
    { label: 'Total Allocation Share', office: formatLKR(office.totalAllocated), cut: formatLKR(cutting.totalAllocated), stitch: formatLKR(stitching.totalAllocated), tot: formatLKR(orderTotals.totalAgreedOrderValue) },
    { label: 'Completed Jobs Count', office: 'N/A', cut: String(cutting.completedCount || 0), stitch: String(stitching.completedCount || 0), tot: String((cutting.completedCount || 0) + (stitching.completedCount || 0)) },
    { label: 'Salary Payable Now', office: 'N/A', cut: formatLKR(cutting.payableAmount), stitch: formatLKR(stitching.payableAmount), tot: formatLKR((cutting.payableAmount || 0) + (stitching.payableAmount || 0)) },
    { label: 'Customer-Payment Holds', office: 'N/A', cut: formatLKR(cutting.heldAmount), stitch: formatLKR(stitching.heldAmount), tot: formatLKR((cutting.heldAmount || 0) + (stitching.heldAmount || 0)) },
    { label: 'Incomplete Work Pending', office: 'N/A', cut: `${cutting.pendingCount || 0} jobs`, stitch: `${stitching.pendingCount || 0} jobs`, tot: `${(cutting.pendingCount || 0) + (stitching.pendingCount || 0)} jobs` }
  ];

  rows.forEach((r, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, currentY, contentWidth, 6, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...textDark);

    let rX = margin;
    doc.text(r.label, rX + 2, currentY + 4.2);
    rX += mCols[0].width;

    doc.text(r.office, rX + mCols[1].width - 2, currentY + 4.2, { align: 'right' });
    rX += mCols[1].width;

    doc.text(r.cut, rX + mCols[2].width - 2, currentY + 4.2, { align: 'right' });
    rX += mCols[2].width;

    doc.text(r.stitch, rX + mCols[3].width - 2, currentY + 4.2, { align: 'right' });
    rX += mCols[3].width;

    doc.setFont('helvetica', 'bold');
    doc.text(r.tot, rX + mCols[4].width - 2, currentY + 4.2, { align: 'right' });

    currentY += 6;
  });

  currentY += 10;

  // Check overflow before sign-off block
  if (currentY + 34 > pageHeight - 16) {
    doc.addPage();
    currentY = drawSalaryReportHeader(doc, {
      reportTitle: 'Cutting vs Stitching Allocation Report (Sign-Off)',
      reportSubtitle: 'Executive sign-off sheet continuation',
      weekRange,
      branchName,
      user,
      generatedAt,
      margin,
      contentWidth,
      pageWidth,
      startY: 10
    });
  }

  drawSignOffBlock(doc, currentY, margin, contentWidth);
  addSalaryPageNumbers(doc);

  const startStr = weekRange.startDateStr || 'start';
  const endStr = weekRange.endDateStr || 'end';
  const fileName = `JB_GROUP_Cutting_vs_Stitching_${startStr}_to_${endStr}.pdf`;

  return { doc, fileName };
}

// ============================================================================
// 6. REPORT: CUSTOMER-PAYMENT SALARY HOLDS PDF
// ============================================================================
export function generateCustomerHoldsPDF({
  reportData,
  user = {},
  branchName = 'Consolidated HQ (All Branches)',
  generatedAt = new Date()
}) {
  if (!reportData) throw new Error('Report data is required');

  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  const weekRange = reportData.weekRange || {};
  const allAllocations = reportData.allocations || [];
  const heldAllocations = allAllocations.filter(a => a.status === 'ON_HOLD_CUSTOMER_PAYMENT');

  let currentY = drawSalaryReportHeader(doc, {
    reportTitle: 'Customer-Payment Salary Holds Ledger',
    reportSubtitle: `Completed bespoke garments held pending customer invoice settlement (${heldAllocations.length} held jobs)`,
    weekRange,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth,
    startY: 10
  });

  // Alert Explanation Banner
  doc.setFillColor(...amberBg);
  doc.setDrawColor(...amberWarning);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...amberWarning);
  doc.text('CUSTOMER PAYMENT HOLD POLICY & CLEARANCE CRITERIA', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...textDark);
  const holdExplanation =
    'The craftsman tasks below have been fully completed in the production workshop. However, because the customer has an outstanding balance due on their bespoke invoice, ' +
    'the salary allocation remains ON HOLD to protect company cash flow. Once the customer settles the balance in full, this salary status automatically transitions to PAYABLE.';
  doc.text(holdExplanation, margin + 4, currentY + 8.5, { maxWidth: contentWidth - 8 });

  currentY += 18;

  const totalHeldAmount = heldAllocations.reduce((s, a) => s + (a.allocatedAmount || 0), 0);
  const totalAgreedVal = heldAllocations.reduce((s, a) => s + (a.agreedPrice || 0), 0);
  const totalCustPaid = heldAllocations.reduce((s, a) => s + (a.customerTotalPaid || 0), 0);
  const totalCustBalance = heldAllocations.reduce((s, a) => s + (a.customerBalanceDue || 0), 0);

  const holdCols = [
    { header: '#', width: 9, align: 'left' },
    { header: 'ORDER #', width: 28, align: 'left' },
    { header: 'CUSTOMER NAME', width: 38, align: 'left' },
    { header: 'TAILOR NAME', width: 34, align: 'left' },
    { header: 'WORK', width: 22, align: 'center' },
    { header: 'GARMENT SPEC', width: 34, align: 'left' },
    { header: 'AGREED PRICE', width: 27, align: 'right' },
    { header: 'CUSTOMER PAID', width: 27, align: 'right' },
    { header: 'BALANCE DUE', width: 27, align: 'right' },
    { header: 'HELD SALARY', width: 27, align: 'right' }
  ];

  const drawHoldHeader = (yPos) => {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, yPos, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let hX = margin;
    holdCols.forEach(col => {
      const posX = col.align === 'right' ? hX + col.width - 2 : col.align === 'center' ? hX + col.width / 2 : hX + 2;
      doc.text(col.header, posX, yPos + 4.5, { align: col.align || 'left' });
      hX += col.width;
    });
    return yPos + 6.5;
  };

  currentY = drawHoldHeader(currentY);

  if (heldAllocations.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, currentY, contentWidth, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...greenSuccess);
    doc.text('No salary allocations are currently on hold. All completed jobs have full customer payments verified.', margin + 10, currentY + 7);
    currentY += 12;
  } else {
    heldAllocations.forEach((alloc, hIdx) => {
      const rowHeight = 6.2;
      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        currentY = drawSalaryReportHeader(doc, {
          reportTitle: 'Customer-Payment Salary Holds Ledger (Continued)',
          reportSubtitle: 'Completed tailor bespoke garments held on customer payment continuation',
          weekRange,
          branchName,
          user,
          generatedAt,
          margin,
          contentWidth,
          pageWidth,
          startY: 10
        });
        currentY = drawHoldHeader(currentY);
      }

      const isEven = hIdx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(...textDark);

      let hX = margin;
      doc.text(String(hIdx + 1), hX + 2, currentY + 4.2);
      hX += holdCols[0].width;

      doc.setFont('helvetica', 'bold');
      doc.text(String(alloc.orderNumber || '-').slice(0, 18), hX + 2, currentY + 4.2);
      hX += holdCols[1].width;

      doc.setFont('helvetica', 'normal');
      doc.text(String(alloc.customerName || 'Customer').slice(0, 22), hX + 2, currentY + 4.2);
      hX += holdCols[2].width;

      doc.setFont('helvetica', 'bold');
      doc.text(String(alloc.tailorName || 'Unassigned').slice(0, 20), hX + 2, currentY + 4.2);
      hX += holdCols[3].width;

      doc.setFont('helvetica', 'bold');
      if (alloc.workType === 'CUTTING') doc.setTextColor(...blueInfo);
      else doc.setTextColor(...purpleText);
      doc.text(String(alloc.workTypeName || alloc.workType), hX + holdCols[4].width / 2, currentY + 4.2, { align: 'center' });
      hX += holdCols[4].width;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      doc.text(String(alloc.dressType || 'Garment').slice(0, 20), hX + 2, currentY + 4.2);
      hX += holdCols[5].width;

      doc.text(formatLKR(alloc.agreedPrice), hX + holdCols[6].width - 2, currentY + 4.2, { align: 'right' });
      hX += holdCols[6].width;

      doc.setTextColor(...greenSuccess);
      doc.text(formatLKR(alloc.customerTotalPaid), hX + holdCols[7].width - 2, currentY + 4.2, { align: 'right' });
      hX += holdCols[7].width;

      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text(formatLKR(alloc.customerBalanceDue), hX + holdCols[8].width - 2, currentY + 4.2, { align: 'right' });
      hX += holdCols[8].width;

      doc.setTextColor(...amberWarning);
      doc.text(formatLKR(alloc.allocatedAmount), hX + holdCols[9].width - 2, currentY + 4.2, { align: 'right' });

      currentY += rowHeight;
    });

    // Check overflow before Table Totals
    if (currentY + 12 > pageHeight - 16) {
      doc.addPage();
      currentY = drawSalaryReportHeader(doc, {
        reportTitle: 'Customer-Payment Salary Holds (Totals)',
        reportSubtitle: 'Holds grand totals continuation',
        weekRange,
        branchName,
        user,
        generatedAt,
        margin,
        contentWidth,
        pageWidth,
        startY: 10
      });
    }

    // Table Totals
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...primaryNavy);

    let totX = margin;
    doc.text(`TOTAL HELD ALLOCATIONS (${heldAllocations.length} JOBS)`, totX + 2, currentY + 4.8);
    totX += holdCols[0].width + holdCols[1].width + holdCols[2].width + holdCols[3].width + holdCols[4].width + holdCols[5].width;

    doc.text(formatLKR(totalAgreedVal), totX + holdCols[6].width - 2, currentY + 4.8, { align: 'right' });
    totX += holdCols[6].width;

    doc.setTextColor(...greenSuccess);
    doc.text(formatLKR(totalCustPaid), totX + holdCols[7].width - 2, currentY + 4.8, { align: 'right' });
    totX += holdCols[7].width;

    doc.setTextColor(220, 38, 38);
    doc.text(formatLKR(totalCustBalance), totX + holdCols[8].width - 2, currentY + 4.8, { align: 'right' });
    totX += holdCols[8].width;

    doc.setTextColor(...amberWarning);
    doc.text(formatLKR(totalHeldAmount), totX + holdCols[9].width - 2, currentY + 4.8, { align: 'right' });

    currentY += 10;
  }

  // Check overflow before sign-off block
  if (currentY + 34 > pageHeight - 16) {
    doc.addPage();
    currentY = drawSalaryReportHeader(doc, {
      reportTitle: 'Customer-Payment Salary Holds (Sign-Off)',
      reportSubtitle: 'Executive clearance authority and sign-off',
      weekRange,
      branchName,
      user,
      generatedAt,
      margin,
      contentWidth,
      pageWidth,
      startY: 10
    });
  }

  drawSignOffBlock(doc, currentY, margin, contentWidth);
  addSalaryPageNumbers(doc);

  const startStr = weekRange.startDateStr || 'start';
  const endStr = weekRange.endDateStr || 'end';
  const fileName = `JB_GROUP_Customer_Payment_Holds_${startStr}_to_${endStr}.pdf`;

  return { doc, fileName };
}

// ============================================================================
// 7. REPORT: SALARY DISBURSEMENT HISTORY LEDGER PDF
// ============================================================================
export function generateDisbursementHistoryPDF({
  reportData,
  user = {},
  branchName = 'Consolidated HQ (All Branches)',
  generatedAt = new Date()
}) {
  if (!reportData) throw new Error('Report data is required');

  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  const weekRange = reportData.weekRange || {};
  const payments = reportData.recentPayments || [];

  let currentY = drawSalaryReportHeader(doc, {
    reportTitle: 'Salary Disbursement History Ledger',
    reportSubtitle: `Official audit trail of recorded tailor salary disbursements (${payments.length} records)`,
    weekRange,
    branchName,
    user,
    generatedAt,
    margin,
    contentWidth,
    pageWidth,
    startY: 10
  });

  const totalDisbursed = payments.reduce((s, p) => s + Number(p.amountPaid || 0), 0);
  const uniqueTailors = new Set(payments.map(p => p.tailorId).filter(Boolean));

  // Quick summary cards
  const kpis = [
    { label: 'TOTAL DISBURSED IN PERIOD', val: formatLKR(totalDisbursed), color: purpleText, bg: purpleBg },
    { label: 'DISBURSEMENTS RECORDED', val: `${payments.length} Payments`, color: primaryNavy, bg: [241, 245, 249] },
    { label: 'UNIQUE CRAFTSMEN PAID', val: `${uniqueTailors.size} Tailors`, color: greenSuccess, bg: greenBg }
  ];

  const colW = (contentWidth - 6) / 3;
  kpis.forEach((k, idx) => {
    const kX = margin + idx * (colW + 3);
    doc.setFillColor(...k.bg);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.2);
    doc.roundedRect(kX, currentY, colW, 13, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...k.color);
    doc.text(k.label, kX + 3, currentY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryNavy);
    doc.text(k.val, kX + 3, currentY + 9.5);
  });

  currentY += 17;

  const payCols = [
    { header: '#', width: 9, align: 'left' },
    { header: 'DISBURSEMENT DATE', width: 30, align: 'left' },
    { header: 'ORDER NUMBER', width: 28, align: 'left' },
    { header: 'TAILOR NAME', width: 36, align: 'left' },
    { header: 'WORK TYPE', width: 24, align: 'center' },
    { header: 'AMOUNT PAID', width: 30, align: 'right' },
    { header: 'METHOD', width: 24, align: 'center' },
    { header: 'RECEIPT / REF', width: 28, align: 'left' },
    { header: 'AUTHORISED BY', width: 32, align: 'left' },
    { header: 'NOTES', width: 32, align: 'left' }
  ];

  const drawPayHeader = (yPos) => {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, yPos, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let pX = margin;
    payCols.forEach(col => {
      const posX = col.align === 'right' ? pX + col.width - 2 : col.align === 'center' ? pX + col.width / 2 : pX + 2;
      doc.text(col.header, posX, yPos + 4.5, { align: col.align || 'left' });
      pX += col.width;
    });
    return yPos + 6.5;
  };

  currentY = drawPayHeader(currentY);

  if (payments.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, currentY, contentWidth, 12, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text('No salary disbursements recorded in this period yet.', margin + 10, currentY + 7);
    currentY += 12;
  } else {
    payments.forEach((p, pIdx) => {
      const rowHeight = 6.2;
      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        currentY = drawSalaryReportHeader(doc, {
          reportTitle: 'Salary Disbursement History Ledger (Continued)',
          reportSubtitle: 'Official audit trail of recorded salary disbursements continuation',
          weekRange,
          branchName,
          user,
          generatedAt,
          margin,
          contentWidth,
          pageWidth,
          startY: 10
        });
        currentY = drawPayHeader(currentY);
      }

      const isEven = pIdx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(...textDark);

      let pX = margin;
      doc.text(String(pIdx + 1), pX + 2, currentY + 4.2);
      pX += payCols[0].width;

      const dateStr = formatColomboDate(p.paymentDate);
      doc.text(dateStr, pX + 2, currentY + 4.2);
      pX += payCols[1].width;

      doc.setFont('helvetica', 'bold');
      doc.text(String(p.orderNumber || p.orderRef || '-').slice(0, 18), pX + 2, currentY + 4.2);
      pX += payCols[2].width;

      doc.setFont('helvetica', 'bold');
      doc.text(String(p.tailorName || `Tailor #${p.tailorId}`).slice(0, 20), pX + 2, currentY + 4.2);
      pX += payCols[3].width;

      doc.setFont('helvetica', 'bold');
      if (p.workType === 'CUTTING') doc.setTextColor(...blueInfo);
      else doc.setTextColor(...purpleText);
      doc.text(String(p.workType || '-'), pX + payCols[4].width / 2, currentY + 4.2, { align: 'center' });
      pX += payCols[4].width;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...greenSuccess);
      doc.text(formatLKR(p.amountPaid), pX + payCols[5].width - 2, currentY + 4.2, { align: 'right' });
      pX += payCols[5].width;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      doc.text(String(p.paymentMethod || 'CASH'), pX + payCols[6].width / 2, currentY + 4.2, { align: 'center' });
      pX += payCols[6].width;

      doc.setFont('courier', 'normal');
      doc.text(String(p.referenceNo || '—').slice(0, 16), pX + 2, currentY + 4.2);
      pX += payCols[7].width;

      doc.setFont('helvetica', 'normal');
      doc.text(String(p.recordedByName || 'Management').slice(0, 18), pX + 2, currentY + 4.2);
      pX += payCols[8].width;

      doc.text(String(p.notes || '—').slice(0, 20), pX + 2, currentY + 4.2);

      currentY += rowHeight;
    });

    // Check overflow before Table Totals
    if (currentY + 12 > pageHeight - 16) {
      doc.addPage();
      currentY = drawSalaryReportHeader(doc, {
        reportTitle: 'Salary Disbursement History (Totals)',
        reportSubtitle: 'Disbursements totals continuation',
        weekRange,
        branchName,
        user,
        generatedAt,
        margin,
        contentWidth,
        pageWidth,
        startY: 10
      });
    }

    // Table Totals
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...primaryNavy);

    let totX = margin;
    doc.text(`TOTAL DISBURSEMENTS (${payments.length} PAYMENTS)`, totX + 2, currentY + 4.8);
    totX += payCols[0].width + payCols[1].width + payCols[2].width + payCols[3].width + payCols[4].width;

    doc.setTextColor(...greenSuccess);
    doc.text(formatLKR(totalDisbursed), totX + payCols[5].width - 2, currentY + 4.8, { align: 'right' });

    currentY += 10;
  }

  // Check overflow before sign-off block
  if (currentY + 34 > pageHeight - 16) {
    doc.addPage();
    currentY = drawSalaryReportHeader(doc, {
      reportTitle: 'Salary Disbursement History (Sign-Off)',
      reportSubtitle: 'Executive audit trail verification continuation',
      weekRange,
      branchName,
      user,
      generatedAt,
      margin,
      contentWidth,
      pageWidth,
      startY: 10
    });
  }

  drawSignOffBlock(doc, currentY, margin, contentWidth);
  addSalaryPageNumbers(doc);

  const startStr = weekRange.startDateStr || 'start';
  const endStr = weekRange.endDateStr || 'end';
  const fileName = `JB_GROUP_Salary_Disbursement_History_${startStr}_to_${endStr}.pdf`;

  return { doc, fileName };
}
