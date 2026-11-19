# JB SYSTEM – Enterprise Tailoring & Order Management System

Welcome to the **JB SYSTEM** codebase! This documentation provides developers with an architectural roadmap, setup instructions, workflow traces, business rules, and refactoring guidelines.

---

## 1. Quickstart Guide

### Prerequisites
- **Node.js**: v18+ (tested on Node v20/v24)
- **Database**: PostgreSQL (managed via Prisma ORM)
- **Package Manager**: npm

### Running the Application

1. **Frontend Setup**:
   ```bash
   # Install dependencies
   npm install

   # Start Vite development server
   npm run dev

   # Build for production
   npm run build
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install

   # Generate Prisma client
   npx prisma generate

   # Start Express API server
   npm run dev
   ```

---

## 2. Project Architecture & Directory Map

```
JB SYSTEM/
├── src/                               # Frontend Application (React + Vite)
│   ├── components/                   # UI Workstations & Modals
│   │   ├── ActionCentre/             # Daily Action Centre Workstation
│   │   │   └── DailyActionCentreView.jsx # 3 Action Queues (Quotation, Collection, Delivery)
│   │   ├── DigitalInvoiceModal.jsx   # Professional Customer Invoice (PNG/PDF/Print)
│   │   ├── digitalInvoiceStyles.js   # Scoped CSS styling for Customer Invoice
│   │   ├── SalesERP.jsx              # Main Sales & Order Workstation (Kanban & Table)
│   │   ├── OrderCreationModal.jsx    # Shop & Online Order Booking Modal
│   │   ├── RecordPaymentModal.jsx    # Cash / Card / Bank Slip Payment Modal
│   │   ├── CustomerOrderHistoryModal.jsx # Customer Profile & Order History Modal
│   │   └── ...
│   ├── utils/                        # Shared Business Utilities
│   │   ├── paymentCalculations.js    # Centralized Order Payment & Status Rules
│   │   ├── orderStatus.js            # Lifecycle Stage Transitions & Permissions
│   │   └── phoneUtils.js             # Phone Normalization & WhatsApp Helpers
│   └── config/api.js                 # API Endpoints & Image URL Resolvers
│
├── backend/                          # Backend Application (Node.js + Express + Prisma)
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── actionCentreController.js # Daily Action Centre Controller
│   │   │   ├── orderController.js    # Order Ingestion, Workflow & Stage Handlers
│   │   │   ├── customerController.js # Customer Profile & Measurement CRUD
│   │   │   ├── salaryController.js   # Tailor Piece-Rate Salary Engine
│   │   │   └── expenseController.js  # Branch Operating Expenses & Petty Cash
│   │   ├── services/
│   │   │   ├── actionCentreService.js  # 3 Daily Action Queues & Follow-up Lifecycle
│   │   │   ├── orderPaymentService.js  # Backend Verified Payments Calculation
│   │   │   └── orderWhatsAppService.js # Canonical UTF-8 WhatsApp Messaging
│   │   └── prisma/                   # PostgreSQL Schema & Migrations
│   └── scripts/                      # Verification & Automated Test Suites
└── README.md                         # Developer Guide & Architecture Documentation
```

---

## 3. Core Workflow: Order-to-Invoice Lifecycle

Developers can trace any order from screen to API to database using this map:

```
┌─────────────────┐       ┌────────────────────┐       ┌─────────────────┐
│ 1. Order Entry  │ ───►  │  2. Price & Quote  │ ───►  │  3. Payment(s)  │
│ OrderCreation   │       │ PriceQuotationModal│       │RecordPayment    │
│ orderController │       │ setOrderPrice      │       │recordPayment    │
└─────────────────┘       └────────────────────┘       └─────────────────┘
         │                                                      │
         ▼                                                      ▼
┌─────────────────┐       ┌────────────────────┐       ┌─────────────────┐
│  6. Delivery    │ ◄───  │  5. Production     │ ◄───  │ 4. Digital Inv. │
│ deliverOrder    │       │ Cutting/Stitching  │       │DigitalInvoice   │
│ orderWhatsApp   │       │ updateOrderStatus  │       │paymentCalc.js   │
└─────────────────┘       └────────────────────┘       └─────────────────┘
```

