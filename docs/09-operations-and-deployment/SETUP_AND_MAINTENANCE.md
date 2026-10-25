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
5. **Storage Configuration:** Warns or halts if `UPLOADS_DIR` points to an ephemeral `/tmp` folder instead of persistent or cloud storage.

---

## 7. Attaching a New Production Database

When publishing to production or attaching a brand-new, clean PostgreSQL database, GroundKart provides an automated, idempotent initialization and verification pipeline.

### 7.1 Automated Database Initialization
From the `backend/` directory, run:
```powershell
python scripts/init_production_db.py
```
*(Or add `--non-interactive` in CI/CD pipelines to bypass confirmation prompts).*

This script automatically executes:
1. **Alembic Schema Migrations:** Applies all schema migrations up to `HEAD`.
2. **Static Metadata Seeding:** Seeds standard categories, venue types, and use cases idempotently.
3. **System Configuration:** Generates the baseline `system_configurations` record (hold duration, cancellation policies, commission percentages).
4. **SuperAdmin Account Verification:** Detects if an active admin exists; if not, prompts or uses environment variables (`ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_PASSWORD`) to provision the primary admin account.
5. **Full Pre-Flight Verification Suite:** Validates the newly attached database before production traffic is routed.

### 7.2 Pre-Flight Production Readiness Check
To verify an existing production environment without modifying state:
```powershell
python scripts/verify_production_readiness.py --strict
```
This performs automated pre-flight checks:
- **Environment Secrets:** Asserts `JWT_SECRET_KEY` is not a default dev key and meets minimum entropy requirements.
- **Database Connectivity & Migrations:** Confirms live connection and ensures `alembic_version` matches the latest revision.
- **Table Integrity:** Verifies all 14 core tables (`users`, `venues`, `inventory_units`, `bookings`, `payments`, `payouts`, `ledger_entries`, `refunds`, `categories`, `venue_types`, `system_configurations`, etc.).
- **Admin Governance:** Confirms at least one active administrator account exists.
- **Upload Directory Permissions:** Tests that `UPLOADS_DIR` and `PRIVATE_UPLOADS_DIR` exist and are writable by the application process.

### 7.3 Deep Health Probe for Load Balancers & Kubernetes
The API provides two health probe endpoints:
- `GET /healthz` (Standard Kubernetes liveness/readiness probe)
- `GET /api/v1/health`

Both endpoints perform live runtime checks:
- Database connection (`SELECT 1`)
- Core schema tables existence (`users`, `venues`, `bookings`, `alembic_version`)
- Storage directory write ability

Returns `200 OK` when fully healthy, or `503 Service Unavailable` with detailed diagnosis if degraded or unmigrated.

---

## 8. Production Storage Configuration (Preventing Image Loss)

In local development, default storage points to temporary folders (`/tmp/groundkart-uploads`). When moving projects across drives or deploying to production containers, ephemeral `/tmp` storage will be erased on server reboot or drive relocation.

### Production Storage Best Practices:
1. **Persistent Mount (Local Disk / NAS):**
   Set an absolute path on a persistent volume in `.env`:
   ```env
   STORAGE_BACKEND=local
   UPLOADS_DIR=/var/data/groundkart/uploads
   PRIVATE_UPLOADS_DIR=/var/data/groundkart/private-uploads
   ```
2. **Cloud Object Storage (AWS S3 / Cloud Storage / Cloudflare R2):**
   Set S3 storage mode in `.env`:
   ```env
   STORAGE_BACKEND=s3
   S3_BUCKET_NAME=groundkart-production-media
   AWS_REGION=ap-south-1
   AWS_ACCESS_KEY_ID=your-access-key-id
   AWS_SECRET_ACCESS_KEY=your-secret-access-key
   ```
This guarantees that all venue images and verification documents remain persistent across deployments and migrations.

