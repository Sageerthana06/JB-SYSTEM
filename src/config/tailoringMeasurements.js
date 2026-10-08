// Reusable Tailoring Measurements Configuration for JB GROUP / Bella Design

export const DRESS_TYPE_OPTIONS = [
  'Saree Blouse',
  'Frock',
  'Lehenga',
  'Skirt',
  'Top',
  'Uniform',
  'Alteration',
  'Other'
];

export const DRESS_TYPE_MEASUREMENTS = {
  'Saree Blouse': [
    { key: 'bust', label: 'Bust', required: true, placeholder: 'e.g. 86' },
    { key: 'underBust', label: 'Under Bust', required: true, placeholder: 'e.g. 74' },
    { key: 'waist', label: 'Waist', required: true, placeholder: 'e.g. 70' },
    { key: 'shoulder', label: 'Shoulder', required: false, placeholder: 'e.g. 36' },
    { key: 'armhole', label: 'Armhole', required: true, placeholder: 'e.g. 40' },
    { key: 'sleeveLength', label: 'Sleeve Length', required: true, placeholder: 'e.g. 26' },
    { key: 'sleeveRound', label: 'Sleeve Round', required: false, placeholder: 'e.g. 30' },
    { key: 'blouseLength', label: 'Blouse Length', required: true, placeholder: 'e.g. 38' },
    { key: 'frontNeck', label: 'Front Neck Depth', required: false, placeholder: 'e.g. 18' },
    { key: 'backNeck', label: 'Back Neck Depth', required: false, placeholder: 'e.g. 24' },
    { key: 'acrossShoulder', label: 'Across Shoulder', required: false, placeholder: 'e.g. 35' },
    { key: 'apexBustPoint', label: 'Apex / Bust Point', required: false, placeholder: 'e.g. 25' },
    { key: 'notes', label: 'Other Notes', required: false, isTextarea: true, placeholder: 'Special neckline, tie-backs, hook positions...' }
  ],

  'Frock': [
    { key: 'bust', label: 'Bust', required: true, placeholder: 'e.g. 86' },
    { key: 'waist', label: 'Waist', required: true, placeholder: 'e.g. 72' },
    { key: 'hip', label: 'Hip', required: true, placeholder: 'e.g. 96' },
    { key: 'shoulder', label: 'Shoulder', required: false, placeholder: 'e.g. 37' },
    { key: 'armhole', label: 'Armhole', required: true, placeholder: 'e.g. 42' },
    { key: 'sleeveLength', label: 'Sleeve Length', required: false, placeholder: 'e.g. 45' },
    { key: 'sleeveRound', label: 'Sleeve Round', required: false, placeholder: 'e.g. 28' },
    { key: 'frockLength', label: 'Frock Length', required: true, placeholder: 'e.g. 130', aliases: ['dressLength'] },
    { key: 'neckDepth', label: 'Neck Depth', required: false, placeholder: 'e.g. 16' },
    { key: 'waistLength', label: 'Waist Length', required: false, placeholder: 'e.g. 38' },
    { key: 'skirtLength', label: 'Skirt Length', required: false, placeholder: 'e.g. 92' },
    { key: 'notes', label: 'Other Notes', required: false, isTextarea: true, placeholder: 'Flairs, pleats, zip placement, inner lining notes...' }
  ],

  'Lehenga': [
    { key: 'bust', label: 'Bust', required: true, placeholder: 'e.g. 86' },
    { key: 'underBust', label: 'Under Bust', required: false, placeholder: 'e.g. 74' },
    { key: 'waist', label: 'Waist', required: true, placeholder: 'e.g. 72' },
    { key: 'hip', label: 'Hip', required: true, placeholder: 'e.g. 96' },
    { key: 'shoulder', label: 'Shoulder', required: false, placeholder: 'e.g. 36' },
    { key: 'blouseLength', label: 'Blouse Length', required: true, placeholder: 'e.g. 38' },
    { key: 'sleeveLength', label: 'Sleeve Length', required: false, placeholder: 'e.g. 30' },
    { key: 'sleeveRound', label: 'Sleeve Round', required: false, placeholder: 'e.g. 28' },
    { key: 'lehengaWaist', label: 'Lehenga Waist', required: true, placeholder: 'e.g. 76' },
    { key: 'lehengaLength', label: 'Lehenga Length', required: true, placeholder: 'e.g. 105' },
    { key: 'hipRound', label: 'Hip Round', required: false, placeholder: 'e.g. 98' },
    { key: 'notes', label: 'Other Notes', required: false, isTextarea: true, placeholder: 'Can-can layers, tassel details, dupatta drape...' }
  ],

  'Skirt': [
    { key: 'waist', label: 'Waist', required: true, placeholder: 'e.g. 72' },
    { key: 'hip', label: 'Hip', required: true, placeholder: 'e.g. 96' },
    { key: 'skirtLength', label: 'Skirt Length', required: true, placeholder: 'e.g. 100' },
    { key: 'waistToHip', label: 'Waist to Hip', required: false, placeholder: 'e.g. 20' },
    { key: 'hemBottomRound', label: 'Hem / Bottom Round', required: false, placeholder: 'e.g. 160' },
    { key: 'notes', label: 'Other Notes', required: false, isTextarea: true, placeholder: 'Pockets, waistband elastic/belt, slit length...' }
  ],

  'Top': [
    { key: 'bust', label: 'Bust', required: true, placeholder: 'e.g. 86' },
    { key: 'waist', label: 'Waist', required: true, placeholder: 'e.g. 74' },
    { key: 'hip', label: 'Hip', required: true, placeholder: 'e.g. 96' },
    { key: 'shoulder', label: 'Shoulder', required: false, placeholder: 'e.g. 36' },
    { key: 'armhole', label: 'Armhole', required: true, placeholder: 'e.g. 40' },
    { key: 'sleeveLength', label: 'Sleeve Length', required: false, placeholder: 'e.g. 42' },
    { key: 'sleeveRound', label: 'Sleeve Round', required: false, placeholder: 'e.g. 28' },
    { key: 'topLength', label: 'Top Length', required: true, placeholder: 'e.g. 75' },
    { key: 'neckDepth', label: 'Neck Depth', required: false, placeholder: 'e.g. 16' },
    { key: 'notes', label: 'Other Notes', required: false, isTextarea: true, placeholder: 'Side slits, collar style, button details...' }
  ],

  'Uniform': [
    { key: 'chestBust', label: 'Chest / Bust', required: true, placeholder: 'e.g. 92', aliases: ['bustChest', 'bust', 'chest'] },
    { key: 'waist', label: 'Waist', required: true, placeholder: 'e.g. 78' },
    { key: 'hip', label: 'Hip', required: false, placeholder: 'e.g. 98' },
    { key: 'shoulder', label: 'Shoulder', required: false, placeholder: 'e.g. 38' },
    { key: 'armhole', label: 'Armhole', required: false, placeholder: 'e.g. 44' },
    { key: 'sleeveLength', label: 'Sleeve Length', required: false, placeholder: 'e.g. 25' },
    { key: 'sleeveRound', label: 'Sleeve Round', required: false, placeholder: 'e.g. 32' },
    { key: 'shirtTopLength', label: 'Shirt / Top Length', required: true, placeholder: 'e.g. 72', aliases: ['shirtLength', 'topLength'] },
    { key: 'trouserSkirtLength', label: 'Trouser / Skirt Length', required: false, placeholder: 'e.g. 98', aliases: ['bottomLength', 'skirtLength'] },
    { key: 'inseam', label: 'Inseam', required: false, placeholder: 'e.g. 74' },
    { key: 'thigh', label: 'Thigh', required: false, placeholder: 'e.g. 56' },
    { key: 'bottomRound', label: 'Bottom Round', required: false, placeholder: 'e.g. 38' },
    { key: 'notes', label: 'Other Notes', required: false, isTextarea: true, placeholder: 'Badge placement, pocket specs, epaulettes...' }
  ],

  'Alteration': [
    { key: 'currentGarmentType', label: 'Current Garment Type', isText: true, required: true, placeholder: 'e.g. Saree Blouse, Jeans, Frock' },
    { key: 'requiredAlteration', label: 'Required Alteration', isText: true, required: true, placeholder: 'e.g. Tighten sides, shorten hem', aliases: ['alterationArea'] },
    { key: 'currentMeasurement', label: 'Current Garment Measurement', isText: true, required: false, placeholder: 'e.g. Bust 92 cm, Waist 78 cm' },
    { key: 'requiredMeasurement', label: 'Required Target Measurement', isText: true, required: true, placeholder: 'e.g. Bust 86 cm, Waist 72 cm', aliases: ['targetMeasurement'] },
    { key: 'lengthAdjustment', label: 'Length Adjustment', isText: true, required: false, placeholder: 'e.g. Reduce by 4 cm' },
    { key: 'waistAdjustment', label: 'Waist Adjustment', isText: true, required: false, placeholder: 'e.g. Take in 3 cm' },
    { key: 'bustChestAdjustment', label: 'Bust / Chest Adjustment', isText: true, required: false, placeholder: 'e.g. Take in 2 cm' },
    { key: 'hipAdjustment', label: 'Hip Adjustment', isText: true, required: false, placeholder: 'e.g. Relax 2 cm' },
    { key: 'sleeveAdjustment', label: 'Sleeve Adjustment', isText: true, required: false, placeholder: 'e.g. Shorten by 3 cm' },
    { key: 'alterationInstructions', label: 'Other Alteration Instructions', isTextarea: true, required: false, placeholder: 'Describe stitch style, seam preservation, zip fixes...' }
  ],

  'Other': [
    { key: 'customMeasurements', label: 'Custom Sizing & Dimensions', isTextarea: true, required: true, placeholder: 'Enter complete sizing specifications (e.g. Chest 92 cm, Waist 76 cm, Length 110 cm...)' },
    { key: 'fittingNotes', label: 'Fitting & Tailoring Notes', isTextarea: true, required: false, placeholder: 'Special customer preferences, silhouette drape, fabric handling...' }
  ]
};

