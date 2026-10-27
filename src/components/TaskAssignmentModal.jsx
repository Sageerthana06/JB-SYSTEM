import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Layers,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { API_URL } from '../config/api';

const DEFAULT_TASK_DEFS = [
  {
    type: 'CUTTING',
    name: 'Cutting',
    icon: '✂️',
    description: 'Pattern marking & fabric cutting according to measurements'
  },
  {
    type: 'AARI_EMBROIDERY',
    name: 'Aari Embroidery',
    icon: '✨',
    description: 'Handcrafted Aari / Zardosi needlework & beadwork'
  },
  {
    type: 'STITCHING',
    name: 'Stitching',
    icon: '🧵',
    description: 'Main garment assembly, seam stitching, and inner lining'
  },
  {
    type: 'FITTING_ALTERATION',
    name: 'Fitting / Alteration',
    icon: '📐',
    description: 'Trial fitting review, adjustments, and silhouette tuning'
  },
  {
    type: 'FINISHING',
    name: 'Finishing',
    icon: '👔',
    description: 'Hemming, hook/button attachment, thread trimming, and iron press'
  },
  {
    type: 'QUALITY_CHECK',
    name: 'Quality Check',
    icon: '🛡️',
    description: 'Measurement compliance audit & final packaging'
  }
];

