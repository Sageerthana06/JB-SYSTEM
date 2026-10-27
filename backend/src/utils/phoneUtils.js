/**
 * Phone number normalization and utility helpers for Sri Lanka and International numbers.
 * JB GROUP / Bella Design ERP (Backend - CommonJS)
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
 * Strips all spaces, hyphens, parentheses, and letters, keeping only digits and leading plus.
 * Example: "(077) 123-4567" -> "0771234567"
 *
 * @param {string} phone - Raw input phone string
 * @returns {string} Stripped digits-only or plus-prefixed string
 */
const cleanPhoneRaw = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  return phone.trim().replace(/[^\d+]/g, '');
};

/**
 * Normalizes any valid phone format into standard international E.164 format (+94 for Sri Lanka).
 *
 * Examples handled:
 * - Local 10-digit: "0771234567"  -> "+94771234567"
 * - Country code no plus: "94771234567" -> "+94771234567"
 * - Trunk code with 00: "0094771234567" -> "+94771234567"
 * - 9-digit without 0: "771234567"   -> "+94771234567"
 * - Foreign numbers: "+44712345678" -> preserved as "+44712345678"
 *
 * @param {string} phone
 * @returns {string} E.164 normalized phone number (e.g. "+94771234567")
 */
const normalizePhoneNumber = (phone) => {
  let cleaned = cleanPhoneRaw(phone);
  if (!cleaned) return '';

  // Handle leading 0094 -> +94
  if (cleaned.startsWith('0094')) {
    cleaned = '+94' + cleaned.slice(4);
  }

  // Sri Lanka 10-digit local format: 0XXXXXXXXX -> +94XXXXXXXXX
  if (/^0\d{9}$/.test(cleaned)) {
    return '+94' + cleaned.slice(1);
  }

  // Sri Lanka 11-digit format without plus: 94XXXXXXXXX -> +94XXXXXXXXX
  if (/^94\d{9}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  // Sri Lanka 9-digit format: XXXXXXXXX -> +94XXXXXXXXX
  if (/^\d{9}$/.test(cleaned)) {
    return '+94' + cleaned;
  }

  // Already standard +94XXXXXXXXX
  if (/^\+94\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  // Standard international with plus: +XXXXXXXXXXX
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  return cleaned;
};

/**
 * Formats a phone number into readable local Sri Lankan format (077 123 4567)
 * or international format (+94 77 123 4567).
 *
 * @param {string} phone
 * @param {boolean} international
 * @returns {string}
 */
const formatPhoneNumber = (phone, international = false) => {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return phone || '';

  if (norm.startsWith('+94') && norm.length === 12) {
    const p1 = norm.slice(3, 5); // 77
    const p2 = norm.slice(5, 8); // 123
    const p3 = norm.slice(8);    // 4567
    if (international) {
      return `+94 ${p1} ${p2} ${p3}`;
    }
    return `0${p1} ${p2} ${p3}`;
  }

  return norm;
};

/**
 * Generates all valid lookup variations for a phone number so searching in PostgreSQL
 * matches regardless of whether the record was stored as 077..., +9477..., 9477..., or formatted.
 *
 * @param {string} phone
 * @returns {string[]} Array of unique phone representations
 */
const getPhoneSearchVariants = (phone) => {
  if (!phone || typeof phone !== 'string') return [];
  const raw = cleanPhoneRaw(phone);
  if (!raw) return [];

  const variants = new Set([phone.trim(), raw]);
  const norm = normalizePhoneNumber(phone);

  if (norm) {
    variants.add(norm);
    if (norm.startsWith('+94') && norm.length === 12) {
      const nineDigits = norm.slice(3);
      variants.add('0' + nineDigits);       // e.g. 0771234567
      variants.add('94' + nineDigits);      // e.g. 94771234567
      variants.add('+94' + nineDigits);     // e.g. +94771234567
      variants.add(nineDigits);             // e.g. 771234567
      variants.add(`0${nineDigits.slice(0, 2)} ${nineDigits.slice(2, 5)} ${nineDigits.slice(5)}`); // 077 123 4567
      variants.add(`+94 ${nineDigits.slice(0, 2)} ${nineDigits.slice(2, 5)} ${nineDigits.slice(5)}`); // +94 77 123 4567
    }
  }

  return Array.from(variants).filter(Boolean);
};

/**
 * Validates whether a phone number string meets basic mobile phone format rules.
 * Accepts local Sri Lankan numbers (07XXXXXXXX or 01XXXXXXXX), international (+94...),
 * and standard international numbers (7-15 digits total).
 *
 * @param {string} phone
 * @returns {{ valid: boolean, error?: string }}
 */
const validatePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return { valid: false, error: 'Phone number is required.' };
  }

  const cleaned = cleanPhoneRaw(phone);
  const digitsOnly = cleaned.replace(/\D/g, '');

  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { valid: false, error: 'Please enter a valid phone number (7 to 15 digits).' };
  }

  // If starts with 0 and length is 10 (standard Sri Lanka)
  if (cleaned.startsWith('0') && digitsOnly.length === 10) {
    return { valid: true };
  }

  // If starts with +94 and length is 12 (standard Sri Lanka E.164)
  if (cleaned.startsWith('+94') && digitsOnly.length === 11) {
    return { valid: true };
  }

  // If starts with 94 and length is 11
  if (cleaned.startsWith('94') && digitsOnly.length === 11) {
    return { valid: true };
  }

  // Any other international number with 7-15 digits
  return { valid: true };
};

module.exports = {
  cleanPhoneRaw,
  normalizePhoneNumber,
  formatPhoneNumber,
  getPhoneSearchVariants,
  validatePhoneNumber
};
