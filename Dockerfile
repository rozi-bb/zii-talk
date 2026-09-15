# Zii Talk dalam satu image: frontend hasil build + API FastAPI yang sekalian
# nyajiin frontend-nya (server/main.py). Dijalanin lewat docker-compose.yml:
#
#   npm run docker:up    build + nyalain app & Postgres → http://localhost:8080
#
# Kunci API sengaja NGGAK masuk image — dibaca dari .env waktu container jalan.

# ── 1. build frontend ──────────────────────────────────────────────
FROM node:26-alpine AS web
WORKDIR /web

# dependency dulu, biar layer ini ke-cache selama package-lock nggak berubah
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── 2. API + frontend ──────────────────────────────────────────────
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.11 /uv /bin/uv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/.venv/bin:$PATH" \
    HOST=0.0.0.0 \
    PORT=8787

WORKDIR /app

# versi persis dari uv.lock, tanpa grup dev (langgraph-cli buat Studio)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY server ./server
COPY --from=web /web/dist ./dist

# jalan sebagai user biasa; kodenya cukup kebaca, nggak perlu bisa ditulis
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin zii
USER zii

EXPOSE 8787

# /api/auth/me nyentuh database juga — Postgres putus = container ditandai unhealthy
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8787/api/auth/me', timeout=2)"]

CMD ["python", "-m", "server.main"]
