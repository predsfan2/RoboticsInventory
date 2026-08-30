# Agent notes

Robotics Inventory is an inventory and accounting app for robotics teams: Vite + React + Tailwind frontend, Express backend, flat-file JSON database.

## Cursor Cloud specific instructions

Dependencies are installed during the environment `install` step (`npm ci` in `backend/` and `frontend/`). Dev servers are started in shared terminals:

- Backend: http://localhost:3001 (`npm run dev --prefix backend`)
- Frontend: http://localhost:5173 (`npm run dev --prefix frontend`) — Vite proxies `/api` and `/uploads` to the backend

Smoke-check the API with `GET /api/health`. There is no automated test suite.

On first backend start, `seed-data.json` is copied to `backend/data/data.json` and an idempotent migration runs. Default seed login is **Admin** / **admin123**.

The root `Dockerfile` is the **production** image (multi-stage, Alpine, serves the built SPA). Do not use it as the Cloud Agent base image.

## Layout

- `backend/` — Express API (`server.js`), routes, JSON storage under `backend/data/`
- `frontend/` — Vite React SPA
- `seed-data.json` — initial database copied on first boot
- `docker-compose.yml` — production-style local run on port 3000
