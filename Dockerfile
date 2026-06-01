# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only the manifest first so npm install is cached as a separate layer
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install

# Copy the rest of the frontend source and build
COPY frontend/ ./frontend/
RUN cd frontend && npm run build
# vite outDir is '../public' relative to frontend/ → output lands at /app/public/


# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install backend production dependencies (cached layer)
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Copy built SPA from stage 1 (/app/public in builder = outDir '../public')
COPY --from=builder /app/public ./public

# Copy seed data (server looks for it at /app/seed-data.json)
COPY seed-data.json ./

# Pre-create data directory (volume mount point)
RUN mkdir -p /app/backend/data

EXPOSE 3000

# server.js __dirname = /app/backend
# → PUBLIC_DIR  = /app/backend/../public  = /app/public   ✓
# → SEED_PATH   = /app/backend/../seed-data.json           ✓
# → DATA_DIR    = /app/backend/utils/../../data = /app/backend/data (or env override) ✓
CMD ["node", "backend/server.js"]
