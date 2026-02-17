import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { deviceAPI, dataAPI, pinAPI, alertAPI } from '../services/api';
import { subscribeToDevice, unsubscribeFromDevice, getSocket } from '../services/socket';
import toast from 'react-hot-toast';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Cpu, ArrowLeft, Plus, Settings, Trash2, RefreshCw,
  Thermometer, Droplets, Wind, Flame, Activity, Zap,
  ToggleLeft, ToggleRight, Key, Copy, Edit3, Save, X
} from 'lucide-react';
import './DeviceDetailPage.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

// ─── Widget Components ────────────────────────────────────────────────────────

const GaugeWidget = ({ pin, value, min, max, unit, color, label }) => {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const angle = -135 + (pct / 100) * 270;
  const getColor = () => {
    if (pct > 80) return 'var(--accent-red)';
    if (pct > 60) return 'var(--accent-orange)';
    return color || 'var(--accent-cyan)';
  };

  return (
    <div className="widget-inner gauge-widget">
      <div className="widget-label">{label || pin}</div>
      <div className="gauge-container">
        <svg viewBox="0 0 120 80" className="gauge-svg">
          <path d="M 10 70 A 50 50 0 1 1 110 70" fill="none" stroke="var(--border-color)" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M 10 70 A 50 50 0 1 1 110 70"
            fill="none"
            stroke={getColor()}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 157} 157`}
            style={{ filter: `drop-shadow(0 0 4px ${getColor()})` }}
          />
          <text x="60" y="65" textAnchor="middle" fill="var(--text-primary)" fontSize="16" fontWeight="700">
            {value !== null && value !== undefined ? Number(value).toFixed(1) : '--'}
          </text>
          <text x="60" y="78" textAnchor="middle" fill="var(--text-secondary)" fontSize="8">
            {unit}
          </text>
        </svg>
      </div>
      <div className="gauge-range">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

const NumericWidget = ({ pin, value, unit, color, label, sensorType }) => {
  const icons = {
    temperature: Thermometer,
    humidity: Droplets,
    gas: Wind,
    smoke: Flame,
    carbon_emission: Wind,
    voltage: Zap,
    default: Activity,
  };
  const Icon = icons[sensorType] || icons.default;

  return (
    <div className="widget-inner numeric-widget">
      <div className="numeric-icon" style={{ color: color || 'var(--accent-cyan)' }}>
        <Icon size={24} />
      </div>
      <div className="numeric-value" style={{ color: color || 'var(--accent-cyan)' }}>
        {value !== null && value !== undefined ? Number(value).toFixed(2) : '--'}
        <span className="numeric-unit">{unit}</span>
      </div>
      <div className="numeric-label">{label || pin}</div>
    </div>
  );
};

const ChartWidget = ({ pin, label, color, history }) => {
  const data = history.slice(-30).map((d) => ({
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: d.value,
  }));

  return (
    <div className="widget-inner chart-widget">
      <div className="widget-label">{label || pin} — History</div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${pin}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color || '#00d4ff'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color || '#00d4ff'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color || '#00d4ff'}
            fill={`url(#grad-${pin})`}
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const LEDWidget = ({ pin, value, label, threshold = 1 }) => {
  const isOn = value !== null && value >= threshold;
  return (
    <div className="widget-inner led-widget">
      <div className={`led-indicator ${isOn ? 'led-on' : 'led-off'}`} />
      <div className="led-label">{label || pin}</div>
      <div className="led-status">{isOn ? 'ON' : 'OFF'}</div>
      <div className="led-value">{value !== null ? value : '--'}</div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DeviceDetailPage = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [pins, setPins] = useState([]);
  const [pinData, setPinData] = useState({});
  const [pinHistory, setPinHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState([]);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [showAddPinModal, setShowAddPinModal] = useState(false);
  const [newPin, setNewPin] = useState({ pinName: '', label: '', sensorType: 'custom', unit: '', minValue: 0, maxValue: 100, color: '#00d4ff' });
  const [widgetTypes, setWidgetTypes] = useState({});

  const fetchDevice = useCallback(async () => {
    try {
      const [deviceRes, latestRes] = await Promise.all([
        deviceAPI.getById(deviceId),
        dataAPI.getLatest(deviceId),
      ]);

      const dev = deviceRes.data.device;
      const pinsData = deviceRes.data.virtualPins || [];
      setDevice(dev);
      setPins(pinsData);

      // Build pin data map
      const dataMap = {};
      (latestRes.data.data || []).forEach((d) => {
        dataMap[d.pin] = d;
      });
      setPinData(dataMap);

      // Build default layout if none saved
      const savedLayout = dev.dashboardLayout;
      if (savedLayout && savedLayout.length > 0) {
        setLayout(savedLayout);
      } else {
        const defaultLayout = pinsData.map((p, i) => ({
          i: p.pinName,
          x: (i % 3) * 4,
          y: Math.floor(i / 3) * 4,
          w: 4,
          h: 4,
          minW: 2,
          minH: 3,
        }));
        setLayout(defaultLayout);
      }

      // Default widget types
      const types = {};
      pinsData.forEach((p) => {
        types[p.pinName] = 'gauge';
      });
      setWidgetTypes(types);

      // Fetch history for each pin
      const historyPromises = pinsData.map((p) =>
        dataAPI.getHistory(deviceId, { pin: p.pinName, limit: 50 })
          .then((r) => ({ pin: p.pinName, data: r.data.data || [] }))
          .catch(() => ({ pin: p.pinName, data: [] }))
      );
      const histories = await Promise.all(historyPromises);
      const histMap = {};
      histories.forEach(({ pin, data }) => { histMap[pin] = data; });
      setPinHistory(histMap);

    } catch (err) {
      toast.error('Failed to load device');
      navigate('/devices');
    } finally {
      setLoading(false);
    }
  }, [deviceId, navigate]);

  useEffect(() => {
    fetchDevice();

    // Subscribe to real-time updates
    subscribeToDevice(deviceId);
    const socket = getSocket();
    if (socket) {
      socket.on('sensor_data', (data) => {
        if (data.deviceId !== deviceId) return;
        setPinData((prev) => ({
          ...prev,
          [data.pin]: { ...prev[data.pin], value: data.value, lastUpdated: data.timestamp },
        }));
        setPinHistory((prev) => ({
          ...prev,
          [data.pin]: [...(prev[data.pin] || []).slice(-49), { value: data.value, timestamp: data.timestamp }],
        }));
      });
    }

    return () => {
      unsubscribeFromDevice(deviceId);
      if (socket) socket.off('sensor_data');
    };
  }, [deviceId, fetchDevice]);

  const handleSaveLayout = async () => {
    try {
      await deviceAPI.update(deviceId, { dashboardLayout: layout });
      toast.success('Dashboard layout saved!');
      setEditMode(false);
    } catch {
      toast.error('Failed to save layout');
    }
  };

  const handleShowToken = async () => {
    try {
      const res = await deviceAPI.getToken(deviceId);
      setAuthToken(res.data.authToken);
      setShowTokenModal(true);
    } catch {
      toast.error('Failed to fetch token');
    }
  };

  const handleAddPin = async (e) => {
    e.preventDefault();
    try {
      const res = await pinAPI.create(deviceId, newPin);
      setPins((prev) => [...prev, res.data.pin]);
      setLayout((prev) => [
        ...prev,
        { i: newPin.pinName.toUpperCase(), x: 0, y: Infinity, w: 4, h: 4, minW: 2, minH: 3 },
      ]);
      setWidgetTypes((prev) => ({ ...prev, [newPin.pinName.toUpperCase()]: 'gauge' }));
      toast.success(`Pin ${newPin.pinName.toUpperCase()} created!`);
      setShowAddPinModal(false);
      setNewPin({ pinName: '', label: '', sensorType: 'custom', unit: '', minValue: 0, maxValue: 100, color: '#00d4ff' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create pin');
    }
  };

  const cycleWidgetType = (pinName) => {
    const types = ['gauge', 'numeric', 'chart', 'led'];
    setWidgetTypes((prev) => {
      const current = prev[pinName] || 'gauge';
      const next = types[(types.indexOf(current) + 1) % types.length];
      return { ...prev, [pinName]: next };
    });
  };

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const isOnline = device?.lastSeen && Date.now() - new Date(device.lastSeen).getTime() < 5 * 60 * 1000;

  return (
    <div className="device-detail-page fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="device-detail-title">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/devices')}>
            <ArrowLeft size={16} />
          </button>
          <div className="device-icon">
            <Cpu size={20} />
          </div>
          <div>
            <h1 className="page-title">{device?.name}</h1>
            <div className="device-detail-meta">
              <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}>
                <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <span className="device-id-badge">{device?.deviceId}</span>
              <span className="device-template-badge">{device?.templateId}</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleShowToken}>
            <Key size={16} />
            Auth Token
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddPinModal(true)}>
            <Plus size={16} />
            Add Pin
          </button>
          {editMode ? (
            <>
              <button className="btn btn-primary btn-sm" onClick={handleSaveLayout}>
                <Save size={16} />
                Save Layout
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(false)}>
                <X size={16} />
                Cancel
              </button>
            </>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>
              <Edit3 size={16} />
              Edit Layout
            </button>
          )}
        </div>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="edit-mode-banner">
          <Edit3 size={16} />
          <span>Drag and resize widgets to customize your dashboard layout</span>
        </div>
      )}

      {/* No pins state */}
      {pins.length === 0 ? (
        <div className="empty-state">
          <Activity size={48} />
          <h3>No virtual pins configured</h3>
          <p>Add virtual pins to start receiving sensor data from your device</p>
          <button className="btn btn-primary" onClick={() => setShowAddPinModal(true)}>
            <Plus size={16} />
            Add Virtual Pin
          </button>
        </div>
      ) : (
        /* Dashboard Grid */
        <ResponsiveGridLayout
          className="dashboard-grid"
          layouts={{ lg: layout, md: layout, sm: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          isDraggable={editMode}
          isResizable={editMode}
          onLayoutChange={(newLayout) => setLayout(newLayout)}
          margin={[12, 12]}
        >
          {pins.map((pin) => {
            const data = pinData[pin.pinName] || {};
            const history = pinHistory[pin.pinName] || [];
            const wType = widgetTypes[pin.pinName] || 'gauge';

            return (
              <div key={pin.pinName} className="widget-container">
                {/* Widget header */}
                <div className="widget-header">
                  <span className="widget-pin-name">{pin.pinName}</span>
                  <div className="widget-actions">
                    <button
                      className="widget-action-btn"
                      onClick={() => cycleWidgetType(pin.pinName)}
                      title="Change widget type"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>

                {/* Widget content */}
                {wType === 'gauge' && (
                  <GaugeWidget
                    pin={pin.pinName}
                    value={data.value}
                    min={pin.minValue}
                    max={pin.maxValue}
                    unit={pin.unit}
                    color={pin.color}
                    label={pin.label}
                  />
                )}
                {wType === 'numeric' && (
                  <NumericWidget
                    pin={pin.pinName}
                    value={data.value}
                    unit={pin.unit}
                    color={pin.color}
                    label={pin.label}
                    sensorType={pin.sensorType}
                  />
                )}
                {wType === 'chart' && (
                  <ChartWidget
                    pin={pin.pinName}
                    label={pin.label}
                    color={pin.color}
                    history={history}
                  />
                )}
                {wType === 'led' && (
                  <LEDWidget
                    pin={pin.pinName}
                    value={data.value}
                    label={pin.label}
                  />
                )}
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}

      {/* Auth Token Modal */}
      {showTokenModal && (
        <div className="modal-overlay" onClick={() => setShowTokenModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <Key size={18} />
                Device Auth Token
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowTokenModal(false)}>
                <X size={16} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Use this token in your ESP32/ESP8266 firmware to authenticate data publishing.
            </p>
            <div className="token-display">
              <code>{authToken}</code>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { navigator.clipboard.writeText(authToken); toast.success('Token copied!'); }}
              >
                <Copy size={14} />
              </button>
            </div>
            <div className="token-config">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Arduino/ESP32 Configuration:
              </p>
              <pre className="code-block">{`#define TEMPLATE_ID "${device?.templateId}"
#define DEVICE_NAME "${device?.name}"
#define AUTH_TOKEN "${authToken}"
#define SERVER_URL "http://localhost:5000"`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Add Pin Modal */}
      {showAddPinModal && (
        <div className="modal-overlay" onClick={() => setShowAddPinModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <Plus size={18} />
                Add Virtual Pin
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddPinModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddPin}>
              <div className="form-group">
                <label className="form-label">Pin Name *</label>
                <input
                  className="form-input"
                  placeholder="V0, V1, V2..."
                  value={newPin.pinName}
                  onChange={(e) => setNewPin({ ...newPin, pinName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Label</label>
                <input
                  className="form-input"
                  placeholder="Temperature, Humidity..."
                  value={newPin.label}
                  onChange={(e) => setNewPin({ ...newPin, label: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Sensor Type</label>
                <select
                  className="form-select"
                  value={newPin.sensorType}
                  onChange={(e) => setNewPin({ ...newPin, sensorType: e.target.value })}
                >
                  {['temperature', 'humidity', 'gas', 'smoke', 'carbon_emission', 'pressure', 'light', 'motion', 'voltage', 'current', 'custom'].map((t) => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <input className="form-input" placeholder="°C, %, ppm" value={newPin.unit} onChange={(e) => setNewPin({ ...newPin, unit: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Min</label>
                  <input type="number" className="form-input" value={newPin.minValue} onChange={(e) => setNewPin({ ...newPin, minValue: parseFloat(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Max</label>
                  <input type="number" className="form-input" value={newPin.maxValue} onChange={(e) => setNewPin({ ...newPin, maxValue: parseFloat(e.target.value) })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input type="color" className="form-input" style={{ height: '42px', padding: '4px' }} value={newPin.color} onChange={(e) => setNewPin({ ...newPin, color: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddPinModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} />
                  Create Pin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceDetailPage;
