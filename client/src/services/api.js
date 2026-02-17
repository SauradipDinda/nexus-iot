import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('iot_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('iot_token');
      localStorage.removeItem('iot_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// ─── Devices ──────────────────────────────────────────────────────────────────
export const deviceAPI = {
  getAll: () => api.get('/devices'),
  getById: (id) => api.get(`/devices/${id}`),
  getToken: (id) => api.get(`/devices/${id}/token`),
  create: (data) => api.post('/devices', data),
  update: (id, data) => api.put(`/devices/${id}`, data),
  delete: (id) => api.delete(`/devices/${id}`),
  regenerateToken: (id) => api.post(`/devices/${id}/regenerate-token`),
};

// ─── Data ─────────────────────────────────────────────────────────────────────
export const dataAPI = {
  getLatest: (deviceId) => api.get(`/data/latest/${deviceId}`),
  getHistory: (deviceId, params) => api.get(`/data/history/${deviceId}`, { params }),
};

// ─── Templates ────────────────────────────────────────────────────────────────
export const templateAPI = {
  getAll: () => api.get('/templates'),
  getById: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
};

// ─── Virtual Pins ─────────────────────────────────────────────────────────────
export const pinAPI = {
  getAll: (deviceId) => api.get(`/virtual-pins/${deviceId}`),
  create: (deviceId, data) => api.post(`/virtual-pins/${deviceId}`, data),
  update: (deviceId, pinName, data) => api.put(`/virtual-pins/${deviceId}/${pinName}`, data),
  delete: (deviceId, pinName) => api.delete(`/virtual-pins/${deviceId}/${pinName}`),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertAPI = {
  getAll: () => api.get('/alerts'),
  getByDevice: (deviceId) => api.get(`/alerts/device/${deviceId}`),
  create: (data) => api.post('/alerts', data),
  update: (id, data) => api.put(`/alerts/${id}`, data),
  delete: (id) => api.delete(`/alerts/${id}`),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  getSummary: (deviceId, params) => api.get(`/analytics/summary/${deviceId}`, { params }),
  getChartData: (deviceId, params) => api.get(`/analytics/chart/${deviceId}`, { params }),
  getDashboardStats: () => api.get('/analytics/dashboard-stats'),
  exportCSV: (deviceId, params) => {
    const token = localStorage.getItem('iot_token');
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE}/analytics/export/${deviceId}?${queryString}`;
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${deviceId}_data.csv`);
    link.setAttribute('Authorization', `Bearer ${token}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

export default api;
