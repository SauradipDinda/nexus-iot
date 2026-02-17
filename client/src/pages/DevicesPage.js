import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { deviceAPI, templateAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Cpu, Plus, Trash2, Eye, RefreshCw, Key, X, Search } from 'lucide-react';

const DevicesPage = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', description: '', templateId: '', hardwareType: 'ESP32' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [devRes, tmplRes] = await Promise.all([deviceAPI.getAll(), templateAPI.getAll()]);
      setDevices(devRes.data.devices || []);
      setTemplates(tmplRes.data.templates || []);
    } catch { toast.error('Failed to load devices'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await deviceAPI.create(form);
      toast.success('Device registered successfully!');
      setShowModal(false);
      setForm({ name: '', description: '', templateId: '', hardwareType: 'ESP32' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create device');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete device "${name}"?`)) return;
    try {
      await deviceAPI.delete(id);
      toast.success('Device deleted');
      setDevices(prev => prev.filter(d => d.deviceId !== id && d._id !== id));
    } catch { toast.error('Failed to delete device'); }
  };

  const filtered = devices.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.deviceId.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Cpu size={24} className="title-icon" /> Devices</h1>
          <p className="page-subtitle">Manage your registered IoT devices</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={fetchData}><RefreshCw size={16} /></button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Device</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: '400px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="Search devices..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Cpu size={48} />
          <h3>{search ? 'No devices found' : 'No devices yet'}</h3>
          <p>{search ? 'Try a different search term' : 'Register your first IoT device to get started'}</p>
          {!search && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Device</button>}
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Device ID</th>
                <th>Template</th>
                <th>Hardware</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(device => {
                const isOnline = device.status === 'online';
                return (
                  <tr key={device._id}>
                    <td><strong>{device.name}</strong></td>
                    <td><code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{device.deviceId}</code></td>
                    <td>{device.template?.name || device.templateId}</td>
                    <td>{device.metadata?.hardwareType || 'ESP32'}</td>
                    <td>
                      <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}>
                        <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/devices/${device.deviceId}`)}><Eye size={14} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(device.deviceId, device.name)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Device Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><Plus size={18} /> Register Device</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Device Name *</label>
                <input className="form-input" placeholder="My ESP32 Sensor" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Template *</label>
                <select className="form-select" value={form.templateId} onChange={e => setForm({ ...form, templateId: e.target.value })} required>
                  <option value="">Select a template...</option>
                  {templates.map(t => <option key={t._id} value={t.templateId}>{t.name} ({t.templateId})</option>)}
                </select>
                {templates.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--accent-orange)', marginTop: '0.3rem' }}>⚠ No templates found. <a href="/templates">Create one first</a></p>}
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" placeholder="Optional description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Hardware Type</label>
                <select className="form-select" value={form.hardwareType} onChange={e => setForm({ ...form, hardwareType: e.target.value })}>
                  {['ESP32', 'ESP8266', 'Arduino', 'Raspberry Pi', 'Other'].map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Creating...</> : <><Plus size={16} /> Register</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevicesPage;
