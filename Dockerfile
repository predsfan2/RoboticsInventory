# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app/frontend

# Keep NODE_ENV unset/development during install so build tools are present.
# (vite / plugin-react / tailwind are also listed under dependencies for Docker.)
ENV NODE_ENV=development

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
RUN test -x node_modules/.bin/vite \
  && npm run build \
  && test -f /app/public/index.html


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
