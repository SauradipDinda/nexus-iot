import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsAPI, deviceAPI } from '../services/api';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';
import {
  Cpu, Wifi, WifiOff, Bell, Activity, TrendingUp,
  Plus, RefreshCw, AlertTriangle, Database
} from 'lucide-react';
import './DashboardPage.css';

const StatCard = ({ icon: Icon, label, value, color, subtitle }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: `${color}20`, color }}>
      <Icon size={22} />
    </div>
    <div className="stat-info">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
  </div>
);

const DeviceCard = ({ device, onClick }) => {
  const isOnline = device.status === 'online';
  return (
    <div className="device-card" onClick={() => onClick(device.deviceId)}>
      <div className="device-card-header">
        <div className="device-icon">
          <Cpu size={20} />
        </div>
        <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}>
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      <h3 className="device-name">{device.name}</h3>
      <p className="device-id">{device.deviceId}</p>
      {device.template && (
        <p className="device-template">{device.template.name} · {device.template.category}</p>
      )}
      <div className="device-meta">
        <span>{device.metadata?.hardwareType || 'ESP32'}</span>
        {device.lastSeen && (
          <span>Last seen: {new Date(device.lastSeen).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [statsRes, devicesRes] = await Promise.all([
        analyticsAPI.getDashboardStats(),
        deviceAPI.getAll(),
      ]);
      setStats(statsRes.data.stats);
      setDevices(devicesRes.data.devices || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Listen for real-time alerts
    const socket = getSocket();
    if (socket) {
      socket.on('alert_triggered', (alert) => {
        toast.error(`🚨 Alert: ${alert.alertName}`, { duration: 6000 });
        setAlerts((prev) => [alert, ...prev.slice(0, 4)]);
      });
    }

    // Poll every 60 seconds as fallback
    const interval = setInterval(() => fetchData(), 60000);

    return () => {
      clearInterval(interval);
      if (socket) socket.off('alert_triggered');
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Activity size={24} className="title-icon" />
            Dashboard Overview
          </h1>
          <p className="page-subtitle">Monitor all your IoT devices in real-time</p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/devices')}>
            <Plus size={16} />
            Add Device
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          icon={Cpu}
          label="Total Devices"
          value={stats?.totalDevices ?? 0}
          color="var(--accent-cyan)"
          subtitle="Registered devices"
        />
        <StatCard
          icon={Wifi}
          label="Online Devices"
          value={stats?.onlineDevices ?? 0}
          color="var(--accent-green)"
          subtitle="Active right now"
        />
        <StatCard
          icon={WifiOff}
          label="Offline Devices"
          value={stats?.offlineDevices ?? 0}
          color="var(--accent-red)"
          subtitle="Not responding"
        />
        <StatCard
          icon={Bell}
          label="Active Alerts"
          value={stats?.totalAlerts ?? 0}
          color="var(--accent-orange)"
          subtitle="Configured rules"
        />
        <StatCard
          icon={Database}
          label="Data Points (24h)"
          value={stats?.recentDataPoints?.toLocaleString() ?? 0}
          color="var(--accent-purple)"
          subtitle="Last 24 hours"
        />
        <StatCard
          icon={TrendingUp}
          label="Uptime"
          value={`${stats?.totalDevices > 0 ? Math.round((stats.onlineDevices / stats.totalDevices) * 100) : 0}%`}
          color="var(--accent-yellow)"
          subtitle="Device availability"
        />
      </div>

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <div className="section">
          <h2 className="section-title">
            <AlertTriangle size={18} />
            Recent Alerts
          </h2>
          <div className="alerts-list">
            {alerts.map((alert, idx) => (
              <div key={idx} className="alert-item">
                <div className="alert-icon">
                  <AlertTriangle size={16} />
                </div>
                <div className="alert-content">
                  <strong>{alert.alertName}</strong>
                  <span>{alert.message}</span>
                </div>
                <span className="alert-time">
                  {new Date(alert.triggeredAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Devices Grid */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">
            <Cpu size={18} />
            Your Devices ({devices.length})
          </h2>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/devices')}>
            View All
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="empty-state">
            <Cpu size={48} />
            <h3>No devices yet</h3>
            <p>Register your first IoT device to start monitoring</p>
            <button className="btn btn-primary" onClick={() => navigate('/devices')}>
              <Plus size={16} />
              Add Your First Device
            </button>
          </div>
        ) : (
          <div className="devices-grid">
            {devices.slice(0, 6).map((device) => (
              <DeviceCard
                key={device._id}
                device={device}
                onClick={(id) => navigate(`/devices/${id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
