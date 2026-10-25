# GroundKart

> Next-generation sports venue, turf, and facility booking platform.

GroundKart is a full-stack, enterprise-grade multi-persona venue reservation and management platform built for players, facility owners, and platform administrators.

---

## 🌟 Key Features

- **Player & Customer Experience**
  - Instant discovery and search with sport type, location, and price filters.
  - Real-time slot availability, pricing breakdown, and booking holds.
  - Transparent payment and refund handling with offline and digital flows.
  - Support ticket system and responsive customer dashboard.

- **Venue Owner Workspace**
  - Multi-step venue onboarding & listing builder (identity, location, sports, pricing, media).
  - Slot scheduling, calendar management, and custom booking rules.
  - Bank account verification, revenue tracking, and payout status monitoring.

- **Platform Administration**
  - Owner KYC and venue verification workflows.
  - Double-entry ledger compliance and automated payout management.
  - Database studio, system health monitoring, and audit log tracking.
  - Dynamic homepage curation and platform configuration management.

- **Enterprise Reliability & Architecture**
  - **Idempotency Guard**: Distributed intention keys preventing double-booking and payment collisions.
  - **Concurrency & Overlap Protection**: Strict transactional isolation with pessimistic row-level locking.
  - **Security & Hardening**: Rate limiting, strict CORS, CSP headers, and authenticated role-based access.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.12+, FastAPI, SQLAlchemy 2.0 (AsyncIO), Alembic, Pydantic v2, PostgreSQL / SQLite (test) |
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS v4, TanStack Query, Framer Motion, Lucide Icons |
| **Testing & QA** | Pytest, Vitest, Playwright E2E, Axe-core Accessibility |

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** & **npm**
- **PostgreSQL 14+** (for production / full development)

### 1. Clone & Configure

```bash
git clone https://github.com/quantaliezofficial-code/Groundkart.git
cd Groundkart
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Run database migrations
alembic upgrade head

# Start development API server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start development server
npm run dev
```

The frontend will be accessible at `http://localhost:3000` and the API documentation at `http://localhost:8000/docs`.

### 4. Windows One-Click Start

If developing on Windows, you can start both frontend and backend concurrently using:

```cmd
start.bat
```

---

## 🧪 Testing & Verification

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Unit & Component Tests
```bash
cd frontend
npm test
```

### End-to-End (E2E) Browser Tests
```bash
cd frontend
npm run test:e2e
```

---

## 📚 Documentation

Comprehensive project documentation is available in the [`docs/`](docs/README.md) directory:

- [Project Overview & Architecture](docs/01-overview/PROJECT_OVERVIEW.md)
- [Technical Architecture](docs/04-architecture-and-design/TECHNICAL_ARCHITECTURE.md)
- [API & Data Model Reference](docs/05-api-and-data/API_AND_DATA_MODEL.md)
- [User Guide & Workflows](docs/03-features-and-user-guides/USER_GUIDE.md)
- [Security & Compliance](docs/10-security-and-reliability/SECURITY_AND_PERMISSIONS.md)
- [Full Website Feature Documentation](docs/website-documentation/WEBSITE_FEATURE_DOCUMENTATION.md)

---

## 📄 License

ISC License. See LICENSE for details.
