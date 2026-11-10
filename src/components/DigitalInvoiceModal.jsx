import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  Download,
  MessageCircle,
  Image as ImageIcon,
  MapPin
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const normalizePhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  const raw = String(phone).replace(/\D/g, '');
  if (raw.startsWith('00')) return raw.slice(2);
  if (raw.startsWith('0')) return '94' + raw.slice(1);
  return raw;
};

export const generateDigitalInvoiceWhatsAppMessage = (order) => {
  if (!order) return '';
  const customerName = order.customer?.name || 'Customer';
  const customerPhone = order.customer?.primaryPhone || order.customer?.phone || '';
  const orderNo = order.orderNumber || `JB-${order.id}`;
  const billNo = order.id || 'N/A';
  const bookedDate = order.orderDate
    ? new Date(order.orderDate).toISOString().split('T')[0]
    : order.createdAt
      ? new Date(order.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

  const dressType = order.garmentDetails?.dressType || 'Other';
  const quantity = Number(order.garmentDetails?.quantity || 1);
  const totalAmount = Number(order.totalAmount || 0);
  const discountAmount = Number(order.discountAmount || 0);
  const grossSubtotal = totalAmount + discountAmount;
  const rate = quantity > 0 ? (totalAmount / quantity) : totalAmount;

  // Real verified payment calculation from PostgreSQL
  let verifiedPaid = 0;
  if (Array.isArray(order.payments) && order.payments.length > 0) {
    verifiedPaid = order.payments
      .filter(p => p.status === 'VERIFIED')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }
  const amountPaid = verifiedPaid > 0 ? verifiedPaid : Number(order.advancePayment || 0);
  const balanceDue = Number(order.balanceAmount !== undefined ? order.balanceAmount : Math.max(0, totalAmount - amountPaid));

  const statusStamp = totalAmount === 0
    ? 'COMPLIMENTARY'
    : balanceDue <= 0
      ? 'PAID'
      : 'BALANCE DUE';

  return `\u{1F9FE} *DIGITAL INVOICE — JB GROUP (PVT) LTD*
Headquarters: First floor, No 71, Thirugnanasampanthar Street, Trincomalee. Sri Lanka.
WhatsApp: +94 72 627 8727 | +44 7847 431970

*STATUS:* [ ${statusStamp} ]

━━━━━━━━━━━━━━━━━━━━━━━━━━
\u{1F464} *BILLED TO:*
*${customerName}*
${customerPhone}

\u{1F516} *INVOICE REFERENCE:*
*Order No:* ${orderNo}
*Bill No:* ${billNo}
*Booked:* ${bookedDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━
\u{1F4CB} *ITEMS & SERVICES:*
*Stitching*
Dress: ${dressType}
Qty: ${quantity}  |  Rate: Rs. ${rate.toFixed(2)}
*Total: Rs. ${totalAmount.toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━━━━━━━
\u{1F4B0} *PAYMENT SUMMARY:*
\u2022 Gross Subtotal: Rs. ${grossSubtotal.toFixed(2)}
${discountAmount > 0 ? `\u2022 Discount: -Rs. ${discountAmount.toFixed(2)}\n` : ''}\u2022 *Net Payable:* *Rs. ${totalAmount.toFixed(2)}*
\u2022 *Amount Paid:* *Rs. ${amountPaid.toFixed(2)}*
\u2022 *Balance Due:* *Rs. ${balanceDue.toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━━━━━━━
\u2728 _Fits guaranteed for 30 days. Thank you for choosing us!_
\u{1F4CD} *JB GROUP (PVT) LTD*`;
};

export const DigitalInvoiceModal = ({ order, isOpen, onClose }) => {
  const invoiceRef = useRef(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);

  if (!isOpen || !order) return null;

  const customerName = order.customer?.name || 'Customer';
  const customerPhone = order.customer?.primaryPhone || order.customer?.phone || '';
  const customerAddress = order.customer?.address || '';
  const orderNo = order.orderNumber || `JB-${order.id}`;
  const billNo = order.id || 'N/A';
  const bookedDate = order.orderDate
    ? new Date(order.orderDate).toISOString().split('T')[0]
    : order.createdAt
      ? new Date(order.createdAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

  const dressType = order.garmentDetails?.dressType || 'Other';
  const quantity = Number(order.garmentDetails?.quantity || 1);
  const totalAmount = Number(order.totalAmount || 0);
  const discountAmount = Number(order.discountAmount || 0);
  const grossSubtotal = totalAmount + discountAmount;
  const rate = quantity > 0 ? (totalAmount / quantity) : totalAmount;

  // Real payment calculation from PostgreSQL
  let verifiedPaid = 0;
  let latestPaymentMethod = '';
  if (Array.isArray(order.payments) && order.payments.length > 0) {
    const verifiedPayments = order.payments.filter(p => p.status === 'VERIFIED');
    verifiedPaid = verifiedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    if (verifiedPayments.length > 0) {
      latestPaymentMethod = verifiedPayments[verifiedPayments.length - 1].paymentMethod || 'Cash';
    }
  }
  const amountPaid = verifiedPaid > 0 ? verifiedPaid : Number(order.advancePayment || 0);
  const balanceDue = Number(order.balanceAmount !== undefined ? order.balanceAmount : Math.max(0, totalAmount - amountPaid));
  const isPaid = balanceDue <= 0 && totalAmount > 0;

  // Download high-resolution PNG image
  const handleDownloadPng = async () => {
    if (!invoiceRef.current) return;
    setDownloadingPng(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        letterRendering: true,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          const card = clonedDoc.querySelector('.invoice-receipt-card');
          if (card) {
            card.style.webkitFontSmoothing = 'antialiased';
            card.style.mozOsxFontSmoothing = 'grayscale';
            card.style.textRendering = 'optimizeLegibility';
          }
        }
      });
      const link = document.createElement('a');
      link.download = `JB_GROUP_Invoice_${orderNo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG download error:', err);
      alert('Unable to generate invoice image.');
    } finally {
      setDownloadingPng(false);
    }
  };

  // Download crisp A4-proportioned PDF
  const handleDownloadPdf = async () => {
    if (!invoiceRef.current) return;
    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        letterRendering: true,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          const card = clonedDoc.querySelector('.invoice-receipt-card');
          if (card) {
            card.style.webkitFontSmoothing = 'antialiased';
            card.style.mozOsxFontSmoothing = 'grayscale';
            card.style.textRendering = 'optimizeLegibility';
          }
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const targetWidth = 165; // 165mm width leaves balanced margins on A4 (210mm wide)
      const targetHeight = (canvas.height * targetWidth) / canvas.width;
      const marginX = (pageWidth - targetWidth) / 2;
      const marginY = 16;

      // Use 'SLOW' compression to preserve pristine lossless anti-aliased typography
      pdf.addImage(imgData, 'PNG', marginX, marginY, targetWidth, targetHeight, undefined, 'SLOW');
      pdf.save(`JB_GROUP_Invoice_${orderNo}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Unable to generate invoice PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Professional A4 Browser Print
  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${orderNo} - JB GROUP (PVT) LTD</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: #ffffff !important;
              color: #0f172a;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: optimizeLegibility;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .invoice-receipt-card {
              box-shadow: none !important;
              border: 1.5px solid #93c5fd !important;
              margin: 0 auto !important;
              max-width: 500px !important;
              page-break-inside: avoid;
            }
            .whatsapp-pill {
              white-space: nowrap !important;
              display: inline-flex !important;
            }
            .whatsapp-pill span {
              white-space: nowrap !important;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div style="padding: 10px; max-width: 540px; margin: 0 auto;">
            ${printContent.outerHTML}
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(() => { window.close(); }, 600);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const whatsAppUrl = `https://wa.me/${normalizePhoneForWhatsApp(customerPhone)}?text=${encodeURIComponent(generateDigitalInvoiceWhatsAppMessage(order))}`;

  return (
    <div className="modal-overlay-responsive" style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div className="modal-card-responsive" style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '540px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden'
      }}>
        {/* Modal Action Header */}
        <div className="no-print" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              Digital Invoice Preview
            </span>
            <span style={{
              fontSize: '0.75rem',
              backgroundColor: '#e0e7ff',
              color: '#3730a3',
              padding: '2px 8px',
              borderRadius: '999px',
              fontWeight: 700
            }}>
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
        <div className="invoice-modal-toolbar no-print" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '10px 18px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          flexWrap: 'wrap'
        }}>
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
              padding: '7px 13px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 2px 4px rgba(34, 197, 94, 0.25)',
              transition: 'background-color 0.2s'
            }}
          >
            <MessageCircle size={15} /> Send via WhatsApp
          </a>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleDownloadPng}
              disabled={downloadingPng}
              title="Download high-res PNG image"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '6px 11px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ImageIcon size={14} /> {downloadingPng ? 'Saving...' : 'PNG'}
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              title="Download A4 PDF Invoice"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '6px 11px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Download size={14} /> {downloadingPdf ? 'PDF...' : 'PDF'}
            </button>

            <button
              onClick={handlePrint}
              title="Print A4 Invoice"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '6px 11px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        {/* Receipt Container (Scrollable) */}
        <div className="invoice-receipt-wrapper" style={{
          overflowY: 'auto',
          padding: '20px 16px',
          backgroundColor: '#f1f5f9',
          display: 'flex',
          justifyContent: 'center'
        }}>
          {/* EXACT INVOICE CARD MATCHING REFERENCE IMAGE */}
          <div
            ref={invoiceRef}
            className="invoice-receipt-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px 22px 20px 22px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
              border: '1.5px solid #93c5fd',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
              color: '#0f172a',
              position: 'relative',
              overflow: 'hidden',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              textRendering: 'optimizeLegibility',
              isolation: 'isolate'
            }}
          >
            {/* BACKGROUND WATERMARK */}
            <div style={{
              position: 'absolute',
              top: '53%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              opacity: 0.14,
              zIndex: 0,
              width: '275px',
              userSelect: 'none'
            }}>
              <img
                src="/jb_group_logo.png"
                alt="Watermark"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            {/* 1. TOP HEADER & STAMP */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '8px',
              position: 'relative',
              zIndex: 1,
              width: '100%'
            }}>
              {/* Left Column: Logo + Vertical Bar + Headquarters & Address */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  {/* JB GROUP Logo */}
                  <img
                    src="/jb_group_logo.png"
                    alt="JB GROUP"
                    style={{
                      height: '52px',
                      width: 'auto',
                      objectFit: 'contain',
                      flexShrink: 0
                    }}
                  />

                  {/* Vertical Blue Line */}
                  <div style={{
                    width: '1.5px',
                    height: '56px',
                    backgroundColor: '#0a2558',
                    margin: '0 8px',
                    flexShrink: 0
                  }} />

                  {/* Headquarters & Address */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '2px' }}>
                      <span style={{
                        backgroundColor: '#0a2558',
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 9px',
                        borderRadius: '9999px',
                        display: 'inline-block'
                      }}>
                        Headquarters
                      </span>
                    </div>

                    <div style={{
                      fontSize: '0.93rem',
                      fontWeight: 900,
                      color: '#0a2558',
                      letterSpacing: '0.1px',
                      lineHeight: 1.2,
                      marginBottom: '3px',
                      whiteSpace: 'nowrap'
                    }}>
                      JB GROUP (PVT) LTD
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                      <MapPin
                        size={13}
                        color="#dc2626"
                        fill="#dc2626"
                        style={{ flexShrink: 0, marginTop: '2px' }}
                      />
                      <div style={{
                        fontSize: '0.71rem',
                        color: '#0f172a',
                        lineHeight: 1.3
                      }}>
                        <div style={{ whiteSpace: 'nowrap' }}>First floor, No 71,</div>
                        <div style={{ whiteSpace: 'nowrap' }}>Thirugnanasampanthar Street,</div>
                        <div style={{ whiteSpace: 'nowrap' }}>
                          Trincomalee.{' '}
                          <span style={{ fontWeight: 800, color: '#0a2558' }}>
                            Sri Lanka.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vertical Divider Line beside Address */}
              <div style={{
                width: '1px',
                backgroundColor: '#bfdbfe',
                margin: '0 8px',
                alignSelf: 'stretch',
                flexShrink: 0
              }} />

              {/* Right Column: Rotated Stamp + WhatsApp Contact Pills */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                flex: '0 0 auto',
                minWidth: 'fit-content',
                gap: '8px'
              }}>
                {/* 🔴/🟢 Rotated Stamp Badge */}
                <div style={{
                  border: `2.5px solid ${isPaid ? '#16a34a' : '#dc2626'}`,
                  borderRadius: '6px',
                  padding: isPaid ? '5px 14px' : '3px 12px',
                  transform: 'rotate(-6deg)',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                  textAlign: 'center',
                  marginRight: '2px'
                }}>
                  {isPaid ? (
                    <div style={{
                      color: '#16a34a',
                      fontWeight: 900,
                      fontSize: '1.05rem',
                      letterSpacing: '1px',
                      lineHeight: 1.1
                    }}>
                      PAID
                    </div>
                  ) : (
                    <div style={{
                      color: '#dc2626',
                      fontWeight: 900,
                      fontSize: '0.92rem',
                      letterSpacing: '0.8px',
                      lineHeight: 1.12
                    }}>
                      <div>BALANCE</div>
                      <div>DUE</div>
                    </div>
                  )}
                </div>

                {/* WhatsApp Contact Capsules - Single Line display */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '5px',
                  width: '100%'
                }}>
                  <div
                    className="whatsapp-pill"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: '6px',
                      backgroundColor: '#0a2558',
                      borderRadius: '9999px',
                      padding: '3px 10px 3px 8px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      style={{ flexShrink: 0, display: 'block' }}
                    >
                      <circle cx="12" cy="12" r="11" fill="#25D366" />
                      <path
                        d="M17.5 14.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9 0 1.7 1.2 3.4 1.4 3.6.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.6-.4z"
                        fill="#ffffff"
                      />
                    </svg>
                    <span
                      style={{
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        letterSpacing: '0.25px',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.2,
                        display: 'inline-block',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      +94 72 627 8727
                    </span>
                  </div>

                  <div
                    className="whatsapp-pill"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: '6px',
                      backgroundColor: '#0a2558',
                      borderRadius: '9999px',
                      padding: '3px 10px 3px 8px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      style={{ flexShrink: 0, display: 'block' }}
                    >
                      <circle cx="12" cy="12" r="11" fill="#25D366" />
                      <path
                        d="M17.5 14.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9 0 1.7 1.2 3.4 1.4 3.6.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.6-.4z"
                        fill="#ffffff"
                      />
                    </svg>
                    <span
                      style={{
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        letterSpacing: '0.25px',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.2,
                        display: 'inline-block',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      +44 7847 431970
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Red Accent Swoosh Spanning Header */}
            <div style={{ margin: '10px 0 6px 0', width: '100%', position: 'relative', zIndex: 1 }}>
              <svg width="100%" height="8" viewBox="0 0 440 8" fill="none" style={{ display: 'block' }}>
                <path
                  d="M 4 2 C 120 7, 280 8, 436 2"
                  stroke="#dc2626"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Light Blue Horizontal Divider */}
            <div style={{
              height: '1px',
              backgroundColor: '#93c5fd',
              margin: '6px 0 16px 0',
              position: 'relative',
              zIndex: 1
            }} />

            {/* 2. BILLED TO & INVOICE REFERENCE */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'stretch',
              marginBottom: '16px',
              fontSize: '0.85rem',
              position: 'relative',
              zIndex: 1
            }}>
              {/* Left Column: Billed To */}
              <div style={{ flex: '1 1 auto', minWidth: 0, paddingRight: '8px' }}>
                <div style={{
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  color: '#0a2558',
                  letterSpacing: '0.5px'
                }}>
                  BILLED TO:
                </div>
                <div style={{
                  fontWeight: 800,
                  fontSize: '1.22rem',
                  color: '#0f172a',
                  marginTop: '3px',
                  lineHeight: 1.2,
                  wordBreak: 'break-word'
                }}>
                  {customerName}
                </div>
                <div style={{
                  color: '#0f172a',
                  fontSize: '0.94rem',
                  fontWeight: 600,
                  marginTop: '3px',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap'
                }}>
                  {customerPhone || 'Not Available'}
                </div>
                {customerAddress && (
                  <div style={{
                    color: '#475569',
                    fontSize: '0.78rem',
                    marginTop: '2px',
                    maxWidth: '220px',
                    lineHeight: 1.3,
                    wordBreak: 'break-word'
                  }}>
                    {customerAddress}
                  </div>
                )}
              </div>

              {/* Vertical Divider Line between Billed To and Reference */}
              <div style={{
                width: '1px',
                backgroundColor: '#93c5fd',
                margin: '0 12px',
                alignSelf: 'stretch',
                flexShrink: 0
              }} />

              {/* Right Column: Invoice Reference */}
              <div style={{ flex: '0 0 auto', textAlign: 'right', minWidth: 'fit-content' }}>
                <div style={{
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  color: '#0a2558',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap'
                }}>
                  INVOICE REFERENCE:
                </div>
                <div style={{ color: '#0f172a', fontSize: '0.92rem', marginTop: '3px', whiteSpace: 'nowrap' }}>
                  Order No: <strong style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{orderNo}</strong>
                </div>
                <div style={{ color: '#0f172a', fontSize: '0.98rem', marginTop: '2px', whiteSpace: 'nowrap' }}>
                  Bill No: <strong style={{ fontWeight: 900, fontSize: '1.08rem', fontVariantNumeric: 'tabular-nums' }}>{billNo}</strong>
                </div>
                <div style={{ color: '#0f172a', fontSize: '0.88rem', marginTop: '2px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  Booked: {bookedDate}
                </div>
              </div>
            </div>

            {/* 3. ITEMS TABLE */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              marginBottom: '14px',
              position: 'relative',
              zIndex: 1
            }}>
              <thead>
                <tr style={{
                  borderTop: '1px solid #93c5fd',
                  borderBottom: '1px solid #93c5fd'
                }}>
                  <th style={{
                    textAlign: 'left',
                    padding: '8px 4px',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: '#0a2558',
                    width: '38%'
                  }}>
                    Description
                  </th>
                  <th style={{
                    textAlign: 'center',
                    padding: '8px 4px',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: '#0a2558',
                    width: '14%'
                  }}>
                    Qty
                  </th>
                  <th style={{
                    textAlign: 'right',
                    padding: '8px 4px',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: '#0a2558',
                    width: '22%'
                  }}>
                    Rate
                  </th>
                  <th style={{
                    textAlign: 'right',
                    padding: '8px 4px',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: '#0a2558',
                    width: '26%'
                  }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #93c5fd' }}>
                  <td style={{ padding: '12px 4px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#0f172a' }}>
                      Stitching
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#1d4ed8', fontWeight: 600, marginTop: '2px' }}>
                      Dress: {dressType}
                    </div>
                  </td>
                  <td style={{
                    textAlign: 'center',
                    padding: '12px 4px',
                    fontSize: '1.02rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    verticalAlign: 'middle',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {quantity}
                  </td>
                  <td style={{
                    textAlign: 'right',
                    padding: '12px 4px',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap'
                  }}>
                    <div style={{ lineHeight: 1.2 }}>
                      <div>Rs.</div>
                      <div style={{ fontVariantNumeric: 'tabular-nums' }}>{rate.toFixed(2)}</div>
                    </div>
                  </td>
                  <td style={{
                    textAlign: 'right',
                    padding: '12px 4px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    verticalAlign: 'middle',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap'
                  }}>
                    Rs. {totalAmount.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 4. TOTALS BLOCK */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              position: 'relative',
              zIndex: 1,
              marginBottom: '18px'
            }}>
              <div style={{
                width: 'auto',
                minWidth: '255px',
                maxWidth: '300px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                fontSize: '0.96rem',
                color: '#0a2558',
                fontWeight: 700,
                marginBottom: '6px'
              }}>
                <span style={{ whiteSpace: 'nowrap' }}>Gross Subtotal:</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  Rs. {grossSubtotal.toFixed(2)}
                </span>
              </div>

              {discountAmount > 0 && (
                <div style={{
                  width: 'auto',
                  minWidth: '255px',
                  maxWidth: '300px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '16px',
                  fontSize: '0.9rem',
                  color: '#dc2626',
                  fontWeight: 700,
                  marginBottom: '6px'
                }}>
                  <span style={{ whiteSpace: 'nowrap' }}>Discount:</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    - Rs. {discountAmount.toFixed(2)}
                  </span>
                </div>
              )}

              <div style={{
                width: 'auto',
                minWidth: '255px',
                maxWidth: '300px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                fontSize: '1.1rem',
                fontWeight: 900,
                color: '#0f172a',
                marginBottom: '6px'
              }}>
                <span style={{ whiteSpace: 'nowrap' }}>Net Payable:</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  Rs. {totalAmount.toFixed(2)}
                </span>
              </div>

              <div style={{
                width: 'auto',
                minWidth: '255px',
                maxWidth: '300px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                fontSize: '1.05rem',
                fontWeight: 800,
                color: '#16a34a',
                marginBottom: '6px'
              }}>
                <span style={{ whiteSpace: 'nowrap' }}>Amount Paid:</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  Rs. {amountPaid.toFixed(2)}
                </span>
              </div>

              <div style={{
                width: 'auto',
                minWidth: '255px',
                maxWidth: '300px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                fontSize: '1.1rem',
                fontWeight: 900,
                color: balanceDue > 0 ? '#dc2626' : '#16a34a'
              }}>
                <span style={{ whiteSpace: 'nowrap' }}>Balance Due:</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  Rs. {balanceDue.toFixed(2)}
                </span>
              </div>
            </div>

            {/* 5. FOOTER GUARANTEE */}
            <div style={{
              borderTop: '1px solid #93c5fd',
              paddingTop: '14px',
              textAlign: 'center',
              fontSize: '0.88rem',
              color: '#0a2558',
              fontStyle: 'italic',
              fontWeight: 500,
              position: 'relative',
              zIndex: 1
            }}>
              Fits guaranteed for 30 days. Thank you for choosing us!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
