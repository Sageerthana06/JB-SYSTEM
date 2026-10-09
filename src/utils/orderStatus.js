/**
 * Frontend Order Status Utilities
 * Single source of truth for status labels and colors in the UI.
 * Never expose raw enum values (underscores) to users.
 */

export const ORDER_STATUS_LABELS = {
  // Pre-Book & Approvals
  PENDING_APPROVAL:           'Pending Approval',
  APPROVED:                   'Approved — Price Pending',
  REJECTED:                   'Rejected',
  CHANGES_REQUIRED:           'Changes Required',

  // Price Setting & Customer Approval
  PRICE_SET:                  'Price Set — Waiting Customer',
  WAITING_CUSTOMER_APPROVAL:  'Waiting Customer Price Approval',
  CUSTOMER_APPROVED:          'Customer Price Approved',
  PRICE_REVISION_REQUIRED:    'Price Revision Required',
  PRICE_DECLINED:             'Price Declined',

  // Tailor Assignment & Acceptance
  TAILOR_ASSIGNED:            'Tailor Assigned',
  IN_PROGRESS:                'Tailor Accepted — In Progress',

  // Production Workflow
  ORDER_CONFIRMED:            'Order Confirmed',
  PENDING_PRODUCTION:         'Pending Production',
  CUTTING:                    'Cutting',
  STITCHING:                  'Stitching',
  AARI_EMBROIDERY:            'Aari / Embroidery',
  QUALITY_CHECK:              'Quality Check',
  ALTERATION:                 'Alteration Required',
  FITTING_ALTERATION:         'Fitting / Alteration',
  FINISHING:                  'Finishing',
  READY:                      'Ready for Collection',
  DELIVERED:                  'Delivered',
  COMPLETED:                  'Completed (Archived)',

  // Exceptions & Legacy
  PENDING:                    'Order Confirmed',
  EMBROIDERY_AARI:            'Aari / Embroidery',
  ON_HOLD:                    'On Hold',
  CANCELLED:                  'Cancelled'
};

/** Returns a user-friendly label for any status value or order object */
export const getStatusLabel = (statusOrOrder, maybePriceStatus) => {
  if (typeof statusOrOrder === 'object' && statusOrOrder !== null) {
    const status = statusOrOrder.status;
    const priceStatus = statusOrOrder.priceStatus;
    if (status === 'APPROVED') {
      if (priceStatus === 'SENT') return 'Price Confirmation Required';
      if (priceStatus === 'PENDING') return 'Approved — Price Pending';
      return 'Approved';
    }
    if (status === 'WAITING_CUSTOMER_APPROVAL') return 'Waiting Customer Approval';
    if (status === 'CUSTOMER_APPROVED') return 'Customer Price Approved';
    return ORDER_STATUS_LABELS[status] || status || '—';
  }
  if (statusOrOrder === 'APPROVED') {
    if (maybePriceStatus === 'SENT') return 'Price Confirmation Required';
    if (maybePriceStatus === 'PENDING') return 'Approved — Price Pending';
    return 'Approved — Price Pending';
  }
  return ORDER_STATUS_LABELS[statusOrOrder] || statusOrOrder || '—';
};

