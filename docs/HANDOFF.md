# GroundBooking / GroundKart — Engineering Handoff

> Authoritative project status, local setup instructions, test verification, product decisions, and operational reference.

---

## 1. Repository Layout

The project is structured as a unified monorepo:

```
groundbooking/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI matrix (PostgreSQL 16, backend pytest, frontend tsc/test/build)
├── backend/
│   ├── alembic/                 # Database migration versions and environment
│   ├── app/
│   │   ├── models/              # SQLAlchemy core models
│   │   ├── modules/             # Domain modules (auth, booking, catalog, admin, support, analytics, notifications)
│   │   ├── config.py            # Pydantic-based settings validated from environment
│   │   ├── db.py                # Database connection engines and session factories
│   │   └── main.py              # FastAPI application factory and route registrations
│   ├── tests/                   # Pytest test suite (352 passing tests)
│   │   ├── conftest.py          # PostgreSQL test fixtures with non-locking table cleaning
│   │   └── ...
│   ├── requirements.txt         # Human-managed top-level dependencies
│   ├── requirements.lock.txt    # Fully pinned, reproducible dependency lockfile for CI/CD
│   └── .env.example             # Example environment configuration for local development
├── frontend/
│   ├── public/                  # Static assets (favicon.svg, WebP heroes, og-image.png)
│   ├── src/                     # React 19 + TypeScript application source
│   │   ├── components/          # Reusable UI components, modals, listing builder, dashboard
│   │   ├── hooks/               # Custom React hooks (useVenues, useAdmin, useDebounce, etc.)
│   │   ├── types.ts             # Shared frontend type definitions
│   │   └── ...
│   ├── package.json             # NPM dependencies (runtime) and devDependencies (vite, tailwindcss, typescript)
│   ├── package-lock.json        # Committed lockfile for reproducible `npm ci`
│   ├── vite.config.ts           # Vite bundler configuration
│   └── .env.example             # Frontend environment variables example
├── design-assets/               # High-resolution raw source images kept outside the production bundle
└── docs/
    ├── HANDOFF.md               # This authoritative handoff document
    ├── BOOKING_LIFECYCLE.md     # Booking state machine specifications
    ├── SUPPORT_TICKETS.md       # Support ticket and audit logging specifications
    └── archive/                 # Historical phase summaries and previous milestone handoffs
```

---

## 2. Running Locally

### Prerequisites
- Python 3.12+
- Node.js 22+ (LTS) & npm
- PostgreSQL 16 running locally (or via Docker)

### Backend Setup
1. **Navigate to the backend directory and activate the virtual environment**:
   ```bash
   cd backend
   # Windows:
   venv\Scripts\activate
   # macOS / Linux:
   source venv/bin/activate
   ```
2. **Install locked dependencies**:
   ```bash
   pip install -r requirements.lock.txt
   ```
3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your local PostgreSQL credentials
   ```
4. **Apply database migrations**:
   ```bash
   alembic upgrade head
   ```
5. **Start development server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   API docs will be accessible at `http://localhost:8000/docs`.

### Frontend Setup
1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```
2. **Install dependencies cleanly from lockfile**:
   ```bash
   npm ci
   ```
3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Default: VITE_API_URL=http://localhost:8000/api/v1
   ```
4. **Start Vite development server**:
   ```bash
   npm run dev
   ```
   The client will be running at `http://localhost:5173`.

---

## 3. Environment Variables Reference

### Backend (`backend/.env.example`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL async connection string | `postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking` |
| `SECRET_KEY` | HMAC key for signing JWTs | Secure random string (min 32 chars) |
| `ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifespan | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifespan | `7` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated or JSON) | `http://localhost:5173,http://localhost:3000` |
| `APP_ENV` | Application environment | `development` / `production` |
| `PUBLIC_APP_URL` | Frontend canonical URL for links | `http://localhost:5173` |

### Frontend (`frontend/.env.example`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Target backend API endpoint prefix | `http://localhost:8000/api/v1` |

---

## 4. Tests & Quality Verification

### Test Verification Counts (Latest Green Run)
- **Backend (Pytest)**: **352 passed, 0 failed** (503.54s)
- **Frontend (Vitest)**: **79 passed across 15 test suites, 0 failed** (16.17s)
- **Frontend TypeScript (`npx tsc --noEmit`)**: **0 errors, clean check**
- **Production Build (`npm run build`)**: **Clean build, bundle size ~2.96 MB** (down from ~19 MB after converting hero images to WebP and moving raw PNGs to `design-assets/`).

### How to Run Tests
```bash
# Backend tests (from backend/ directory):
pytest -q

# Frontend tests (from frontend/ directory):
npm test

# Frontend typecheck & build (from frontend/ directory):
npx tsc --noEmit
npm run build
```

---

## 5. Open Product Decisions

The following product decisions are currently implemented using defensible, configurable defaults but require explicit business stakeholder sign-off:

1. **Hold Duration for Bookings (Decision Point B-1)**:
   - *Current Implementation*: 15 minutes by default, configurable dynamically via `SystemConfig` (`booking_hold_duration_minutes`).
   - *Decision Needed*: Final confirmation of customer reservation hold window for offline/online checkout.
2. **Customer Cancellation Refund Tiers (Decision Point C-7)**:
   - *Current Implementation*: Distance-from-event policy configured in settings:
     - > 48 hours before slot: **100% full refund** (`cancellation_full_refund_hours=48`).
     - 24 to 48 hours before slot: **50% partial refund** (`cancellation_partial_refund_hours=24`, `cancellation_partial_refund_percent=50`).
     - < 24 hours before slot: **0% refund** (slot is released, ₹0 refund issued).
   - *Decision Needed*: Business confirmation of tier cutoffs and percentage schedule for different venue categories (e.g., wedding venues vs. hourly sports turfs).
3. **Platform Commission Structure (Decision Point D-4)**:
   - *Current Implementation*: Platform fee percentage snapshot recorded on booking; default platform commission rate can be parameterized per owner or system-wide.
   - *Decision Needed*: Fixed fee per booking vs. variable commission tiering by owner volume.

---

## 6. Security Posture & Known Notes

- **Dependency Hygiene**:
  - `requirements.lock.txt` pins exact versions for all direct and transitive dependencies.
  - `package-lock.json` pins exact frontend dependencies. `vite` is strictly in `devDependencies`.
- **JWT Verification**:
  - `pyjwt` advisory regarding caller-controlled algorithm lists is mitigated: GroundBooking hardcodes `algorithms=["HS256"]` across all decoding paths.
- **Clean Packaging**:
  - For deployment or code sharing, avoid creating manual zips that might include local `.env` files or caches. Use:
    ```bash
    git archive --format=zip -o ../groundbooking-clean.zip HEAD
    ```
- **Automated CI**:
  - `.github/workflows/ci.yml` runs full backend migrations, backend pytest suite with a clean PostgreSQL service container, frontend `npm ci`, TypeScript validation, Vitest test suite, and Vite production bundle generation on every push and pull request.
