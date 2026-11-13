/**
 * JB SYSTEM - Daily Action Centre Controller
 * 
 * Provides HTTP endpoints for the Daily Action Centre workstation.
 */

const actionCentreService = require('../services/actionCentreService');

exports.getActionCentreData = async (req, res, next) => {
  try {
    const { branchId, search, responsiblePersonId, queue } = req.query;
    const data = await actionCentreService.getDailyActionCentreData({
      user: req.user,
      branchId,
      search,
      responsiblePersonId,
      queue
    });

    return res.status(200).json({
      success: true,
      ...data
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('Error fetching Daily Action Centre data:', error);
    next(error);
  }
};

exports.saveFollowUp = async (req, res, next) => {
  try {
    const { orderId, queueType, followUpDate, responsiblePersonId, nextAction, outcome, status, notes } = req.body;

    if (!orderId || !queueType) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and Queue Type are required.'
      });
    }

    const followUp = await actionCentreService.recordActionFollowUp({
      user: req.user,
      orderId,
      queueType,
      followUpDate,
      responsiblePersonId,
      nextAction,
      outcome,
      status,
      notes
    });

    return res.status(201).json({
      success: true,
      message: status === 'COMPLETED' ? 'Follow-up marked as completed.' : 'Follow-up recorded successfully.',
      followUp
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('Error saving action follow-up:', error);
    next(error);
  }
};

exports.completeChecklistItem = async (req, res, next) => {
  try {
    const { checklistItemId, status, notes, businessDate } = req.body;

    if (!checklistItemId) {
      return res.status(400).json({
        success: false,
        message: 'Checklist Item ID is required.'
      });
    }

    const result = await actionCentreService.completeChecklistItem({
      user: req.user,
      checklistItemId,
      status: status || 'COMPLETED',
      notes,
      businessDate
    });

    return res.status(200).json({
      success: true,
      message: (status === 'COMPLETED' || !status) ? 'Checklist item marked as completed.' : 'Checklist item updated.',
      ...result
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('Error completing checklist item:', error);
    next(error);
  }
};

exports.getChecklistMonitoring = async (req, res, next) => {
  try {
    const { date, branchId, managerId, status } = req.query;

    const monitoringData = await actionCentreService.getCeoChecklistMonitoringData({
      user: req.user,
      date,
      branchId,
      managerId,
      statusFilter: status
    });

    return res.status(200).json({
      success: true,
      ...monitoringData
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('Error fetching CEO checklist monitoring:', error);
    next(error);
  }
};


