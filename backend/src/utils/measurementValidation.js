// Centralized Backend Tailoring Measurement Validation for JB GROUP / Bella Design

const DRESS_TYPE_MEASUREMENTS = {
  'Saree Blouse': [
    { key: 'bust', label: 'Bust', required: true, type: 'number' },
    { key: 'underBust', label: 'Under Bust', required: true, type: 'number' },
    { key: 'waist', label: 'Waist', required: true, type: 'number' },
    { key: 'shoulder', label: 'Shoulder', required: false, type: 'number' },
    { key: 'armhole', label: 'Armhole', required: true, type: 'number' },
    { key: 'sleeveLength', label: 'Sleeve Length', required: true, type: 'number' },
    { key: 'sleeveRound', label: 'Sleeve Round', required: false, type: 'number' },
    { key: 'blouseLength', label: 'Blouse Length', required: true, type: 'number' },
    { key: 'frontNeck', label: 'Front Neck Depth', required: false, type: 'number' },
    { key: 'backNeck', label: 'Back Neck Depth', required: false, type: 'number' },
    { key: 'acrossShoulder', label: 'Across Shoulder', required: false, type: 'number' },
    { key: 'apexBustPoint', label: 'Apex / Bust Point', required: false, type: 'number' },
    { key: 'notes', label: 'Other Notes', required: false, type: 'text' }
  ],

  'Frock': [
    { key: 'bust', label: 'Bust', required: true, type: 'number' },
    { key: 'waist', label: 'Waist', required: true, type: 'number' },
    { key: 'hip', label: 'Hip', required: true, type: 'number' },
    { key: 'shoulder', label: 'Shoulder', required: false, type: 'number' },
    { key: 'armhole', label: 'Armhole', required: true, type: 'number' },
    { key: 'sleeveLength', label: 'Sleeve Length', required: false, type: 'number' },
    { key: 'sleeveRound', label: 'Sleeve Round', required: false, type: 'number' },
    { key: 'frockLength', label: 'Frock Length', required: true, type: 'number', aliases: ['dressLength'] },
    { key: 'neckDepth', label: 'Neck Depth', required: false, type: 'number' },
    { key: 'waistLength', label: 'Waist Length', required: false, type: 'number' },
    { key: 'skirtLength', label: 'Skirt Length', required: false, type: 'number' },
    { key: 'notes', label: 'Other Notes', required: false, type: 'text' }
  ],

  'Lehenga': [
    { key: 'bust', label: 'Bust', required: true, type: 'number' },
    { key: 'underBust', label: 'Under Bust', required: false, type: 'number' },
    { key: 'waist', label: 'Waist', required: true, type: 'number' },
    { key: 'hip', label: 'Hip', required: true, type: 'number' },
    { key: 'shoulder', label: 'Shoulder', required: false, type: 'number' },
    { key: 'blouseLength', label: 'Blouse Length', required: true, type: 'number' },
    { key: 'sleeveLength', label: 'Sleeve Length', required: false, type: 'number' },
    { key: 'sleeveRound', label: 'Sleeve Round', required: false, type: 'number' },
    { key: 'lehengaWaist', label: 'Lehenga Waist', required: true, type: 'number' },
    { key: 'lehengaLength', label: 'Lehenga Length', required: true, type: 'number' },
    { key: 'hipRound', label: 'Hip Round', required: false, type: 'number' },
    { key: 'notes', label: 'Other Notes', required: false, type: 'text' }
  ],

  'Skirt': [
    { key: 'waist', label: 'Waist', required: true, type: 'number' },
    { key: 'hip', label: 'Hip', required: true, type: 'number' },
    { key: 'skirtLength', label: 'Skirt Length', required: true, type: 'number' },
    { key: 'waistToHip', label: 'Waist to Hip', required: false, type: 'number' },
    { key: 'hemBottomRound', label: 'Hem / Bottom Round', required: false, type: 'number' },
    { key: 'notes', label: 'Other Notes', required: false, type: 'text' }
  ],

  'Top': [
    { key: 'bust', label: 'Bust', required: true, type: 'number' },
    { key: 'waist', label: 'Waist', required: true, type: 'number' },
    { key: 'hip', label: 'Hip', required: true, type: 'number' },
    { key: 'shoulder', label: 'Shoulder', required: false, type: 'number' },
    { key: 'armhole', label: 'Armhole', required: true, type: 'number' },
    { key: 'sleeveLength', label: 'Sleeve Length', required: false, type: 'number' },
    { key: 'sleeveRound', label: 'Sleeve Round', required: false, type: 'number' },
    { key: 'topLength', label: 'Top Length', required: true, type: 'number' },
    { key: 'neckDepth', label: 'Neck Depth', required: false, type: 'number' },
    { key: 'notes', label: 'Other Notes', required: false, type: 'text' }
  ],

  'Uniform': [
    { key: 'chestBust', label: 'Chest / Bust', required: true, type: 'number', aliases: ['bustChest', 'bust', 'chest'] },
    { key: 'waist', label: 'Waist', required: true, type: 'number' },
    { key: 'hip', label: 'Hip', required: false, type: 'number' },
    { key: 'shoulder', label: 'Shoulder', required: false, type: 'number' },
    { key: 'armhole', label: 'Armhole', required: false, type: 'number' },
    { key: 'sleeveLength', label: 'Sleeve Length', required: false, type: 'number' },
    { key: 'sleeveRound', label: 'Sleeve Round', required: false, type: 'number' },
    { key: 'shirtTopLength', label: 'Shirt / Top Length', required: true, type: 'number', aliases: ['shirtLength', 'topLength'] },
    { key: 'trouserSkirtLength', label: 'Trouser / Skirt Length', required: false, type: 'number', aliases: ['bottomLength', 'skirtLength'] },
    { key: 'inseam', label: 'Inseam', required: false, type: 'number' },
    { key: 'thigh', label: 'Thigh', required: false, type: 'number' },
    { key: 'bottomRound', label: 'Bottom Round', required: false, type: 'number' },
    { key: 'notes', label: 'Other Notes', required: false, type: 'text' }
  ],

  'Alteration': [
    { key: 'currentGarmentType', label: 'Current Garment Type', required: true, type: 'text' },
    { key: 'requiredAlteration', label: 'Required Alteration', required: true, type: 'text', aliases: ['alterationArea'] },
    { key: 'currentMeasurement', label: 'Current Measurement', required: false, type: 'text' },
    { key: 'requiredMeasurement', label: 'Required Measurement', required: true, type: 'text', aliases: ['targetMeasurement'] },
    { key: 'lengthAdjustment', label: 'Length Adjustment', required: false, type: 'text' },
    { key: 'waistAdjustment', label: 'Waist Adjustment', required: false, type: 'text' },
    { key: 'bustChestAdjustment', label: 'Bust / Chest Adjustment', required: false, type: 'text' },
    { key: 'hipAdjustment', label: 'Hip Adjustment', required: false, type: 'text' },
    { key: 'sleeveAdjustment', label: 'Sleeve Adjustment', required: false, type: 'text' },
    { key: 'alterationInstructions', label: 'Other Alteration Instructions', required: false, type: 'text' }
  ],

  'Other': [
    { key: 'customMeasurements', label: 'Custom Sizing & Measurements', required: true, type: 'text' },
    { key: 'fittingNotes', label: 'Fitting & Tailoring Notes', required: false, type: 'text' }
  ]
};

