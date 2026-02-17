# 🚀 IoT Dashboard Deployment Guide

This guide walks you through deploying the IoT Dashboard to the cloud for **FREE** using:
- **GitHub** – Code hosting
- **MongoDB Atlas** – Free cloud database (512MB free)
- **Render** – Backend hosting (free tier)
- **Netlify** – Frontend hosting (free tier)

---

## 📋 Prerequisites

- GitHub account: https://github.com
- MongoDB Atlas account: https://www.mongodb.com/atlas
- Render account: https://render.com
- Netlify account: https://netlify.com

---

## Step 1: Push Code to GitHub

1. Go to https://github.com/new and create a new repository named `iot-dashboard`
2. Run these commands in your project folder:

```bash
git remote add origin https://github.com/YOUR_USERNAME/iot-dashboard.git
git branch -M main
git push -u origin main
```

---

## Step 2: Set Up MongoDB Atlas (Free Cloud Database)

1. Go to https://www.mongodb.com/atlas and sign up/login
2. Click **"Build a Database"** → Choose **FREE (M0 Sandbox)**
3. Select a cloud provider (AWS) and region closest to you
4. Click **"Create Cluster"**
5. Set up database access:
   - Click **"Database Access"** → **"Add New Database User"**
   - Username: `iotadmin`
   - Password: Generate a secure password (save it!)
   - Role: **Atlas Admin**
6. Set up network access:
   - Click **"Network Access"** → **"Add IP Address"**
   - Click **"Allow Access from Anywhere"** (0.0.0.0/0)
7. Get your connection string:
   - Click **"Connect"** → **"Connect your application"**
   - Copy the URI: `mongodb+srv://iotadmin:<password>@cluster0.xxxxx.mongodb.net/iot_dashboard`
   - Replace `<password>` with your actual password

---

## Step 3: Deploy Backend to Render

1. Go to https://render.com and sign up/login with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository `iot-dashboard`
4. Configure the service:
   - **Name**: `iot-dashboard-api`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Plan**: Free
5. Add Environment Variables (click "Advanced" → "Add Environment Variable"):

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | `mongodb+srv://iotadmin:PASSWORD@cluster0.xxxxx.mongodb.net/iot_dashboard` |
   | `JWT_SECRET` | `your_super_secret_jwt_key_change_this_in_production_2024` |
   | `JWT_EXPIRE` | `7d` |
   | `CLIENT_URL` | `https://your-app.netlify.app` (update after Netlify deploy) |
   | `RATE_LIMIT_WINDOW` | `15` |
   | `RATE_LIMIT_MAX` | `100` |

6. Click **"Create Web Service"**
7. Wait for deployment (2-5 minutes)
8. Copy your Render URL: `https://iot-dashboard-api.onrender.com`

---

## Step 4: Deploy Frontend to Netlify

1. Go to https://netlify.com and sign up/login with GitHub
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect GitHub → Select `iot-dashboard` repository
4. Configure build settings:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/build`
5. Add Environment Variables (Site settings → Environment variables):

   | Key | Value |
   |-----|-------|
   | `REACT_APP_API_URL` | `https://iot-dashboard-api.onrender.com/api` |
   | `REACT_APP_SOCKET_URL` | `https://iot-dashboard-api.onrender.com` |
   | `CI` | `false` |

6. Click **"Deploy site"**
7. Wait for deployment (2-5 minutes)
8. Your app will be live at: `https://random-name.netlify.app`

---

## Step 5: Update CORS on Render

After getting your Netlify URL, go back to Render:
1. Open your `iot-dashboard-api` service
2. Go to **Environment** tab
3. Update `CLIENT_URL` to your Netlify URL: `https://your-app.netlify.app`
4. Click **"Save Changes"** – Render will auto-redeploy

---

## ✅ Verification

After deployment, test these URLs:
- **Backend Health**: `https://iot-dashboard-api.onrender.com/api/health`
- **Frontend**: `https://your-app.netlify.app`

---

## 🔄 Auto-Deploy on Push

Both Render and Netlify automatically redeploy when you push to GitHub:
```bash
git add .
git commit -m "Update feature"
git push origin main
```

---

## 📱 Local Development

To run locally:
```bash
# Terminal 1 - Backend
cd server
npm install
npm start

# Terminal 2 - Frontend  
cd client
npm install
npm start
```

Access at: http://localhost:3000

---

## 🔧 Troubleshooting

### Backend not connecting to MongoDB
- Check MongoDB Atlas Network Access allows 0.0.0.0/0
- Verify the connection string has correct password
- Check Render logs for error messages

### Frontend can't reach backend
- Verify `REACT_APP_API_URL` environment variable on Netlify
- Check CORS settings on Render (`CLIENT_URL` must match Netlify URL)
- Ensure Render service is not sleeping (free tier sleeps after 15 min inactivity)

### Render free tier note
- Free tier services sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- Consider upgrading to paid tier for production use

---

## 🌐 Custom Domain (Optional)

### Netlify Custom Domain:
1. Go to Site settings → Domain management
2. Click "Add custom domain"
3. Follow DNS configuration instructions

### Render Custom Domain:
1. Go to your service → Settings → Custom Domains
2. Add your domain and configure DNS

---

## 📊 Architecture Overview

```
[ESP32/ESP8266] → HTTPS → [Render Backend API]
                              ↕ WebSocket
[MongoDB Atlas] ←→ [Render Backend] ←→ [Netlify Frontend]
```

---

*Generated for IoT Dashboard Platform v1.0.0*
