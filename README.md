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

## Phase Plan

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Auth, invitations, family CRUD, persons |
| 2 | 🔜 | Tree visualization, relationships, Indian/Intl toggle |
| 3 | 🔜 | Edit proposals, audit log, notifications |
| 4 | 🔜 | Tree merging, super admin, photo uploads |
| 5 | 🔜 | Polish, security hardening, production deploy |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full data model, API docs, and tech stack details.
