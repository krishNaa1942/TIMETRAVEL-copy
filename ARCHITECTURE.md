# Time Travel AI — Architecture Document

**Project:** Time Travel AI — Smart Tourism Assistant  
**Stack:** Flask 3.x + SQLAlchemy + PostgreSQL/Redis | React Native 0.81 + Expo SDK 54  
**Total Codebase:** ~127,000 lines (Python + TypeScript/TSX)  
**Author:** AI/ML Full-Stack Engineer

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Backend Architecture](#2-backend-architecture)
3. [Database Layer](#3-database-layer)
4. [API Layer](#4-api-layer)
5. [Service Layer](#5-service-layer)
6. [AI/ML Integration](#6-aiml-integration)
7. [Mobile App Architecture](#7-mobile-app-architecture)
8. [Navigation Architecture](#8-navigation-architecture)
9. [State Management](#9-state-management)
10. [Infrastructure](#10-infrastructure)
11. [Data Flow](#11-data-flow)
12. [Security Architecture](#12-security-architecture)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOBILE APP (Expo/React Native)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐  │
│  │  Home    │ │ Explore  │ │  Chat    │ │  Trips   │ │Profile│  │
│  │  Tab     │ │  Tab     │ │  Tab     │ │   Tab    │ │  Tab  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──┬───┘  │
│       │            │            │            │          │       │
│  ┌────┴────────────┴────────────┴────────────┴──────────┴───┐  │
│  │                   BottomTabNavigator                      │  │
│  │              (5 tabs, lazy-loaded, error-bounded)         │  │
│  └─────────────────────────┬────────────────────────────────┘  │
│  ┌─────────────────────────┴────────────────────────────────┐  │
│  │                   NavOS (Stack Navigator)                  │  │
│  │    Auth guard, deep linking, 17 detail screens, theme     │  │
│  └─────────────────────────┬────────────────────────────────┘  │
│  ┌─────────────────────────┴────────────────────────────────┐  │
│  │              API Client Layer (Axios)                     │  │
│  │  Retry, 401 refresh queue, error classification, caching │  │
│  └─────────────────────────┬────────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTPS / JSON
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FLASK API BACKEND                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            33 Blueprint Routes (app/api/routes/)          │   │
│  │  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌───────────┐   │   │
│  │  │Auth  │ │Chat  │ │Itinerary│ │Budget│ │Favorites  │...│   │   │
│  │  │v1+v2 │ │      │ │         │ │      │ │+ 25 more  │   │   │   │
│  │  └──┬───┘ └──┬───┘ └───┬─────┘ └──┬───┘ └─────┬─────┘   │   │
│  └─────┼────────┼─────────┼──────────┼───────────┼──────────┘   │
│        │        │         │          │           │               │
│  ┌─────┴────────┴─────────┴──────────┴───────────┴──────────┐  │
│  │             40+ Services (app/services/)                  │  │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐   │  │
│  │  │JWT v2   │ │Gemini AI  │ │Cache     │ │Push Notif│   │  │
│  │  │Auth     │ │Service    │ │Service   │ │Service   │   │  │
│  │  └──────────┘ └───────────┘ └──────────┘ └──────────┘   │  │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐   │  │
│  │  │Supabase │ │OpenWeather│ │TomTom    │ │Unsplash  │   │  │
│  │  │DB       │ │Service    │ │Maps      │ │Images    │   │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────┬──────────────────────────────────────────┬──────────┘
           │                                          │
           ▼                                          ▼
┌──────────────────────┐              ┌──────────────────────┐
│   PostgreSQL/SQLite  │              │   Redis (Cache +     │
│   (SQLAlchemy ORM)   │              │   JWT Blacklist)     │
│   + Supabase Storage │              │   + In-Memory        │
└──────────────────────┘              │   Fallback           │
                                      └──────────────────────┘
```

### Key Design Decisions

- **Flask application factory** (`app/main.py:48`) — creates a fully configured Flask instance with all extensions, blueprints, middleware, and error handlers
- **Two auth systems**: Flask-Login sessions (v1, web) + JWT bearer tokens (v2, mobile API) — consolidated into a shared `app/utils/auth.py` utility
- **Blueprint-per-feature** organization — 33 route files, one per domain feature
- **Service singletons** — module-level instantiation (`jwt_service_v2 = JWTServiceV2()`) with lazy Redis fallback
- **React Navigation** with 3 historical generations (NavOS active, RootNavigator.new unused, production/ unused)
- **Zustand** for client state + **React Query** for server state — clear separation

---

## 2. Backend Architecture

### 2.1 Application Factory (`app/main.py`)

```
create_app(config_class=None)
  │
  ├── 1. Load config (DevelopmentConfig / TestingConfig / ProductionConfig)
  ├── 2. Configure logging
  ├── 3. Init database (db.init_app + create_all)
  ├── 4. Init CSRF (csrf.init_app)
  ├── 5. Init CORS (dynamic origin from LAN_IP env)
  ├── 6. Init Rate Limiting (limiter.init_app)
  ├── 7. Init Flask-Login (user_loader, unauthorized_handler)
  ├── 8. Register 32 blueprints
  ├── 9. Register security headers (CSP, HSTS, X-Frame-Options, etc.)
  ├── 10. Register error handlers (400, 404, 429, 500)
  └── 11. Validate environment (log API service status)
```

### 2.2 Configuration (`app/config.py`)

| Class | Env | Key Settings |
|-------|-----|-------------|
| `Config` | base | SECRET_KEY enforcement, DATABASE_URL, 7 API keys, session security, rate limit defaults |
| `DevelopmentConfig` | dev | `DEBUG = True` |
| `TestingConfig` | test | `SQLite :memory:`, CSRF/rate-limit disabled |
| `ProductionConfig` | prod | `SESSION_COOKIE_SECURE = True`, HSTS enforced |

### 2.3 Extensions Initialized

| Extension | Import | Config |
|-----------|--------|--------|
| `SQLAlchemy` | `app.models.database:db` | Pool: 5/10/30s/300s/pre-ping (PostgreSQL) |
| `LoginManager` | `app.main:login_manager` | Login view = None (API-only) |
| `CSRFProtect` | `app.main:csrf` | Exempted for all API blueprints |
| `Limiter` | `app.main:limiter` | Memory storage, 2000/day, 500/hour defaults |
| `CORS` | `app.main:CORS` | Dynamic origins, credentials support |

---

## 3. Database Layer

### 3.1 Architecture

```
┌─────────────────────────────────────────────────────┐
│                  SQLAlchemy ORM                      │
│  │                                                   │
│  ├── db.Model (18 entities in entities.py)          │
│  ├── db.init_app(app)  →  create_all() on startup   │
│  └── Alembic (migrations/)  →  initial_schema       │
│                                                      │
├─────────────────────────────────────────────────────┤
│  Connection Strategy                                 │
│  │                                                   │
│  ├── PostgreSQL (Supabase) if DATABASE_URL set       │
│  │   └── pool_size=5, max_overflow=10               │
│  │   └── Fallback to SQLite on connection failure   │
│  └── SQLite local fallback (default dev)             │
└─────────────────────────────────────────────────────┘
```

### 3.2 Entity Models (18 tables)

| Entity | Table | Key Fields | FK to users |
|--------|-------|------------|-------------|
| `User` | `users` | id, name, email, password_hash (bcrypt) | — |
| `TripQuery` | `trip_queries` | destination, num_days, budget_breakdown | ✓ nullable |
| `ChatMessage` | `chat_messages` | role (user/bot), message, intent | ✓ nullable |
| `Destination` | `destinations` | name, lat/lon, safety_score, cost | — |
| `Favorite` | `favorites` | item_type, item_name, notes | ✓ |
| `TravelNote` | `travel_notes` | title, content, mood, rating, is_public | ✓ |
| `SharedTrip` | `shared_trips` | share_token (uuid), title, is_active | ✓ |
| `Expense` | `expenses` | category, amount, currency, date | ✓ |
| `PackingItem` | `packing_items` | item_text, is_checked, is_custom | ✓ |
| `Trip` | `trips` | title, destination, status, budget_total, itinerary_json | ✓ |
| `TripDay` | `trip_days` | day_number, date, title, notes | via Trip |
| `TripPlace` | `trip_places` | name, lat/lon, category, cost, is_booked | via Trip |
| `Reservation` | `reservations` | res_type, title, confirmation_code, status | ✓ |
| `TripPhoto` | `trip_photos` | filename, caption, file_size | ✓ |
| `TripDocument` | `trip_documents` | doc_type, title, expiry_date | ✓ |
| `Companion` | `companions` | name, email, phone, role | ✓ |
| `TripTemplate` | `trip_templates` | title, destination, template_json (pre-built) | — |
| `NewsletterSubscriber` | `newsletter_subscribers` | email (unique) | — |

**Relationships**: `Trip` is the central entity with cascading relationships to `TripDay`, `TripPlace`, `Reservation`, `TripPhoto`, `Companion`.

### 3.3 Migration Strategy

- **Current**: `db.create_all()` on startup (creates tables, no alters)
- **Alembic**: Initialized (`alembic/`) with initial migration generated (`5b48fcd422ba_initial_schema.py`)
- Run: `alembic upgrade head` to apply migrations

---

## 4. API Layer

### 4.1 Blueprint Registration Order (32 routes)

```
frontend → health → auth(v1) → auth_v2 → chatbot → budget → safety → weather
→ trips → maps → images → places → news → itinerary → compare → export
→ favorites → destinations → currency → language → booking → notes → sharing
→ expenses → packing → trip_planner → reservations → uploads → templates
→ travel_stats → profile → newsletter
```

### 4.2 Route Catalog

| Blueprint | Prefix | Auth | Key Endpoints |
|-----------|--------|------|---------------|
| `health` | — | None | `GET /api/health` |
| `auth` | — | None | `POST /api/auth/register`, `/login`, `/logout`, `GET /me` |
| `auth_v2` | — | JWT | `POST /api/auth/v2/register`, `/login`, `/refresh`, `/logout`, `/sessions` |
| `chatbot` | — | `@login_required` | `POST /api/chat`, `/chat/ai`, `/chat/classic`, `GET /chat/status` |
| `budget` | — | None | `POST /api/budget/estimate` |
| `safety` | — | None | `GET /api/safety/<destination>` |
| `weather` | — | None | `GET /api/weather?destination=...&days=...` |
| `trips` | — | Session/JWT | Full CRUD: `GET/POST/PUT/DELETE /api/trips` |
| `maps` | — | None | `GET /api/maps/search?q=...`, `/directions` |
| `images` | — | None | `GET /api/images?destination=...&count=...` |
| `places` | — | None | `GET /api/places?destination=...&category=...` |
| `news` | — | None | `GET /api/news?destination=...` |
| `itinerary` | — | Session/JWT | `POST /api/itinerary/generate`, `/day`, `/route` |
| `compare` | — | `@login_required` | `GET /api/compare?dest1=...&dest2=...` |
| `export` | — | Session/JWT | `GET /api/export/pdf`, `/share` |
| `favorites` | — | Session/JWT | `GET/POST/DELETE /api/favorites`, `/check` |
| `destinations` | — | None | `GET /api/destinations`, `/search`, `/autocomplete` |
| `currency` | — | None | `GET /api/currency/convert`, `/rates` |
| `language` | — | None | `POST /api/language/translate` |
| `booking` | — | Session/JWT | `POST /api/booking/search`, `/book` |
| `notes` | — | Session/JWT | `GET/POST/PUT/DELETE /api/notes` |
| `sharing` | — | `@login_required` | `POST /api/share`, `GET/DELETE /api/share/<token>` |
| `expenses` | — | Session/JWT | `GET/POST/PUT/DELETE /api/expenses` |
| `packing` | — | Session/JWT | `GET/POST/PUT/DELETE /api/packing` |
| `trip_planner` | — | Session/JWT | `POST /api/trip-planner/generate` |
| `reservations` | — | Session/JWT | `GET/POST/PUT/DELETE /api/reservations` |
| `uploads` | `/api/uploads` | `@login_required` | `POST /api/uploads/photo`, `/document`, `GET/DELETE` |
| `templates` | — | None | `GET /api/templates` |
| `travel_stats` | `/api/stats` | Session/JWT | `GET /api/stats` |
| `profile` | `/api/profile` | Session/JWT | `GET /api/profile/summary` |
| `newsletter` | — | None | `POST /api/newsletter/subscribe` |
| `frontend` | — | None | Web UI routes (templates) |

### 4.3 Response Format

Standard: `jsonify({...})` with appropriate HTTP status code. Error format:
```json
{
  "error": "error_code_string",
  "message": "Human-readable message",
  "details": []  // optional validation details
}
```

Consolidated error type at `app/utils/api_error.py`:
```python
ApiError(message, status_code, code, details, retryable)
# Factories: bad_request(), unauthorized(), not_found(), conflict(),
#            validation_error(), rate_limited(), internal_error()
```

---

## 5. Service Layer

### 5.1 Service Catalog

| Service | Singleton | Dependencies | Purpose |
|---------|-----------|-------------|---------|
| `jwt_service_v2` | `jwt_service_v2` | Redis (optional), PyJWT | Access/refresh tokens, blacklist, session mgmt |
| `cache_service` | `cache_service` | Redis (optional) | Redis + in-memory caching, decorator, async |
| `gemini_service` | Module-level dict | `google.generativeai` SDK | Chat sessions, history, Gemini 2.5 Flash |
| `itinerary_service` | Module-level | `google.generativeai`, geocode | AI itinerary generation, route optimization |
| `ai_security` | `ai_sanitizer` | None (regex-based) | Prompt injection detection, PII redaction |
| `ai_insights_service` | `ai_insights_service` | OpenAI (optional fallback) | User insights, travel personality, AI summary |
| `ai_recommendations` | Module-level | Gemini | Destination recommendations |
| `push_notification_service` | `push_notification_service` | Firebase (optional) | FCM/APNs push, device reg, templates |
| `realtime_service` | Module-level | asyncio | Trip collaboration, price alerts, WebSocket |
| `websocket_service` | Module-level | Flask-SocketIO | Room mgmt, presence, message broadcast |
| `supabase_db` | `_get_client()` | `supabase` PyPI package | PostgREST client, storage buckets |
| `supabase_service` | `_get_client()` | `supabase` PyPI package | Supabase API wrapper |
| `weather_service` | Module-level | `requests`, OpenWeatherMap | Current, forecast, history |
| `maps_service` | Module-level | `requests`, TomTom | Geocode, search, directions |
| `foursquare_service` | Module-level | `requests`, Foursquare | POI search, places |
| `unsplash_service` | Module-level | `requests`, Unsplash | Destination photos, search |
| `news_service` | Module-level | `requests`, NewsAPI | Travel news by destination |
| `safety_service` | Module-level | `data/safety_scores.json` | Safety scores, alerts, embassy info |
| `budget_service` | Module-level | `data/budget_baselines.json` | Budget estimation by destination/class |
| `currency_service` | Module-level | `requests`, exchangerate API | Currency conversion, rates |
| `language_service` | Module-level | None (rule-based) | Phrasebook, translation helper |
| `booking_service` | Module-level | None (mock) | Hotel/flight search, booking simulation |
| `packing_service` | Module-level | None (rule-based) | Packing list generation by weather/duration |
| `pdf_service` | Module-level | `fpdf2` | PDF itinerary export |
| `database_service` | Module-level | SQLAlchemy | Raw queries, SafeQueryBuilder |
| `embedding_service` | Module-level | None (optional numpy) | Text embeddings for ML |
| `recommendation_engine` | Module-level | scikit-learn | TF-IDF + LogReg for classic chatbot |
| `trip_management` | Module-level | SQLAlchemy | Trip CRUD with business logic |
| `user_preferences` | `user_preferences_service` | SQLAlchemy | User pref extraction, travel DNA |

### 5.2 Singleton Pattern

```python
# Module-level instantiation (prevalent pattern)
jwt_service_v2 = JWTServiceV2()
cache_service = CacheService()
push_notification_service = PushNotificationService()
ai_insights_service = AIInsightsService()
user_preferences_service = UserPreferenceService()
```

### 5.3 External API Integrations

| API | Service | Key Env Var | Rate Limit |
|-----|---------|-------------|------------|
| Google Gemini 2.5 Flash | `gemini_service` | `GOOGLE_API_KEY` | Model limits |
| OpenWeatherMap | `weather_service` | `OPENWEATHER_API_KEY` | 60/min free |
| TomTom Maps | `maps_service` | `TOMTOM_API_KEY` | 2500/day free |
| Unsplash | `unsplash_service` | `UNSPLASH_ACCESS_KEY` | 50/hr free |
| Foursquare | `foursquare_service` | `FOURSQUARE_API_KEY` | Tiered |
| NewsAPI | `news_service` | `NEWSAPI_KEY` | 100/day free |
| Firebase Cloud Messaging | `push_notification_service` | Firebase creds | Free |
| Supabase (DB + Storage) | `supabase_db/service` | `SUPABASE_URL` + `KEY` | Tiered |

---

## 6. AI/ML Integration

### 6.1 Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        AI LAYER                                     │
│                                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │  AI Security     │  │  Gemini Service │  │  Classic ML      │   │
│  │  (ai_security.py)│  │ (gemini_service)│  │ (recommendation  │   │
│  │                  │  │                 │  │  _engine.py)     │   │
│  │  Regex-based:    │  │  Model:         │  │                  │   │
│  │  • 18 injection  │  │  gemini-2.5-    │  │  TF-IDF Vector-  │   │
│  │    patterns      │  │  flash          │  │  ization +       │   │
│  │  • 6 PII types   │  │                 │  │  Logistic Reg    │   │
│  │  • Unicode norm  │  │  Sessions:      │  │                  │   │
│  │  • Control char  │  │  max 200,       │  │  Used as fallback│   │
│  │    removal       │  │  TTL 1800s      │  │  when Gemini is  │   │
│  │                  │  │                 │  │  unavailable     │   │
│  │  Applied by:     │  │  max 20 turns   │  │                  │   │
│  │  gemini_service  │  │                 │  │  Intent: safety, │   │
│  │  itinerary_service│ │                 │  │  budget, weather │   │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘   │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  AI Insights Service (ai_insights_service.py)               │    │
│  │  • Travel personality generation                            │    │
│  │  • User summary from trip/favorite data                     │    │
│  │  • Rule-based fallback when AI unavailable                  │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

### 6.2 Prompt Pipeline

```
User Input → AIPromptSanitizer.sanitize_input()
  ├── Length check (max 2000 chars)
  ├── Injection pattern scan (18 patterns)
  ├── PII redaction (credit cards, SSN, email, phone, API keys, JWT)
  ├── Control character removal
  ├── Unicode normalization (NFKC)
  └── Final sanitization
       │
       ├── Threats detected? → Block request, return safe refusal
       └── Safe? → Send sanitized input to Gemini
```

### 6.3 Offline ML Layer (learned priors)

Trained artifacts in `data/models/` (gitignored; reproducible via
`scripts/train_models.py`) provide data-driven priors that **blend with** —
never replace — the deterministic heuristic engines, so the system keeps
working with zero models deployed.

```
scripts/train_models.py ──► data/models/*.joblib  ──► app/services/learned_prior.py
   quality regressor          quality_model          LearnedPriors (lazy singleton)
   popularity regressor       popularity_model       .quality(name)      → 0-5 or None
   TF-IDF content matcher     content_vectorizer     .popularity(name)   → 0-1 or None
                              content_matrix         .content_similarity(query, k)
                              content_names.json     .content_score(query, name)
                              metadata.json          .priors(name)       → (q, p)
```

- **Datasets** (`data/training/`, ~4 MB, committed): `top_indian_places.csv`
  (real Google ratings — ground truth), `expanded_destinations.csv`,
  `tourism_destinations.csv` (rich synthetic features), `places.csv`.
- **Training**: GradientBoosting regressors over TF-IDF text + numeric
  features (median imputation, scaling); pipeline uses **positional column
  indices** so runtime inference needs only numpy + scikit-learn — pandas
  is a train-time dependency only (`requirements-train.txt`).
- **Blending**: `blend_prior()` = 0.6 × learned + 0.4 × heuristic (clamped
  to [0,1]); applied in `FeatureEngineer.calculate_popularity/quality` and
  the AI recommendation preference matcher (0.75 feature + 0.25 content).
- **Graceful degradation**: missing/corrupt artifacts return `None`/`[]`
  (see `tests/test_learned_prior.py`), and `MODELS_DIR` overrides the
  default path.
- **Validation**: `scripts/evaluate_models.py` enforces CI gates — quality
  MAE ≤ 0.6, popularity MAE ≤ 1.0, content same-state precision@5 ≥ 0.30
  (current: 0.338 / 0.494 / 0.830). Smoke training runs in the CI `ml` job.

---

## 7. Mobile App Architecture

### 7.1 Project Structure

```
TimeTravelMobile/
├── App.tsx                          # Entry: providers + store init
├── index.ts                         # Expo entry
├── app.json                         # Expo config (plugins, icons, deep links)
├── package.json                     # Dependencies (~60 packages)
│
├── src/
│   ├── navigation/                  # Navigation system (NavOS active)
│   │   ├── NavOS/index.tsx          # Active navigator (stack + deep linking)
│   │   ├── BottomTabNavigator.tsx   # 5-tab navigation with error boundaries
│   │   ├── stacks/                  # 10 stack navigators (Home, Explore, Chat, etc.)
│   │   ├── components/              # ErrorBoundary, LazyScreen, AnimatedTabIcon
│   │   ├── config/                  # Tab configs, deep link config
│   │   ├── context/                 # AuthContext (React context)
│   │   └── services/               # NavigationService (ref-based)
│   │
│   ├── screens/                    # 23 screens (lazy-loaded in stacks)
│   │   ├── HomeScreen.tsx
│   │   ├── ChatScreen.tsx
│   │   ├── ExploreScreen.tsx
│   │   ├── TripsScreen.tsx
│   │   ├── ProfileScreen.tsx       # → features/profile/
│   │   ├── BudgetScreen.tsx
│   │   ├── ItineraryScreen.tsx
│   │   ├── CompareScreen.tsx
│   │   ├── PackingScreen.tsx
│   │   ├── ReservationsScreen.tsx
│   │   ├── ExpenseTrackerScreen.tsx
│   │   ├── TravelJournalScreen.tsx
│   │   ├── FavoritesScreen.tsx
│   │   ├── NewsFeedScreen.tsx
│   │   ├── PlacesScreen.tsx
│   │   ├── CurrencyScreen.tsx
│   │   ├── RoutePlannerScreen.tsx
│   │   ├── PhrasebookScreen.tsx
│   │   ├── TripSharingScreen.tsx
│   │   ├── TravelStatsScreen.tsx
│   │   ├── TripWorkspaceScreen.tsx
│   │   ├── DestinationDetailScreen.tsx
│   │   └── AuthScreen.tsx          # → features/auth/
│   │
│   ├── features/                   # Feature modules (domain-bounded)
│   │   ├── auth/                   # AuthScreen, hooks, social auth, config
│   │   ├── compare/                # scoringEngine, insightEngine, hooks
│   │   ├── explore/                # useExploreEngine, categories, scoring
│   │   ├── phrasebook/             # SearchEngine, VoiceService, store
│   │   ├── profile/                # ProfileScreen, hooks, travel DNA
│   │   ├── travel-intelligence/    # TravelDNAChart, AI assistant modal
│   │   └── trip-sharing/          # ShareCard, TripSelector, empty/error states
│   │
│   ├── stores/                     # Zustand state management
│   │   ├── authStore.refactored.ts  # Auth state, tokens in SecureStore
│   │   ├── authStore.ts             # Legacy auth (deprecated but still referenced)
│   │   ├── preferenceStore.ts       # User preferences (persisted)
│   │   ├── uiStore.ts               # Theme, UI state
│   │   ├── mapStore.ts              # Map region, markers
│   │   ├── itineraryStore.ts        # Saved itineraries (persisted)
│   │   ├── journalStore.ts          # Journal drafts (not persisted)
│   │   ├── tripsStore.ts            # Trip browsing state
│   │   ├── routeStore.ts            # Route preferences
│   │   ├── travelIntelligenceStore.ts # AI cache, preferences (persisted)
│   │   └── userBehaviorStore.ts     # Events, badges, streak (persisted)
│   │
│   ├── services/                   # API clients + business services
│   │   ├── apiClientImpl.ts         # Axios client (active, retry, 401 queue)
│   │   ├── api.ts                   # Legacy client (used by some stores)
│   │   ├── authV2.ts               # JWT auth service
│   │   ├── tokenManagerCore.ts     # Token storage + refresh
│   │   ├── secureStorage.ts        # expo-secure-store wrapper
│   │   ├── offlineQueue.ts         # Offline mutation queue
│   │   └── ...                     # 20+ feature service files
│   │
│   ├── components/                 # Reusable UI components
│   │   ├── Chat/                   # ChatBubble, MessageStatus, TypingIndicator
│   │   ├── Common/                 # LoadingSpinner, ErrorMessage, ExpoMap
│   │   ├── UI/                     # GlassCard, PressableScale, SkeletonLoader
│   │   ├── Weather/                # WeatherCard, hooks, adapter, utils
│   │   ├── ItineraryMap/          # MapView, itineraryMapEngine
│   │   ├── Features/              # DestinationCard, SafetyBadge, WeatherCard
│   │   └── Trips/                 # FeatureCard, featureConfig
│   │
│   ├── hooks/                      # Shared custom hooks (10+)
│   │   ├── useAuth.ts
│   │   ├── useChatAgent.ts
│   │   ├── useBudgetPlanner.ts
│   │   └── ...
│   │
│   ├── api/                        # React Query setup
│   │   ├── client.ts               # Axios base
│   │   ├── queryClient.ts          # QueryClient config
│   │   ├── queryKeys.ts            # Query key factory
│   │   └── queries/                # useAuth, useDestinations, useRecommendations
│   │
│   ├── core/                       # Infrastructure modules
│   │   ├── api/ApiOrchestrator.ts  # Fetch-based client (unused)
│   │   ├── cache/CacheManager.ts   # Memory cache
│   │   ├── errors/                 # AppError, NetworkError
│   │   ├── network/NetworkManager.ts
│   │   ├── offline/                # OfflineManager, SyncQueue
│   │   ├── streaming/              # StreamingManager for AI responses
│   │   └── telemetry/              # Analytics, Logger, Metrics
│   │
│   ├── domain/                     # Domain models + services
│   │   ├── models/                 # Destination, UserPreferences
│   │   ├── services/recommendation/ # DestinationScorer, RecommendationService
│   │   ├── agents/                 # IntentParserAgent
│   │   └── constants/              # DestinationTags
│   │
│   ├── constants/                  # Config (dev + prod)
│   │   ├── config.ts               # API URL resolution (env → LAN IP → fallback)
│   │   └── config.production.ts    # Prod re-export
│   │
│   ├── theme/colors.ts            # Light/dark theme definitions
│   ├── types/                      # Shared TypeScript types
│   └── utils/                      # cache.ts, errorHandler.ts, geoUtils.ts, etc.
```

---

## 8. Navigation Architecture

### 8.1 Navigator Tree (Active: NavOS)

```
NavigationContainer (deep linking: timetravel://)
└── Stack.Navigator<RootStackParamList>
    ├── [unauthenticated]
    │   └── AuthScreen
    │
    └── [authenticated]
        ├── MainTabs (BottomTabNavigator)
        │   ├── Tab: Home → HomeStack (lazy)
        │   │   └── HomeMain, HomeDetail
        │   ├── Tab: Explore → ExploreStack (lazy)
        │   │   └── ExploreMain, DestinationDetail, etc.
        │   ├── Tab: Chat → ChatStack (lazy)
        │   │   └── ChatMain
        │   ├── Tab: Trips → TripsStack (lazy)
        │   │   └── TripsMain, TripDetail, etc.
        │   └── Tab: Profile → ProfileStack (lazy)
        │       └── ProfileMain, Settings, etc.
        │
        └── + 17 detail screens (eager-loaded)
            ├── BudgetScreen, ItineraryScreen, PackingScreen,
            ├── ReservationsScreen, ExpenseTrackerScreen,
            ├── TravelJournalScreen, TripSharingScreen,
            ├── FavoritesScreen, NewsFeedScreen, PlacesScreen,
            ├── CurrencyScreen, RoutePlannerScreen,
            ├── PhrasebookScreen, TravelStatsScreen,
            ├── TripWorkspaceScreen, CompareScreen,
            └── DestinationDetailScreen
```

### 8.2 Deep Linking

- **Scheme:** `timetravel://`
- **Universal links:** `https://timetravel.app`, `https://*.timetravel.app`
- **Config:** Inline in `NavOS/index.tsx` + duplicate in `navigation/config.ts`

### 8.3 Auth Guard

```typescript
<Stack.Navigator>
  {isAuthenticated ? (
    <Stack.Screen name="MainTabs" component={MainTabs} />
    <Stack.Screen name="Budget" component={BudgetScreen} />
    // ... 16 more authenticated screens
  ) : (
    <Stack.Screen name="Auth" component={AuthScreen} />
  )}
</Stack.Navigator>
```

---

## 9. State Management

### 9.1 Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                   STATE ARCHITECTURE                           │
│                                                               │
│  CLIENT STATE (Zustand)       │  SERVER STATE (React Query)   │
│  ─────────────────────        │  ─────────────────────────    │
│  • authStore (tokens only)    │  • useDestinations()          │
│  • preferenceStore (filters)  │  • useItineraries()           │
│  • mapStore (map state)       │  • useTrips()                 │
│  • uiStore (UI state)         │  • useFavorites()             │
│  • itineraryStore (saved)     │  • useAuth (mutations)        │
│  • journalStore (drafts)      │                               │
│  • tripsStore (browsing)      │  Persisted with cache inval-  │
│  • routeStore (preferences)   │  idation, refetch, pagination │
│  • travelIntelligenceStore    │                               │
│  • userBehaviorStore          │                               │
│                                                               │
│  Persisted via Zustand        │  Cached via React Query       │
│  `persist` middleware         │  `staleTime`/`cacheTime`      │
│  → AsyncStorage               │  → In-memory                  │
└───────────────────────────────────────────────────────────────┘
```

### 9.2 Store Details

| Store | Persisted | Storage | Keys | Notes |
|-------|-----------|---------|------|-------|
| `authStore.refactored` | Yes | SecureStore + AsyncStorage | `{status, expiresAt}` | Tokens in SecureStore |
| `preferenceStore` | Yes | AsyncStorage | preferences, filters, viewMode, recentSearches | |
| `uiStore` | Manual | AsyncStorage (single key) | themeDark | Custom persistence |
| `mapStore` | No | — | region, markers, selectedMarker | |
| `itineraryStore` | Yes | AsyncStorage | savedItineraries | |
| `journalStore` | No | — | drafts, entries, feed | subscribeWithSelector |
| `tripsStore` | Yes | AsyncStorage | recentlyUsed, favorites, viewMode | |
| `routeStore` | Yes | AsyncStorage | preferences, behavior, recentPlaces | |
| `travelIntelligenceStore` | Yes | AsyncStorage | userPreferences, aiCache, activeTrip | AI cache (20 entries) |
| `userBehaviorStore` | Yes | AsyncStorage | events (1000), badges, streak, level | Gamification |

---

## 10. Infrastructure

### 10.1 Docker

```
Development (docker-compose.yml)
└── web: Flask app (gunicorn 4 workers, SQLite)

Production (docker-compose.prod.yml)
├── nginx: Reverse proxy, SSL, rate limiting
├── web: Flask app (gunicorn 4 workers, PostgreSQL, Redis)
├── postgres: PostgreSQL 15 (2 CPU, 2G RAM, 1GB RAM limit)
├── redis: Redis 7 (0.5 CPU, 512M RAM, AOF persistence)
├── celery-worker: Background tasks (shared with web image)
├── prometheus: Monitoring (:latest)
└── grafana: Dashboards (:latest)

Kubernetes (deploy/kubernetes/deployment.yml)
├── Namespace: timetravel
├── ConfigMap + Secret (env vars)
├── Deployment: 3 replicas, RollingUpdate, HPA (CPU 70%, mem 80%)
├── Postgres StatefulSet: 1 replica, 20Gi PVC
├── Redis: 1 replica, emptyDir (non-persistent)
├── Service: ClusterIP port 80 → 5001
├── Ingress: nginx, cert-manager, 100 req/s limit
└── Pod anti-affinity (preferred)
```

### 10.2 CI/CD (`.github/workflows/ci.yml`)

```
on: push/PR to main/master/develop

jobs:
  lint → flake8 + black check
  test → matrix: 3.11, 3.12, pytest --cov-fail-under=60
  integration → PostgreSQL service, integration tests
  typescript → npx tsc --noEmit (mobile app)
  docker → build + smoke test (health endpoint)
```

### 10.3 Redis Usage

| Purpose | Service | Key Pattern | TTL |
|---------|---------|-------------|-----|
| JWT blacklist | `jwt_service_v2` | `blacklist:{jti}` | Token expiry |
| Token storage | `jwt_service_v2` | `session:{sid}` | Session TTL |
| Cache | `cache_service` | Namespaced prefixes | Configurable per entry |

---

## 11. Data Flow

### 11.1 Authentication Flow

```
Mobile App                          Flask API
    │                                  │
    │  POST /api/auth/v2/login         │
    │  {email, password, device_id}    │
    │ ──────────────────────────────>  │
    │                                  ├── validate input
    │                                  ├── find user by email
    │                                  ├── bcrypt.check_password()
    │                                  ├── jwt_service_v2.create_token_pair()
    │                                  │   ├── access_token (15 min)
    │                                  │   └── refresh_token (7 days)
    │                                  └── return TokenPair
    │ <────────────────────────────── │
    │                                  │
    │  Store tokens:                   │
    │  ├── refresh_token → SecureStore │
    │  └── access_token → memory      │
    │                                  │
    │  GET /api/profile/summary       │
    │  Authorization: Bearer <token>  │
    │ ──────────────────────────────>  │
    │                                  ├── resolve_user_id()
    │                                  │   ├── verify_token()
    │                                  │   └── return uid
    │                                  ├── get_travel_stats(uid)
    │                                  ├── ai_insights_service(uid)
    │                                  └── return profile data
    │ <────────────────────────────── │
```

### 11.2 Chat/AI Flow

```
User Input → ChatScreen
  → apiClient.post("/api/chat", {message, session_id})
  → chatbot.py chat_endpoint()
    → AIPromptSanitizer.sanitize_input(message)
      ├── safe → continue
      └── blocked → return safe refusal
    → chat_with_gemini(message, session_id, api_key)
      → Gemini API (gemini-2.5-flash)
      → return {reply, model, mode}
    → _persist_message(session_id, user_msg, reply)
    → return jsonify({reply, session_id, ...})
  → API response
  → Update chat UI with reply
```

### 11.3 Itinerary Generation Flow

```
User Request → ItineraryScreen
  → apiClient.post("/api/itinerary/generate", ...)
  → itinerary.py generate_itinerary()
    → _build_budget_estimate()
    → AIPromptSanitizer.sanitize_input(interests)
    → _configure(api_key)  # Gemini
    → _model.generate_content(prompt)
    → _extract_json(response)  # Parse JSON from AI
    → _build_route_points()    # Geocode places
    → return {itinerary, budget, route_points, ...}
  → Cache itinerary locally (travelIntelligenceStore)
  → Render day-by-day view
```

---

## 12. Security Architecture

### 12.1 Layers

```
┌────────────────────────────────────────────────────────────┐
│                  SECURITY LAYERS                            │
│                                                            │
│  Network:                                                   │
│  ├── CSP headers (script-src, style-src restricted)        │
│  ├── HSTS (max-age=31536000, includeSubDomains)            │
│  ├── X-Frame-Options: DENY                                 │
│  ├── X-Content-Type-Options: nosniff                       │
│  ├── Referrer-Policy: strict-origin-when-cross-origin      │
│  └── Permissions-Policy (camera/mic denied)                │
│                                                            │
│  Rate Limiting:                                             │
│  ├── Global: 2000/day, 500/hour                            │
│  ├── Auth register: 20/hour                                │
│  ├── Auth login: 30/minute                                 │
│  └── Chat: 20/minute                                       │
│                                                            │
│  Authentication:                                            │
│  ├── Session cookies (v1 web) + JWT bearer (v2 mobile)     │
│  ├── Access tokens: 15 min, Refresh tokens: 7 days         │
│  ├── Token rotation on refresh                             │
│  ├── Device fingerprinting                                  │
│  └── Redis-backed blacklisting                             │
│                                                            │
│  Input Validation:                                          │
│  ├── AIPromptSanitizer (18 injection patterns)             │
│  ├── PII redaction (CC, SSN, email, phone, API keys)      │
│  ├── Password requirements (8+ chars, upper, lower,        │
│  │   digit, special)                                       │
│  └── File upload: extension whitelist, size limit,         │
│      secure_filename(), path traversal protection          │
│                                                            │
│  Database:                                                  │
│  ├── bcrypt password hashing                                │
│  ├── RLS policies (Supabase) with app.user_id              │
│  └── SQLAlchemy parameterized queries (no raw SQL)         │
│                                                            │
│  Secrets:                                                   │
│  ├── .env file (gitignored)                                 │
│  ├── SECRET_KEY enforced in production                      │
│  ├── JWT_SECRET_KEY required (32+ chars)                   │
│  └── Docker/K8s secrets management                         │
└────────────────────────────────────────────────────────────┘
```

### 12.2 Auth Middleware Stack

```
Request → CORS check → CSRF exemption (API paths) → Rate limit check
  → Flask-Login session check (cookie) OR JWT check (Authorization header)
    → resolve_authenticated_user() → sets g.user_id, g.user_email
      → Route handler
```

---

## Architecture Summary

| Dimension | Technology | Key Metric |
|-----------|-----------|------------|
| **Backend framework** | Flask 3.x (app factory) | 32 blueprints, 40+ services |
| **Database** | SQLAlchemy ORM (PostgreSQL + SQLite) | 18 entities, Alembic migrations |
| **Cache** | Redis + InMemory fallback | Pool max 20 connections |
| **Auth** | Flask-Login (web) + JWT v2 (mobile) | Access 15min, Refresh 7 days |
| **AI** | Gemini 2.5 Flash + scikit-learn | Prompt injection sanitized |
| **Mobile** | React Native 0.81 + Expo SDK 54 | 23 screens, 5 tabs |
| **State** | Zustand (client) + React Query (server) | 10 stores, 8 persisted |
| **API** | REST (JSON) | 60+ endpoints |
| **Deploy** | Docker + K8s + GitHub Actions | 3-replica HPA, cert-manager |
| **Monitoring** | Prometheus + Grafana | Included in prod compose |

---

*Generated 2026-07-28 — Full architecture audit of `/Users/laxmanp/Pictures/TIMETRAVEL copy`*
