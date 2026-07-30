# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm ci --omit=dev 2>/dev/null || npm install

COPY frontend/ ./frontend/
RUN cd frontend && npm run build


# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY backend/ ./backend/
COPY --from=builder /app/public ./public
COPY seed-data.json ./

RUN mkdir -p /app/backend/data /app/backend/data/uploads \
  && chown -R app:app /app

USER app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/backend/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "backend/server.js"]