/** Badge colors per status */
export const STATUS_COLORS = {
  PENDING_APPROVAL:           { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  APPROVED:                   { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  CHANGES_REQUIRED:           { bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' },
  PRICE_SET:                  { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
  WAITING_CUSTOMER_APPROVAL:  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  CUSTOMER_APPROVED:          { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  PRICE_REVISION_REQUIRED:    { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  PRICE_DECLINED:             { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
  TAILOR_ASSIGNED:            { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  IN_PROGRESS:                { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  ORDER_CONFIRMED:            { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  PENDING_PRODUCTION:         { bg: '#FEF9C3', text: '#92400E', border: '#FDE68A' },
  CUTTING:                    { bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE' },
  STITCHING:                  { bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE' },
  AARI_EMBROIDERY:            { bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE' },
  QUALITY_CHECK:              { bg: '#FEF9C3', text: '#92400E', border: '#FDE68A' },
  ALTERATION:                 { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  FITTING_ALTERATION:         { bg: '#FDF4FF', text: '#7E22CE', border: '#F3E8FF' },
  FINISHING:                  { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  READY:                      { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  DELIVERED:                  { bg: '#BBF7D0', text: '#14532D', border: '#86EFAC' },
  COMPLETED:                  { bg: '#F1F5F9', text: '#334155', border: '#CBD5E1' },
  REJECTED:                   { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
  ON_HOLD:                    { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
  CANCELLED:                  { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
  PENDING:                    { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  EMBROIDERY_AARI:            { bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE' }
};

/** Returns { bg, text, border } for a status badge */
export const getStatusColors = (status) =>
  STATUS_COLORS[status] || { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' };

export const PRICE_STATUS_LABELS = {
  PENDING:  'Price Pending',
  SENT:     'Price Sent',
  ACCEPTED: 'Price Accepted',
  DECLINED: 'Price Declined'
};

export const PRICE_STATUS_COLORS = {
  PENDING:  { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  SENT:     { bg: '#E0F2FE', text: '#0284C7', border: '#BAE6FD' },
  ACCEPTED: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  DECLINED: { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' }
};

export const getPriceStatusLabel = (status) =>
  PRICE_STATUS_LABELS[status] || status || 'Pending';

export const getPriceStatusColors = (status) =>
  PRICE_STATUS_COLORS[status] || { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' };

export const ALL_STATUSES = [
  'PENDING_APPROVAL',
  'APPROVED',
  'WAITING_CUSTOMER_APPROVAL',
  'CUSTOMER_APPROVED',
  'TAILOR_ASSIGNED',
  'IN_PROGRESS',
  'ORDER_CONFIRMED',
  'PENDING_PRODUCTION',
  'CUTTING',
  'STITCHING',
  'AARI_EMBROIDERY',
  'QUALITY_CHECK',
  'ALTERATION',
  'READY',
  'DELIVERED',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED'
];

/** 13-stage sequential workflow tracker definition */
export const WORKFLOW_TRACKER_STAGES = [
  { key: 'ORDER_BOOK',           label: 'Order Book',           statuses: ['PENDING_APPROVAL', 'CHANGES_REQUIRED'] },
  { key: 'CEO_APPROVAL',         label: 'CEO Approval',         statuses: ['APPROVED'] },
  { key: 'PRICE_SET',            label: 'Price Set',            statuses: ['WAITING_CUSTOMER_APPROVAL', 'PRICE_SET', 'PRICE_REVISION_REQUIRED'] },
  { key: 'CUSTOMER_APPROVAL',    label: 'Customer Approved',    statuses: ['CUSTOMER_APPROVED', 'ORDER_CONFIRMED'] },
  { key: 'TAILOR_ASSIGNED',      label: 'Tailor Assigned',      statuses: ['TAILOR_ASSIGNED', 'PENDING_PRODUCTION'] },
  { key: 'TAILOR_ACCEPTED',      label: 'Tailor Accepted',      statuses: ['IN_PROGRESS'] },
  { key: 'CUTTING',              label: 'Cutting',              statuses: ['CUTTING'] },
  { key: 'STITCHING',            label: 'Stitching',            statuses: ['STITCHING', 'AARI_EMBROIDERY', 'FINISHING'] },
  { key: 'QUALITY_CHECK',        label: 'Quality Check',        statuses: ['QUALITY_CHECK', 'ALTERATION'] },
  { key: 'READY',                label: 'Ready',                statuses: ['READY'] },
  { key: 'PAYMENT',              label: 'Payment Verified',     isPaymentStage: true },
  { key: 'DELIVERY',             label: 'Delivered',            statuses: ['DELIVERED'] },
  { key: 'COMPLETED',            label: 'Completed',            statuses: ['COMPLETED'] }
];

export const WORKFLOW_SEQUENCE = [
  'PENDING_APPROVAL',
  'APPROVED',
  'WAITING_CUSTOMER_APPROVAL',
  'CUSTOMER_APPROVED',
  'TAILOR_ASSIGNED',
  'IN_PROGRESS',
  'CUTTING',
  'STITCHING',
  'QUALITY_CHECK',
  'READY',
  'DELIVERED',
  'COMPLETED'
];

export const EXCEPTION_STATUSES = ['ON_HOLD', 'CANCELLED', 'REJECTED', 'CHANGES_REQUIRED', 'PRICE_REVISION_REQUIRED'];

export const isAariRequired = (order) => {
  const g = order?.garmentDetails;
  if (!g) return false;
  return Boolean(
    g.workRequired === true ||
    g.workRequired === 'Yes' ||
    (typeof g.workDetails === 'string' && g.workDetails.trim().length > 0 && g.workDetails.toLowerCase() !== 'none')
  );
};

export const isFittingRequired = (order) => {
  const g = order?.garmentDetails;
  if (!g) return false;
  const text = `${g.specialDesignInstructions || ''} ${g.workDetails || ''}`.toLowerCase();
  return text.includes('fitting') || text.includes('trial') || text.includes('alteration');
};

export const ALLOWED_STAGE_TRANSITIONS = {
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CHANGES_REQUIRED'],
  CHANGES_REQUIRED: ['PENDING_APPROVAL', 'REJECTED'],
  APPROVED: ['WAITING_CUSTOMER_APPROVAL', 'PRICE_SET', 'PRICE_DECLINED', 'ORDER_CONFIRMED', 'REJECTED'],
  PRICE_SET: ['WAITING_CUSTOMER_APPROVAL', 'CUSTOMER_APPROVED', 'PRICE_REVISION_REQUIRED'],
  WAITING_CUSTOMER_APPROVAL: ['CUSTOMER_APPROVED', 'PRICE_REVISION_REQUIRED', 'PRICE_DECLINED', 'ORDER_CONFIRMED'],
  PRICE_REVISION_REQUIRED: ['WAITING_CUSTOMER_APPROVAL', 'APPROVED'],
  PRICE_DECLINED: ['WAITING_CUSTOMER_APPROVAL', 'APPROVED'],
  CUSTOMER_APPROVED: ['TAILOR_ASSIGNED', 'ORDER_CONFIRMED'],
  ORDER_CONFIRMED: ['TAILOR_ASSIGNED', 'PENDING_PRODUCTION', 'IN_PROGRESS', 'CUTTING'],
  PENDING: ['TAILOR_ASSIGNED', 'ORDER_CONFIRMED', 'PENDING_PRODUCTION', 'CUTTING'],
  PENDING_PRODUCTION: ['TAILOR_ASSIGNED', 'IN_PROGRESS', 'CUTTING'],
  TAILOR_ASSIGNED: ['IN_PROGRESS', 'CUSTOMER_APPROVED', 'ORDER_CONFIRMED', 'CUTTING'],
  IN_PROGRESS: ['CUTTING'],
  CUTTING: ['STITCHING'],
  STITCHING: ['QUALITY_CHECK', 'AARI_EMBROIDERY', 'FITTING_ALTERATION', 'FINISHING', 'READY'],
  AARI_EMBROIDERY: ['QUALITY_CHECK', 'FINISHING', 'STITCHING'],
  EMBROIDERY_AARI: ['QUALITY_CHECK', 'FINISHING', 'STITCHING'],
  FITTING_ALTERATION: ['QUALITY_CHECK', 'FINISHING'],
  FINISHING: ['QUALITY_CHECK', 'READY'],
  QUALITY_CHECK: ['READY', 'ALTERATION', 'STITCHING', 'FINISHING'],
  ALTERATION: ['QUALITY_CHECK'],
  READY: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  ON_HOLD: ['IN_PROGRESS', 'CUTTING', 'STITCHING', 'QUALITY_CHECK', 'READY']
};

/**
 * Returns next stage action button info for production execution.
 */
export const getNextStageInfo = (order) => {
  if (!order) return null;
  const status = order.status;

  switch (status) {
    case 'CUSTOMER_APPROVED':
    case 'ORDER_CONFIRMED':
    case 'PENDING':
      if (!order.assignedTailorId) return null;
      return {
        nextStatus: 'TAILOR_ASSIGNED',
        label: 'Tailor Assigned',
        buttonText: 'Assign Tailor',
        bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE'
      };
    case 'TAILOR_ASSIGNED':
      return {
        nextStatus: 'IN_PROGRESS',
        label: 'In Progress',
        buttonText: 'Tailor Accept Order',
        bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE'
      };
    case 'IN_PROGRESS':
    case 'PENDING_PRODUCTION':
      return {
        nextStatus: 'CUTTING',
        label: 'Cutting',
        buttonText: 'Start Cutting',
        bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE'
      };
    case 'CUTTING':
      return {
        nextStatus: 'STITCHING',
        label: 'Stitching',
        buttonText: 'Complete Cutting & Stitch',
        bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE'
      };
    case 'STITCHING':
    case 'AARI_EMBROIDERY':
    case 'FINISHING':
      return {
        nextStatus: 'QUALITY_CHECK',
        label: 'Quality Check',
        buttonText: 'Move to Quality Check',
        bg: '#FEF9C3', text: '#92400E', border: '#FDE68A'
      };
    case 'ALTERATION':
      return {
        nextStatus: 'QUALITY_CHECK',
        label: 'Quality Check',
        buttonText: 'Alteration Done → Re-Check QC',
        bg: '#FEF9C3', text: '#92400E', border: '#FDE68A'
      };
    case 'QUALITY_CHECK':
      return {
        nextStatus: 'READY',
        label: 'Ready for Collection',
        buttonText: 'Pass QC → Mark Ready',
        bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7'
      };
    case 'READY':
      return {
        nextStatus: 'DELIVERED',
        label: 'Delivered',
        buttonText: 'Record Delivery',
        bg: '#BBF7D0', text: '#14532D', border: '#86EFAC'
      };
    case 'DELIVERED':
      return {
        nextStatus: 'COMPLETED',
        label: 'Completed',
        buttonText: 'Mark Order Completed',
        bg: '#F1F5F9', text: '#334155', border: '#CBD5E1'
      };
    default:
      return null;
  }
};

/**
 * Strips email addresses and cleans names/roles (e.g. manager@jbgroup.com -> Manager, ceo@jbgroup.com -> CEO)
 */
export const cleanActorName = (name) => {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (trimmed.toLowerCase().includes('ceo')) return 'CEO';
  if (trimmed.toLowerCase().includes('manager')) return 'Manager';
  if (trimmed.toLowerCase().includes('admin')) return 'Manager';
  if (trimmed.includes('@')) {
    const userPart = trimmed.split('@')[0];
    return userPart.charAt(0).toUpperCase() + userPart.slice(1);
  }
  return trimmed;
};

/**
 * Sanitizes activity log notes and history messages to ensure emails are replaced with role titles (Manager, CEO)
 */
export const cleanActivityNote = (note) => {
  if (!note || typeof note !== 'string') return '';
  return note
    .replace(/manager@jbgroup\.com/gi, 'Manager')
    .replace(/ceo@jbgroup\.com/gi, 'CEO')
    .replace(/admin@jbgroup\.com/gi, 'Manager')
    .replace(/\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi, (match, username) => {
      const lower = username.toLowerCase();
      if (lower.includes('ceo')) return 'CEO';
      if (lower.includes('manager') || lower.includes('admin')) return 'Manager';
      return username.charAt(0).toUpperCase() + username.slice(1);
    });
};
