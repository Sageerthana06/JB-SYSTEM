const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'controllers', 'orderController.js');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize to LF for clean matching
const isCRLF = content.includes('\r\n');
if (isCRLF) {
  content = content.replace(/\r\n/g, '\n');
}

// 1. getOrderById: add manager branch check
const getOrderByIdTarget = `    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Security check: Customers can only view their own orders`;

const getOrderByIdReplacement = `    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Security check: Manager can only view orders in their authorized branch
    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user?.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (order.branchId && order.branchId !== managerBranch)) {
        return res.status(403).json({
          success: false,
          message: \`Access denied: Managers are restricted to their assigned branch (\${managerBranch || 'none'}). Cannot access order in branch \${order.branchId || 'unassigned'}.\`
        });
      }
    }

    // Security check: Customers can only view their own orders`;

if (!content.includes(getOrderByIdTarget)) {
  console.error('Failed to find getOrderByIdTarget');
  process.exit(1);
}
content = content.replace(getOrderByIdTarget, getOrderByIdReplacement);
console.log('✓ Patched getOrderById with manager branch security');

// 2. updateOrderStatus: add branchId to select and check manager branch
const updateStatusTarget = `    // Fetch current order to capture previousStage, balances, and assignment
    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        assignedTailorId: true,
        tailorAccepted: true,
        priceAcceptedByCustomer: true,
        balanceAmount: true,
        totalAmount: true,
        readyNotificationSent: true,
        readyNotificationSentAt: true,
        readyNotificationStatus: true,
        customer: { select: { id: true, name: true, primaryPhone: true } }
      }
    });

    if (!currentOrder) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }`;

const updateStatusReplacement = `    // Fetch current order to capture previousStage, balances, and assignment
    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        branchId: true,
        status: true,
        assignedTailorId: true,
        tailorAccepted: true,
        priceAcceptedByCustomer: true,
        balanceAmount: true,
        totalAmount: true,
        readyNotificationSent: true,
        readyNotificationSentAt: true,
        readyNotificationStatus: true,
        customer: { select: { id: true, name: true, primaryPhone: true } }
      }
    });

    if (!currentOrder) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Branch authorization check for Manager
    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user?.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (currentOrder.branchId && currentOrder.branchId !== managerBranch)) {
        return res.status(403).json({
          success: false,
          message: \`Access denied: Managers cannot modify orders from another branch.\`
        });
      }
    }`;

if (!content.includes(updateStatusTarget)) {
  console.error('Failed to find updateStatusTarget');
  process.exit(1);
}
content = content.replace(updateStatusTarget, updateStatusReplacement);
console.log('✓ Patched updateOrderStatus with manager branch security');

// 3. generateOrderPdf: add manager branch check
const generatePdfTarget = `    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    // Security check: Tailors must NOT receive financial invoices (Requirement 5)`;

const generatePdfReplacement = `    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    // Security check: Manager can only download order PDF in their authorized branch
    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user?.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (order.branchId && order.branchId !== managerBranch)) {
        return res.status(403).json({
          success: false,
          message: \`Access denied: Managers are restricted to their assigned branch (\${managerBranch || 'none'}). Cannot access order in branch \${order.branchId || 'unassigned'}.\`
        });
      }
    }

    // Security check: Tailors must NOT receive financial invoices (Requirement 5)`;

if (!content.includes(generatePdfTarget)) {
  console.error('Failed to find generatePdfTarget');
  process.exit(1);
}
content = content.replace(generatePdfTarget, generatePdfReplacement);
console.log('✓ Patched generateOrderPdf with manager branch security');

// 4. approveOrder: add manager branch check
const approveOrderTarget = `exports.approveOrder = async (req, res, next) => {
  try {
    // Role check: Only authorized CEO / Manager can approve orders
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can approve orders.' });
    }

    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }`;

const approveOrderReplacement = `exports.approveOrder = async (req, res, next) => {
  try {
    // Role check: Only authorized CEO / Manager can approve orders
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can approve orders.' });
    }

    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user?.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (order.branchId && order.branchId !== managerBranch)) {
        return res.status(403).json({ success: false, message: 'Access denied: Managers cannot approve orders from another branch.' });
      }
    }`;

if (!content.includes(approveOrderTarget)) {
  console.error('Failed to find approveOrderTarget');
  process.exit(1);
}
content = content.replace(approveOrderTarget, approveOrderReplacement);
console.log('✓ Patched approveOrder with manager branch security');

// 5. requestChangesOrder: add manager branch check
const requestChangesTarget = `exports.requestChangesOrder = async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can request changes.' });
    }

    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Reason for requesting changes is required.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }`;

const requestChangesReplacement = `exports.requestChangesOrder = async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can request changes.' });
    }

    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Reason for requesting changes is required.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user?.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (order.branchId && order.branchId !== managerBranch)) {
        return res.status(403).json({ success: false, message: 'Access denied: Managers cannot request changes for orders from another branch.' });
      }
    }`;

