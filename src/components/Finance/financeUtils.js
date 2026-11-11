/**
 * Finance ERP Utility Functions
 * JB GROUP (PVT) LTD — Version 3.2.0
 */

export const formatLKR = (val) => {
  const num = Number(val) || 0;
  return `LKR ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatCompactLKR = (val) => {
  const num = Number(val) || 0;
  if (Math.abs(num) >= 1000000) {
    return `LKR ${(num / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(num) >= 1000) {
    return `LKR ${(num / 1000).toFixed(1)}k`;
  }
  return `LKR ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const BRANCH_OPTIONS = [
  { id: 'ALL', name: 'All Branches (Consolidated)' },
  { id: 1, name: 'JB Group (Main) — Branch 1' },
  { id: 2, name: 'Bella Design — Branch 2' }
];

export const getBranchName = (bId) => {
  if (bId === 1 || bId === '1') return 'JB Group (Main)';
  if (bId === 2 || bId === '2') return 'Bella Design';
  if (bId === 'ALL' || bId === null || bId === undefined) return 'Group Central / Both Branches';
  return `Branch ${bId}`;
};

/**
 * Resolve effective branch parameter for API calls based on RBAC and active branch filter
 */
export const resolveEffectiveBranch = (activeBranch, user) => {
  const role = String(user?.role || '').toUpperCase();
  const isCeo = ['SUPER_ADMIN', 'CEO'].includes(role);

  // Admin, Managers, and Staff are strictly locked to their assigned branch
  if (!isCeo) {
    return user?.branchId ? Number(user.branchId) : 1;
  }

  if (activeBranch === 'ALL' || activeBranch === 'All Branches') return 'ALL';
  if (activeBranch === '1' || activeBranch === 1 || String(activeBranch).includes('Main')) return 1;
  if (activeBranch === '2' || activeBranch === 2 || String(activeBranch).includes('Bella')) return 2;
  return 'ALL';
};

export const formatDateColombo = (dateString) => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Colombo',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(dateString);
  }
};

export const formatDateTimeColombo = (dateString) => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleString('en-GB', {
      timeZone: 'Asia/Colombo',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(dateString);
  }
};

export const getColomboTodayDateString = () => {
  const d = new Date();
  const colomboMs = d.getTime() + (330 * 60 * 1000);
  const c = new Date(colomboMs);
  const y = c.getUTCFullYear();
  const m = String(c.getUTCMonth() + 1).padStart(2, '0');
  const day = String(c.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

