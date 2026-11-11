import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  Download,
  MessageCircle,
  Image as ImageIcon,
  MapPin,
  User,
  Phone,
  ClipboardList
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { digitalInvoiceStyles } from './digitalInvoiceStyles';

export const normalizePhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  const raw = String(phone).replace(/\D/g, '');
  if (raw.startsWith('00')) return raw.slice(2);
  if (raw.startsWith('0')) return '94' + raw.slice(1);
  return raw;
};

export const computeInvoicePaymentStatus = (order) => {
  if (!order) {
    return {
      statusKey: 'PRICE_PENDING',
      label: 'Balance Due',
      stampText: 'PRICE PENDING',
      color: '#d97706',
      bgColor: '#fffbeb',
      borderColor: '#fde68a',
      stampBorderColor: '#d97706',
      stampTextColor: '#d97706',
      totalAmount: 0,
      amountPaid: 0,
      balanceDue: 0
    };
  }

  const rawTotal = Number(
    order.totalAmount !== undefined && order.totalAmount !== null
      ? order.totalAmount
      : (order.agreedTotal !== undefined && order.agreedTotal !== null ? order.agreedTotal : 0)
  );
  const totalAmount = isNaN(rawTotal) ? 0 : rawTotal;

  const isPricePending =
    totalAmount <= 0 ||
    order.priceStatus === 'PENDING' ||
    order.priceStatus === 'PRICE_PENDING' ||
    order.priceStatus === 'DECLINED' ||
    order.priceApproved === false ||
    order.status === 'PENDING_APPROVAL';

  // Real verified payment calculation from PostgreSQL
  // Pending, unverified, or rejected payments must not count as received
  const verifiedPayments = Array.isArray(order.payments)
    ? order.payments.filter((p) => p && p.status === 'VERIFIED')
    : [];

  let amountPaid = 0;
  if (verifiedPayments.length > 0) {
    amountPaid = verifiedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  } else if ((!Array.isArray(order.payments) || order.payments.length === 0) && order.advancePayment !== undefined && order.advancePayment !== null) {
    amountPaid = Number(order.advancePayment) || 0;
  }

  const balanceDue = isPricePending ? 0 : Math.max(0, totalAmount - amountPaid);

  if (isPricePending) {
    return {
      statusKey: 'PRICE_PENDING',
      label: 'PRICE PENDING',
      stampText: 'PRICE PENDING',
      balanceLabel: 'Balance Due',
      color: '#d97706',
      bgColor: '#fffbeb',
      borderColor: '#fde68a',
      stampBorderColor: '#d97706',
      stampTextColor: '#d97706',
      totalAmount: 0,
      amountPaid: 0,
      balanceDue: 0
    };
  }

  if (amountPaid >= totalAmount && totalAmount > 0) {
    return {
      statusKey: 'PAID',
      label: 'PAID',
      stampText: 'PAID',
      balanceLabel: 'Balance Due',
      color: '#16a34a',
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      stampBorderColor: '#16a34a',
      stampTextColor: '#16a34a',
      totalAmount,
      amountPaid,
      balanceDue: 0
    };
  }

  if (amountPaid > 0 && balanceDue > 0) {
    return {
      statusKey: 'PARTIALLY_PAID',
      label: 'PARTIALLY PAID',
      stampText: 'PARTIALLY PAID',
      balanceLabel: 'Balance Due',
      color: '#ea580c',
      bgColor: '#fff7ed',
      borderColor: '#fed7aa',
      stampBorderColor: '#ea580c',
      stampTextColor: '#ea580c',
      totalAmount,
      amountPaid,
      balanceDue
    };
  }

  return {
    statusKey: 'UNPAID',
    label: 'UNPAID',
    stampText: 'UNPAID',
    balanceLabel: 'Balance Due',
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    stampBorderColor: '#dc2626',
    stampTextColor: '#dc2626',
    totalAmount,
    amountPaid: 0,
    balanceDue: totalAmount
  };
};