if (!content.includes(requestChangesTarget)) {
  console.error('Failed to find requestChangesTarget');
  process.exit(1);
}
content = content.replace(requestChangesTarget, requestChangesReplacement);
console.log('✓ Patched requestChangesOrder with manager branch security');

// 6. setOrderPrice: add manager branch check
const setOrderPriceTarget = `exports.setOrderPrice = async (req, res, next) => {
  try {
    // Role check: Only authorized CEO / Manager can set or change final prices
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can set order price quotes.' });
    }

    const orderId = parseInt(req.params.id);
    const {
      basePrice,
      designCharge,
      cuttingCharge,
      stitchingCharge,
      embroideryCharge,
      additionalCharge,
      discountAmount,
      advanceRequired,
      notes,
      directAccept,
      // Legacy aliases for backward compatibility
      serviceCharge,
      additionalWorkCharge,
      materialCharge,
      totalAmount
    } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }`;

const setOrderPriceReplacement = `exports.setOrderPrice = async (req, res, next) => {
  try {
    // Role check: Only authorized CEO / Manager can set or change final prices
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can set order price quotes.' });
    }

    const orderId = parseInt(req.params.id);
    const {
      basePrice,
      designCharge,
      cuttingCharge,
      stitchingCharge,
      embroideryCharge,
      additionalCharge,
      discountAmount,
      advanceRequired,
      notes,
      directAccept,
      // Legacy aliases for backward compatibility
      serviceCharge,
      additionalWorkCharge,
      materialCharge,
      totalAmount
    } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user?.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (order.branchId && order.branchId !== managerBranch)) {
        return res.status(403).json({ success: false, message: 'Access denied: Managers cannot set prices for orders from another branch.' });
      }
    }`;

if (!content.includes(setOrderPriceTarget)) {
  console.error('Failed to find setOrderPriceTarget');
  process.exit(1);
}
content = content.replace(setOrderPriceTarget, setOrderPriceReplacement);
console.log('✓ Patched setOrderPrice with manager branch security');

// 7. confirmCustomerPrice: add manager branch check
const confirmPriceTarget = `exports.confirmCustomerPrice = async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can record customer price acceptance.' });
    }

    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }`;

const confirmPriceReplacement = `exports.confirmCustomerPrice = async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can record customer price acceptance.' });
    }

    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user?.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (order.branchId && order.branchId !== managerBranch)) {
        return res.status(403).json({ success: false, message: 'Access denied: Managers cannot record customer price acceptance for orders from another branch.' });
      }
    }`;

if (!content.includes(confirmPriceTarget)) {
  console.error('Failed to find confirmPriceTarget');
  process.exit(1);
}
content = content.replace(confirmPriceTarget, confirmPriceReplacement);
console.log('✓ Patched confirmCustomerPrice with manager branch security');

// 8. requestCustomerPriceRevision: add manager branch check
const priceRevisionTarget = `exports.requestCustomerPriceRevision = async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can record price revision request.' });
    }

    const orderId = parseInt(req.params.id);
    const { reason } = req.body;
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }`;

const priceRevisionReplacement = `exports.requestCustomerPriceRevision = async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can record price revision request.' });
    }

    const orderId = parseInt(req.params.id);
    const { reason } = req.body;
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user?.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (order.branchId && order.branchId !== managerBranch)) {
        return res.status(403).json({ success: false, message: 'Access denied: Managers cannot request price revision for orders from another branch.' });
      }
    }`;

if (!content.includes(priceRevisionTarget)) {
  console.error('Failed to find priceRevisionTarget');
  process.exit(1);
}
content = content.replace(priceRevisionTarget, priceRevisionReplacement);
console.log('✓ Patched requestCustomerPriceRevision with manager branch security');

// 9. rejectOrder: add manager branch check
const rejectOrderTarget = `exports.rejectOrder = async (req, res, next) => {
  try {
    // Role check: Only authorized CEO / Manager can reject orders
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can reject orders.' });
    }

    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }`;

const rejectOrderReplacement = `exports.rejectOrder = async (req, res, next) => {
  try {
    // Role check: Only authorized CEO / Manager can reject orders
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can reject orders.' });
    }

    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user?.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (order.branchId && order.branchId !== managerBranch)) {
        return res.status(403).json({ success: false, message: 'Access denied: Managers cannot reject orders from another branch.' });
      }
    }`;

if (!content.includes(rejectOrderTarget)) {
  console.error('Failed to find rejectOrderTarget');
  process.exit(1);
}
content = content.replace(rejectOrderTarget, rejectOrderReplacement);
console.log('✓ Patched rejectOrder with manager branch security');

// Restore original line ending style
if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('\n✅ Successfully applied all 9 manager branch security patches to orderController.js');