1. **Order Creation (`OrderCreationModal.jsx` → `orderController.createOrder`)**:
   - Customer is linked or created by phone number.
   - Initial measurements and dress specification recorded.
   - Status initialized to `PENDING_APPROVAL` (Online) or `ACCEPTED` (Shop).
2. **Quotation & Approval (`PriceQuotationModal.jsx` → `orderController.setOrderPrice`)**:
   - Charges configured: Tailoring charge, additional work charge, material charge.
   - Pricing approved by Manager/CEO. Customer confirmed via WhatsApp quotation.
3. **Payment Collection (`RecordPaymentModal.jsx` → `orderController.recordPayment`)**:
   - Cash, bank slip, or card payment logged.
   - Multi-payment ledger stores individual `Payment` records.
   - Slips require manager verification (`status: 'VERIFIED'`).
4. **Digital Invoice Generation (`DigitalInvoiceModal.jsx` → `paymentCalculations.js`)**:
   - Renders company branding (`JB GROUP` vs `BELLA DESIGN`).
   - Dynamic payment stamp: `PAID`, `PARTIALLY PAID`, `UNPAID`, or `PRICE PENDING`.
   - High-resolution 1,500 × 1,851 px PNG export, crisp A4 PDF, and Print.
5. **Production & Tailor Workstation (`TaskAssignmentModal.jsx` → `orderController.updateOrderStatus`)**:
   - Sequential progression: `MEASUREMENT` → `FABRIC_RECEIVED` → `CUTTING` → `STITCHING` → `QUALITY_CHECK` → `READY_FOR_DELIVERY`.
6. **Order Delivery & Notification (`orderController.deliverOrder` → `orderWhatsAppService.js`)**:
   - Order marked as `DELIVERED`.
   - Dispatch completion thank-you alert via WhatsApp API URL.

---

## 4. Key Business Rules

### Rule 1: Verified Payments Only
- Only payments where `Payment.status === 'VERIFIED'` count toward the settled amount.
- Slips with `PENDING_VERIFICATION`, `UNVERIFIED`, or `REJECTED` **must never** reduce the customer balance.

### Rule 2: Legacy Advance Payment Fallback
- For legacy records created before multi-payment ledgers, `order.advancePayment` is honored only if `order.payments` array is empty.

### Rule 3: Price Pending Guard
- If `totalAmount <= 0` or `priceStatus === 'PENDING'`, payment status must display **PRICE PENDING**. It must never incorrectly display as `PAID`.

### Rule 4: Dual-Branch Scoping
- **Branch 1 (JB GROUP)**: Official headquarters address, +94 72 627 8727 & +44 7847 431970, official JB logo.
- **Branch 2 (BELLA DESIGN)**: Bella Design Studio branding, +94 26 222 5555, BD monogram (no JB logo).

---

## 5. Summary of Recent Refactorings

| Module | Improvements Made |
| :--- | :--- |
| **`src/utils/paymentCalculations.js`** | Centralized payment calculation into pure, tested helpers (`calculateOrderPayments`, `computeInvoicePaymentStatus`). Replaced duplicated, divergent inline math across modal and Kanban cards. |
| **`src/components/DigitalInvoiceModal.jsx`** | Separated business logic into `paymentCalculations.js`. Refined export canvas height handling so standard orders export at 1,500 × 1,851 px while longer orders grow dynamically. |
| **`src/components/digitalInvoiceStyles.js`** | Optimized vertical spacing across table, capsules, and address rows. Placed footer in normal document flow below payment terms to eliminate clipping and overlap defects. |
| **`src/components/CustomerOrderHistoryModal.jsx`** | Fixed React `rules-of-hooks` violation by moving `useState` declarations above conditional early exits. |
| **`backend/src/services/orderPaymentService.js`** | Extracted order payment totals and verified payments summation into a dedicated backend service. |
| **`backend/src/services/orderWhatsAppService.js`** | Modularized WhatsApp message generation using canonical UTF-8 Unicode emojis, preventing U+FFFD (``) corruption. |

