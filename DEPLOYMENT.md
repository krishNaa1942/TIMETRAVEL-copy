# Deployment Runbook — Time To Travel

Public deployment of the full stack (Expo web + Flask API + Postgres + Redis) on a VPS with your own domain.

## Architecture

```
Browser ──▶ https://timetotravel.app (nginx :443)
              ├─ /         → Expo web build (static SPA, docker volume)
              └─ /api/     → Flask (gunicorn, 3 replicas)
Native App ──▶ https://api.timetotravel.app/api (EXPO_PUBLIC_API_URL)
```

Both the web app and API are served from the **same origin** (`timetotravel.app`), so no CORS issues on web. Native apps don't send CORS origins, so they work regardless.

## Prerequisites (one-time, ~$15 total)

| Item | Cost | Where |
|---|---|---|
| Domain | ~$10/yr | Cloudflare / Namecheap / GoDaddy |
| VPS (2GB RAM, 2 vCPU) | ~$5-6/mo | DigitalOcean / Linode / Vultr / Hetzner |
| Google Maps API key (real) | varies | https://console.cloud.google.com |

> Replace `AIzaSyB_PLACEHOLDER_KEY` in `TimeTravelMobile/app.json` with your real Maps key before building a native APK. The web build doesn't use it.

## 1. DNS Setup

On your domain registrar, create **A records** pointing to the VPS IP:

| Host | Type | Value |
|---|---|---|
| `timetotravel.app` | A | `<VPS_IP>` |
| `api.timetotravel.app` | A | `<VPS_IP>` |
| `*` (optional) | A | `<VPS_IP>` |

## 2. VPS Environment File

On the VPS, in the repo root, create `.env.production`:

```bash
FLASK_ENV=production
DOMAIN=timetotravel.app
WEB_DOMAIN=timetotravel.app
API_DOMAIN=api.timetotravel.app
SSL_EMAIL=admin@timetotravel.app
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
POSTGRES_USER=timetravel
POSTGRES_PASSWORD=$(python3 -c "import secrets; print(secrets.token_hex(24))")
POSTGRES_DB=timetravel
REDIS_PASSWORD=$(python3 -c "import secrets; print(secrets.token_hex(24))")
GRAFANA_ADMIN_PASSWORD=$(python3 -c "import secrets; print(secrets.token_hex(16))")

# CORS — browser origins that may call the API
ALLOWED_ORIGINS=https://timetotravel.app,https://www.timetotravel.app

# Database backups (optional, default 14 days)
BACKUP_RETENTION_DAYS=14

# --- API keys (same values as your local .env) ---
SUPABASE_URL=...
SUPABASE_KEY=...
SUPABASE_SERVICE_KEY=...
GOOGLE_API_KEY=...
OPENWEATHER_API_KEY=...
UNSPLASH_ACCESS_KEY=...
UNSPLASH_SECRET_KEY=...
TOMTOM_API_KEY=...
FOURSQUARE_API_KEY=...
FOURSQUARE_CLIENT_ID=...
FOURSQUARE_CLIENT_SECRET=...
NEWSAPI_KEY=...
```

> If using Supabase instead of bundled Postgres, set `DATABASE_URL=postgresql://...` and you can drop the `postgres` service from `docker-compose.prod.yml`.

## 3. Deploy

```bash
cd /path/to/repo
sudo bash scripts/deploy_vps.sh
```

The script:
1. Installs Docker + compose, Node.js 20, certbot
2. Loads `.env.production` (domains come from it — falls back to `timetotravel.app`)
3. Verifies DNS resolves to the server (hard-fails if A records are wrong/missing)
4. Issues a Let's Encrypt cert via **standalone** certbot and copies it into
   `deploy/nginx/ssl/` (gitignored), which is what the nginx container serves
