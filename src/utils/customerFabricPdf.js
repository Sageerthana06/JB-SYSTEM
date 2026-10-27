import jsPDFModule, { jsPDF } from 'jspdf';

const PDFDoc = jsPDF || jsPDFModule.jsPDF || jsPDFModule;

/**
 * Generate a professional JB GROUP / Bella Design Customer Fabric Tracking Report PDF.
 *
 * @param {Object} params
 * @param {Array} params.records - List of customer fabric records matching current filters
 * @param {Object} params.summary - Totals: totalReceived, totalAvailableInStore, totalWithTailors, etc.
 * @param {Object} params.filters - Active filters: branch, status, fabricType, search, from, to
 * @param {Object} params.user - Current logged-in user: name, role
 * @param {Date|string} params.generatedAt - Report timestamp
 */
export function generateCustomerFabricPDF({ records = [], summary = {}, filters = {}, user = {}, generatedAt = new Date() }) {
  const doc = new PDFDoc('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2); // 273mm

  let currentY = margin;

  // Harmonious theme colors
  const primaryNavy = [15, 23, 42]; // #0f172a
  const accentCrimson = [217, 4, 41]; // #d90429 (JB Crimson)
  const textDark = [30, 41, 59]; // #1e293b
  const textMuted = [100, 116, 139]; // #64748b
  const borderLight = [226, 232, 240]; // #e2e8f0
  const bgLight = [248, 250, 252]; // #f8fafc

  function drawHeader(isFirstPage = false) {
    // Top Crimson Accent bar
    doc.setFillColor(...accentCrimson);
    doc.rect(margin, currentY, contentWidth, 3, 'F');
    currentY += 5;

    // Company & Report Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...primaryNavy);
    doc.text('JB GROUP / BELLA DESIGN', margin, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...textMuted);
    const dateStr = generatedAt ? new Date(generatedAt).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : new Date().toLocaleString();
    doc.text(`Generated: ${dateStr}  |  User: ${user?.name || 'Authorized User'} (${user?.role || 'Staff'})`, pageWidth - margin, currentY + 5, { align: 'right' });

    currentY += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...accentCrimson);
    doc.text('CUSTOMER FABRIC TRACKING REPORT', margin, currentY + 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...textMuted);
    doc.text('Dedicated tracking for customer-owned fabrics  •  Completely separated from company inventory & valuation (WAC unaffected)', margin, currentY + 8);

    currentY += 12;

    if (isFirstPage) {
      // Filter criteria metadata box
      doc.setFillColor(...bgLight);
      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, currentY, contentWidth, 13, 1.5, 1.5, 'FD');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryNavy);

      const fBranch = filters.branch || 'All Branches';
      const fStatus = filters.status || 'All Statuses';
      const fType = filters.fabricType || 'All Types';
      const fSearch = filters.search ? `"${filters.search}"` : 'None';
      const fDate = (filters.from || filters.to) ? `${filters.from || 'Start'} to ${filters.to || 'Present'}` : 'All Dates';

      doc.text('REPORT FILTERS & PARAMETERS:', margin + 4, currentY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      doc.text(`Branch: ${fBranch}    |    Status: ${fStatus}    |    Fabric Type: ${fType}    |    Search: ${fSearch}    |    Date Range: ${fDate}`, margin + 4, currentY + 9.5);

      currentY += 16;

      // Summary Cards (only if records exist)
      if (records && records.length > 0) {
        const kpiCardWidth = (contentWidth - (6 * 3)) / 7; // 7 KPI cards
        const kpis = [
          { label: 'TOTAL RECEIVED', val: `${Number(summary.totalReceived || 0).toFixed(2)}`, unit: 'm / yds', color: primaryNavy },
          { label: 'IN STORE', val: `${Number(summary.totalAvailableInStore || 0).toFixed(2)}`, unit: 'Available', color: [21, 128, 61] },
          { label: 'WITH TAILORS', val: `${Number(summary.totalWithTailors || 0).toFixed(2)}`, unit: 'Work-in-prog', color: [180, 83, 9] },
          { label: 'ACTUAL CONSUMED', val: `${Number(summary.totalConsumed || 0).toFixed(2)}`, unit: 'Stitched', color: [30, 64, 175] },
          { label: 'TAILOR RETURNS', val: `${Number(summary.totalReturnedToStore || 0).toFixed(2)}`, unit: 'To Store', color: [15, 118, 110] },
          { label: 'RETURNED TO CUST.', val: `${Number(summary.totalReturnedToCustomer || 0).toFixed(2)}`, unit: 'Delivered', color: [100, 116, 139] },
          { label: 'WASTE / SCRAP', val: `${Number(summary.totalWaste || 0).toFixed(2)}`, unit: 'Off-cuts', color: [220, 38, 38] }
        ];

        kpis.forEach((kpi, idx) => {
          const cardX = margin + idx * (kpiCardWidth + 3);
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(...borderLight);
          doc.roundedRect(cardX, currentY, kpiCardWidth, 14, 1.2, 1.2, 'FD');

          // Left indicator strip
          doc.setFillColor(...kpi.color);
          doc.rect(cardX, currentY, 1.5, 14, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.8);
          doc.setTextColor(...textMuted);
          doc.text(kpi.label, cardX + 3.5, currentY + 4);

          doc.setFontSize(8.8);
          doc.setTextColor(...kpi.color);
          doc.text(kpi.val, cardX + 3.5, currentY + 9);

          doc.setFontSize(5.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...textMuted);
          doc.text(kpi.unit, cardX + 3.5, currentY + 12.2);
        });

        currentY += 18;
      }
    }
  }

  // Column definitions (Sum = 273mm)
  const columns = [
    { id: 'codeDate', header: 'CODE & DATE', width: 26 },
    { id: 'customer', header: 'CUSTOMER', width: 30 },
    { id: 'orderNo', header: 'ORDER #', width: 22 },
    { id: 'fabric', header: 'FABRIC & COLOUR', width: 28 },
    { id: 'desc', header: 'DESCRIPTION', width: 38 },
    { id: 'qty', header: 'QTY (RECV / BALANCES)', width: 36 },
    { id: 'status', header: 'STATUS', width: 22 },
    { id: 'branch', header: 'BRANCH', width: 20 },
    { id: 'price', header: 'PURCHASE PRICE', width: 27 },
    { id: 'registeredBy', header: 'REGISTERED BY', width: 24 }
  ];

  function drawTableHeader() {
    doc.setFillColor(...primaryNavy);
    doc.rect(margin, currentY, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    columns.forEach(col => {
      doc.text(col.header, curX + 1.5, currentY + 4.8);
      curX += col.width;
    });

    currentY += 7;
  }

  // Draw Page 1 header
  drawHeader(true);

  if (!records || records.length === 0) {
    // Clear No Records Message Box
    currentY += 5;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(185, 28, 28);
    doc.text('No customer fabric records found matching the selected filter criteria.', margin + 8, currentY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27);
    doc.text('Try adjusting your search query, branch selection, status filter, or date range.', margin + 8, currentY + 16);
    currentY += 30;
  } else {
    drawTableHeader();

    records.forEach((row, index) => {
      const descText = row.fabricDescription || row.conditionNotes || '-';
      const descLines = doc.splitTextToSize(descText, 36);

      const custNameLines = doc.splitTextToSize(row.customerName || '', 28);

      const lineCounts = [
        2, // Code & Date
        custNameLines.length + 1, // Customer
        2, // Fabric & Colour
        descLines.length, // Description
        2 // Qty & Balances
      ];
      const maxLines = Math.max(2, ...lineCounts);
      const rowHeight = Math.max(9, (maxLines * 3.8) + 2.5);

      // Check if row exceeds printable height (leave 16mm for footer)
      if (currentY + rowHeight > pageHeight - 16) {
        doc.addPage();
        currentY = margin;
        drawHeader(false);
        drawTableHeader();
      }

      // Alternate row backgrounds
      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      }

      // Bottom row divider
      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.15);
      doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      // Draw Cells
      let curX = margin;

      // 1. Code & Date
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...primaryNavy);
      doc.text(row.code || '', curX + 1.5, currentY + 3.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...textMuted);
      doc.text(row.dateReceived ? new Date(row.dateReceived).toLocaleDateString() : '', curX + 1.5, currentY + 7.2);
      curX += columns[0].width;

      // 2. Customer
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...textDark);
      doc.text(custNameLines, curX + 1.5, currentY + 3.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(...textMuted);
      const phoneY = currentY + 3.8 + (custNameLines.length * 3.4);
      doc.text(row.customerPhone || '', curX + 1.5, Math.min(currentY + rowHeight - 1, phoneY));
      curX += columns[1].width;

      // 3. Order #
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...primaryNavy);
      doc.text(`#${row.orderNumber || ''}`, curX + 1.5, currentY + 3.8);
      curX += columns[2].width;

      // 4. Fabric & Colour
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...textDark);
      doc.text(row.fabricType || '', curX + 1.5, currentY + 3.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...textMuted);
      doc.text(row.fabricColour || '', curX + 1.5, currentY + 7.2);
      curX += columns[3].width;

      // 5. Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(...textDark);
      doc.text(descLines, curX + 1.5, currentY + 3.5);
      curX += columns[4].width;

      // 6. Qty & Balances
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...primaryNavy);
      doc.text(`Recv: ${row.receivedQty} ${row.unit}`, curX + 1.5, currentY + 3.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(...textMuted);
      doc.text(`Store: ${row.availableQty} | Tailor: ${row.tailorBalanceQty}`, curX + 1.5, currentY + 7.2);
      curX += columns[5].width;

      // 7. Status Badge
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      const statusText = (row.status || '').replace(/_/g, ' ');
      if (row.status === 'AVAILABLE') doc.setTextColor(21, 128, 61);
      else if (row.status === 'ISSUED') doc.setTextColor(180, 83, 9);
      else if (row.status === 'PARTIALLY_ISSUED') doc.setTextColor(55, 48, 163);
      else if (row.status === 'CONSUMED') doc.setTextColor(30, 64, 175);
      else if (row.status === 'RETURNED_TO_CUSTOMER') doc.setTextColor(15, 118, 110);
      else doc.setTextColor(...textDark);
      doc.text(statusText, curX + 1.5, currentY + 3.8);
      curX += columns[6].width;

      // 8. Branch
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...textDark);
      doc.text(row.branchName || '-', curX + 1.5, currentY + 3.8);
      curX += columns[7].width;

      // 9. Customer-reported Purchase Price (Clearly shows 'Not Provided' if missing)
      let priceText = 'Not Provided';
      if (row.customerPurchasePrice !== null && row.customerPurchasePrice !== undefined && String(row.customerPurchasePrice).trim() !== '') {
        const cur = row.customerPurchaseCurrency || 'LKR';
        const pType = row.customerPurchasePriceType === 'PER_UNIT' ? `/${row.unit}` : ' (Total)';
        priceText = `${cur} ${Number(row.customerPurchasePrice).toLocaleString()}${pType}`;
      }

      doc.setFont('helvetica', priceText === 'Not Provided' ? 'italic' : 'bold');
      doc.setFontSize(6);
      if (priceText === 'Not Provided') {
        doc.setTextColor(...textMuted);
      } else {
        doc.setTextColor(3, 105, 161);
      }
      doc.text(priceText, curX + 1.5, currentY + 3.8);
      curX += columns[8].width;

      // 10. Registered By
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...textDark);
      doc.text(row.receivedByName || 'Staff', curX + 1.5, currentY + 3.8);
      curX += columns[9].width;

      currentY += rowHeight;
    });
  }

  // Draw Running Footers and Page Numbers across all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...textMuted);
    doc.text('JB GROUP / Bella Design ERP  •  Customer Fabric Tracker System (Client-Owned Fabric)', margin, pageHeight - 5);
    doc.text(`Page ${i} of ${totalPages}`, margin + contentWidth, pageHeight - 5, { align: 'right' });
  }

  return doc;
}
