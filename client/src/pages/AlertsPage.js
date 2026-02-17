import React, { useState, useEffect, useCallback } from 'react';
import { alertAPI, deviceAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Bell, Plus, Trash2, Edit3, X, ToggleLeft, ToggleRight } from 'lucide-react';

const CONDITIONS = ['>', '<', '>=', '<=', '==', '!='];
const NOTIFY_TYPES = ['dashboard', 'email'];

const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAlert, setEditAlert] = useState(null);
  const [form, setForm] = useState({ deviceId: '', name: '', pin: '', condition: '>', threshold: '', notificationType: ['dashboard'], message: '', cooldownMinutes: 5 });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [alertRes, devRes] = await Promise.all([alertAPI.getAll(), deviceAPI.getAll()]);
      setAlerts(alertRes.data.alerts || []);
      setDevices(devRes.data.devices || []);
    } catch { toast.error('Failed to load alerts'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditAlert(null);
    setForm({ deviceId: '', name: '', pin: '', condition: '>', threshold: '', notificationType: ['dashboard'], message: '', cooldownMinutes: 5 });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editAlert) {
        await alertAPI.update(editAlert._id, form);
        toast.success('Alert updated!');
      } else {
        await alertAPI.create(form);
        toast.success('Alert created!');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save alert');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this alert?')) return;
    try {
      await alertAPI.delete(id);
      toast.success('Alert deleted');
      setAlerts(prev => prev.filter(a => a._id !== id));
    } catch { toast.error('Failed to delete alert'); }
  };

  const handleToggle = async (alert) => {
    try {
      await alertAPI.update(alert._id, { isActive: !alert.isActive });
      setAlerts(prev => prev.map(a => a._id === alert._id ? { ...a, isActive: !a.isActive } : a));
      toast.success(alert.isActive ? 'Alert disabled' : 'Alert enabled');
    } catch { toast.error('Failed to update alert'); }
  };

  const toggleNotifyType = (type) => {
    setForm(prev => ({
      ...prev,
      notificationType: prev.notificationType.includes(type)
        ? prev.notificationType.filter(t => t !== type)
        : [...prev.notificationType, type]
    }));
  };

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Bell size={24} className="title-icon" /> Alerts</h1>
          <p className="page-subtitle">Configure threshold-based smart alerts</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> New Alert</button>
      </div>

      {alerts.length === 0 ? (
        <div className="empty-state">
          <Bell size={48} />
          <h3>No alerts configured</h3>
          <p>Create alerts to get notified when sensor values exceed thresholds</p>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Create Alert</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Alert Name</th><th>Device</th><th>Condition</th><th>Triggers</th><th>Notify</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {alerts.map(alert => (
                <tr key={alert._id}>
                  <td><strong>{alert.name}</strong></td>
                  <td style={{ fontSize: '0.85rem' }}>{alert.device?.name || alert.deviceId}</td>
                  <td>
                    <code style={{ background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {alert.pin} {alert.condition} {alert.threshold}
                    </code>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{alert.triggerCount || 0}x</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {alert.notificationType?.map(t => (
                        <span key={t} className="badge" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-cyan)', fontSize: '0.7rem' }}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button onClick={() => handleToggle(alert)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: alert.isActive ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                      {alert.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditAlert(alert); setForm({ deviceId: alert.deviceId, name: alert.name, pin: alert.pin, condition: alert.condition, threshold: alert.threshold, notificationType: alert.notificationType, message: alert.message || '', cooldownMinutes: alert.cooldownMinutes }); setShowModal(true); }}><Edit3 size={14} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(alert._id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><Bell size={18} /> {editAlert ? 'Edit Alert' : 'New Alert'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Alert Name *</label>
                <input className="form-input" placeholder="High Temperature Alert" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Device *</label>
                <select className="form-select" value={form.deviceId} onChange={e => setForm({ ...form, deviceId: e.target.value })} required>
                  <option value="">Select device...</option>
                  {devices.map(d => <option key={d._id} value={d.deviceId}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Pin *</label>
                  <input className="form-input" placeholder="V0" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Condition *</label>
                  <select className="form-select" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Threshold *</label>
                  <input type="number" className="form-input" placeholder="30" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notification Types</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {NOTIFY_TYPES.map(t => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input type="checkbox" checked={form.notificationType.includes(t)} onChange={() => toggleNotifyType(t)} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Custom Message</label>
                <input className="form-input" placeholder="Optional alert message..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Cooldown (minutes)</label>
                <input type="number" className="form-input" min={1} value={form.cooldownMinutes} onChange={e => setForm({ ...form, cooldownMinutes: parseInt(e.target.value) })} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : editAlert ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsPage;
