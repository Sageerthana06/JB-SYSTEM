/**
 * Shared Order Status Configuration
 * Single source of truth for all status labels, colors, and workflow ordering.
 * Used by backend and frontend.
 */

const ORDER_STATUS_LABELS = {
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
  ALTERATION:                 'Alteration in Progress',
  FITTING_ALTERATION:         'Fitting / Alteration',
  FINISHING:                  'Finishing',
  READY:                      'Ready for Collection',
  DELIVERED:                  'Delivered',
  COMPLETED:                  'Completed (Archived)',
  ON_HOLD:                    'On Hold',
  CANCELLED:                  'Cancelled'
};

const WORKFLOW_SEQUENCE = [
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

const ALLOWED_STAGE_TRANSITIONS = {
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

const VALID_STATUSES = Object.keys(ORDER_STATUS_LABELS);

const STATUS_COLORS = {
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
  CANCELLED:                  { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' }
};

module.exports = {
  ORDER_STATUS_LABELS,
  WORKFLOW_SEQUENCE,
  VALID_STATUSES,
  ALLOWED_STAGE_TRANSITIONS,
  STATUS_COLORS
};