export const getMeasurementsForDressType = (dressType) => {
  if (!dressType) return DRESS_TYPE_MEASUREMENTS['Saree Blouse'];
  
  if (DRESS_TYPE_MEASUREMENTS[dressType]) {
    return DRESS_TYPE_MEASUREMENTS[dressType];
  }

  // Fallback matching
  const lower = dressType.toLowerCase().trim();
  if (lower.includes('blouse')) return DRESS_TYPE_MEASUREMENTS['Saree Blouse'];
  if (lower.includes('frock') || lower.includes('gown')) return DRESS_TYPE_MEASUREMENTS['Frock'];
  if (lower.includes('lehenga')) return DRESS_TYPE_MEASUREMENTS['Lehenga'];
  if (lower.includes('skirt')) return DRESS_TYPE_MEASUREMENTS['Skirt'];
  if (lower.includes('top') || lower.includes('kurti')) return DRESS_TYPE_MEASUREMENTS['Top'];
  if (lower.includes('uniform')) return DRESS_TYPE_MEASUREMENTS['Uniform'];
  if (lower.includes('alteration')) return DRESS_TYPE_MEASUREMENTS['Alteration'];
  if (lower.includes('other')) return DRESS_TYPE_MEASUREMENTS['Other'];
  
  return DRESS_TYPE_MEASUREMENTS['Other'];
};

export const validateDressMeasurements = (dressType, measurements) => {
  if (!dressType) {
    return { valid: false, message: 'Dress Type is required.' };
  }

  const fields = getMeasurementsForDressType(dressType);
  if (!measurements || typeof measurements !== 'object') {
    return { valid: false, message: `Please enter tailoring measurements for ${dressType}.` };
  }

  // Verify all mandatory fields
  for (const field of fields) {
    if (field.required) {
      let val = measurements[field.key];
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

      if (!field.isText && !field.isTextarea) {
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

  // Verify non-negative for filled numbers
  for (const [key, val] of Object.entries(measurements)) {
    if (val !== '' && val !== null && val !== undefined) {
      const fieldDef = fields.find(f => f.key === key || (f.aliases && f.aliases.includes(key)));
      if (fieldDef && !fieldDef.isText && !fieldDef.isTextarea) {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0) {
          return {
            valid: false,
            message: `Measurement for "${fieldDef.label}" cannot be a negative value.`
          };
        }
      }
    }
  }

  return { valid: true };
};
