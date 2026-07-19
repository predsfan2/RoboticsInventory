# Robotics Inventory App

Full-stack inventory and accounting for robotics teams: track parts and kits, moves and borrows, purchases, and team finance.

**Stack:** React 18 + Vite + Tailwind · Node/Express · flat-file JSON database · Docker multi-stage image

| Doc | Audience |
|-----|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, data model, auth, API/frontend maps |
| [AGENTS.md](AGENTS.md) | AI/agent code index, edit recipes, customization cookbook |

---

## Repository map

```
.
├── backend/
│   ├── server.js          # Boot, auth middleware, route mounts, SPA serve
│   ├── routes/            # Express routers (items, moves, finance, admin, …)
│   └── utils/             # storage.js (JSON DB), migration.js
├── frontend/
│   └── src/
│       ├── App.jsx        # Auth/toast context, routes, permissions gates
│       ├── pages/         # Screen-level views (+ finance/ sub-tabs)
│       ├── components/    # Shared UI (Layout, Login, search, …)
│       ├── modals/        # Item/move/unit dialogs
│       └── lib/           # api.js, constants.js, permissions.js
├── seed-data.json         # Initial DB when data.json is missing
├── Dockerfile             # Build frontend → production Node image
└── docker-compose.yml     # Port 3000 + persistent data volume
```

---

## Quick Start (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker + Docker Compose (Linux)

### 1. Place project files

```
inventory-app/
  backend/
  frontend/
  seed-data.json
  Dockerfile
  docker-compose.yml
```

### 2. (Optional) Seed with existing data

If you have an existing `data.json` from a previous install, copy it into the project root and rename it `seed-data.json`. Migration runs automatically on first start and normalises legacy fields.

### 3. Fix line endings (Linux / WSL only)

If files were edited on Windows and you are deploying on Linux:

```bash
bash fix-line-endings.sh
```

### 4. Build and run

```bash
docker compose up -d
```

First build installs dependencies and compiles the frontend. Later starts reuse the cached image.

### 5. Open the app

```
http://localhost:3000
```

**First login:** credentials come from `seed-data.json`. On first start, migration converts legacy `pin` fields into `password`. Change passwords immediately via **Team** after first login.

---

## Development (without Docker)

### Backend

```bash
cd backend
npm install
npm run dev      # nodemon, hot-reload
# or
npm start        # plain node
```

Runs on **http://localhost:3001**. Data stored in `backend/data/data.json`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on **http://localhost:5173**. API and uploads are proxied to `:3001` via Vite.

### Build frontend for backend to serve

```bash
cd frontend
npm run build    # outputs to ../public/
```

Then the backend at `:3001` serves the built SPA from `/public`.

---

## Managing the container

| Task | Command |
|------|---------|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| View logs | `docker compose logs -f` |
| Rebuild after code change | `docker compose up -d --build` |
| Open shell inside container | `docker compose exec inventory-app sh` |

---

## Backup & Restore

### Backup data volume

```bash
docker run --rm \
  -v inventory-app_inventory-data:/data \
  -v $(pwd):/backup \
  alpine cp -r /data /backup/data-backup
```

This copies the volume contents to `./data-backup/` on your host.

### Restore from backup

```bash
docker run --rm \
  -v inventory-app_inventory-data:/data \
  -v $(pwd)/data-backup:/backup \
  alpine cp -r /backup/. /data/
```

### Manual backup (JSON only)

```bash
docker compose exec inventory-app cat /app/backend/data/data.json > data-backup.json
```

---

## Configuration

Environment variables (set in `docker-compose.yml` or a `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` (Docker) / `3001` (local backend) | Port the server listens on |
| `DATA_DIR` | `./backend/data` | Directory for `data.json` and uploads |
| `NODE_ENV` | `development` | Set to `production` in Docker |

### Using a `.env` file

Create `.env` in the project root:

```env
PORT=3000
DATA_DIR=/app/backend/data
NODE_ENV=production
```

---

## Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access — users, locations, items, accounting, audit |
| **Manager** | Approve moves/reimbursements, manage purchases, view accounting |
| **Accounting Admin** | Access to Finance section only (plus limited inventory/purchase view) |
| **Member** | Request moves, borrow items, submit reimbursements, comment |
| **Viewer** | Read-only access to inventory |

Granular per-user permission arrays can override role defaults (see Team admin UI and [AGENTS.md](AGENTS.md)).

---

## Customization

Common knobs without a rewrite:

| What | Where |
|------|-------|
| Categories, conditions, nav, role defaults (UI) | `frontend/src/lib/constants.js` |
| Role default permissions (migration / new users) | `backend/utils/migration.js` |
| Bootstrap team / locations / items | `seed-data.json` (used only when `data.json` is absent) |
| Port and data directory | env vars / `docker-compose.yml` |
| Item custom-field definitions | `rt:customFields` via `/api/custom-fields` |

Full recipes for agents and contributors: **[Customization cookbook in AGENTS.md](AGENTS.md#customization-cookbook)**.

---

## Data & Migration

On every startup the server:

1. Ensures `DATA_DIR` exists.
2. If `backend/data/data.json` is missing, copies `seed-data.json` (or writes an empty skeleton).
3. Runs the idempotent migration to add missing tables and normalise legacy fields.

Migration is safe to run multiple times — it skips tables that already exist and only fills missing fields.

---

## File Uploads

Images and invoice/receipt attachments are stored in `backend/data/uploads/`.
They live on the Docker volume and persist across restarts.

| Upload type | Max size |
|-------------|----------|
| Item images / invoices | **4 MB** |
| Finance receipts | **10 MB** |

Supported formats (typical): JPEG, PNG, GIF, PDF, DOC/DOCX, XLS/XLSX, CSV.
