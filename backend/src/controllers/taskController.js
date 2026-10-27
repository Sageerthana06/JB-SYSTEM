/**
 * Production Task Management Controller — JB GROUP / Bella Design ERP
 *
 * =========================================================================
 * ARCHITECTURAL DESIGN & WORKFLOW RULES:
 * =========================================================================
 * This controller manages the multi-tailor production workflow for garment orders.
 *
 * KEY PRINCIPLES:
 * 1. Granular Production Tasks:
 *    A bespoke garment can have multiple specialized craftsmen working on it:
 *    - CUTTING:            Pattern drafting, sizing, shears fabric according to measurements.
 *    - AARI_EMBROIDERY:    Handcrafted needlework, beads, stone setting, or Maggam art.
 *    - STITCHING:          Main structural assembly, seam joining, inner lining attachment.
 *    - FITTING_ALTERATION: Trial fitting, darts adjustment, silhouette tuning.
 *    - FINISHING:          Hemming, hook/button attachment, professional steam pressing.
 *    - QUALITY_CHECK:      Measurement compliance inspection and final packaging.
 *
 * 2. Immediate Assignment (No Acceptance Bottleneck):
 *    When a Manager or CEO assigns tasks to tailors, the tasks are immediately
 *    set to status 'ASSIGNED' and appear on the tailor's workspace right away.
 *    Tailor acceptance is no longer a blocking bottleneck.
 *
 * 3. Automatic Order Stage Synchronization:
 *    As craftsmen update their tasks (ASSIGNED -> IN_PROGRESS -> COMPLETED),
 *    the parent Order status automatically transitions to match the active stage.
 *
 * 4. Critical Lifecycle Rule: 'READY' is NOT 'COMPLETED':
 *    When all production tasks are COMPLETED, the parent Order status becomes 'READY'
 *    (ready for customer collection/pickup).
 *    An order ONLY becomes 'COMPLETED' after delivery and full payment verification!
 * =========================================================================
 */
const { prisma } = require('../prisma');
const {
  TASK_DEFINITIONS,
  getRequiredTasksForOrder,
  determineOrderProductionStage
} = require('../utils/taskUtils');
const { logAudit } = require('../utils/auditLogger');

/**
 * GET /api/orders/:id/tasks
 * Get all tasks for an order + required tasks template.
 * Accessible by CEO, Manager, Staff, Tailor.
 */
exports.getOrderTasks = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        garmentDetails: true,
        branch: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        tasks: {
          include: {
            assignedTailor: {
              select: { id: true, name: true, email: true, role: true, branchId: true }
            }
          },
          orderBy: { sequence: 'asc' }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Branch security for Managers
    if (req.user?.role === 'MANAGER' && order.branchId && order.branchId !== req.user.branchId) {
      return res.status(403).json({ success: false, message: 'Access denied: Order belongs to another branch.' });
    }

    // Tailor security: if role is Tailor, must be assigned to this order or task
    if (req.user?.role === 'TAILOR') {
      const isAssigned = order.assignedTailorId === req.user.id || order.tasks.some(t => t.assignedTailorId === req.user.id);
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this order.' });
      }
    }

    // Determine tasks required for this order
    const requiredTasks = getRequiredTasksForOrder(order);

    res.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        branchId: order.branchId,
        branchName: order.branch?.name,
        customerName: order.customer?.name,
        dressType: order.garmentDetails?.dressType || 'Garment'
      },
      tasks: order.tasks || [],
      requiredTasks
    });
  } catch (error) {
    console.error('Error fetching order tasks:', error);
    next(error);
  }
};

/**
 * Assign production tasks for an order to Tailors (Task Assignment Only - No Acceptance)
 * Accessible only by CEO and authorized Managers (branch-restricted)
 */
