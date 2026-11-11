export const digitalInvoiceStyles = `
  .jb-invoice, .jb-invoice * { box-sizing: border-box; }
  .jb-invoice {
    width: 100%;
    max-width: 500px;
    position: relative;
    overflow: hidden;
    isolation: isolate;
    border: 1.5px solid #002b66;
    border-radius: 14px;
    background: #ffffff;
    color: #0f172a;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 11.5px;
    line-height: 1.28;
    box-shadow: 0 8px 30px rgba(0, 43, 102, 0.08);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .jb-invoice-standard {
    height: 617px;
    min-height: 617px;
    max-height: 617px;
  }
  .jb-invoice-expanded {
    height: auto;
    min-height: 617px;
  }
  .jb-invoice-body {
    padding: 10px 14px 4px 14px;
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    justify-content: space-between;
  }
  .jb-invoice-corner {
    position: absolute;
    top: 0;
    right: 0;
    width: 100px;
    height: 62px;
    pointer-events: none;
    z-index: 2;
  }
  .jb-invoice-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 5px;
  }
  .jb-invoice-brand img {
    height: 38px;
    width: auto;
    max-width: 90px;
    object-fit: contain;
    flex-shrink: 0;
    display: block;
  }
  .jb-invoice-brand-divider {
    width: 1.5px;
    height: 34px;
    background-color: #002b66;
    flex-shrink: 0;
  }
  .jb-invoice-brand-info strong {
    display: block;
    color: #002b66;
    font-size: 1.12rem;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: -0.2px;
  }
  .jb-invoice-brand-info span {
    display: block;
    margin-top: 1px;
    font-size: 0.7rem;
    color: #334155;
    font-weight: 600;
  }
  .jb-invoice-contact {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 4px 0 5px 0;
    border-top: 1px solid #e2e8f0;
  }
  .jb-invoice-hq {
    display: inline-block;
    background: #002b66;
    color: #ffffff;
    font-size: 0.62rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 9999px;
    margin-bottom: 2px;
    letter-spacing: 0.3px;
  }
  .jb-invoice-address {
    display: flex;
    align-items: flex-start;
    gap: 3px;
    font-size: 0.68rem;
    color: #334155;
    line-height: 1.25;
  }
  .jb-invoice-address svg {
    flex-shrink: 0;
    margin-top: 1px;
  }
  .jb-invoice-numbers {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex-shrink: 0;
  }
  .jb-invoice-wa-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background-color: #25D366;
    color: #ffffff;
    border-radius: 9999px;
    padding: 2px 8px 2px 4px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    text-decoration: none;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.2px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .jb-invoice-wa-pill-navy {
    background-color: #002b66;
  }
  .jb-invoice-wa-icon {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background-color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .jb-invoice-title-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 4px 0 5px 0;
    position: relative;
  }
  .jb-invoice-title-wing-left {
    flex: 1;
    height: 4px;
    background: linear-gradient(90deg, transparent, #dc2626);
    border-radius: 2px;
    margin-right: 8px;
  }
  .jb-invoice-title-wing-right {
    flex: 1;
    height: 4px;
    background: linear-gradient(90deg, #dc2626, transparent);
    border-radius: 2px;
    margin-left: 8px;
  }
  .jb-invoice-title-pill {
    background-color: #002b66;
    color: #ffffff;
    font-weight: 900;
    font-size: 0.85rem;
    letter-spacing: 1.1px;
    padding: 3px 24px;
    border-radius: 9999px;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0, 43, 102, 0.2);
    white-space: nowrap;
  }
  .jb-invoice-billing {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    background-color: #f8fafc;
    border: 1px solid #002b66;
    border-radius: 8px;
    padding: 5px 10px;
    margin-bottom: 5px;
    gap: 8px;
  }
  .jb-invoice-customer {
    flex: 1 1 52%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .jb-invoice-customer-header {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #002b66;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.4px;
  }
  .jb-invoice-customer-name {
    font-size: 1.12rem;
    font-weight: 900;
    color: #0f172a;
    line-height: 1.1;
    margin: 2px 0 3px 0;
    word-break: break-word;
  }
  .jb-invoice-customer-phone {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.76rem;
    font-weight: 800;
    color: #002b66;
    font-variant-numeric: tabular-nums;
  }
  .jb-invoice-ref-divider {
    width: 1px;
    background-color: #002b66;
    flex-shrink: 0;
  }
  .jb-invoice-ref {
    flex: 1 1 48%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    font-size: 0.72rem;
    padding-left: 4px;
  }
  .jb-invoice-ref-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .jb-invoice-ref-label {
    color: #0f172a;
    font-weight: 600;
  }
  .jb-invoice-ref-val {
    color: #0f172a;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .jb-invoice-table-wrapper {
    margin-bottom: 5px;
    border-radius: 6px;
    overflow: hidden;
    border: 1.5px solid #002b66;
  }
  .jb-invoice table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-variant-numeric: tabular-nums;
  }
  .jb-invoice th {
    background-color: #002b66;
    color: #ffffff;
    padding: 5px 8px;
    font-size: 0.74rem;
    font-weight: 800;
    border-right: 1.5px solid #002b66;
  }
  .jb-invoice th:last-child {
    border-right: none;
  }
  .jb-invoice td {
    padding: 5px 8px;
    vertical-align: middle;
    border-right: 1.5px solid #002b66;
    border-top: 1px solid #002b66;
    overflow-wrap: anywhere;
    font-size: 0.75rem;
  }
  .jb-invoice td:last-child {
    border-right: none;
  }
  .jb-invoice-payment-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 5px;
  }
  .jb-invoice-art-box {
    flex: 1 1 42%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 110px;
    border-radius: 8px;
    overflow: hidden;
  }
  .jb-invoice-watermark {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.12;
    pointer-events: none;
    z-index: 0;
  }
  .jb-invoice-watermark img {
    width: 85%;
    max-width: 140px;
    height: auto;
  }
  .jb-invoice-art-img {
    position: relative;
    z-index: 1;
    max-width: 100%;
    max-height: 105px;
    object-fit: contain;
  }
  .jb-invoice-totals-box {
    flex: 1 1 58%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3.5px;
  }
  .jb-invoice-pill {
    border-radius: 6px;
    padding: 3px 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.74rem;
    font-variant-numeric: tabular-nums;
  }
  .jb-invoice-pill-subtotal {
    background-color: #e2e8f0;
    color: #0f172a;
    font-weight: 800;
  }
  .jb-invoice-pill-discount {
    background-color: #fee2e2;
    border: 1px solid #fca5a5;
    color: #dc2626;
    font-weight: 800;
  }
  .jb-invoice-pill-net {
    background-color: #002b66;
    color: #ffffff;
    font-weight: 900;
    font-size: 0.78rem;
    padding: 3.5px 8px;
    box-shadow: 0 1px 3px rgba(0,43,102,0.2);
  }
  .jb-invoice-pill-paid {
    background-color: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #16a34a;
    font-weight: 800;
  }
  .jb-invoice-pill-due {
    border-radius: 6px;
    font-weight: 900;
    font-size: 0.78rem;
    padding: 3.5px 8px;
  }
  /* Original Bill-Style Rubber Stamp */
  .jb-invoice-rubber-stamp-container {
    margin-top: 3px;
    align-self: center;
    transform: rotate(-4deg);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .jb-invoice-rubber-stamp {
    border-radius: 5px;
    padding: 2.5px 14px;
    background-color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-weight: 900;
    font-size: 0.86rem;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }
  .jb-invoice-bottom-terms {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #f8fafc;
    border: 1px solid #002b66;
    border-radius: 8px;
    padding: 5px 8px;
    gap: 8px;
    margin-bottom: 5px;
  }
  .jb-invoice-terms-box {
    flex: 1 1 auto;
    min-width: 0;
  }
  .jb-invoice-terms-header {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 900;
    color: #002b66;
    margin-bottom: 2px;
  }
  .jb-invoice-terms-list {
    margin: 0;
    padding-left: 14px;
    font-size: 0.66rem;
    color: #334155;
    line-height: 1.35;
    font-weight: 600;
  }
  .jb-invoice-thanks-box {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding-left: 8px;
    border-left: 1.5px solid #002b66;
    max-width: 125px;
  }
  .jb-invoice-footer {
    position: relative;
    width: 100%;
    margin-top: auto;
    height: 32px;
    background-color: #002b66;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .jb-invoice-footer-stripe {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2.5px;
    background-color: #dc2626;
  }
  .jb-invoice-footer-swoosh {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 55px;
    height: 32px;
    pointer-events: none;
  }
  .jb-invoice-footer-title {
    color: #ffffff;
    font-weight: 900;
    font-size: 0.75rem;
    letter-spacing: 0.4px;
    line-height: 1.1;
    position: relative;
    z-index: 1;
  }
  .jb-invoice-footer-tagline {
    color: #cbd5e1;
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.3px;
    margin-top: 1px;
    position: relative;
    z-index: 1;
  }
`;