const normalizeDressType = (dressType) => {
  if (!dressType) return null;
  const trimmed = dressType.trim();
  if (DRESS_TYPE_MEASUREMENTS[trimmed]) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower.includes('blouse')) return 'Saree Blouse';
  if (lower.includes('frock') || lower.includes('gown')) return 'Frock';
  if (lower.includes('lehenga')) return 'Lehenga';
  if (lower.includes('skirt')) return 'Skirt';
  if (lower.includes('top') || lower.includes('kurti')) return 'Top';
  if (lower.includes('uniform')) return 'Uniform';
  if (lower.includes('alteration')) return 'Alteration';
  if (lower.includes('other')) return 'Other';

  return 'Other';
};

const validateDressMeasurements = (dressType, measurements) => {
  if (!dressType) {
    return { valid: false, message: 'Dress Type is required.' };
  }

  const normalized = normalizeDressType(dressType);
  const fields = DRESS_TYPE_MEASUREMENTS[normalized] || DRESS_TYPE_MEASUREMENTS['Other'];

  if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) {
    return { valid: false, message: 'Please provide tailoring measurements for ' + dressType + '.' };
  }

  // Check required fields
  for (const field of fields) {
    if (field.required) {
      let val = measurements[field.key];
      // Check aliases if key not directly present
      if ((val === undefined || val === null || val === '') && field.aliases) {
        for (const alias of field.aliases) {
          if (measurements[alias] !== undefined && measurements[alias] !== null && measurements[alias] !== '') {
            val = measurements[alias];
            break;
          }
        }
      }

      if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        return {
          valid: false,
          message: `Please enter ${field.label} measurement.`
        };
      }

      if (field.type === 'number') {
        const num = parseFloat(val);
        if (isNaN(num) || num <= 0) {
          return {
            valid: false,
            message: `Please enter a valid positive value for ${field.label}.`
          };
        }
      }
    }
  }

  // Check numeric fields for validity (cannot be negative)
  for (const [key, val] of Object.entries(measurements)) {
    if (val !== '' && val !== null && val !== undefined) {
      const fieldDef = fields.find(f => f.key === key || (f.aliases && f.aliases.includes(key)));
      if (fieldDef && fieldDef.type === 'number') {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0) {
          return {
            valid: false,
            message: `Measurement for "${fieldDef.label}" cannot be negative.`
          };
        }
      }
    }
  }

  return { valid: true };
};

module.exports = {
  DRESS_TYPE_MEASUREMENTS,
  normalizeDressType,
  validateDressMeasurements
};
