# Live Production Audit — Time To Travel

**Date:** 2026-08-02 (refreshed audit, all numbers verified by live checks)
**Status:** ✅ All blocking bugs fixed + deploy path hardened — ready for user actions (domain/VPS/keys)

---

## Executive Summary

| Area              | Status                                      | Grade |
| ----------------- | ------------------------------------------- | ----- |
| Backend tests     | **777 passed, 2 skipped, 0 failed**         | 🟢 A  |
| Backend warnings  | 0 (SQLAlchemy deprecations fixed)           | 🟢 A  |
| Test coverage     | **60.39% (CI gate 60% — now PASSES)**       | 🟢 A  |
| TypeScript        | 0 errors                                    | 🟢 A  |
| expo-doctor       | 18/18 checks passed                         | 🟢 A  |
| flake8            | **0 issues** (E203 + per-file E501 handled) | 🟢 A  |
| black             | clean (all files formatted)                 | 🟢 A  |
| Web bundle export | Builds clean (8.7 MB)                       | 🟢 A  |
| Production infra  | **3 blocking bugs FIXED** (below)           | 🟢 A  |
| Deploy path       | **6 readiness issues FIXED** (Part 1B)      | 🟢 A  |
| Secrets hygiene   | Keys in `.env` (git-ignored ✓)              | 🟡 B  |

**Bottom line:** All audit-blocking items are resolved. Remaining work is user actions (buy domain + VPS, real Maps/EAS/Sentry keys, rotate exposed keys) and the optional scale items in Part 6.

---

## PART 1 — Fixes Applied This Session

### ✅ 1.1 CI coverage gate — FIXED

- Coverage raised **46% → 60.39%** (gate is 60%). Verified `--cov-fail-under=60` passes.
- Added 6 new test files: `test_security_utils.py`, `test_rate_limiter_utils.py`, `test_validation_models.py`, `test_core_utils.py`, `test_cache_service_utils.py`, `test_ai_security.py`, `test_push_notification_service.py`, `test_error_handler_middleware.py` (+279 tests).

### ✅ 1.2 Celery worker crash — FIXED

