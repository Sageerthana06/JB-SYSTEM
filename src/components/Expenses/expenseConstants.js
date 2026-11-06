/**
 * JB GROUP Expense Management System — Category Constants & Utilities
 * Version 3.3.0
 */

export const EXPENSE_CATEGORIES = [
  {
    key: 'SHOP_RENT',
    label: 'Shop Rent',
    iconName: 'Building',
    color: '#3b82f6',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    desc: 'Showroom and workshop monthly rent & lease payments'
  },
  {
    key: 'ELECTRICITY_BILL',
    label: 'Electricity Bill',
    iconName: 'Zap',
    color: '#eab308',
    bgColor: '#fefce8',
    borderColor: '#fef08a',
    desc: 'Ceylon Electricity Board monthly power supply bills'
  },
  {
    key: 'WATER_BILL',
    label: 'Water Bill',
    iconName: 'Droplet',
    color: '#06b6d4',
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc',
    desc: 'National Water Supply and Drainage Board utility bills'
  },
  {
    key: 'INTERNET_BILL',
    label: 'Internet Bill',
    iconName: 'Wifi',
    color: '#6366f1',
    bgColor: '#eef2ff',
    borderColor: '#c7d2fe',
    desc: 'Fiber broadband, WiFi, and official office data connections'
  },
  {
    key: 'TELEPHONE_BILL',
    label: 'Telephone Bill',
    iconName: 'Phone',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    desc: 'Landline and official company mobile voice & SMS bills'
  },
  {
    key: 'STAFF_SALARY',
    label: 'Staff Salary Expenses',
    iconName: 'Users',
    color: '#10b981',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    desc: 'Monthly fixed management, administrative, and cashier salaries'
  },
  {
    key: 'TRANSPORT',
    label: 'Transport Expenses',
    iconName: 'Truck',
    color: '#f97316',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa',
    desc: 'Delivery fuel, courier van travel, transit, and staff travel'
  },
  {
    key: 'OFFICE_EXPENSES',
    label: 'Office Expenses',
    iconName: 'Briefcase',
    color: '#64748b',
    bgColor: '#f8fafc',
    borderColor: '#e2e8f0',
    desc: 'Stationery, paper, printing, tea supplies, and office consumables'
  },
  {
    key: 'MAINTENANCE',
    label: 'Maintenance Expenses',
    iconName: 'Wrench',
    color: '#14b8a6',
    bgColor: '#f0fdfa',
    borderColor: '#99f6e4',
    desc: 'Sewing machine servicing, motor maintenance, and workshop upkeep'
  },
  {
    key: 'REPAIR_EXPENSES',
    label: 'Repair Expenses',
    iconName: 'Hammer',
    color: '#f43f5e',
    bgColor: '#fff1f2',
    borderColor: '#fecdd3',
    desc: 'Electrical repairs, plumbing fixes, press iron, and fixture repairs'
  },
  {
    key: 'STAFF_WELFARE',
    label: 'Staff Welfare Expenses',
    iconName: 'Heart',
    color: '#ec4899',
    bgColor: '#fdf2f8',
    borderColor: '#fbcfe8',
    desc: 'Staff refreshments, emergency medical support, and welfare gifts'
  },
  {
    key: 'PURCHASES',
    label: 'Purchases',
    iconName: 'ShoppingBag',
    color: '#84cc16',
    bgColor: '#f7fee7',
    borderColor: '#d9f99d',
    desc: 'Haberdashery, buttons, threads, zippers, packaging boxes, and materials'
  },
  {
    key: 'DELIVERY_EXPENSES',
    label: 'Delivery Expenses',
    iconName: 'Send',
    color: '#0284c7',
    bgColor: '#f0f9ff',
    borderColor: '#bae6fd',
    desc: 'Customer dispatch courier charges, parcel shipping, and post'
  },
  {
    key: 'EMERGENCY_EXPENSES',
    label: 'Emergency Expenses',
    iconName: 'AlertTriangle',
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    desc: 'Urgent unplanned operational cash and critical breakdown expenses'
  },
  {
    key: 'OTHER_EXPENSES',
    label: 'Other / Extra Expenses',
    iconName: 'PlusCircle',
    color: '#a855f7',
    bgColor: '#faf5ff',
    borderColor: '#e9d5ff',
    desc: 'Petty cash allowances, incidental costs, and miscellaneous expenses'
  }
];

export const getCategoryMeta = (key) => {
  return EXPENSE_CATEGORIES.find(c => c.key === key) || {
    key,
    label: key,
    iconName: 'Receipt',
    color: '#6b7280',
    bgColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    desc: 'Business operational expense'
  };
};

export const formatLKR = (val) => {
  const num = Number(val) || 0;
  return `LKR ${num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const getStatusBadge = (status, isOverdue) => {
  if (isOverdue || status === 'OVERDUE') {
    return { label: 'OVERDUE', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
  }
  switch (status) {
    case 'PAID':
      return { label: 'PAID', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
    case 'PARTIALLY_PAID':
      return { label: 'PARTIALLY PAID', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' };
    case 'PENDING':
    default:
      return { label: 'PENDING', color: '#ca8a04', bg: '#fefce8', border: '#fef08a' };
  }
};

