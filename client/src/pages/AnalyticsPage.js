import React, { useState, useEffect, useCallback } from 'react';
import { analyticsAPI, deviceAPI } from '../services/api';
import toast from 'react-hot-toast';
import { BarChart3, Download, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const AnalyticsPage = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [interval, setInterval] = useState('hour');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [selectedPin, setSelectedPin] = useState('');

  useEffect(() => {
    deviceAPI.getAll().then(res => {
      const devs = res.data.devices || [];
      setDevices(devs);
      if (devs.length > 0) setSelectedDevice(devs[0].deviceId);
    }).catch(() => {});
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!selectedDevice) return;
    setLoading(true);
    try {
      const params = { interval, ...dateRange };
      if (selectedPin) params.pin = selectedPin;

      const [summaryRes, chartRes] = await Promise.all([
        analyticsAPI.getSummary(selectedDevice, dateRange),
        analyticsAPI.getChartData(selectedDevice, params),
      ]);
      setSummary(summaryRes.data);
      setChartData(chartRes.data.data || []);
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  }, [selectedDevice, interval, dateRange, selectedPin]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const handleExport = () => {
    if (!selectedDevice) return;
    const params = { ...dateRange };
    if (selectedPin) params.pin = selectedPin;
    analyticsAPI.exportCSV(selectedDevice, params);
    toast.success('CSV download started');
  };

  // Group chart data by pin for multi-line chart
  const pins = [...new Set(chartData.map(d => d.pin))];
  const groupedData = chartData.reduce((acc, d) => {
    const time = new Date(d.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const existing = acc.find(a => a.time === time);
    if (existing) { existing[d.pin] = d.value; }
    else { acc.push({ time, [d.pin]: d.value }); }
    return acc;
  }, []);

  const COLORS = ['#00d4ff', '#7b2ff7', '#00ff88', '#ff6b35', '#ffd700', '#ff4757'];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title"><BarChart3 size={24} className="title-icon" /> Analytics</h1>
          <p className="page-subtitle">Historical data analysis and visualization</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={fetchAnalytics} disabled={loading}><RefreshCw size={16} className={loading ? 'spinning' : ''} /></button>
          <button className="btn btn-secondary" onClick={handleExport} disabled={!selectedDevice}><Download size={16} /> Export CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
          <label className="form-label">Device</label>
          <select className="form-select" value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)}>
            {devices.map(d => <option key={d._id} value={d.deviceId}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Pin Filter</label>
          <input className="form-input" placeholder="V0, V1..." value={selectedPin} onChange={e => setSelectedPin(e.target.value)} style={{ width: '100px' }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Interval</label>
          <select className="form-select" value={interval} onChange={e => setInterval(e.target.value)} style={{ width: '120px' }}>
            <option value="minute">Minute</option>
            <option value="hour">Hour</option>
            <option value="day">Day</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">From</label>
          <input type="datetime-local" className="form-input" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">To</label>
          <input type="datetime-local" className="form-input" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))} />
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {summary.pinStats?.map((stat, i) => (
            <div key={stat._id} className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: 'monospace', color: COLORS[i % COLORS.length], fontWeight: 700 }}>{stat._id}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stat.count} pts</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.latest?.toFixed(2)}</div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>↓ {stat.min?.toFixed(1)}</span>
                <span>avg {stat.avg?.toFixed(1)}</span>
                <span>↑ {stat.max?.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Sensor Data Over Time</h3>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : groupedData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No data available for the selected range</div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={groupedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend />
              {pins.map((pin, i) => (
                <Line key={pin} type="monotone" dataKey={pin} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
