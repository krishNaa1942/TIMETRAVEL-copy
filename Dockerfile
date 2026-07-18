# ──────────────────────────────────────────────────────────
# Time Travel – AI Smart Tourism Assistant
# Multi-stage Docker build for production-ready deployment
# ──────────────────────────────────────────────────────────

# ── Stage 1: Build dependencies ─────────────────────────
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Install build-time system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: Production image ───────────────────────────
FROM python:3.11-slim AS production

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Create instance & uploads directories
RUN mkdir -p instance uploads/photos uploads/documents

# Create non-root user and hand over ownership
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser \
    && chown -R appuser:appuser /app

USER appuser

# Expose the application port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/api/health')" || exit 1

# Run with gunicorn production WSGI server
CMD ["gunicorn", "--workers", "4", "--bind", "0.0.0.0:5001", "--access-logfile", "-", "--error-logfile", "-", "run:app"]