export const TaskAssignmentModal = ({ order, isOpen, onClose, onAssigned, user }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tailors, setTailors] = useState([]);
  const [requiredTasks, setRequiredTasks] = useState([]);
  const [existingTasks, setExistingTasks] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState({});
  const [taskNotes, setTaskNotes] = useState({});
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const isCeo = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const orderBranchId = order?.branchId || user?.branchId;

  // Load tailors and order tasks
  useEffect(() => {
    if (!isOpen || !order?.id) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        const token = localStorage.getItem('jb_token');
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Fetch Tailors
        const tailorsRes = await fetch(`${API_URL}/api/orders/tailors/list`, { headers });
        const tailorsData = await tailorsRes.json();
        let tailorsList = [];
        if (tailorsData.success && Array.isArray(tailorsData.data)) {
          tailorsList = tailorsData.data;
        } else if (Array.isArray(tailorsData.tailors)) {
          tailorsList = tailorsData.tailors;
        }

        // Filter tailors by branch for Managers
        if (!isCeo && orderBranchId) {
          tailorsList = tailorsList.filter(t => !t.branchId || t.branchId === orderBranchId);
        }
        setTailors(tailorsList);

        // 2. Fetch Order Tasks & Required Tasks
        const tasksRes = await fetch(`${API_URL}/api/orders/${order.id}/tasks`, { headers });
        const tasksData = await tasksRes.json();

        if (tasksData.success) {
          const req = tasksData.requiredTasks || [];
          setRequiredTasks(req);
          setExistingTasks(tasksData.tasks || []);

          // Initialize task selections
          const initSelected = {};
          const initNotes = {};

          // Populate with existing tasks if present
          if (tasksData.tasks && tasksData.tasks.length > 0) {
            tasksData.tasks.forEach(t => {
              initSelected[t.taskType] = t.assignedTailorId ? String(t.assignedTailorId) : '';
              initNotes[t.taskType] = t.notes || '';
            });
          } else {
            // Default to required tasks
            req.forEach(t => {
              // If order has legacy assignedTailorId, prefill stitching or first task
              if (order.assignedTailorId && (t.taskType === 'STITCHING' || t.taskType === 'CUTTING')) {
                initSelected[t.taskType] = String(order.assignedTailorId);
              } else {
                initSelected[t.taskType] = '';
              }
              initNotes[t.taskType] = '';
            });
          }

          setSelectedTasks(initSelected);
          setTaskNotes(initNotes);
        }
      } catch (err) {
        console.error('Error loading task assignment data:', err);
        setError('Network error loading tailors and task definitions.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, order?.id]);

  if (!isOpen || !order) return null;

  const gDetails = order.garmentDetails || {};
  const dressType = gDetails.dressType || 'Garment';

  // Tasks to display: either only required tasks or all tasks if toggled
  const requiredTypes = new Set(requiredTasks.map(t => t.type || t.taskType));
  const displayedTaskDefs = showAllTasks
    ? DEFAULT_TASK_DEFS
    : DEFAULT_TASK_DEFS.filter(def => requiredTypes.has(def.type) || selectedTasks[def.type] !== undefined);

  const handleTailorChange = (taskType, tailorId) => {
    setSelectedTasks(prev => ({
      ...prev,
      [taskType]: tailorId
    }));
  };

  const handleNotesChange = (taskType, notes) => {
    setTaskNotes(prev => ({
      ...prev,
      [taskType]: notes
    }));
  };

  const handleToggleTaskInclusion = (taskType) => {
    setSelectedTasks(prev => {
      const next = { ...prev };
      if (next[taskType] !== undefined) {
        delete next[taskType];
      } else {
        next[taskType] = '';
      }
      return next;
    });
  };

  const handleSaveTasks = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      // Build tasks payload
      const tasksToAssign = [];
      for (const [taskType, tailorId] of Object.entries(selectedTasks)) {
        if (!tailorId) continue; // Only assign tasks that have a tailor assigned
        const def = DEFAULT_TASK_DEFS.find(d => d.type === taskType) || {};
        tasksToAssign.push({
          taskType,
          taskName: def.name || taskType,
          assignedTailorId: parseInt(tailorId, 10),
          notes: taskNotes[taskType] || null
        });
      }

      if (tasksToAssign.length === 0) {
        setError('Please select at least one tailor for a task to assign.');
        setSaving(false);
        return;
      }

      const token = localStorage.getItem('jb_token');
      const res = await fetch(`${API_URL}/api/orders/${order.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tasks: tasksToAssign })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`✓ ${tasksToAssign.length} task(s) assigned successfully! Tasks are immediately active with status ASSIGNED.`);
        if (onAssigned) {
          onAssigned(data.tasks, order.id);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(data.message || 'Failed to assign tasks.');
      }
    } catch (err) {
      console.error('Error saving tasks:', err);
      setError('Network error saving task assignments.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#0a192f',
          color: '#ffffff',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  Assign Production Tasks
                </h2>
                <span style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  color: '#93c5fd',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}>
                  {order.orderNumber || `ORD-${order.id}`}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                {dressType} • Customer: <strong style={{ color: '#e2e8f0' }}>{order.customer?.name || 'Customer'}</strong> • Branch: {order.branch?.name || 'Main'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Banner: Immediate ASSIGNED status */}
        <div style={{
          backgroundColor: '#f0fdf4',
          borderBottom: '1px solid #bbf7d0',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.82rem',
          color: '#15803d'
        }}>
          <ShieldCheck size={18} color="#16a34a" />
          <span>
            <strong>Task Assignment Only — No Acceptance Step:</strong> Tasks immediately appear on craftsmen dashboards with status <span style={{ backgroundColor: '#dcfce7', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>ASSIGNED</span>.
          </span>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Garment Summary Card */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '0.8rem',
            color: '#475569'
          }}>
            <div>
              <span style={{ color: '#64748b' }}>Garment:</span> <strong>{dressType} (Qty: {gDetails.quantity || 1})</strong>
            </div>
            {gDetails.fabricType && (
              <div>
                <span style={{ color: '#64748b' }}>Fabric:</span> <strong>{gDetails.fabricType} {gDetails.fabricColour ? `(${gDetails.fabricColour})` : ''}</strong>
              </div>
            )}
            {gDetails.workRequired && (
              <div>
                <span style={{ color: '#64748b' }}>Embroidery / Aari:</span> <strong style={{ color: '#7c3aed' }}>Required</strong>
              </div>
            )}
            {gDetails.specialDesignInstructions && (
              <div style={{ width: '100%', color: '#1e293b' }}>
                <span style={{ color: '#64748b' }}>Instructions:</span> {gDetails.specialDesignInstructions}
              </div>
            )}
          </div>

          {/* Toggle All Tasks option */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e293b' }}>
              Production Tasks Required for this Order ({displayedTaskDefs.length})
            </div>
            <button
              type="button"
              onClick={() => setShowAllTasks(!showAllTasks)}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {showAllTasks ? 'Show Only Required Tasks' : 'Customize / Show All Tasks +'}
            </button>
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              backgroundColor: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tasks List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
              <div>Loading production tasks & tailor directory...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {displayedTaskDefs.map((def) => {
                const isSelected = selectedTasks[def.type] !== undefined;
                const assignedTailorId = selectedTasks[def.type] || '';
                const existing = existingTasks.find(t => t.taskType === def.type);

                return (
                  <div
                    key={def.type}
                    style={{
                      border: isSelected ? '1px solid #cbd5e1' : '1px dashed #e2e8f0',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      backgroundColor: isSelected ? '#ffffff' : '#f8fafc',
                      opacity: isSelected ? 1 : 0.65,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleTaskInclusion(def.type)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '1.2rem' }}>{def.icon}</span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{def.name}</strong>
                            {requiredTypes.has(def.type) && (
                              <span style={{
                                backgroundColor: '#e0f2fe',
                                color: '#0369a1',
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 700
                              }}>
                                Required
                              </span>
                            )}
                            {existing && (
                              <span style={{
                                backgroundColor: existing.status === 'COMPLETED' ? '#dcfce7' : existing.status === 'IN_PROGRESS' ? '#dbeafe' : '#fef3c7',
                                color: existing.status === 'COMPLETED' ? '#15803d' : existing.status === 'IN_PROGRESS' ? '#1d4ed8' : '#b45309',
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 800
                              }}>
                                {existing.status}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            {def.description}
                          </div>
                        </div>
                      </div>

                      {/* Tailor Selector */}
                      {isSelected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>Assign To:</span>
                          <select
                            value={assignedTailorId}
                            onChange={(e) => handleTailorChange(def.type, e.target.value)}
                            style={{
                              padding: '7px 12px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: '#1e293b',
                              outline: 'none',
                              minWidth: '200px'
                            }}
                          >
                            <option value="">— Select Craftsman —</option>
                            {tailors.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.role || 'Tailor'})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Task notes input if selected */}
                    {isSelected && (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                        <input
                          type="text"
                          value={taskNotes[def.type] || ''}
                          onChange={(e) => handleNotesChange(def.type, e.target.value)}
                          placeholder={`Instructions for ${def.name} (optional)...`}
                          style={{
                            width: '100%',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.78rem',
                            outline: 'none'
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Assigning different tailors to separate tasks within the same order is fully supported.
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveTasks}
              disabled={saving || loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 800,
                cursor: (saving || loading) ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(37,99,235,0.2)'
              }}
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              <span>{saving ? 'Dispatching Tasks...' : 'Dispatch Tasks (No Acceptance Step)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