export const generateDigitalInvoiceWhatsAppMessage = (order) => {
  if (!order) return '';

  const customerName = order.customer?.name || order.customerName || 'Customer';
  const orderNo = order.orderNumber || (order.id ? `JB-${order.id}` : 'ORD-PENDING');
  const quotationNo = order.quotationNumber || order.orderNumber || (order.id ? `Q-${order.id}` : 'QUO-PENDING');
  const itemName =
    order.garmentDetails?.dressType ||
    order.dressType ||
    order.itemName ||
    'Custom Tailoring';
  const quantity = Number(order.garmentDetails?.quantity || order.quantity || 1);

  const discountAmount = Number(order.discountAmount || 0);
  const paymentInfo = computeInvoicePaymentStatus(order);
  const totalAmount = paymentInfo.totalAmount;
  const amountPaid = paymentInfo.amountPaid;
  const balanceDue = paymentInfo.balanceDue;
  const grossSubtotal = totalAmount + discountAmount;

  const isBella =
    order.branchId === 2 ||
    (order.branch && (order.branch.name === 'BELLA DESIGN' || order.branch.id === 2)) ||
    (order.branchName && order.branchName.toUpperCase().includes('BELLA'));

  const brandName = isBella ? 'BELLA DESIGN' : 'JB GROUP';
  const brandFull = isBella ? 'BELLA DESIGN' : 'JB GROUP (PVT) LTD';

  return `✨ ${brandFull} ✨

Dear ${customerName}, 🌸

Thank you for choosing ${brandName}! 💐 We truly appreciate your trust in us.

📋 ORDER QUOTATION

🔖 Quotation No: ${quotationNo}
👗 Item: ${itemName} × ${quantity}
💰 Total Amount: LKR ${grossSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
${discountAmount > 0 ? `🎁 Discount: LKR ${discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n💳 Net Payable: LKR ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` : ''}💵 Advance Payment: LKR ${amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
💳 Balance Payable: LKR ${balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

✅ Kindly review and confirm your quotation so we can proceed with your order.

💖 Your satisfaction is our priority, and we look forward to serving you!

🏢 ${brandFull}
✨ Build • Lead • Inspire.

🤖 Automated message from ${brandName} Management System.`;
};

const formatDateSpaced = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '—';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y} - ${m} - ${day}`;
  } catch (e) {
    return '—';
  }
};

const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const isBellaBranch = (branchId, branchName) => {
  if (branchId === 2) return true;
  if (!branchName) return false;
  const norm = String(branchName).trim().toUpperCase();
  return norm.includes('BELLA') || norm === '2';
};

export const DigitalInvoiceModal = ({ order, isOpen, onClose }) => {
  const invoiceRef = useRef(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);

  if (!isOpen || !order) return null;

  const isBella = isBellaBranch(order.branchId, order.branch?.name || order.branchName);
  const companyTitle = isBella ? 'BELLA DESIGN' : 'JB GROUP (PVT) LTD';
  const brandShort = isBella ? 'BELLA DESIGN' : 'JB GROUP';
  const tagline = isBella ? 'Exclusive Boutique & Fashion Studio' : 'Build • Lead • Inspire | Since 2021';
  const addressLine = isBella
    ? 'Bella Design Studio, Trincomalee.'
    : 'First floor, No 71, Thirugnanasampanthar Street, Trincomalee.';
  const branchPhone1 = '+94 72 627 8727';
  const branchPhone2 = isBella ? '+94 26 222 5555' : '+44 7847 431970';

  const customerName = order.customer?.name || order.customerName || 'Customer';
  const customerPhone = order.customer?.primaryPhone || order.customer?.phone || order.phone || '';
  const customerAddress = order.customer?.address || order.address || '';
  const orderNo = order.orderNumber || (order.id ? `JB-${order.id}` : 'ORD-PENDING');
  const billNo = order.id || 'N/A';

  const orderDate = formatDateSpaced(order.orderDate || order.createdAt);
  const bookedDate = formatDateSpaced(order.orderDate || order.createdAt);
  const rawDueDate = order.deliveryDate || order.dueDate;
  const hasDueDate = Boolean(rawDueDate);
  const dueDate = formatDateSpaced(rawDueDate);

  // Map order items supporting multiple line items
  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items.map((item) => {
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.unitPrice || item.rate || (item.total ? item.total / qty : 0));
        const total = Number(item.totalPrice || item.total || (rate * qty));
        return {
          title: item.title || item.category || 'Stitching',
          name: item.name || item.description || item.dressType || `Dress: ${order.garmentDetails?.dressType || 'Custom Garment'}`,
          quantity: qty,
          rate,
          total
        };
      })
    : [{
        title: 'Stitching',
        name: `Dress: ${order.garmentDetails?.dressType || order.dressType || order.itemName || 'Saree Blouse'}`,
        quantity: Number(order.garmentDetails?.quantity || order.quantity || 1),
        rate: Number(order.garmentDetails?.quantity || order.quantity || 1) > 0
          ? Number(order.totalAmount || 0) / Number(order.garmentDetails?.quantity || order.quantity || 1)
          : Number(order.totalAmount || 0),
        total: Number(order.totalAmount || 0)
      }];

  const isSingleItem = items.length <= 1;
  const discountAmount = Number(order.discountAmount || 0);
  const paymentInfo = computeInvoicePaymentStatus(order);
  const totalAmount = paymentInfo.totalAmount;
  const amountPaid = paymentInfo.amountPaid;
  const balanceDue = paymentInfo.balanceDue;
  const grossSubtotal = totalAmount + discountAmount;

  // Customer reference photo or artwork
  const customerGarmentImage =
    order.garmentDetails?.designPhoto ||
    order.garmentDetails?.referenceImage ||
    order.designImage ||
    order.customerFabric?.materialPhoto ||
    null;

  const resolvedGarmentImageUrl = customerGarmentImage
    ? (customerGarmentImage.startsWith('http') || customerGarmentImage.startsWith('data:')
        ? customerGarmentImage
        : customerGarmentImage.startsWith('/')
          ? customerGarmentImage
          : `/${customerGarmentImage}`)
    : null;

  // Capture clean invoice card: Exactly 1500 x 1851 for standard 1-item orders; height grows for longer orders
  const captureInvoice = () => {
    return html2canvas(invoiceRef.current, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 15000,
      scrollX: 0,
      scrollY: 0,
      onclone: (_document, card) => {
        card.ownerDocument.body.style.width = '500px';
        card.ownerDocument.body.style.minWidth = '500px';
        card.ownerDocument.body.append(card);
        Object.assign(card.style, {
          width: '500px',
          minWidth: '500px',
          maxWidth: '500px',
          margin: '0',
          boxShadow: 'none',
          position: 'static'
        });
        if (isSingleItem) {
          card.style.height = '617px';
          card.style.minHeight = '617px';
          card.style.maxHeight = '617px';
        } else {
          card.style.height = 'auto';
          card.style.minHeight = '617px';
        }
      }
    });
  };

  // Download high-resolution PNG image (exactly 1500 x 1851 for standard 1-item)
  const handleDownloadPng = async () => {
    if (!invoiceRef.current) return;
    setDownloadingPng(true);
    try {
      const canvas = await captureInvoice();
      const link = document.createElement('a');
      link.download = `${isBella ? 'BELLA_DESIGN' : 'JB_GROUP'}_Invoice_${orderNo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG download error:', err);
      alert('Unable to generate invoice image.');
    } finally {
      setDownloadingPng(false);
    }
  };

  // Prepare full A4 PDF invoice (preserving readability and handling multi-page/scaled layout)
  const makePdf = async () => {
    const canvas = await captureInvoice();
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const printableWidth = pageWidth - 24;
    const printableHeight = pageHeight - 24;

    const scaledHeight = (printableWidth * canvas.height) / canvas.width;

    if (scaledHeight <= printableHeight) {
      // Single page perfect fit
      pdf.addImage(canvas, 'PNG', 12, 12, printableWidth, scaledHeight, undefined, 'SLOW');
    } else {
      // For very long orders, paginate cleanly onto additional A4 pages
      const pageCanvasHeight = (printableHeight * canvas.width) / printableWidth;
      let renderedHeight = 0;
      let pageNum = 0;

      while (renderedHeight < canvas.height) {
        if (pageNum > 0) pdf.addPage('a4', 'portrait');

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(pageCanvasHeight, canvas.height - renderedHeight);

        const ctx = sliceCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          renderedHeight,
          canvas.width,
          sliceCanvas.height,
          0,
          0,
          sliceCanvas.width,
          sliceCanvas.height
        );

        const sliceHeightMm = (printableWidth * sliceCanvas.height) / sliceCanvas.width;
        pdf.addImage(sliceCanvas, 'PNG', 12, 12, printableWidth, sliceHeightMm, undefined, 'SLOW');

        renderedHeight += pageCanvasHeight;
        pageNum++;
      }
    }
    return pdf;
  };

  // Download crisp A4 PDF invoice
  const handleDownloadPdf = async () => {
    if (!invoiceRef.current) return;
    setDownloadingPdf(true);
    try {
      const pdf = await makePdf();
      pdf.save(`${isBella ? 'BELLA_DESIGN' : 'JB_GROUP'}_Invoice_${orderNo}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Unable to generate invoice PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Print full invoice with proper layout matching PDF & PNG
  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Allow pop-ups to open the printable invoice.');
      return;
    }
    try {
      const pdf = await makePdf();
      pdf.autoPrint();
      const url = pdf.output('bloburl');
      printWindow.location.replace(url);
      window.addEventListener('pagehide', () => URL.revokeObjectURL(url), { once: true });
    } catch (err) {
      printWindow.close();
      console.error('Invoice print error:', err);
      alert('Unable to prepare printable invoice.');
    }
  };

  const whatsAppUrl = `https://api.whatsapp.com/send?phone=${normalizePhoneForWhatsApp(customerPhone)}&text=${encodeURIComponent(generateDigitalInvoiceWhatsAppMessage(order))}`;

  return (
    <div
      className="modal-overlay-responsive"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px'
      }}
    >
      <div
        className="modal-card-responsive"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden'
        }}
      >
        {/* Style injection */}
        <style>{digitalInvoiceStyles}</style>

        {/* Modal Action Header */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#002b66' }}>
              Customer Invoice
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                backgroundColor: '#e0e7ff',
                color: '#002b66',
                padding: '2px 8px',
                borderRadius: '999px',
                fontWeight: 700
              }}
            >
              {orderNo}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div
          className="invoice-modal-toolbar no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '8px 18px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            flexWrap: 'wrap'
          }}
        >
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#22c55e',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 2px 4px rgba(34, 197, 94, 0.25)'
            }}
          >
            <MessageCircle size={15} /> Send via WhatsApp
          </a>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleDownloadPng}
              disabled={downloadingPng}
              title="Download high-res PNG image (1500 x 1851 px)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ImageIcon size={14} /> {downloadingPng ? 'Saving...' : 'PNG'}
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              title="Download A4 PDF invoice"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Download size={14} /> {downloadingPdf ? 'PDF...' : 'PDF'}
            </button>

            <button
              onClick={handlePrint}
              title="Print A4 invoice"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body containing the Invoice Card */}
        <div
          className="invoice-receipt-wrapper"
          style={{
            overflowY: 'auto',
            maxHeight: 'calc(94vh - 110px)',
            padding: '12px',
            backgroundColor: '#f1f5f9',
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          {/* THE DIGITAL INVOICE CARD */}
          <article
            ref={invoiceRef}
            className={`jb-invoice ${isSingleItem ? 'jb-invoice-standard' : 'jb-invoice-expanded'}`}
          >
            {/* Top-Right Decorative Curve (Red & Blue Swoosh) */}
            <svg
              className="jb-invoice-corner"
              viewBox="0 0 135 85"
              fill="none"
              aria-hidden="true"
            >
              <path d="M 25 0 C 60 28, 90 42, 135 48 L 135 0 Z" fill="#002b66" />
              <path d="M 0 0 C 45 22, 75 46, 135 66 L 135 48 C 80 34, 45 16, 12 0 Z" fill="#dc2626" />
            </svg>

            {/* Inner Content Body */}
            <div className="jb-invoice-body">

              {/* 1. TOP HEADER */}
              <header className="jb-invoice-brand">
                {isBella ? (
                  <div
                    style={{
                      width: '54px',
                      height: '40px',
                      borderRadius: '6px',
                      backgroundColor: '#002b66',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '1.2rem',
                      letterSpacing: '1px',
                      flexShrink: 0
                    }}
                  >
                    BD
                  </div>
                ) : (
                  <img
                    src="/jb_group_logo.png"
                    alt="JB GROUP"
                    crossOrigin="anonymous"
                  />
                )}

                <div className="jb-invoice-brand-divider" />

                <div className="jb-invoice-brand-info">
                  <strong>{companyTitle}</strong>
                  <span>{tagline}</span>
                </div>
              </header>

              {/* 2. SUB-HEADER: HEADQUARTERS & CONTACTS */}
              <div className="jb-invoice-contact">
                <div>
                  <span className="jb-invoice-hq">Headquarters</span>
                  <div className="jb-invoice-address">
                    <MapPin size={12} color="#dc2626" />
                    <span>
                      {addressLine} <b>Sri Lanka.</b>
                    </span>
                  </div>
                </div>

                <div className="jb-invoice-numbers">
                  <a href={`https://api.whatsapp.com/send?phone=94726278727`} className="jb-invoice-wa-pill">
                    <div className="jb-invoice-wa-icon">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#25D366">
                        <path d="M17.5 14.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9 0 1.7 1.2 3.4 1.4 3.6.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.6-.4z" />
                      </svg>
                    </div>
                    <span>{branchPhone1}</span>
                  </a>

                  <a href={`https://api.whatsapp.com/send?phone=${normalizePhoneForWhatsApp(branchPhone2)}`} className="jb-invoice-wa-pill jb-invoice-wa-pill-navy">
                    <div className="jb-invoice-wa-icon">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#25D366">
                        <path d="M17.5 14.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9 0 1.7 1.2 3.4 1.4 3.6.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.6-.4z" />
                      </svg>
                    </div>
                    <span>{branchPhone2}</span>
                  </a>
                </div>
              </div>

              {/* 3. INVOICE TITLE: "CUSTOMER INVOICE" BANNER */}
              <div className="jb-invoice-title-wrapper">
                <div className="jb-invoice-title-wing-left" />
                <div className="jb-invoice-title-pill">
                  CUSTOMER INVOICE
                </div>
                <div className="jb-invoice-title-wing-right" />
              </div>

              {/* 4. CUSTOMER DETAILS & INVOICE REFERENCE */}
              <div className="jb-invoice-billing">
                <div className="jb-invoice-customer">
                  <div className="jb-invoice-customer-header">
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#002b66',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <User size={10} color="#ffffff" />
                    </div>
                    <span>BILLED TO:</span>
                  </div>

                  <div className="jb-invoice-customer-name">
                    {customerName}
                  </div>

                  <div className="jb-invoice-customer-phone">
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#002b66',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Phone size={10} color="#ffffff" />
                    </div>
                    <span>{customerPhone || 'Not Available'}</span>
                  </div>

                  {customerAddress && (
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                      {customerAddress}
                    </div>
                  )}
                </div>

                <div className="jb-invoice-ref-divider" />

                <div className="jb-invoice-ref">
                  <div className="jb-invoice-ref-row">
                    <span className="jb-invoice-ref-label">Invoice No</span>
                    <span className="jb-invoice-ref-val">: {billNo}</span>
                  </div>
                  <div className="jb-invoice-ref-row">
                    <span className="jb-invoice-ref-label">Order No</span>
                    <span className="jb-invoice-ref-val">: {orderNo}</span>
                  </div>
                  <div className="jb-invoice-ref-row">
                    <span className="jb-invoice-ref-label">Order Date</span>
                    <span className="jb-invoice-ref-val">: {orderDate}</span>
                  </div>
                  <div className="jb-invoice-ref-row">
                    <span className="jb-invoice-ref-label">Booked Date</span>
                    <span className="jb-invoice-ref-val">: {bookedDate}</span>
                  </div>
                  {hasDueDate && (
                    <div className="jb-invoice-ref-row">
                      <span className="jb-invoice-ref-label">Due Date</span>
                      <span className="jb-invoice-ref-val">: {dueDate}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. ITEM DESCRIPTION TABLE */}
              <div className="jb-invoice-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: '42%' }}>Description</th>
                      <th style={{ textAlign: 'center', width: '14%' }}>Qty</th>
                      <th style={{ textAlign: 'right', width: '22%' }}>Rate (Rs.)</th>
                      <th style={{ textAlign: 'right', width: '22%' }}>Total (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr
                        key={idx}
                        style={{
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                        }}
                      >
                        <td style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 900, fontSize: '0.88rem', color: '#0f172a' }}>
                            {it.title}
                          </div>
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: '#0056b3',
                              fontWeight: 700,
                              marginTop: '1px'
                            }}
                          >
                            {it.name}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.92rem', fontWeight: 800 }}>
                          {it.quantity}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.84rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {formatCurrency(it.rate)}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.88rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                          {formatCurrency(it.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 6. GARMENT VISUAL + PAYMENT SUMMARY ROW */}
              <div className="jb-invoice-payment-section">
                {/* Left: Garment Artwork / Watermark */}
                <div className="jb-invoice-art-box">
                  {!isBella && (
                    <div className="jb-invoice-watermark">
                      <img
                        src="/jb_group_logo.png"
                        alt="Watermark"
                        crossOrigin="anonymous"
                      />
                    </div>
                  )}

                  {resolvedGarmentImageUrl ? (
                    <img
                      src={resolvedGarmentImageUrl}
                      alt="Garment Design"
                      crossOrigin="anonymous"
                      className="jb-invoice-art-img"
                      style={{
                        borderRadius: '6px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                      }}
                    />
                  ) : (
                    <img
                      src="/tailoring_mannequin_artwork.png"
                      alt="Tailoring Visual"
                      crossOrigin="anonymous"
                      className="jb-invoice-art-img"
                    />
                  )}
                </div>

                {/* Right: Payment Summary Cards & Bill-Style Rubber Stamp */}
                <div className="jb-invoice-totals-box">
                  {/* Gross Subtotal */}
                  <div className="jb-invoice-pill jb-invoice-pill-subtotal">
                    <span>Gross Subtotal</span>
                    <span>Rs. {formatCurrency(grossSubtotal)}</span>
                  </div>

                  {/* Discount (if any) */}
                  {discountAmount > 0 && (
                    <div className="jb-invoice-pill jb-invoice-pill-discount">
                      <span>Discount</span>
                      <span>- Rs. {formatCurrency(discountAmount)}</span>
                    </div>
                  )}

                  {/* Net Payable */}
                  <div className="jb-invoice-pill jb-invoice-pill-net">
                    <span>Net Payable</span>
                    <span>Rs. {formatCurrency(totalAmount)}</span>
                  </div>

                  {/* Amount Paid */}
                  <div className="jb-invoice-pill jb-invoice-pill-paid">
                    <span>Amount Paid</span>
                    <span>Rs. {formatCurrency(amountPaid)}</span>
                  </div>

                  {/* Balance Due (Outstanding Amount) */}
                  <div
                    className="jb-invoice-pill jb-invoice-pill-due"
                    style={{
                      backgroundColor: balanceDue > 0 ? (amountPaid > 0 ? '#fff7ed' : '#fef2f2') : '#f8fafc',
                      border: `1px solid ${balanceDue > 0 ? (amountPaid > 0 ? '#fed7aa' : '#fecaca') : '#e2e8f0'}`,
                      color: balanceDue > 0 ? (amountPaid > 0 ? '#ea580c' : '#dc2626') : '#334155'
                    }}
                  >
                    <span>Balance Due</span>
                    <span>Rs. {formatCurrency(balanceDue)}</span>
                  </div>

                  {/* Original Bill-Style Rubber Stamp (Kept clear of all amounts and footer) */}
                  <div className="jb-invoice-rubber-stamp-container">
                    <div
                      className="jb-invoice-rubber-stamp"
                      style={{
                        border: `2.5px solid ${paymentInfo.stampBorderColor}`,
                        color: paymentInfo.stampTextColor,
                        boxShadow: `0 2px 6px ${paymentInfo.stampBorderColor}20`
                      }}
                    >
                      {paymentInfo.stampText}
                    </div>
                  </div>
                </div>
              </div>

              {/* 7. PAYMENT TERMS & THANK YOU SECTION */}
              <div className="jb-invoice-bottom-terms">
                <div className="jb-invoice-terms-box">
                  <div className="jb-invoice-terms-header">
                    <ClipboardList size={13} color="#002b66" />
                    <span>Payment Terms</span>
                  </div>
                  <ul className="jb-invoice-terms-list">
                    <li>
                      {paymentInfo.statusKey === 'PRICE_PENDING'
                        ? 'Price pending confirmation.'
                        : `Full payment: Rs. ${formatCurrency(totalAmount)}`}
                    </li>
                    {balanceDue > 0 && paymentInfo.statusKey !== 'PRICE_PENDING' && (
                      <li>Please make the payment at your earliest convenience.</li>
                    )}
                    {paymentInfo.statusKey === 'PAID' && (
                      <li>Payment received in full. Thank you!</li>
                    )}
                  </ul>
                </div>

                <div className="jb-invoice-thanks-box">
                  <svg
                    width="22"
                    height="32"
                    viewBox="0 0 24 38"
                    fill="none"
                    stroke="#002b66"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M10 2.5h4v2h-4z" fill="#002b66" stroke="none" />
                    <line x1="12" y1="4.5" x2="12" y2="7" />
                    <path d="M7.5 7.5 C9 6.8 15 6.8 16.5 7.5 C17.8 9.5 18 12.5 17.5 15.5 C17 18 15.5 19.5 15.5 21.5 C15.5 23 16.8 24 16.5 25.5 L7.5 25.5 C7.2 24 8.5 23 8.5 21.5 C8.5 19.5 7 18 6.5 15.5 C6 12.5 6.2 9.5 7.5 7.5 Z" />
                    <line x1="12" y1="25.5" x2="12" y2="34" />
                    <path d="M6 37 L12 34 L18 37" />
                  </svg>
                  <div
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      color: '#002b66',
                      lineHeight: 1.2
                    }}
                  >
                    Thank you for choosing {brandShort}!
                  </div>
                </div>
              </div>

            </div>

            {/* 8. BOTTOM DECORATIVE BANNER & FOOTER (Follows Content in Natural Flow) */}
            <footer className="jb-invoice-footer">
              <div className="jb-invoice-footer-stripe" />
              <svg
                className="jb-invoice-footer-swoosh"
                viewBox="0 0 55 32"
                fill="none"
                aria-hidden="true"
              >
                <path d="M 0 32 C 22 29, 38 18, 55 0 L 55 32 Z" fill="#002b66" />
                <path d="M 0 32 C 22 29, 38 18, 55 0 L 55 4 C 40 21, 24 29, 0 32 Z" fill="#dc2626" />
              </svg>

              <strong className="jb-invoice-footer-title">
                {companyTitle}
              </strong>
              <span className="jb-invoice-footer-tagline">
                Build • Lead • Inspire
              </span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
};
