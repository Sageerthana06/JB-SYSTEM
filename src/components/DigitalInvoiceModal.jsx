import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  Download,
  MessageCircle,
  Image as ImageIcon
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
  const customerPhone = order.customer?.primaryPhone || '';
  const orderNo = order.orderNumber || `JB-${order.id}`;
  const billNo = order.id || 'N/A';
  const bookedDate = order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const deliveredDate = order.updatedAt ? new Date(order.updatedAt).toISOString().split('T')[0] : bookedDate;

  const dressType = order.garmentDetails?.dressType || 'Custom Garment';
  const quantity = order.garmentDetails?.quantity || 1;
  const totalAmount = Number(order.totalAmount || 0);
  const rate = quantity > 0 ? (totalAmount / quantity) : totalAmount;
  const advancePayment = Number(order.advancePayment || 0);
  const balanceAmount = Number(order.balanceAmount !== undefined ? order.balanceAmount : Math.max(0, totalAmount - advancePayment));

  const statusStamp = totalAmount === 0
    ? 'COMPLIMENTARY'
    : order.status === 'DELIVERED' && balanceAmount <= 0
      ? 'PAID & DELIVERED'
      : balanceAmount <= 0
        ? 'PAID IN FULL'
        : advancePayment > 0
          ? 'PARTIALLY PAID'
          : 'PAYMENT DUE';

  return `🧾 *DIGITAL INVOICE — JB GROUP (PVT) LTD*
Branch: ${order.branch?.name || 'JB Group HQ'}
First Floor, no 71, Thirugnanasampanthar Street
Trincomalee
Phone: +94 72 627 8727

*STATUS:* [ ${statusStamp} ]

━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *BILLED TO:*
*${customerName}*
${customerPhone}

🔖 *INVOICE REFERENCE:*
*Order No:* ${orderNo}
*Bill No:* ${billNo}
*Booked:* ${bookedDate}
${order.status === 'DELIVERED' ? `*Delivered:* ${deliveredDate}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *ITEMS & SERVICES:*
*Stitching*
Dress: ${dressType}
Qty: ${quantity}  |  Rate: Rs. ${rate.toFixed(2)}
*Total: Rs. ${totalAmount.toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *PAYMENT SUMMARY:*
• Gross Subtotal: Rs. ${totalAmount.toFixed(2)}
• *Net Payable:* *Rs. ${totalAmount.toFixed(2)}*
• *Amount Paid:* *Rs. ${advancePayment.toFixed(2)}*
• Balance Due: Rs. ${balanceAmount.toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ _Fits guaranteed for 30 days. Thank you for choosing us!_
📍 *JB GROUP (PVT) LTD*`;
};

export const DigitalInvoiceModal = ({ order, isOpen, onClose }) => {
  const invoiceRef = useRef(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);

  if (!isOpen || !order) return null;

  const customerName = order.customer?.name || 'Customer';
  const customerPhone = order.customer?.primaryPhone || '';
  const orderNo = order.orderNumber || `JB-${order.id}`;
  const billNo = order.id || '1530';
  const bookedDate = order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : '2026-07-07';
  const deliveredDate = order.updatedAt ? new Date(order.updatedAt).toISOString().split('T')[0] : bookedDate;

  const dressType = order.garmentDetails?.dressType || 'Saree Blouse';
  const quantity = order.garmentDetails?.quantity || 1;
  const totalAmount = Number(order.totalAmount || 0);
  const rate = quantity > 0 ? (totalAmount / quantity) : totalAmount;
  const advancePayment = Number(order.advancePayment || 0);
  const balanceAmount = Number(order.balanceAmount !== undefined ? order.balanceAmount : Math.max(0, totalAmount - advancePayment));

  // Determine Stamp Status
  let stampText = 'PAID & DELIVERED';
  let stampColor = '#16a34a';
  let stampBorder = '#16a34a';

  if (order.status === 'DELIVERED' && balanceAmount <= 0) {
    stampText = 'PAID & DELIVERED';
    stampColor = '#16a34a';
  } else if (balanceAmount <= 0) {
    stampText = 'PAID IN FULL';
    stampColor = '#16a34a';
  } else if (advancePayment > 0 && order.status === 'DELIVERED') {
    stampText = 'DELIVERED (BAL DUE)';
    stampColor = '#d97706';
    stampBorder = '#d97706';
  } else if (advancePayment > 0) {
    stampText = 'ADVANCE PAID';
    stampColor = '#2563eb';
    stampBorder = '#2563eb';
  } else {
    stampText = 'BALANCE DUE';
    stampColor = '#dc2626';
    stampBorder = '#dc2626';
  }

  // Download high-resolution PNG image
  const handleDownloadPng = async () => {
    if (!invoiceRef.current) return;
    setDownloadingPng(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `Digital_Invoice_${orderNo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG download error:', err);
      alert('Unable to generate invoice image.');
    } finally {
      setDownloadingPng(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    if (!invoiceRef.current) return;
    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Digital_Invoice_${orderNo}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Unable to generate invoice PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Browser Print
  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${orderNo}</title>
          <style>
            body { font-family: 'Inter', -apple-system, sans-serif; margin: 0; padding: 20px; background: #fff; color: #1e293b; }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>
          ${printContent.outerHTML}
          <script>
            window.onload = function() { window.print(); window.close(); }
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
        maxWidth: '560px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden'
      }}>
        {/* Modal Action Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
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
        <div className="invoice-modal-toolbar" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '10px 20px',
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
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 2px 4px rgba(34, 197, 94, 0.25)',
              transition: 'background-color 0.2s'
            }}
          >
            <MessageCircle size={16} /> Send via WhatsApp
          </a>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleDownloadPng}
              disabled={downloadingPng}
              title="Download image to send as photo on WhatsApp"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '7px 11px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ImageIcon size={14} /> {downloadingPng ? 'Saving...' : 'PNG Image'}
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              title="Download PDF"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '7px 11px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Download size={14} /> {downloadingPdf ? 'PDF...' : 'PDF'}
            </button>

            <button
              onClick={handlePrint}
              title="Print receipt"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '7px 11px',
                borderRadius: '8px',
                fontSize: '0.8rem',
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
          padding: '24px',
          backgroundColor: '#f8fafc',
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
              borderRadius: '12px',
              padding: '28px 24px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e2e8f0',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              color: '#1e293b',
              position: 'relative'
            }}
          >
            {/* 1. HEADER & STAMP */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h1 style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: '#1e3a8a',
                  letterSpacing: '0.2px'
                }}>
                  JB GROUP (PVT) LTD
                </h1>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>
                  <div>Branch: {order.branch?.name || 'JB Group'}</div>
                  <div>First Floor, no 71, Thirugnanasampanthar Street
                    Trincomalee</div>
                  <div>Phone: +94 72 627 8727</div>
                </div>
              </div>

              {/* 🟢 Rotated Stamp Badge */}
              <div style={{
                border: `2.5px solid ${stampBorder}`,
                borderRadius: '6px',
                padding: '5px 12px',
                transform: 'rotate(-7deg)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                marginTop: '4px',
                marginRight: '6px'
              }}>
                <span style={{
                  color: stampColor,
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  letterSpacing: '1px',
                  display: 'inline-block',
                  textAlign: 'center'
                }}>
                  {stampText}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: '#e2e8f0', marginBottom: '18px' }} />

            {/* 2. BILLED TO & INVOICE REFERENCE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '22px', fontSize: '0.85rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>
                  BILLED TO:
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginTop: '3px' }}>
                  {customerName}
                </div>
                <div style={{ color: '#475569', marginTop: '2px' }}>
                  {customerPhone}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>
                  INVOICE REFERENCE:
                </div>
                <div style={{ color: '#0f172a', marginTop: '3px' }}>
                  Order No: <strong>{orderNo}</strong>
                </div>
                <div style={{ color: '#0f172a', marginTop: '2px' }}>
                  Bill No: <strong>{billNo}</strong>
                </div>
                <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>
                  Booked: {bookedDate}
                </div>
                {order.status === 'DELIVERED' && (
                  <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '1px' }}>
                    Delivered: {deliveredDate}
                  </div>
                )}
              </div>
            </div>

            {/* 3. ITEMS TABLE */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', borderTop: '1px solid #f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>
                    Description
                  </th>
                  <th style={{ textAlign: 'center', padding: '8px 4px', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', width: '50px' }}>
                    Qty
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', width: '90px' }}>
                    Rate
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', width: '100px' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px 4px 8px 4px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                      Stitching
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                      Dress: {dressType}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 4px 8px 4px', fontSize: '0.88rem', color: '#0f172a', verticalAlign: 'top' }}>
                    {quantity}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 4px 8px 4px', fontSize: '0.85rem', color: '#0f172a', verticalAlign: 'top' }}>
                    <div>Rs.</div>
                    <div>{rate.toFixed(2)}</div>
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 4px 8px 4px', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', verticalAlign: 'top' }}>
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
              borderTop: '1px solid #e2e8f0',
              paddingTop: '12px',
              marginBottom: '24px'
            }}>
              <div style={{ width: '240px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>
                <span>Gross Subtotal:</span>
                <span>Rs. {totalAmount.toFixed(2)}</span>
              </div>
              <div style={{ width: '240px', display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                <span>Net Payable:</span>
                <span>Rs. {totalAmount.toFixed(2)}</span>
              </div>
              <div style={{ width: '240px', display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', fontWeight: 800, color: '#16a34a', marginBottom: '6px' }}>
                <span>Amount Paid:</span>
                <span>Rs. {advancePayment.toFixed(2)}</span>
              </div>
              <div style={{ width: '240px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: balanceAmount > 0 ? '#dc2626' : '#64748b', fontWeight: balanceAmount > 0 ? 700 : 500 }}>
                <span>Balance Due:</span>
                <span>Rs. {balanceAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* 5. FOOTER GUARANTEE */}
            <div style={{
              borderTop: '1px solid #f1f5f9',
              paddingTop: '14px',
              textAlign: 'center',
              fontSize: '0.78rem',
              color: '#64748b',
              fontStyle: 'italic'
            }}>
              Fits guaranteed for 30 days. Thank you for choosing us!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