- Removed dead `celery-worker` service from `docker-compose.prod.yml` (`app.celery` module never existed; celery isn't in requirements.txt). Stack now boots clean.

### ✅ 1.3 Gemini env var mismatch — FIXED

- `docker-compose.prod.yml` + `.github/workflows/cd.yml` now pass `GOOGLE_API_KEY` (matches what `app/config.py` + `chatbot.py` actually read). AI works in production Docker.

### ✅ 1.4 Lint — FIXED

- Added `.flake8` (E203 ignore, per-file E501 ignores for unbreakable prompt strings) + black-formatted all remaining files. `flake8 app/`: **0 issues**; `black --check`: clean.

### 🐛 1.5 Real bugs found & fixed via new tests

- **`rate_limiter.py:get_client_key`** crashed with `TypeError: argument of type 'NoneType' is not iterable` when `X-Forwarded-For` was absent and `remote_addr` was None → now returns `"unknown"`.
- **`security.py:verify_password`** raised `ValueError: Invalid salt` on sha256-fallback hashes when bcrypt is installed → now handles both formats, never crashes.
- **`validation.py`** was **unimportable under pydantic v2** (`@root_validator` needs `skip_on_failure=True`; `regex=` → `pattern=`; `min_items=` → `min_length=`) → fixed; the importing `trip_management.py` module now imports cleanly. This was a latent production crash.

## PART 1B — Deploy-Readiness Issues FIXED

Verified `scripts/deploy_vps.sh` end-to-end on a simulated fresh VPS. Six issues fixed:

### ✅ 1B.1 TLS — self-signed certs committed to git → real Let's Encrypt

- `deploy/nginx/ssl/cert.pem` + `key.pem` (self-signed, **private key was in git**) — removed with `git rm --cached`; `deploy/nginx/ssl/*.pem` added to `.gitignore`.
- Deploy script now issues certs via **standalone certbot** (system nginx stopped to free port 80), copies `fullchain.pem`→`cert.pem` / `privkey.pem`→`key.pem` into the nginx container's mount, and installs a daily renewal cron (`scripts/renew_ssl.sh` — renew + re-copy + restart nginx).
- DNS check now **hard-fails** instead of logging a warning (prevents a broken HTTPS launch).
- Old webroot flow never worked (nothing served `/var/www/certbot` on port 80 before the stack existed).

### ✅ 1B.2 Web build on VPS — silently skipped → now guaranteed

- Script never installed Node → `command -v node` failed → web UI 404'd with only a log line. Now installs **Node.js 20** (NodeSource) in step 1.
- `npm ci --omit=dev` deleted `babel-preset-expo` (a devDependency required by `expo export`) → changed to plain `npm ci`.
- Web build failure is now **fatal** (`die`) instead of a warning.

### ✅ 1B.3 Alembic ordering — verified CORRECT (no change needed)

- Hypothesis "create_all conflicts with migrations" was **wrong**: the initial migration `5b48fcd422ba` is a no-op — Alembic only adds the composite indexes.
- Proven on a fresh SQLite DB: app boot (`create_all`, 19 tables) → `alembic upgrade head` → all 12 `ix_*_user_created` indexes created. Deploy script already runs alembic *after* the health wait, which is the correct order. (A faulty Dockerfile/init_db change was made and reverted.)

### ✅ 1B.4 Monitoring — dead scrape targets removed

- Prometheus scraped `web:5001/api/metrics` (endpoint doesn't exist) and `redis:6379/metrics` (no exporter container); `deploy/grafana/dashboards/` was empty.
- Trimmed `prometheus.yml` to self-scrape only; documented flask/redis exporters as future work.

### ✅ 1B.5 cd.yml auto-deploy job — disabled

- It rendered `docker-compose.deploy.yml` on the runner but never transferred it to the VPS, then ran `docker compose -f docker-compose.deploy.yml pull` there (file not found). Job commented out with guidance; GHCR image push job still runs on `main`/tags. Manual `deploy_vps.sh` is the deploy path.

### ✅ 1B.6 `.env.example` — completed

- Added `DOMAIN`, `WEB_DOMAIN`, `API_DOMAIN`, `SSL_EMAIL`, `JWT_SECRET_KEY`, `POSTGRES_USER/PASSWORD/DB`, `DATABASE_URL`, `REDIS_PASSWORD`, `GRAFANA_ADMIN_USER/PASSWORD`, `BACKUP_RETENTION_DAYS` — all required by compose + scripts.

## PART 2 — Still Open (0%–35% coverage)

| Module                                  | Coverage | Risk                       |
| --------------------------------------- | -------- | -------------------------- |
| `app/services/ai_recommendations.py`    | 0%       | High — AI ranking          |
| `app/services/embedding_service.py`     | 0%       | High — ML embeddings       |
| `app/services/itinerary_engine.py`      | 0%       | High — trip planning       |
| `app/services/realtime_service.py`      | 0%       | Medium                     |
| `app/services/websocket_service.py`     | 0%       | Medium                     |
| `app/services/recommendation_engine.py` | 0%       | High — AI ranking          |
| `app/services/trip_management.py`       | 0%       | Medium (imports now fixed) |

These are AI/ML services — worth covering before heavy AI traffic, but NOT launch blockers.

## PART 3 — Remaining Launch Checklist (user actions)

| #   | Item                                  | Where                      | Why                                 |
| --- | ------------------------------------- | -------------------------- | ----------------------------------- |
| 1   | Purchase domain                       | —                          | None exists                         |
| 2   | Rent VPS (2GB+ RAM)                   | —                          | ~$5–6/mo                            |
| 3   | Real Google Maps key                  | `app.json`                 | Placeholder breaks native maps      |
| 4   | Real EAS project ID                   | `app.json`                 | `your-project-id` breaks EAS builds |
| 5   | Run deploy (cert issued automatically)| `scripts/deploy_vps.sh`    | Standalone certbot now wired in     |
| 6   | Real Sentry DSNs                      | `.env.production` + mobile | Placeholders                        |
| 7   | Rotate exposed keys                   | provider dashboards        | SECURITY.md procedure               |
| 8   | `DATABASE_URL` → Postgres             | `.env.production`          | SQLite unsuitable for public        |
| 9   | Redis password + verify rate limiting | `.env.production`          | `memory://` per-process in dev      |
| 10  | Web replica memory 512M → 768M        | compose                    | ML fallback ~300MB/process          |

---

_All numbers verified by live checks on 2026-08-02. See also the original deep-dive in AUDIT_REPORT.md._
