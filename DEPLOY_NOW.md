# 🚀 DEPLOY BACKEND NOW - Step by Step

Your code is on GitHub: https://github.com/SauradipDinda/nexus-iot

## STEP 1: Create Free MongoDB Atlas Database (5 minutes)

1. Go to: https://cloud.mongodb.com/
2. Sign up / Log in with Google
3. Click **"Build a Database"** → Choose **FREE (M0)**
4. Select **AWS** → Region: **Mumbai (ap-south-1)** or closest to you
5. Cluster name: `nexus-iot-db` → Click **"Create"**
6. **Security Quickstart:**
   - Username: `nexusiot`
   - Password: Click "Autogenerate" → **COPY THE PASSWORD**
   - Click "Create User"
7. **Network Access:** Click "Add IP Address" → **"Allow Access from Anywhere"** (0.0.0.0/0) → Confirm
8. Click **"Connect"** → **"Drivers"** → Copy the connection string
   - It looks like: `mongodb+srv://nexusiot:<password>@nexus-iot-db.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   - Replace `<password>` with your actual password

## STEP 2: Deploy Backend to Render (5 minutes)

1. Go to: https://render.com/
2. Sign up / Log in with GitHub
3. Click **"New +"** → **"Web Service"**
4. Connect GitHub → Select **"SauradipDinda/nexus-iot"**
5. Configure:
   - **Name:** `nexus-iot-api`
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/index.js`
   - **Instance Type:** Free
6. Click **"Advanced"** → Add Environment Variables:
   ```
   NODE_ENV = production
   PORT = 10000
   MONGODB_URI = mongodb+srv://nexusiot:YOUR_PASSWORD@nexus-iot-db.xxxxx.mongodb.net/nexus_iot?retryWrites=true&w=majority
   JWT_SECRET = nexus-iot-super-secret-jwt-key-2024-production
   CLIENT_URL = https://marvelous-marigold-33a3e5.netlify.app
   ```
7. Click **"Create Web Service"**
8. Wait 3-5 minutes for deployment
9. **Copy your Render URL** (e.g., `https://nexus-iot-api.onrender.com`)

## STEP 3: Tell me your Render URL
After deployment, tell me the URL so I can update the frontend!
