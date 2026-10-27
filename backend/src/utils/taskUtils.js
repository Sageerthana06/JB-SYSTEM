/**
 * Production Task Utilities for JB GROUP SYSTEM
 * Defines task types, requirements determination, and workflow stage synchronization.
 */

const TASK_TYPES = {
  CUTTING: 'CUTTING',
  AARI_EMBROIDERY: 'AARI_EMBROIDERY',
  STITCHING: 'STITCHING',
  FITTING_ALTERATION: 'FITTING_ALTERATION',
  FINISHING: 'FINISHING',
  QUALITY_CHECK: 'QUALITY_CHECK'
};

const TASK_DEFINITIONS = {
  CUTTING: {
    type: 'CUTTING',
    taskType: 'CUTTING',
    name: 'Cutting',
    taskName: 'Cutting',
    defaultSequence: 1,
    stage: 'CUTTING',
    description: 'Pattern marking, sizing layout, fabric shearing & trimming according to customer measurements'
  },
  AARI_EMBROIDERY: {
    type: 'AARI_EMBROIDERY',
    taskType: 'AARI_EMBROIDERY',
    name: 'Aari Embroidery',
    taskName: 'Aari Embroidery',
    defaultSequence: 2,
    stage: 'AARI_EMBROIDERY',
    description: 'Handcrafted Aari needlework, Zardosi, bead embellishment, stone setting & Maggam artwork'
  },
  STITCHING: {
    type: 'STITCHING',
    taskType: 'STITCHING',
    name: 'Stitching',
    taskName: 'Stitching',
    defaultSequence: 3,
    stage: 'STITCHING',
    description: 'Main garment assembly, seam joining, inner lining attachment, and structural stitching'
  },
  FITTING_ALTERATION: {
    type: 'FITTING_ALTERATION',
    taskType: 'FITTING_ALTERATION',
    name: 'Fitting / Alteration',
    taskName: 'Fitting / Alteration',
    defaultSequence: 4,
    stage: 'FITTING_ALTERATION',
    description: 'Trial fitting review, darts/sides taking in or easing, neckline adjustment, and silhouette tuning'
  },
  FINISHING: {
    type: 'FINISHING',
    taskType: 'FINISHING',
    name: 'Finishing',
    taskName: 'Finishing',
    defaultSequence: 5,
    stage: 'FINISHING',
    description: 'Hem stitching, hook/eye/button attachment, thread trimming, and professional steam press'
  },
  QUALITY_CHECK: {
    type: 'QUALITY_CHECK',
    taskType: 'QUALITY_CHECK',
    name: 'Quality Check',
    taskName: 'Quality Check',
    defaultSequence: 6,
    stage: 'QUALITY_CHECK',
    description: 'Final measurement compliance audit, seam integrity inspection, and packaging'
  }
};

/**
 * Checks if Aari Embroidery is required for a garment
 */
function isAariRequired(order) {
  const g = order?.garmentDetails;
  if (!g) return false;

  if (g.workRequired === true || g.workRequired === 'Yes') return true;
  if (order.embroideryCharge && Number(order.embroideryCharge) > 0) return true;

  const workText = (g.workDetails || '').toLowerCase();
  if (workText && !['none', 'no', 'nil', 'n/a'].includes(workText.trim())) return true;

  const dressType = (g.dressType || '').toLowerCase();
  const notes = `${g.specialDesignInstructions || ''} ${dressType}`.toLowerCase();
  if (notes.includes('aari') || notes.includes('embroid') || notes.includes('maggam') || notes.includes('zardo')) {
    return true;
  }

  return false;
}

/**
 * Checks if Fitting / Alteration is required for a garment
 */
function isFittingRequired(order) {
  const g = order?.garmentDetails;
  if (!g) return false;

  const dressType = (g.dressType || '').toLowerCase();
  if (dressType.includes('alteration')) return true;

  // Bridal orders always require trial fitting
  if (dressType.includes('bridal') || (g.occasion && g.occasion.toLowerCase().includes('bridal'))) {
    return true;
  }

  const text = `${g.specialDesignInstructions || ''} ${g.fitPreference || ''} ${g.workDetails || ''}`.toLowerCase();
  return text.includes('fitting') || text.includes('trial') || text.includes('alteration') || text.includes('trial fit');
}

/**
 * Determines only the required production tasks for any order type:
 * - Bridal dresses, normal dresses, blouses, trousers, school uniforms, company uniforms, alterations, etc.
 */
function getRequiredTasksForOrder(order) {
  const g = order?.garmentDetails || {};
  const dressType = (g.dressType || '').toLowerCase();
  const tasks = [];

  // 1. Cutting (required unless pure alteration without cutting)
  const isPureAlteration = dressType === 'alteration' && !(g.workDetails || '').toLowerCase().includes('cut');
  if (!isPureAlteration) {
    tasks.push({ ...TASK_DEFINITIONS.CUTTING, sequence: 1 });
  }

  // 2. Aari Embroidery (shown only if required for this order)
  if (isAariRequired(order)) {
    tasks.push({ ...TASK_DEFINITIONS.AARI_EMBROIDERY, sequence: tasks.length + 1 });
  }

  // 3. Stitching (always required)
  tasks.push({ ...TASK_DEFINITIONS.STITCHING, sequence: tasks.length + 1 });

  // 4. Fitting / Alteration (shown only if required for this order)
  if (isFittingRequired(order)) {
    tasks.push({ ...TASK_DEFINITIONS.FITTING_ALTERATION, sequence: tasks.length + 1 });
  }

  // 5. Finishing (always required)
  tasks.push({ ...TASK_DEFINITIONS.FINISHING, sequence: tasks.length + 1 });

  // 6. Quality Check (always required)
  tasks.push({ ...TASK_DEFINITIONS.QUALITY_CHECK, sequence: tasks.length + 1 });

  return tasks;
}

/**
 * Determines the next overall order stage based on task completion statuses.
 * NEVER marks the entire order COMPLETED when tasks finish — only READY!
 */
function determineOrderProductionStage(tasks) {
  if (!tasks || tasks.length === 0) return 'IN_PROGRESS';

  const allCompleted = tasks.every(t => t.status === 'COMPLETED');
  if (allCompleted) {
    return 'READY'; // All tailoring finished -> READY for customer collection
  }

  // Find active or next pending task
  const activeTask = tasks.find(t => t.status === 'IN_PROGRESS') || tasks.find(t => t.status === 'ASSIGNED');
  if (activeTask) {
    const def = TASK_DEFINITIONS[activeTask.taskType];
    return def ? def.stage : 'IN_PROGRESS';
  }

  return 'IN_PROGRESS';
}

module.exports = {
  TASK_TYPES,
  TASK_DEFINITIONS,
  isAariRequired,
  isFittingRequired,
  getRequiredTasksForOrder,
  determineOrderProductionStage
};
