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

    // Validate task types and assignee IDs, deduplicating by canonical taskType
    const incomingByType = new Map();
    for (const rawTask of tasks) {
      const taskType = rawTask?.taskType ? String(rawTask.taskType).trim().toUpperCase() : '';
      if (!taskType || !TASK_DEFINITIONS[taskType]) {
        return res.status(400).json({
          success: false,
          message: `Invalid task type: "${rawTask?.taskType || ''}". Allowed types: ${Object.keys(TASK_DEFINITIONS).join(', ')}`
        });
      }

      const parsedTailorId = parseInt(rawTask.assignedTailorId, 10);
      if (isNaN(parsedTailorId) || parsedTailorId <= 0) {
        return res.status(400).json({
          success: false,
          message: `Valid assignedTailorId is required for task "${TASK_DEFINITIONS[taskType].name}".`
        });
      }

      incomingByType.set(taskType, {
        taskType,
        assignedTailorId: parsedTailorId,
        notes: rawTask.notes !== undefined && rawTask.notes !== null && String(rawTask.notes).trim() !== ''
          ? String(rawTask.notes)
          : null
      });
    }

    const normalizedTasks = Array.from(incomingByType.values()).sort(
      (a, b) => TASK_DEFINITIONS[a.taskType].defaultSequence - TASK_DEFINITIONS[b.taskType].defaultSequence
    );

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { garmentDetails: true, branch: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Branch restriction for Managers
    if (req.user?.role === 'MANAGER' && order.branchId && Number(order.branchId) !== Number(req.user.branchId)) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Managers can only assign tasks within their authorized branch.'
      });
    }

    // Validate assigned tailors
    const tailorIds = [...new Set(normalizedTasks.map(t => t.assignedTailorId))];
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
      const crossBranchTailor = tailors.find(t => t.branchId && Number(t.branchId) !== Number(req.user.branchId));
      if (crossBranchTailor) {
        return res.status(403).json({
          success: false,
          message: `Tailor ${crossBranchTailor.name} does not belong to your authorized branch.`
        });
      }
    }

    const tailorMap = new Map(tailors.map(t => [t.id, t]));
    const assignerName = req.user.name || (['SUPER_ADMIN', 'CEO'].includes(req.user.role) ? 'CEO' : 'Manager');
    const now = new Date();
    const targetBranchId = order.branchId || req.user.branchId || null;

    // Safe per-task-type update/insert inside transaction (preserves existing IDs, statuses, timestamps & notes)
    await prisma.$transaction(async (tx) => {
      const existingTasks = await tx.orderTask.findMany({
        where: { orderId },
        orderBy: { id: 'asc' }
      });

      const existingByType = new Map();
      for (const existing of existingTasks) {
        if (!existingByType.has(existing.taskType)) {
          existingByType.set(existing.taskType, existing);
        }
      }

      const historySummaryParts = [];

      for (const t of normalizedTasks) {
        const def = TASK_DEFINITIONS[t.taskType];
        const canonicalSequence = def.defaultSequence;
        const existing = existingByType.get(t.taskType);

        if (existing) {
          const isLockedProgress = existing.status === 'IN_PROGRESS' || existing.status === 'COMPLETED';
          const resolvedNotes = t.notes !== null ? t.notes : existing.notes;
          const sameTailor = Number(existing.assignedTailorId) === Number(t.assignedTailorId);

          if (isLockedProgress || sameTailor) {
            // Preserve existing ID, craftsman, status (ASSIGNED / IN_PROGRESS / COMPLETED), startedAt, completedAt & notes
            if (existing.sequence !== canonicalSequence || resolvedNotes !== existing.notes) {
              await tx.orderTask.update({
                where: { id: existing.id },
                data: {
                  sequence: canonicalSequence,
                  notes: resolvedNotes
                }
              });
            }
          } else {
            // Task is still ASSIGNED (not started/completed) and craftsman changed: update in place keeping ID
            await tx.orderTask.update({
              where: { id: existing.id },
              data: {
                taskName: def.name,
                assignedTailorId: t.assignedTailorId,
                assignedById: req.user.id,
                assignedBy: assignerName,
                assignedAt: now,
                status: 'ASSIGNED',
                notes: resolvedNotes,
                sequence: canonicalSequence,
                branchId: existing.branchId || targetBranchId
              }
            });
            historySummaryParts.push(`${def.name} → ${tailorMap.get(t.assignedTailorId)?.name || 'Tailor'}`);
          }
        } else {
          // Insert newly assigned task with canonical sequence and status ASSIGNED
          await tx.orderTask.create({
            data: {
              orderId,
              taskType: t.taskType,
              taskName: def.name,
              assignedTailorId: t.assignedTailorId,
              assignedById: req.user.id,
              assignedBy: assignerName,
              assignedAt: now,
              status: 'ASSIGNED',
              notes: t.notes,
              sequence: canonicalSequence,
              branchId: targetBranchId
            }
          });
          historySummaryParts.push(`${def.name} → ${tailorMap.get(t.assignedTailorId)?.name || 'Tailor'}`);
        }
      }

      // Ensure any untouched existing tasks also carry their canonical sequence from TASK_DEFINITIONS
      for (const existing of existingTasks) {
        if (!incomingByType.has(existing.taskType)) {
          const canonicalSeq = TASK_DEFINITIONS[existing.taskType]?.defaultSequence;
          if (canonicalSeq && existing.sequence !== canonicalSeq) {
            await tx.orderTask.update({
              where: { id: existing.id },
              data: { sequence: canonicalSeq }
            });
          }
        }
      }

      const allSavedTasks = await tx.orderTask.findMany({
        where: { orderId },
        include: {
          assignedTailor: { select: { id: true, name: true } }
        },
        orderBy: { sequence: 'asc' }
      });

      // Primary tailor is stitching tailor or first assigned tailor across all saved tasks
      const primaryTailorTask =
        allSavedTasks.find(t => t.taskType === 'STITCHING' && t.assignedTailorId) ||
        allSavedTasks.find(t => t.assignedTailorId);
      const primaryTailorId = primaryTailorTask ? primaryTailorTask.assignedTailorId : order.assignedTailorId;

      // Determine active stage based on canonical task sequence
      const initialStage = determineOrderProductionStage(allSavedTasks);

      // Update Order: bypass tailor acceptance, set tailorAccepted: true
      await tx.order.update({
        where: { id: orderId },
        data: {
          assignedTailorId: primaryTailorId,
          assignedBy: order.assignedBy || assignerName,
          assignedAt: order.assignedAt || now,
          tailorAccepted: true,        // Acceptance step bypassed
          tailorAcceptedAt: order.tailorAcceptedAt || now,
          tailorRejectedAt: null,
          tailorRejectionReason: null,
          status: ['CUSTOMER_APPROVED', 'APPROVED', 'ORDER_CONFIRMED', 'PENDING_PRODUCTION', 'TAILOR_ASSIGNED'].includes(order.status)
            ? initialStage
            : order.status
        }
      });

      // Record production history
      const assignedSummary = (historySummaryParts.length > 0
        ? historySummaryParts
        : allSavedTasks
            .filter(t => t.assignedTailorId)
            .map(t => `${t.taskName} → ${t.assignedTailor?.name || tailorMap.get(t.assignedTailorId)?.name || 'Tailor'}`)
      ).join(', ');

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
