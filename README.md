# Robotics Inventory App

A full-stack inventory and accounting system for robotics teams.
Dark-themed React frontend (Vite + Tailwind) + Node/Express backend with a flat-file JSON database.

---

## Quick Start (Docker)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker + Docker Compose (Linux)

### 1. Clone / copy the project

Place all project files in a single folder. The structure should look like:

```
inventory-app/
  backend/
  frontend/
  seed-data.json
  Dockerfile
  docker-compose.yml
```

### 2. (Optional) Seed with existing data

If you have an existing `data.json` from a previous install, copy it into the project root and rename it `seed-data.json`. The migration will run automatically on first start and normalise old fields.

### 3. Fix line endings (Linux / WSL only)

If files were edited on Windows and you are deploying on Linux, run:

```bash
find . -type f \( -name "*.js" -o -name "*.json" -o -name "*.html" \
  -o -name "*.css" -o -name "*.md" -o -name "*.yml" -o -name "*.yaml" \) \
  -exec sed -i 's/\r$//' {} \;
```

Or use the included helper script:

```bash
bash fix-line-endings.sh
```

### 4. Build and run

```bash
docker compose up -d
```

The first run builds the frontend and installs all dependencies — this takes 2–4 minutes.
Subsequent starts are instant (image is cached).

### 5. Open the app

```
http://localhost:3000
```

Default admin account: **Admin / admin123**
Change this password immediately via Admin → Team after first login.

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

Runs on **http://localhost:5173**. API calls are proxied to `:3001` via Vite config.

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

### Manual backup (just copy the JSON)

```bash
docker compose exec inventory-app cat /app/backend/data/data.json > data-backup.json
```

---

## Configuration

All configuration is via environment variables (set in `docker-compose.yml` or a `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the server listens on |
| `DATA_DIR` | `./backend/data` | Directory for `data.json` and uploads |
| `NODE_ENV` | `development` | Set to `production` in Docker |

### Using a .env file

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
| **Accounting Admin** | Access to Finance section only |
| **Member** | Request moves, borrow items, submit reimbursements, comment |
| **Viewer** | Read-only access to inventory |

---

## Data & Migration

On every startup the server:

1. Checks if `backend/data/data.json` exists.
2. If not, copies `seed-data.json` as the initial database.
3. Runs the idempotent migration to add any missing tables and normalise legacy fields.

The migration is safe to run multiple times — it skips tables that already exist and only adds missing fields.

---

## File Uploads

Images and invoice attachments are stored in `backend/data/uploads/`.
They are included in the Docker volume and will persist across container restarts.
Maximum upload size: **4 MB per file**.

Supported formats: JPEG, PNG, GIF, PDF, DOC/DOCX, XLS/XLSX, CSV.