5. Builds the Expo web bundle (`npm ci && npx expo export --platform web` → `TimeTravelMobile/dist/`)
6. `docker compose -f docker-compose.prod.yml up -d --build`
7. Waits for `api/health`, then runs `alembic upgrade head` (adds the composite
   indexes on top of the `create_all()` schema — verified working order)
8. Verifies rendered nginx config (`nginx -t`)
9. Installs daily crons: DB backup (`scripts/backup_db.sh`, 03:00) and TLS
   renewal (`scripts/renew_ssl.sh`, 04:00 — re-copies certs + restarts nginx)

> nginx config is a template (`deploy/nginx/templates/nginx.conf.template`).
> `API_DOMAIN` / `WEB_DOMAIN` are rendered via `envsubst` at container start —
> no need to edit nginx config when the domain changes.
>
> TLS certs (`deploy/nginx/ssl/cert.pem` + `key.pem`) are generated on the VPS
> and **must never be committed** (see `.gitignore`).

## 4. Verify

```bash
curl https://timetotravel.app               # web app HTML
curl https://timetotravel.app/api/health    # {"status":"ok"}
```

Open `https://timetotravel.app` in a browser → register an account → browse destinations, plan a trip.

## Native Mobile (Expo Go / APK)

Set the production API URL and rebuild:

```bash
cd TimeTravelMobile
EXPO_PUBLIC_API_URL=https://api.timetotravel.app/api npm run start
# or for a standalone build:
EXPO_PUBLIC_API_URL=https://api.timetotravel.app/api npx expo export --platform android
```

The app falls back to `https://api.timetotravel.app/api` automatically in production builds (`src/constants/config.ts:156`).

## Monitoring

- **Grafana**: `https://timetotravel.app/grafana` (bound to localhost; SSH-tunnel: `ssh -L 3000:localhost:3000 user@vps`)
- **Prometheus**: same, port 9090 — currently self-scrapes only.
  Flask (`/api/metrics`) and Redis exporter targets are **not wired yet**
  (instrumentation is future work — see `deploy/prometheus/prometheus.yml`).
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f web`
- **Sentry**: errors go to your Sentry DSN (`SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN`)

## Backups

The deploy script installs a cron that runs `scripts/backup_db.sh` daily at 03:00:

```bash
# Manual run / restore reference:
./scripts/backup_db.sh                        # → deploy/backups/timetravel_<ts>.sql.gz
gzip -dc deploy/backups/latest.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U timetravel -d timetravel
```

- Retention: `BACKUP_RETENTION_DAYS` in `.env.production` (default 14)
- Copy `deploy/backups/latest.sql.gz` off-server for disaster recovery

## CI/CD

- **CI** (`.github/workflows/ci.yml`): lint (flake8 + black), unit tests
  (`--cov-fail-under=60`), TypeScript check + `expo export --platform web`.
- **CD** (`.github/workflows/cd.yml`): the GHCR image push job runs on
  `main`/tags. The SSH auto-deploy job is **disabled** (it never transferred
  the rendered compose file to the VPS). Use `scripts/deploy_vps.sh` instead.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `api/health` 404 | nginx not proxying — check `docker compose ps`, nginx config |
| Web blank page | `dist/` missing — rerun the deploy script or `npx expo export --platform web` |
| Deploy dies at "certbot failed" | A record not set yet or port 80 blocked — fix DNS/firewall, rerun |
| Deploy dies at "DNS ... does not match" | A record points elsewhere — fix registrar, wait for propagation, rerun |
| CORS errors in browser | Add the origin to `ALLOWED_ORIGINS` in `.env.production`, restart |
| SSL invalid after expiry | `./scripts/renew_ssl.sh` (or wait for the 04:00 cron); check `deploy/backups/renew.log` |
| Uploads lost on redeploy | They're on the `uploads-data` volume — do not delete volumes |

## Security Notes

- Rotate all exposed keys — see [SECURITY.md](SECURITY.md)
- Do not commit `.env.production`
- Firewall: allow only 22, 80, 443 (`ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable`)
