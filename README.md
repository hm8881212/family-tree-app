# Family Tree Web App

Community family tree app for small Indian communities. Invite-only, admin-controlled edits, Indian/International relationship names, tree merging, and full audit trail.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **Auth:** JWT (httpOnly cookies) + argon2id

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Clone & install

```bash
# Server
cd server && npm install

# Client
cd ../client && npm install
```

### 2. Configure environment

```bash
cp .env.example server/.env
# Edit server/.env with your values
```

### 3. Create database & run migrations

```bash
createdb family_tree
cd server && npm run db:migrate
```

### 4. Run dev servers

```bash
# Terminal 1 - Server (port 4000)
cd server && npm run dev

# Terminal 2 - Client (port 5173)
cd client && npm run dev
```

Visit http://localhost:5173

## Deploy to Railway + Neon

### Prerequisites
- [Railway](https://railway.app) account
- [Neon](https://neon.tech) PostgreSQL database

### Steps

1. **Create Neon database** and copy the connection string.

2. **Set environment variables in Railway** (from `.env.example`):
   ```
   DATABASE_URL=<neon-connection-string>
   JWT_SECRET=<random-64-char-hex>
   JWT_REFRESH_SECRET=<random-64-char-hex>
   NODE_ENV=production
   FRONTEND_URL=https://<your-railway-domain>
   ```
   Generate secrets: `openssl rand -hex 64`

3. **Deploy**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```
   Railway auto-detects the `railway.toml` and builds with Docker.

4. **Run migrations** (first deploy only):
   ```bash
   railway run cd server && npm run db:migrate
   ```

5. **Set custom domain** in Railway dashboard if desired.

### Docker (self-hosted)

```bash
cd app
docker build -t family-tree .
docker run -p 4000:4000 -e DATABASE_URL=... -e JWT_SECRET=... family-tree
```

## Phase Plan

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Auth, invitations, family CRUD, persons |
| 2 | ✅ Done | Tree visualization, relationships, Indian/Intl toggle |
| 3 | ✅ Done | Edit proposals, audit log, notifications |
| 4 | ✅ Done | Tree merging, super admin, photo uploads |
| 5 | 🔄 In progress | Polish, mobile, search, PNG export, deploy |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full data model, API docs, and tech stack details.
