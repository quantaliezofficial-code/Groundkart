# GroundBooking — Getting Started Guide

A plain-language walkthrough for getting the project running on your own
machine: backend, frontend, your first admin login, and how to tell
everything actually works.

This assumes zero prior setup. If something here doesn't match what you
see on screen, check the **Troubleshooting** section near the end before
anything else — most first-time hiccups are already answered there.

---

## 1. What you need installed first

| Tool | Version | Why |
|---|---|---|
| Python | 3.12 | Runs the backend (FastAPI) |
| PostgreSQL | 16 | The only database this uses — no SQLite, no Redis |
| Node.js | 18 or newer | Runs the frontend (React + Vite) |

Quick way to check what you already have:

```bash
python3 --version
psql --version
node --version
```

If PostgreSQL isn't installed yet:

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo service postgresql start
```

---

## 2. Backend setup

All commands below are run from the backend project's root folder (the
one containing `app/`, `alembic/`, `requirements.txt`).

### 2.1 Create the database

The backend needs a database user and two databases: one for normal use,
one for running tests.

```bash
sudo -u postgres psql -c "CREATE ROLE groundbooking WITH LOGIN PASSWORD 'devpassword' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE groundbooking OWNER groundbooking;"
sudo -u postgres psql -c "CREATE DATABASE groundbooking_test OWNER groundbooking;"
```

> Using a different password or database name? That's fine — just make
> sure it matches what you put in `.env` in the next step.

### 2.2 Set up your environment file

```bash
cp .env.example .env
```

Open `.env` and take a look. The defaults work for local development
as-is. A few worth knowing about:

| Variable | What it controls |
|---|---|
| `DATABASE_URL` | Where the backend connects — must match what you created in 2.1 |
| `JWT_SECRET_KEY` | Signs login tokens — the example value is fine for local use, never for a real deployment |
| `BOOKING_HOLD_DURATION_MINUTES` | How long a booking holds its slot before payment is due |
| `HOLD_SWEEP_INTERVAL_MINUTES` | How often the background job checks for and releases expired holds (default: every 5 minutes) |

### 2.3 Install Python dependencies

```bash
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
```

### 2.4 Run the database migrations

This creates all the actual tables. Run it against **both** databases —
the normal one and the test one:

```bash
./venv/bin/alembic upgrade head

DATABASE_URL="postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking_test" \
  ./venv/bin/alembic upgrade head
```

### 2.5 Start the backend

```bash
./venv/bin/uvicorn app.main:app --reload --port 8000
```

Leave this running in its own terminal. To check it's alive, open a
second terminal and run:

```bash
curl http://localhost:8000/healthz
```

You should see a simple OK-style response. If you get a connection
error instead, see **Troubleshooting**.

---

## 3. Frontend setup

⚠️ **Important:** if you unzipped a folder that contains both a plain
`frontend/` folder *and* a `frontend/frontend_deliver/` folder inside it,
always work inside **`frontend_deliver`**. The outer folder is an old,
unused copy — running from the wrong one is the single most common way
to get confused early on, since it looks almost identical but has none of
the real functionality wired up.

All commands below are run from inside `frontend_deliver/`.

### 3.1 Point the frontend at your backend

```bash
cp .env.example .env
```

The default (`VITE_API_URL=http://localhost:8000`) already matches the
backend setup above, so you usually don't need to change anything here.

### 3.2 Install and run

```bash
npm install
npm run dev
```

This starts the frontend at **http://localhost:3000**. Open that in your
browser — with the backend also running, you should see the app itself,
not an error page.

---

## 4. Creating your first admin account

There's no sign-up form for admins — by design, nobody can make
themselves an admin through the app. The very first admin has to be
created directly in the database. Run this once, with the backend's
virtual environment active:

