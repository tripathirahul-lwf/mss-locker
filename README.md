# Vault Ledger - Locker Management System (PWA)

A production-grade Progressive Web App (PWA) designed for safe-deposit locker businesses managing **1,484 lockers**, sizes **A through G2**, physical rack mappings, dual-custody access, and offline-capable counter operations.

---

## 🏛️ System Architecture

```text
locker-management/
│
├── frontend/                     # React + TypeScript + Vite + Tailwind CSS + PWA
│   ├── public/                   # Static assets, PWA icons, favicon
│   │   ├── icons/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/           # NetworkStatusBadge, StatCard, SystemHealthCard, ErrorBoundary
│   │   │   ├── layout/           # AppLayout, Sidebar, TopHeader
│   │   │   └── ui/               # Button, Card, Badge, Input, Avatar, Separator
│   │   ├── constants/            # Navigation structure, sizes, system constants
│   │   ├── hooks/                # useNetworkStatus, custom hooks
│   │   ├── lib/                  # utils (cn), Dexie.js offline DB schema
│   │   ├── pages/                # DashboardPage, PlaceholderPage, OfflinePage, NotFoundPage
│   │   ├── routes/               # AppRouter (React Router configuration)
│   │   ├── services/             # Axios apiClient, healthService
│   │   └── types/                # Centralized TypeScript declarations
│   ├── .env.example              # Frontend environment variables
│   ├── vite.config.ts            # Vite + PWA Manifest + Service Worker
│   └── package.json
│
├── backend/                      # Node.js + Express + TypeScript + Mongoose
│   ├── src/
│   │   ├── config/               # Zod env validation, MongoDB connection manager
│   │   ├── controllers/          # healthController, future business controllers
│   │   ├── middlewares/          # errorHandler, notFoundHandler, rateLimiter, requestLogger
│   │   ├── models/               # Mongoose schemas (placeholder index)
│   │   ├── routes/               # Central API router, healthRoutes
│   │   ├── services/             # healthService
│   │   ├── types/                # Express & API interfaces
│   │   ├── utils/                # logger, apiResponse helpers
│   │   ├── validators/           # Zod request validators
│   │   ├── app.ts                # Express application setup (Helmet, CORS, Rate-limit)
│   │   └── server.ts             # Server entrypoint with graceful shutdown
│   ├── .env.example              # Backend environment variables
│   └── package.json
│
└── README.md
```

---

## 🚀 Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS (Slate/Zinc enterprise banking palette)
- **UI Architecture**: shadcn/ui design patterns with 44px min touch targets for counter tablets
- **Routing**: React Router (v7)
- **State & Data Fetching**: TanStack Query (v5)
- **PWA & Offline**: `vite-plugin-pwa`, Web App Manifest, Service Workers, `Dexie.js` (IndexedDB)
- **HTTP Client**: Axios with centralized base URL and interceptors
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB Atlas (via Mongoose)
- **Validation**: Zod (environment & request payload validation)
- **Security**: Helmet, CORS, Express Rate Limit, Bcrypt, JWT architecture
- **Logging**: Morgan & structured console logger

---

## 📋 Environment Configuration

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### Backend (`backend/.env`)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/vault_ledger?retryWrites=true&w=majority
JWT_ACCESS_SECRET=your_super_secret_jwt_access_key_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_jwt_refresh_key_min_32_chars
CLIENT_URL=http://localhost:5173
```

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or pnpm or yarn
- MongoDB instance (local or MongoDB Atlas connection string)

### 2. Backend Setup
```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create .env from example
cp .env.example .env

# Start development server with auto-reload (port 5000)
npm run dev
```

### 3. Frontend Setup
```bash
# In a separate terminal, navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env from example
cp .env.example .env

# Start Vite dev server (port 5173)
npm run dev
```

The application will be accessible at:
- **Frontend Dashboard**: `http://localhost:5173`
- **Backend Health Check**: `http://localhost:5000/api/health`

---

## 🔍 Verification & Build Commands

### Backend Checks
```bash
cd backend
npm run type-check   # Type verification
npm run build        # Build TypeScript to dist/
npm run start        # Run production server
```

### Frontend Checks
```bash
cd frontend
npm run type-check   # Type verification
npm run build        # Build Vite bundle & generate PWA assets
npm run preview      # Preview production build locally
```

---

## 📡 API Health Endpoint

### `GET /api/health`
**Sample Response**:
```json
{
  "success": true,
  "message": "Locker Management API is running",
  "version": "1.0.0",
  "timestamp": "2026-08-26T17:00:00.000Z",
  "uptime": 142,
  "environment": "development",
  "database": {
    "status": "connected",
    "readyState": 1,
    "host": "cluster0.mongodb.net",
    "name": "vault_ledger"
  }
}
```

---

## 🌐 Production Deployment Guide

### 1. Frontend (Vercel)
1. Import repository on **Vercel**.
2. Set **Root Directory** to `frontend`.
3. Set **Framework Preset** to `Vite`.
4. Configure Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-backend.onrender.com/api`
5. Deploy.

### 2. Backend (Render)
1. Create a new **Web Service** on **Render**.
2. Set **Root Directory** to `backend`.
3. Set **Runtime** to `Node`.
4. Set **Build Command**: `npm install && npm run build`
5. Set **Start Command**: `npm start`
6. Add Environment Variables:
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `<Your MongoDB Atlas Connection String>`
   - `JWT_ACCESS_SECRET`: `<Secure 32+ character key>`
   - `JWT_REFRESH_SECRET`: `<Secure 32+ character key>`
   - `CLIENT_URL`: `https://your-frontend.vercel.app`

### 3. Database (MongoDB Atlas)
1. Create a cluster on **MongoDB Atlas**.
2. Whitelist Render outbound IPs (or `0.0.0.0/0` with secure username/password).
3. Copy the standard connection string into the `MONGODB_URI` environment variable.

---

## 📱 Progressive Web App (PWA) Features
- **Installable**: Installable to Android, iOS, Windows, macOS, and iPad/Tablet home screens.
- **Offline Shell**: Pre-cached shell via Workbox with fallback `/offline` page.
- **Live Network Monitor**: Automatic online/offline status bar & reconnection trigger.
- **IndexedDB Ready**: Dexie.js database configured for offline transactions and cache storage.

---

## Production operations

Core financial and lifecycle workflows require a MongoDB replica set. Payments are manual counter entries only; no payment gateway integration is present. Before deployment, follow the environment, rollout, backup/restore, security, reconciliation, and incident-response checklist in [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md).
