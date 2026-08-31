# Robotics Inventory App

A full-stack inventory and accounting system for robotics teams.
Dark-themed React frontend (Vite + Tailwind) + Node/Express backend with a flat-file JSON database.

Every screen, button, modal, permission, and API is catalogued in **[FEATURES.md](./FEATURES.md)**. Gaps and follow-on ideas are in **[FEATURE-GAPS.md](./FEATURE-GAPS.md)**.

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
docker compose up -d --build
```

The first run builds the frontend and installs all dependencies — this takes 2–4 minutes.
Subsequent starts are instant (image is cached).

If a rebuild fails with `vite: not found`, or the container exits with
`EACCES` writing `/app/backend/data`, pull the latest code and force a clean build:

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

The image entrypoint fixes ownership on the `inventory-data` volume so the
non-root app user can write `data.json` and uploads.
### 5. Open the app

```
http://localhost:3000
```

Default admin account: **Admin / admin123**
Change this password immediately via Team after first login.

Set a strong `SESSION_SECRET` (16+ characters) before any real deployment:

```bash
export SESSION_SECRET="$(openssl rand -hex 32)"
docker compose up -d
```

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
| `PORT` | `3000` (Docker) / `3001` (local) | Port the server listens on |
| `DATA_DIR` | `./backend/data` | Directory for `data.json` and uploads |
| `NODE_ENV` | `development` | Set to `production` in Docker |
| `SESSION_SECRET` | weak dev default | **Required in production** — signs auth JWTs |
| `CORS_ORIGIN` | allow all | Comma-separated allowed origins (optional) |
| `TOKEN_TTL` | `7d` | JWT lifetime |
| `HUB_PUBLIC_URL` | request origin | Public HTTPS origin for Hub pairing (`verification_uri`) |
| `HUB_TAILSCALE_URL` | — | Tailscale origin (used if public URL is unset) |
| `HUB_JWT_SECRET` | `SESSION_SECRET` | Signs Homelab Hub access tokens |
| `HUB_PAIRING_NETWORK` | `private_only` | `private_only` or `public_allowed` — pairing from the public internet |

Homelab Hub (Android native UI, no WebView) is documented in [HUB.md](./HUB.md).

### Using a .env file

Create `.env` in the project root:

```env
PORT=3000
DATA_DIR=/app/backend/data
NODE_ENV=production
SESSION_SECRET=replace-with-a-long-random-string
HUB_PUBLIC_URL=https://inventory.example.com
HUB_TAILSCALE_URL=https://inventory.tail123.ts.net
HUB_PAIRING_NETWORK=private_only
```

---

## Roles

| Role | Default access |
|------|----------------|
| **Admin** | Full access (bypasses permission checks) |
| **Manager** | Inventory edit, approvals, purchases, finance, audit |
| **Accounting Admin** | Finance view/edit, inventory/purchases view, audit |
| **Member** | Inventory view, move requests, purchases, borrows |
| **Viewer** | Read-only inventory / purchases / borrows |

Granular permissions can be customized per user on the **Team** page. Custom field definitions are managed under **Custom Fields**.

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