```bash
./venv/bin/python3 -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.core import User
from app.modules.auth.security import hash_password

async def main():
    engine = create_async_engine('postgresql+asyncpg://groundbooking:devpassword@localhost:5432/groundbooking')
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        async with session.begin():
            admin = User(
                name='Admin',
                email='admin@example.com',
                password_hash=hash_password('changeme123'),
                role='admin',
            )
            session.add(admin)
    print('Admin account created: admin@example.com / changeme123')

asyncio.run(main())
"
```

Change the email and password to whatever you want before running it.
Once created, log in through the normal login screen in the app with
those credentials — you'll land straight in the Admin Dashboard.

Everyday customers and venue owners *do* use the normal sign-up flow in
the app — this manual step is only ever needed for the first admin.

---

## 5. Checking everything actually works

### Backend tests

```bash
./venv/bin/python -m pytest tests/ -q
```

You should see every test pass, ending in a line like `223 passed`.

### Frontend tests

```bash
npm test
```

You should see every test file pass.

### A full manual check

With both servers running:
1. Sign up as a regular customer through the app, browse a venue, make a
   booking.
2. Log in as the admin account you created above.
3. In the Admin Dashboard's **Bookings** tab, find that booking (it'll be
   "Pending payment") and confirm its payment.
4. Check the **Overview** tab — the booking counts should reflect it.

If all four steps work, your setup is good.

---

## 6. A quick tour of the Admin Dashboard

Once logged in as an admin, you'll see six tabs:

- **Overview** — platform totals (bookings, revenue, commission) and a
  recent activity log.
- **Approval Queue** — new venue listings and new owner sign-ups waiting
  for a yes/no.
- **Venues** — every venue on the platform; suspend, reactivate, or
  adjust pricing.
- **Users** — every account on the platform; suspend or reactivate.
- **Bookings** — every booking; confirm payments, cancel stale ones, and
  jump straight to a specific booking by pasting its ID. There's also a
  "Sweep expired holds now" button — though this also happens
  automatically in the background every few minutes, so you shouldn't
  usually need it.
- **Payouts** — run and mark-as-paid payouts owed to venue owners.

Every action an admin takes here also sends the affected owner or user an
in-app notification (the bell icon in the header) — they don't need to be
told separately that something changed.

---

## 7. Troubleshooting

**`psql: command not found` or PostgreSQL won't start**
It's likely not installed yet — see section 1. If it's installed but
won't start: `sudo service postgresql start`.

**Backend won't start: `ModuleNotFoundError`**
You're probably not running it through the virtual environment. Use
`./venv/bin/uvicorn ...` and `./venv/bin/pip ...`, not the bare `uvicorn`/
`pip` commands, unless you've activated the venv first with
`source venv/bin/activate`.

**Backend won't start: something about the database connection**
Double check `DATABASE_URL` in `.env` matches the role/database you
actually created in section 2.1, and that PostgreSQL is running.

**Tests fail with a database error**
Make sure you ran the migrations against **both** databases (section
2.4) — it's an easy step to do once and forget to repeat for the test
database.

**The frontend loads but nothing works / every request fails**
Check the backend is actually running (`curl http://localhost:8000/healthz`)
and that the frontend's `.env` has the right `VITE_API_URL`.

**The app looks like an old/incomplete version, or the Admin dashboard
looks totally different from the tour above**
You're very likely running the code from the wrong frontend folder — see
the warning at the top of section 3.

**I can't sign up as an admin**
That's expected — see section 4. Regular sign-up always creates a
customer account; the first admin has to be created directly in the
database.

---

## 8. Where to go from here

- **`README.md`** (backend root) — the full technical reference: every
  API route, every business decision made and why, what's deliberately
  not built yet.
- **`handoff.md`** (both repos, same content in each) — a running log of
  what's been built session by session, including open questions nobody's
  answered yet (a few real business numbers are still placeholders) and
  known rough edges.

If you're picking this project up to keep building on it, `handoff.md` is
the one to read first — it's written specifically to bring a new session
up to speed without any other context.
