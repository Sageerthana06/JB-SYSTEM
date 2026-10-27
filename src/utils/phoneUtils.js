/**
 * Phone number utilities for Sri Lanka & international numbers
 * JB GROUP / Bella Design ERP (Frontend - ES Module)
 *
 * -------------------------------------------------------------------------
 * Sri Lankan Phone Numbering Rules (TRCSL Standard):
 * - Country Code: +94
 * - Local Trunk Prefix: 0 (e.g., 077 123 4567)
 * - Mobile Operator Codes: 070, 071, 072, 074, 075, 076, 077, 078
 * - Landline Area Codes: 011 (Colombo), 026 (Trincomalee), 021 (Jaffna), etc.
 * - Total Digits: 10 digits locally (0XXXXXXXXX) or 12 characters internationally (+94XXXXXXXXX)
 * -------------------------------------------------------------------------
 */

/**
 * Strips all spaces, hyphens, and non-digit characters except leading plus (+).
 * @param {string} phone
 * @returns {string} Cleaned digits or plus-prefixed string
 */
export const cleanPhoneRaw = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  return phone.trim().replace(/[^\d+]/g, '');
};

/**
 * Normalizes phone numbers to standard format (+94 for Sri Lanka).
 * Supports local (0771234567), international (+94771234567), and foreign numbers (+44...).
 * @param {string} phone
 * @returns {string} E.164 normalized phone number
 */
export const normalizePhoneNumber = (phone) => {
  let cleaned = cleanPhoneRaw(phone);
  if (!cleaned) return '';

  if (cleaned.startsWith('0094')) {
    cleaned = '+94' + cleaned.slice(4);
  }

  if (/^0\d{9}$/.test(cleaned)) {
    return '+94' + cleaned.slice(1);
  }

  if (/^94\d{9}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  if (/^\d{9}$/.test(cleaned)) {
    return '+94' + cleaned;
  }

  return cleaned;
};

/**
 * Formats a phone number for UI display.
 * Default local format: "077 123 4567"
 * International format: "+94 77 123 4567"
 *
 * @param {string} phone
 * @param {boolean} international
 * @returns {string} Formatted display string
 */
export const formatPhoneDisplay = (phone, international = false) => {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return phone || '';

  if (norm.startsWith('+94') && norm.length === 12) {
    const p1 = norm.slice(3, 5);
    const p2 = norm.slice(5, 8);
    const p3 = norm.slice(8);
    if (international) {
      return `+94 ${p1} ${p2} ${p3}`;
    }
    return `0${p1} ${p2} ${p3}`;
  }

  return norm;
};

// Backward-compatible alias matching backend utility name
export const formatPhoneNumber = formatPhoneDisplay;

/**
 * Basic client-side phone validation.
 * @param {string} phone
 * @returns {{ valid: boolean, error?: string }}
 */
export const validatePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return { valid: false, error: 'Phone number is required.' };
  }

  const cleaned = cleanPhoneRaw(phone);
  const digitsOnly = cleaned.replace(/\D/g, '');

  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { valid: false, error: 'Please enter a valid phone number (7 to 15 digits).' };
  }

  return { valid: true };
};