---

## 6. Before-and-After Code Examples

### Example 1: Consolidating Duplicated Payment Logic

#### ❌ Before (Scattered & Divergent in UI components)
```jsx
// Found in SalesERP.jsx - naive field read that ignored verified payments ledger
<div><strong>Paid Amount:</strong> {order.advancePayment !== null ? `LKR ${Number(order.advancePayment).toLocaleString()}` : '0'}</div>
<div><strong>Balance:</strong> {order.balanceAmount !== null ? `LKR ${Number(order.balanceAmount).toLocaleString()}` : '0'}</div>
<div><strong>Payment Status:</strong> {
  Number(order.balanceAmount || 0) <= 0 ? (
    <span className="badge badge-success">✓ Paid in Full</span>
  ) : Number(order.advancePayment || 0) > 0 ? (
    <span className="badge badge-warning">Partially Paid</span>
  ) : (
    <span className="badge badge-danger">Payment Due</span>
  )
}</div>
```

#### ✅ After (Centralized, Verified & Safe)
```javascript
// src/utils/paymentCalculations.js
const { totalAmount, amountPaid, balanceDue, isPricePending } = calculateOrderPayments(order);
const status = computeInvoicePaymentStatus(order);

// Reused cleanly in SalesERP.jsx & DigitalInvoiceModal.jsx:
<div><strong>Paid Amount:</strong> LKR {formatCurrencyLKR(amountPaid)}</div>
<div><strong>Balance Due:</strong> LKR {formatCurrencyLKR(balanceDue)}</div>
<div><strong>Payment Status:</strong> <span style={{ color: status.color }}>{status.label}</span></div>
```

---

### Example 2: Digital Invoice Footer Overlap & Layout Fix

#### ❌ Before (Fixed container height clipped payment summary)
```css
/* digitalInvoiceStyles.js - hardcoded height caused footer to cover payment summary */
.jb-invoice-standard {
  height: 617px;
  min-height: 617px;
  max-height: 617px; /* ❌ Forced clipping when address or items added height */
}
.jb-invoice {
  overflow: hidden; /* ❌ Clipped payment summary and terms */
}
```

#### ✅ After (Tightened Spacing + Natural Document Flow)
```css
/* digitalInvoiceStyles.js - tuned vertical gaps and safe document flow */
.jb-invoice {
  width: 100%;
  max-width: 500px;
  position: relative;
  border: 1.5px solid #002b66;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.jb-invoice-standard {
  height: 617px;
  min-height: 617px;
}
.jb-invoice-expanded {
  height: auto;
  min-height: 617px;
}
.jb-invoice-footer {
  position: relative;
  width: 100%;
  margin-top: auto;
  height: 30px;
  /* Placed in natural flow after payment terms; never overlaps content */
}
```
And inside `DigitalInvoiceModal.jsx`:
```javascript
// On clone during export: locks to 617px if content fits (1,500 x 1,851 px), otherwise expands naturally
if (isSingleItem && card.scrollHeight <= 620) {
  card.style.height = '617px';
  card.style.minHeight = '617px';
} else {
  card.style.height = 'auto';
  card.style.minHeight = '617px';
}
```

---

## 7. Verification & Testing

Run the test suite to verify payment calculations and invoice rendering:

```bash
# 1. Verify Digital Invoice Redesign (35 checks)
node backend/scripts/verify_digital_invoice_redesign.js

# 2. Verify Payment Status & Unverified Guards (48 checks)
node backend/scripts/test_invoice_payment_status.js

# 3. Verify Branch-Specific WhatsApp Quotations
node backend/scripts/test_branch_specific_whatsapp_quotations.cjs

# 4. Verify Delivery WhatsApp Automation
node backend/scripts/test_delivery_whatsapp_automation.cjs

# 5. Verify Daily Action Centre (32 checks)
node backend/scripts/test_daily_action_centre.js

# 6. Production Build
npm run build
```
