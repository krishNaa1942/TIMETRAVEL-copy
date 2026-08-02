# Time To Travel — Quick Overview

> Family-first, AI-assisted travel planning for Indian domestic trips — full-stack: Expo mobile app + Flask API.

## Stack at a Glance

| Layer | Tech |
|---|---|
| Mobile | Expo 54, React Native 0.81, TypeScript, Zustand, React Query |
| Backend | Flask 3, SQLAlchemy, Flask-Limiter, bcrypt |
| AI | Google Gemini with deterministic fallback (scikit-learn) |
| Data | SQLite (dev) / PostgreSQL / Supabase (prod) |
| Infra | Docker, Docker Compose, gunicorn, GitHub Actions |

## Repo Layout

```text
.
├── app/                  # Flask backend (routes, models, services, utils)
├── TimeTravelMobile/     # Expo React Native app
├── data/                 # Curated India destinations, budgets, safety scores
├── deploy/               # Kubernetes manifests, nginx, prometheus/grafana
├── tests/                # Backend test suite (pytest)
├── scripts/              # Dev launcher, Supabase migration, validation
└── .github/workflows/    # CI: lint, test, coverage, Docker smoke
```

## Quick Start (Development)

```bash
# 1. Backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # fill in API keys
python run.py             # http://localhost:5001

# 2. Mobile (new terminal)
cd TimeTravelMobile
npm install
cp .env.example .env      # set EXPO_PUBLIC_API_URL
npm run start             # Expo dev server
```

Or run both together:

```bash
./scripts/start_mobile_dev.sh
```

## Production

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- Backend health check: `/api/health`
- Requires PostgreSQL + Redis (see `docker-compose.prod.yml` / `deploy/kubernetes/`)
- Rotate keys before production — see [SECURITY.md](SECURITY.md)

## Verify

```bash
pytest -v                  # backend tests
cd TimeTravelMobile && npx tsc --noEmit   # type check
```

## Docs

| File | Contents |
|---|---|
| [README.md](README.md) | Full project documentation |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture |
| [SECURITY.md](SECURITY.md) | Key rotation & security controls |
| [TimeTravelMobile/README.md](TimeTravelMobile/README.md) | Mobile app docs |
