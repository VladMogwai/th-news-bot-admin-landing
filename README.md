# TG News Bot — Admin Panel

Standalone React + Node.js admin panel for the Telegram News Bot.
Shares the same Supabase PostgreSQL database as the bot. Deployed as a single Railway service.

---

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18 + Vite + TailwindCSS + React Router |
| Backend  | Node.js + Express + Prisma ORM |
| Auth     | JWT (access token in memory) + httpOnly refresh cookie |
| DB       | Existing Supabase PostgreSQL (shared with bot) |
| Deploy   | Railway (one service — Express serves the React build) |

---

## Local Dev Setup

### 1. Clone & install

```bash
git clone https://github.com/VladMogwai/th-news-bot-admin-landing.git
cd th-news-bot-admin-landing

npm install                  # installs server deps
npm install --prefix client  # installs client deps
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `DATABASE_URL` — your Supabase connection string (same one the bot uses)
- `JWT_SECRET` — random 64-char string (`openssl rand -hex 32`)
- `JWT_REFRESH_SECRET` — another random 64-char string

### 3. Create the admins table

```bash
npx prisma migrate deploy
```

> This only creates the `admins` table. Existing bot tables are not touched.

### 4. Create first admin

```bash
npm run create-admin
```

Follow the prompts to enter username and password.

### 5. Run dev servers

In two terminals:

```bash
# Terminal 1 — Express API (port 8080)
npm run dev:server

# Terminal 2 — Vite React (port 5173, proxies /api → 8080)
npm run dev:client
```

Open http://localhost:5173

---

## npm run create-admin

Interactive CLI to create an admin user in the database.

```bash
npm run create-admin

# Output:
# ── Create Admin User ──────────────────────
# Username: admin
# Password: ••••••••
# Admin "admin" created successfully ✓
```

Run this after `prisma migrate deploy` and before the first login.
You can run it multiple times to add more admins.

---

## Railway Deployment

### Step 1 — Connect repository

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select `th-news-bot-admin-landing`

### Step 2 — Set environment variables

In the Railway dashboard → Variables, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Supabase connection string (same as the bot) |
| `JWT_SECRET` | Random 64-char string |
| `JWT_REFRESH_SECRET` | Another random 64-char string |
| `NODE_ENV` | `production` |
| `VITE_API_URL` | `/api` |

> **Important:** Use the **existing Supabase DATABASE_URL** from the bot.
> Do NOT create a new Railway Postgres database.

### Step 3 — Deploy

Railway reads `railway.toml` automatically:
- **Build:** `npm install && npm run build` (generates Prisma client + builds Vite)
- **Start:** `npx prisma migrate deploy && node server/index.js`

The migration runs on every deploy (idempotent — safe to run repeatedly).

### Step 4 — Create first admin

After the first deploy, open a Railway shell or run locally with the production `DATABASE_URL`:

```bash
DATABASE_URL="your-supabase-url" npm run create-admin
```

---

## Project Structure

```
/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── api/axios.js     # Axios instance with JWT interceptor
│   │   ├── context/         # AuthContext (token in memory)
│   │   ├── components/      # Sidebar, Layout, Spinner, PrivateRoute
│   │   └── pages/           # Login, Dashboard, Sources, Settings
│   └── vite.config.js
│
├── server/
│   ├── prisma/
│   │   ├── schema.prisma    # Maps existing bot tables + adds `admins`
│   │   └── migrations/      # Only migration: create admins table
│   ├── routes/              # auth, stats, sources, settings
│   ├── middleware/auth.js   # JWT verification
│   ├── index.js             # Express entry point
│   └── createAdmin.js       # CLI to create admin users
│
├── package.json             # Root — server deps + build scripts
├── railway.toml
└── .env.example
```

---

## Auth Flow

1. On app load → `POST /api/auth/refresh` (uses httpOnly cookie) → restores session silently
2. Login → `POST /api/auth/login` → access token (15min) stored in React memory, refresh token (7d) in httpOnly cookie
3. Access token auto-refreshes every 14 minutes via `setTimeout`
4. Logout → `POST /api/auth/logout` → clears cookie
