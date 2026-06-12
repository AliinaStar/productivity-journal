#!/bin/sh
# Fail fast: if migrations fail, do NOT start the API against a wrong schema.
set -e
.venv/bin/alembic upgrade head
# --proxy-headers: trust X-Forwarded-For from the reverse proxy (Caddy) so
# rate limiting sees the real client IP, not the proxy container's IP.
# '*' is safe here because port 8000 is never published outside the Docker network.
.venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 8000 \
    --proxy-headers --forwarded-allow-ips='*'