exports.assignOrderTasks = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { tasks } = req.body; // Array of { taskType, assignedTailorId, notes }

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one task to assign.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { garmentDetails: true, branch: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Branch restriction for Managers
    if (req.user?.role === 'MANAGER' && order.branchId && order.branchId !== req.user.branchId) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Managers can only assign tasks within their authorized branch.'
      });
    }

    // Validate assigned tailors
    const tailorIds = [...new Set(tasks.map(t => parseInt(t.assignedTailorId, 10)).filter(Boolean))];
    const tailors = await prisma.user.findMany({
      where: {
        id: { in: tailorIds },
        role: { in: ['TAILOR', 'CUTTING', 'EMBROIDERY', 'STAFF'] },
        isActive: true
      }
    });

    if (tailorIds.length > 0 && tailors.length !== tailorIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more assigned tailors do not exist or are inactive.'
      });
    }

    // For managers, verify all tailors belong to the authorized branch
    if (req.user?.role === 'MANAGER') {
      const crossBranchTailor = tailors.find(t => t.branchId && t.branchId !== req.user.branchId);
      if (crossBranchTailor) {
        return res.status(403).json({
          success: false,
          message: `Tailor ${crossBranchTailor.name} does not belong to your authorized branch.`
        });
      }
    }

    const tailorMap = new Map(tailors.map(t => [t.id, t]));
    const assignerName = req.user.name || (req.user.role === 'SUPER_ADMIN' ? 'CEO' : 'Manager');
    const now = new Date();

    // Prepare tasks to insert/update
    const taskRecords = [];
    let sequence = 1;

    for (const t of tasks) {
      const def = TASK_DEFINITIONS[t.taskType] || {
        name: t.taskName || t.taskType,
        type: t.taskType,
        defaultSequence: sequence
      };

      const tailorId = t.assignedTailorId ? parseInt(t.assignedTailorId, 10) : null;

      taskRecords.push({
        orderId,
        taskType: t.taskType,
        taskName: def.name,
        assignedTailorId: tailorId,
        assignedById: req.user.id,
        assignedBy: assignerName,
        assignedAt: now,
        status: 'ASSIGNED', // Immediately ASSIGNED — NO tailor acceptance required
        notes: t.notes || null,
        sequence: sequence++,
        branchId: order.branchId || req.user.branchId || null
      });
    }

    // Replace existing tasks for this order with the newly configured tasks
    await prisma.$transaction(async (tx) => {
      // Delete previous tasks for this order
      await tx.orderTask.deleteMany({
        where: { orderId }
      });

      // Insert new tasks
      await tx.orderTask.createMany({
        data: taskRecords
      });

      // Update Order record
      // Primary tailor is stitching tailor or first assigned tailor
      const primaryTailorTask = taskRecords.find(t => t.taskType === 'STITCHING' && t.assignedTailorId) || taskRecords.find(t => t.assignedTailorId);
      const primaryTailorId = primaryTailorTask ? primaryTailorTask.assignedTailorId : order.assignedTailorId;

      // Determine initial stage based on first assigned task (e.g. CUTTING or IN_PROGRESS)
      const firstTask = taskRecords[0];
      const initialStage = (firstTask && TASK_DEFINITIONS[firstTask.taskType]?.stage) || 'IN_PROGRESS';

      // Update Order: bypass tailor acceptance, set tailorAccepted: true
      await tx.order.update({
        where: { id: orderId },
        data: {
          assignedTailorId: primaryTailorId,
          assignedBy: assignerName,
          assignedAt: now,
          tailorAccepted: true,        // Acceptance step bypassed
          tailorAcceptedAt: now,      // Immediately active
          tailorRejectedAt: null,
          tailorRejectionReason: null,
          status: ['CUSTOMER_APPROVED', 'APPROVED', 'ORDER_CONFIRMED', 'PENDING_PRODUCTION', 'TAILOR_ASSIGNED'].includes(order.status)
            ? initialStage
            : order.status
        }
      });

      // Record production history
      const assignedSummary = taskRecords
        .filter(t => t.assignedTailorId)
        .map(t => `${t.taskName} → ${tailorMap.get(t.assignedTailorId)?.name || 'Tailor'}`)
        .join(', ');

      await tx.productionHistory.create({
        data: {
          orderId,
          stage: initialStage,
          previousStage: order.status,
          assignedToId: primaryTailorId || null,
          startedAt: now,
          notes: `Tasks assigned by ${assignerName}: [${assignedSummary}]. Tasks immediately ASSIGNED (Tailor acceptance bypassed).`
        }
      });
    });

    // Fetch updated tasks with assigned tailor details
    const updatedTasks = await prisma.orderTask.findMany({
      where: { orderId },
      include: {
        assignedTailor: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { sequence: 'asc' }
    });

    // Audit log
    await logAudit({
      action: 'TASKS_ASSIGNED',
      entityType: 'Order',
      entityId: orderId,
      userId: req.user.id,
      userName: assignerName,
      userRole: req.user.role,
      details: {
        orderNumber: order.orderNumber,
        taskCount: updatedTasks.length,
        tasks: updatedTasks.map(t => ({
          taskName: t.taskName,
          tailor: t.assignedTailor?.name,
          status: t.status
        }))
      },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Successfully assigned ${updatedTasks.length} task(s) to tailors. Tasks are immediately active on tailor dashboards.`,
      tasks: updatedTasks
    });
  } catch (error) {
    console.error('Error assigning order tasks:', error);
    next(error);
  }
};

/**
 * Get all tasks assigned to the logged-in Tailor
 * Accessible by Tailor (or any user viewing their own tasks)
 */
exports.getMyTasks = async (req, res, next) => {
  try {
    const tailorId = req.user.id;
    const { status } = req.query; // 'ALL', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'

    const where = { assignedTailorId: tailorId };
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const tasks = await prisma.orderTask.findMany({
      where,
      include: {
        order: {
          include: {
            customer: { select: { id: true, name: true } }, // RBAC sanitized: name only
            garmentDetails: true,
            branch: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // ASSIGNED, IN_PROGRESS first
        { createdAt: 'desc' }
      ]
    });

    // Counts for KPIs
    const allMyTasks = await prisma.orderTask.findMany({
      where: { assignedTailorId: tailorId },
      select: { status: true }
    });

    const counts = {
      total: allMyTasks.length,
      assigned: allMyTasks.filter(t => t.status === 'ASSIGNED').length,
      inProgress: allMyTasks.filter(t => t.status === 'IN_PROGRESS').length,
      completed: allMyTasks.filter(t => t.status === 'COMPLETED').length
    };

    res.json({
      success: true,
      tasks,
      counts
    });
  } catch (error) {
    console.error('Error fetching tailor tasks:', error);
    next(error);
  }
};

/**
 * Get all production tasks across orders
 * Accessible by CEO (multi-branch) and Managers (branch-restricted)
 */
exports.getAllTasks = async (req, res, next) => {
  try {
    const { status, taskType, tailorId, branchId } = req.query;

    const where = {};

    // Branch restriction: Manager is strictly locked to their branch
    if (req.user?.role === 'MANAGER') {
      where.branchId = req.user.branchId;
    } else if (branchId) {
      where.branchId = parseInt(branchId, 10);
    }

    if (status && status !== 'ALL') where.status = status;
    if (taskType && taskType !== 'ALL') where.taskType = taskType;
    if (tailorId) where.assignedTailorId = parseInt(tailorId, 10);

    const tasks = await prisma.orderTask.findMany({
      where,
      include: {
        assignedTailor: {
          select: { id: true, name: true, email: true, role: true }
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            createdAt: true,
            customer: { select: { id: true, name: true } },
            garmentDetails: { select: { dressType: true, quantity: true } },
            branch: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error('Error fetching all tasks:', error);
    next(error);
  }
};

/**
 * Update task status (ASSIGNED -> IN_PROGRESS -> COMPLETED)
 * Tailor updates their own task; Manager/CEO can update tasks in their branch/system.
 * Enforces Requirement 8: Completing a task does NOT mark the order completed!
 */
exports.updateTaskStatus = async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const { status, notes } = req.body; // 'IN_PROGRESS' or 'COMPLETED'

    if (isNaN(taskId)) {
      return res.status(400).json({ success: false, message: 'Invalid task ID' });
    }

    if (!['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: ASSIGNED, IN_PROGRESS, COMPLETED'
      });
    }

    const task = await prisma.orderTask.findUnique({
      where: { id: taskId },
      include: {
        order: {
          include: {
            tasks: { orderBy: { sequence: 'asc' } }
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Role-based authorization
    const isTailor = req.user?.role === 'TAILOR' || req.user?.role === 'CUTTING' || req.user?.role === 'EMBROIDERY';
    const isManager = req.user?.role === 'MANAGER';
    const isCeo = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';

    if (isTailor && task.assignedTailorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only update tasks assigned to you.'
      });
    }

    if (isManager && task.branchId && task.branchId !== req.user.branchId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only update tasks in your authorized branch.'
      });
    }

    const now = new Date();
    const updateData = { status };
    if (notes) updateData.notes = notes;

    if (status === 'IN_PROGRESS' && !task.startedAt) {
      updateData.startedAt = now;
    }
    if (status === 'COMPLETED' && !task.completedAt) {
      updateData.completedAt = now;
    }

    // Update task
    const updatedTask = await prisma.orderTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignedTailor: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    // Check sibling tasks for the order
    const allOrderTasks = await prisma.orderTask.findMany({
      where: { orderId: task.orderId },
      orderBy: { sequence: 'asc' }
    });

    const allCompleted = allOrderTasks.every(t => t.status === 'COMPLETED');
    const order = task.order;

    let targetOrderStage = order.status;
    let historyNote = '';

    if (allCompleted) {
      // All production tasks completed -> Move order to READY (Ready for collection)
      // DO NOT MARK COMPLETED (archived)! Delivery & Payment workflow is preserved!
      targetOrderStage = 'READY';
      historyNote = `All production tasks completed! Garment is now READY for collection.`;

      await prisma.order.update({
        where: { id: task.orderId },
        data: {
          status: 'READY',
          readyNotificationSent: false
        }
      });
    } else {
      // Advance order status to the active/next task's stage
      targetOrderStage = determineOrderProductionStage(allOrderTasks);
      historyNote = `Task "${task.taskName}" updated to ${status} by ${req.user.name || req.user.role}. Order stage: ${targetOrderStage}.`;

      if (targetOrderStage !== order.status && order.status !== 'READY' && order.status !== 'DELIVERED' && order.status !== 'COMPLETED') {
        await prisma.order.update({
          where: { id: task.orderId },
          data: { status: targetOrderStage }
        });
      }
    }

    // Add production history
    await prisma.productionHistory.create({
      data: {
        orderId: task.orderId,
        stage: targetOrderStage,
        previousStage: order.status,
        assignedToId: task.assignedTailorId,
        startedAt: now,
        notes: historyNote
      }
    });

    res.json({
      success: true,
      message: `Task "${task.taskName}" updated to ${status}.`,
      task: updatedTask,
      orderStatus: targetOrderStage,
      allTasksCompleted: allCompleted
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    next(error);
  }
};

/**
 * Reassign an existing task to another tailor
 * Accessible only by CEO and authorized Managers (branch-restricted)
 */
exports.reassignTask = async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const { assignedTailorId, notes } = req.body;

    if (isNaN(taskId)) {
      return res.status(400).json({ success: false, message: 'Invalid task ID' });
    }

    if (!assignedTailorId) {
      return res.status(400).json({ success: false, message: 'New tailor ID is required for reassignment.' });
    }

    const task = await prisma.orderTask.findUnique({
      where: { id: taskId },
      include: { order: true }
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Branch restriction for Managers
    if (req.user?.role === 'MANAGER' && task.branchId && task.branchId !== req.user.branchId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Managers can only reassign tasks within their authorized branch.'
      });
    }

    // Validate new tailor
    const newTailor = await prisma.user.findUnique({
      where: { id: parseInt(assignedTailorId, 10) }
    });

    if (!newTailor || !newTailor.isActive) {
      return res.status(400).json({ success: false, message: 'Assigned tailor does not exist or is inactive.' });
    }

    if (req.user?.role === 'MANAGER' && newTailor.branchId && newTailor.branchId !== req.user.branchId) {
      return res.status(403).json({
        success: false,
        message: `Tailor ${newTailor.name} belongs to another branch.`
      });
    }

    const assignerName = req.user.name || (req.user.role === 'SUPER_ADMIN' ? 'CEO' : 'Manager');
    const now = new Date();

    const updatedTask = await prisma.orderTask.update({
      where: { id: taskId },
      data: {
        assignedTailorId: newTailor.id,
        assignedById: req.user.id,
        assignedBy: assignerName,
        assignedAt: now,
        // Reset status to ASSIGNED if task was in-progress, or keep COMPLETED if already finished
        status: task.status === 'COMPLETED' ? 'COMPLETED' : 'ASSIGNED',
        notes: notes || task.notes
      },
      include: {
        assignedTailor: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    // Production history
    await prisma.productionHistory.create({
      data: {
        orderId: task.orderId,
        stage: task.order.status,
        previousStage: task.order.status,
        assignedToId: newTailor.id,
        startedAt: now,
        notes: `Task "${task.taskName}" reassigned to ${newTailor.name} by ${assignerName}. Immediately visible with status ASSIGNED.`
      }
    });

    res.json({
      success: true,
      message: `Task "${task.taskName}" successfully reassigned to ${newTailor.name}.`,
      task: updatedTask
    });
  } catch (error) {
    console.error('Error reassigning task:', error);
    next(error);
  }
};
