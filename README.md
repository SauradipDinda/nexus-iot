# 🌐 IoT Dashboard Platform

A **professional, production-ready, full-stack IoT web dashboard platform** inspired by Blynk IoT. Monitor, manage, and analyze your IoT devices in real-time.

![IoT Dashboard](https://img.shields.io/badge/IoT-Dashboard-00d4ff?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-20-green?style=for-the-badge&logo=node.js)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![MongoDB](https://img.shields.io/badge/MongoDB-7-green?style=for-the-badge&logo=mongodb)

---

## ✨ Features

- 🔐 **JWT Authentication** — Secure user registration & login
- 📱 **Multi-Device Management** — Register and manage unlimited IoT devices
- 🔌 **Virtual Pin System** — V0, V1, V2... dynamic sensor mapping
- ⚡ **Real-Time Updates** — WebSocket (Socket.io) live data streaming
- 📊 **Interactive Widgets** — Gauge, Line Chart, Numeric Display, LED Indicator
- 🎛️ **Drag-and-Drop Dashboard** — Fully customizable widget layout per device
- 🚨 **Smart Alerts** — Threshold-based alerts with email notifications
- 📈 **Historical Analytics** — Date-filtered charts with CSV export
- 🌙 **Dark / Light Mode** — Persistent theme toggle
- 📱 **Fully Responsive** — Mobile, tablet, and desktop support
- 🐳 **Docker Ready** — One-command deployment
- 🔒 **Security** — bcrypt, rate limiting, CORS, HTTPS-ready

---

## 🏗️ Architecture

```
ESP32/ESP8266 → WiFi → HTTP POST → Backend API → MongoDB
                                        ↓
                                   Socket.io → React Dashboard
```

---

## 📁 Project Structure

```
iot_web/
├── server/                    # Node.js + Express backend
│   ├── src/
│   │   ├── index.js           # Entry point
│   │   ├── models/            # MongoDB schemas
│   │   │   ├── User.js
│   │   │   ├── Device.js
│   │   │   ├── Template.js
│   │   │   ├── VirtualPin.js
│   │   │   ├── SensorData.js
│   │   │   └── Alert.js
│   │   ├── routes/            # REST API routes
│   │   │   ├── auth.js
│   │   │   ├── devices.js
│   │   │   ├── data.js
│   │   │   ├── templates.js
│   │   │   ├── virtualPins.js
│   │   │   ├── alerts.js
│   │   │   └── analytics.js
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT middleware
│   │   ├── socket/
│   │   │   └── socketHandler.js  # WebSocket handler
│   │   └── utils/
│   │       ├── alertEngine.js
│   │       ├── emailService.js
│   │       └── generateToken.js
│   ├── .env                   # Environment variables
│   ├── Dockerfile
│   └── package.json
│
├── client/                    # React.js frontend
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── index.css          # Global styles + CSS variables
│   │   ├── context/
│   │   │   ├── AuthContext.js
│   │   │   └── ThemeContext.js
│   │   ├── services/
│   │   │   ├── api.js         # Axios API client
│   │   │   └── socket.js      # Socket.io client
│   │   ├── components/
│   │   │   └── Layout/
│   │   │       ├── Layout.js
│   │   │       └── Layout.css
│   │   └── pages/
│   │       ├── LoginPage.js
│   │       ├── RegisterPage.js
│   │       ├── DashboardPage.js
│   │       ├── DevicesPage.js
│   │       ├── DeviceDetailPage.js  # Drag-and-drop widgets
│   │       ├── TemplatesPage.js
│   │       ├── AlertsPage.js
│   │       ├── AnalyticsPage.js
│   │       └── ProfilePage.js
│   ├── Dockerfile
│   └── package.json
│
├── esp32_example/
│   └── iot_dashboard_esp32.ino   # Arduino firmware
│
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd iot_web
```

### 2. Backend Setup

```bash
cd server
npm install
```

Edit `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/iot_dashboard
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

Start the server:
```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd client
npm install
```

Create `client/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

Start the frontend:
```bash
npm start
```

### 4. Access the Dashboard

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Docker Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- MongoDB: localhost:27017

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/change-password` | Change password |

### Devices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List all devices |
| POST | `/api/devices` | Register device |
| GET | `/api/devices/:id` | Get device details |
| PUT | `/api/devices/:id` | Update device |
| DELETE | `/api/devices/:id` | Delete device |
| GET | `/api/devices/:id/token` | Get auth token |
| POST | `/api/devices/:id/regenerate-token` | Regenerate token |

### Data Publishing (for ESP32)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/data/publish` | Publish sensor data |
| GET | `/api/data/latest/:deviceId` | Get latest readings |
| GET | `/api/data/history/:deviceId` | Get historical data |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard-stats` | Dashboard statistics |
| GET | `/api/analytics/summary/:deviceId` | Device summary |
| GET | `/api/analytics/chart/:deviceId` | Chart data |
| GET | `/api/analytics/export/:deviceId` | Export CSV |

---

## 🔌 ESP32 Integration

### JSON Payload Format

```json
{
  "template_id": "TMPLxxxxxxxx",
  "auth_token": "your_device_auth_token",
  "device_id": "My_ESP32_Sensor",
  "virtual_pins": {
    "V0": 28.5,
    "V1": 65.2,
    "V2": 350,
    "V3": 120,
    "V4": 45.8
  }
}
```

### Quick Setup Steps

1. **Create a Template** in the dashboard (Templates page)
2. **Register a Device** using that template (Devices page)
3. **Copy the AUTH_TOKEN** from Device → Auth Token button
4. **Add Virtual Pins** (V0, V1, V2...) in Device Detail page
5. **Flash the firmware** from `esp32_example/iot_dashboard_esp32.ino`
6. Update `TEMPLATE_ID`, `AUTH_TOKEN`, `WIFI_SSID`, `SERVER_URL`

### Virtual Pin Mapping Example

| Pin | Sensor | Unit | Range |
|-----|--------|------|-------|
| V0 | Temperature (DHT22) | °C | -40 to 80 |
| V1 | Humidity (DHT22) | % | 0 to 100 |
| V2 | Gas (MQ-2) | ppm | 0 to 1000 |
| V3 | Smoke | ppm | 0 to 500 |
| V4 | Carbon Emission | index | 0 to 500 |

---

## 🎛️ Dashboard Widgets

| Widget | Description |
|--------|-------------|
| **Gauge** | Circular gauge with color-coded zones |
| **Numeric** | Large value display with sensor icon |
| **Line Chart** | Historical area chart (last 30 readings) |
| **LED** | Binary on/off indicator with glow effect |

Click the **↻ button** on any widget to cycle through widget types.
Enable **Edit Layout** to drag and resize widgets freely.

---

## 🚨 Smart Alerts

Configure threshold-based alerts:
- **Conditions**: `>`, `<`, `>=`, `<=`, `==`, `!=`
- **Notifications**: Dashboard popup, Email
- **Cooldown**: Prevent alert spam (configurable minutes)
- **Auto-disable**: Toggle alerts on/off without deleting

---

## 🔒 Security

- JWT tokens with configurable expiry
- bcrypt password hashing (salt rounds: 12)
- Rate limiting (100 req/15min general, 5 req/15min auth)
- CORS protection with whitelist
- Device token validation on every data publish
- Role-based access control (admin/user)

---

## 🌍 Use Cases

- 🌱 **Smart Agriculture** — Soil moisture, temperature, humidity
- 🔥 **Fire Monitoring** — Smoke, gas, temperature alerts
- 🏭 **Industrial Safety** — Gas leaks, carbon emission tracking
- 🌿 **Environmental Monitoring** — Air quality, CO2 levels
- ⚡ **Energy Monitoring** — Voltage, current, power consumption

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router, Recharts, React Grid Layout |
| Backend | Node.js, Express.js, Socket.io |
| Database | MongoDB with Mongoose |
| Auth | JWT, bcrypt |
| Real-time | WebSocket (Socket.io) |
| Styling | CSS Variables, Custom CSS |
| Icons | Lucide React |
| Deployment | Docker, Docker Compose, nginx |

---

## 📝 License

MIT License — Free to use for personal and commercial projects.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
