import React, { useState, useEffect, useCallback } from 'react';
import { templateAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FileCode, Plus, Trash2, Edit3, X, Globe, Lock } from 'lucide-react';

const CATEGORIES = ['Smart Agriculture', 'Fire Monitoring', 'Industrial Safety', 'Carbon Emission Tracking', 'Environmental Monitoring', 'Custom'];
const HW_TYPES = ['ESP32', 'ESP8266', 'Arduino', 'Raspberry Pi', 'Other'];

const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', category: 'Custom', hardwareType: 'ESP32', isPublic: false, defaultPins: [] });
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await templateAPI.getAll();
      setTemplates(res.data.templates || []);
    } catch { toast.error('Failed to load templates'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openCreate = () => {
    setEditTemplate(null);
    setForm({ name: '', description: '', category: 'Custom', hardwareType: 'ESP32', isPublic: false, defaultPins: [] });
    setShowModal(true);
  };

  const openEdit = (t) => {
    setEditTemplate(t);
    setForm({ name: t.name, description: t.description || '', category: t.category, hardwareType: t.hardwareType, isPublic: t.isPublic, defaultPins: t.defaultPins || [] });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editTemplate) {
        await templateAPI.update(editTemplate.templateId, form);
        toast.success('Template updated!');
      } else {
        await templateAPI.create(form);
        toast.success('Template created!');
      }
      setShowModal(false);
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save template');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    try {
      await templateAPI.delete(id);
      toast.success('Template deleted');
      setTemplates(prev => prev.filter(t => t.templateId !== id));
    } catch { toast.error('Failed to delete template'); }
  };

  const categoryColors = {
    'Smart Agriculture': '#00ff88',
    'Fire Monitoring': '#ff4757',
    'Industrial Safety': '#ff6b35',
    'Carbon Emission Tracking': '#7b2ff7',
    'Environmental Monitoring': '#00d4ff',
    'Custom': '#ffd700',
  };

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title"><FileCode size={24} className="title-icon" /> Templates</h1>
          <p className="page-subtitle">Create and manage device templates</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> New Template</button>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <FileCode size={48} />
          <h3>No templates yet</h3>
          <p>Create a template to define your device configuration</p>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Create Template</button>
        </div>
      ) : (
        <div className="devices-grid">
          {templates.map(t => (
            <div key={t._id} className="card" style={{ cursor: 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: categoryColors[t.category] || 'var(--accent-cyan)', background: `${categoryColors[t.category]}20`, padding: '0.2rem 0.6rem', borderRadius: '20px' }}>
                  {t.category}
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {t.isPublic ? <Globe size={14} style={{ color: 'var(--accent-green)' }} /> : <Lock size={14} style={{ color: 'var(--text-muted)' }} />}
                </div>
              </div>
              <h3 style={{ marginBottom: '0.3rem' }}>{t.name}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '0.5rem' }}>{t.templateId}</p>
              {t.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{t.description}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.hardwareType} · {t.defaultPins?.length || 0} pins</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}><Edit3 size={14} /></button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.templateId, t.name)}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><FileCode size={18} /> {editTemplate ? 'Edit Template' : 'New Template'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Template Name *</label>
                <input className="form-input" placeholder="Smart Agriculture Monitor" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" rows={2} placeholder="Describe this template..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Hardware</label>
                  <select className="form-select" value={form.hardwareType} onChange={e => setForm({ ...form, hardwareType: e.target.value })}>
                    {HW_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isPublic} onChange={e => setForm({ ...form, isPublic: e.target.checked })} />
                  <span className="form-label" style={{ margin: 0 }}>Make template public (visible to all users)</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editTemplate ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
