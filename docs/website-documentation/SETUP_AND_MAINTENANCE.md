# GroundKart / GroundBooking — Setup, Maintenance & Operations Guide

This guide details the exact steps required for a developer, DevOps engineer, or system administrator to install, configure, seed, test, and deploy GroundKart.

---

## 1. System Prerequisites

Before starting, ensure the host machine or container satisfies the following requirements:

| Component | Minimum Version | Verified Version | Notes |
|---|---|---|---|
| **Operating System** | Windows 10/11, macOS 14+, Linux | Windows 11 / Ubuntu 22.04 | Monorepo works across Windows PowerShell and Unix Bash. |
| **Python** | `3.11.0` | `3.11.9+` | Required for backend FastAPI, asyncpg, and SQLAlchemy 2.0. |
| **Node.js** | `20.0.0` (LTS) | `22.x+` | Required for frontend build tooling and Vite. |
| **NPM** | `10.0.0+` | `10.9.x` | Package manager for frontend dependencies. |
| **PostgreSQL** | `15.0+` | `16.x` | Relational database with support for `FOR UPDATE SKIP LOCKED`. |

---

## 2. Step-by-Step Local Setup

### 2.1 Clone Repository
```powershell
git clone <repository-url> groundbooking
cd groundbooking
```

### 2.2 Backend Environment & Dependencies
1. Navigate to the backend directory:
   ```powershell
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```powershell
   # Windows PowerShell
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install locked dependencies to guarantee exact package versions:
   ```powershell
   pip install -r requirements.lock.txt
   ```
4. Configure local environment variables:
   ```powershell
   cp .env.example .env
   ```
   Edit `.env` to configure your local PostgreSQL database connection string:
   ```env
   DATABASE_URL=postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking
   JWT_SECRET_KEY=dev-only-not-for-production-CHANGE-ME
   ENVIRONMENT=dev
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   PUBLIC_APP_URL=http://localhost:3000
   APP_BASE_URL=http://localhost:8000
   ```

### 2.3 Database Migration & Dataset Seeding
1. Apply all database schema migrations to the latest revision:
   ```powershell
   alembic upgrade head
   ```
2. Seed the comprehensive demo dataset (14 venues, 10 customers, 5 owners, reviews, and test scenarios):
   ```powershell
   python scripts/seed_dataset.py --yes-this-is-dev
   ```

### 2.4 Frontend Environment & Dependencies
1. Open a new terminal and navigate to the frontend directory:
   ```powershell
   cd ../frontend
   ```
2. Install dependencies cleanly from the lockfile:
   ```powershell
   npm ci
   ```
3. Configure frontend environment variables:
   ```powershell
   cp .env.example .env
   ```
   Ensure the API target points to your local backend:
   ```env
   VITE_API_URL=http://localhost:8000/api/v1
   ```

---

## 3. Running Development Servers

### Option A: One-Click Startup Script (Windows)
From the repository root, run:
```cmd
start.bat
```
This launches two separate command prompt windows:
- Backend: `http://localhost:8000` (FastAPI with auto-reload)
- Frontend: `http://localhost:3000` (Vite dev server)
- Interactive API Docs: `http://localhost:8000/docs`

### Option B: Manual Startup
- **Terminal 1 (Backend):**
  ```powershell
  cd backend
  .\venv\Scripts\activate
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ```
- **Terminal 2 (Frontend):**
  ```powershell
  cd frontend
  npm run dev
  ```

---

## 4. Test Execution & Verification

### Running Backend Pytest Suite
The backend test suite runs with an isolated PostgreSQL database:
```powershell
cd backend
.\venv\Scripts\activate
pytest -v
```
*Expected Result:* **397 passed** across 51 test suites (100% passing).

### Running Frontend Vitest Suite
```powershell
cd frontend
npm test
```
*Expected Result:* All core suites pass (**98 tests passed** in standard run).

### Running Production Build
To verify that the frontend compiles cleanly without TypeScript errors:
```powershell
cd frontend
npm run build
```
Generates production-optimized static bundles into `frontend/dist/`.

---

## 5. Seeded Test Credentials

When `seed_dataset.py` is executed, the following pre-configured test accounts are ready for use:

| Role | Email / Login | Password | Capabilities |
|---|---|---|---|
| **Administrator** | `admin@groundkart.demo` | `Admin@2026!` | Full platform governance, approval queues, payments, payouts, health checks. |
| **Venue Owner** | `anita.srivastava@groundkart.demo` | `Demo@2026!` | Verified owner managing Gomti Greens and Nawabi Mahal venues. |
| **Customer** | `arjun.kumar@groundkart.demo` | `Demo@2026!` | Customer account with active reservation history and review privileges. |

---

## 6. Production Deployment Safeguards

GroundKart includes built-in configuration validation in `backend/app/config.py`. When `ENVIRONMENT=prod` or `ENVIRONMENT=production`:
1. **JWT Secret Protection:** Application immediately crashes if `JWT_SECRET_KEY` equals the dev placeholder or is shorter than 32 characters.
2. **Database Protection:** Application refuses to start if `DATABASE_URL` contains default dev credentials or points to localhost.
3. **CORS Validation:** Every allowed origin must explicitly start with `https://` and cannot contain `localhost` or `127.0.0.1`.
4. **Public App URL Validation:** `PUBLIC_APP_URL` must use `https://` and point to the real domain to prevent generating invalid password reset links.
