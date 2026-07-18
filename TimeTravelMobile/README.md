# 🌍 Time To Travel — AI Smart Tourism Assistant

> A full-stack, cross-platform travel companion built with **React Native (Expo)** and a **Flask** backend. Discover destinations across India, plan trips with AI-powered itineraries, track expenses, chat with an intelligent travel bot, and much more — all from a single, beautifully designed app.

---

## ✨ Feature Highlights

| Category | Features |
|---|---|
| **🏠 Home** | Trending destinations, featured collections, personalized recommendations |
| **🔍 Explore** | Browse 200+ Indian destinations with filters, categories, and search |
| **📍 Destination Detail** | Weather, safety info, photos (Unsplash), nearby places (Foursquare), budget estimates |
| **🗺️ Route Planner** | Multi-stop route planning with TomTom Maps, distance & duration estimates |
| **🗓️ Itinerary** | AI-generated day-by-day itineraries with activity scheduling |
| **💬 AI Chat** | Conversational travel assistant powered by Google Gemini |
| **💰 Expense Tracker** | Log trip expenses, view summaries, currency conversion |
| **🎒 Packing List** | Smart packing suggestions based on destination & weather |
| **📰 News Feed** | Travel news & trending stories via NewsAPI |
| **🌐 Phrasebook** | Local language phrases with translations |
| **📊 Travel Stats** | Personal travel statistics and analytics |
| **📝 Travel Journal** | Document your trips with notes and media |
| **🔄 Trip Sharing** | Share itineraries and collaborate with fellow travelers |
| **💱 Currency** | Real-time currency conversion |
| **⭐ Favorites** | Save and organize favorite destinations |
| **🏨 Reservations** | Track bookings and reservations |
| **📋 Trip Workspace** | All-in-one trip management dashboard |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              Mobile / Web Client            │
│         React Native (Expo SDK 54)          │
│                                             │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ NavOS   │ │ Zustand  │ │ React Query  │ │
│  │ Router  │ │ Stores   │ │ Data Fetch   │ │
│  └────┬────┘ └────┬─────┘ └──────┬───────┘ │
│       └───────────┼──────────────┘          │
└───────────────────┼─────────────────────────┘
                    │ HTTP / REST
┌───────────────────┼─────────────────────────┐
│           Flask Backend (Python)            │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Auth v2  │ │ REST API │ │  Services   │ │
│  │ JWT/OAuth│ │ 30+ rts  │ │  Layer      │ │
│  └──────────┘ └──────────┘ └──────┬──────┘ │
│                                   │         │
│  ┌────────────────────────────────┼───────┐ │
│  │          External APIs         │       │ │
│  │ Gemini · TomTom · Unsplash    │       │ │
│  │ Foursquare · OpenWeather      │       │ │
│  │ NewsAPI · Supabase            │       │ │
│  └────────────────────────────────┘       │ │
│                                           │ │
│  ┌────────────┐  ┌─────────────────────┐  │ │
│  │  SQLite    │  │  Supabase (Cloud)   │  │ │
│  │  (local)   │  │  PostgreSQL + Auth  │  │ │
│  └────────────┘  └─────────────────────┘  │ │
└───────────────────────────────────────────┘ │
```

### Frontend Stack

- **React Native** `0.81` with **Expo SDK 54**
- **TypeScript** for full type safety
- **Zustand** for state management (auth, trips, preferences, routes, journals, map, UI)
- **React Query** (`@tanstack/react-query`) for server data fetching & caching
- **React Navigation** v7 with bottom tabs + stack navigators
- **React Native Paper** (Material Design 3) for native UI components
- **React Native Reanimated** + **Gesture Handler** for fluid animations
- **expo-secure-store** for token storage, **expo-location** for geolocation

### Backend Stack

- **Flask** 3.x with **Flask-SQLAlchemy**, **Flask-CORS**, **Flask-Limiter**
- **JWT v2** authentication with refresh tokens + OAuth (Google / Apple)
- **Google Gemini AI** for chatbot, itineraries, and travel intelligence
- **Supabase** (PostgreSQL + Auth) for cloud persistence
- **SQLite** for zero-config local development
- **30+ REST API endpoints** across destinations, auth, trips, weather, maps, and more

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| **Node.js** | ≥ 18 |
| **Python** | ≥ 3.11 |
| **npm** | ≥ 9 |
| **Expo CLI** | bundled via `npx expo` |

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd "TIMETRAVEL copy"
```

### 2. Backend Setup

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate    # macOS/Linux
# .venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and fill in your API keys (see Environment Variables below)

# Start the Flask server
python run.py
# → Server runs at http://0.0.0.0:5001
```

### 3. Frontend Setup

```bash
cd TimeTravelMobile

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to your backend:
#   Android emulator:  http://10.0.2.2:5001/api
#   iOS simulator:     http://127.0.0.1:5001/api
#   Physical device:   http://<your-LAN-IP>:5001/api

# Start Expo dev server
npx expo start
```

### 4. Run the App

| Platform | Command |
|---|---|
| Web | `npx expo start --web` → opens at `http://localhost:8081` |
| Android | `npx expo start --android` or press `a` in the terminal |
| iOS | `npx expo start --ios` or press `i` in the terminal |
| Both servers | `npm run dev:full` (starts backend + Expo together) |

---

## 🔑 Environment Variables

### Backend (`.env` at project root)

| Variable | Description | Where to get it |
|---|---|---|
| `SECRET_KEY` | Flask session secret | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `SUPABASE_URL` | Supabase project URL | [supabase.com](https://supabase.com) → Project Settings → API |
| `SUPABASE_KEY` | Supabase anon key | Same as above |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Same as above |
| `GOOGLE_API_KEY` | Google Gemini AI key | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `OPENWEATHER_API_KEY` | Weather data | [openweathermap.org](https://openweathermap.org/api) |
| `TOMTOM_API_KEY` | Maps & routing | [developer.tomtom.com](https://developer.tomtom.com/) |
| `UNSPLASH_ACCESS_KEY` | Destination photos | [unsplash.com/developers](https://unsplash.com/developers) |
| `FOURSQUARE_API_KEY` | Places & POIs | [developer.foursquare.com](https://developer.foursquare.com/) |
| `NEWSAPI_KEY` | Travel news | [newsapi.org](https://newsapi.org/register) |

### Frontend (`.env` in `TimeTravelMobile/`)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend API URL (e.g., `http://192.168.1.50:5001/api`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth Web Client ID |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS Client ID |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android Client ID |

---

## 📁 Project Structure

```
TIMETRAVEL/
├── app/                          # Flask Backend
│   ├── api/
│   │   ├── middleware/           # Auth guards, rate limiting
│   │   └── routes/               # 30+ REST endpoints
│   │       ├── auth_v2.py        # JWT auth + OAuth
│   │       ├── destinations.py   # Destination CRUD
│   │       ├── chatbot.py        # AI chat
│   │       ├── itinerary.py      # AI itinerary generation
│   │       ├── weather.py        # Weather forecasts
│   │       ├── maps.py           # Route planning
│   │       ├── places.py         # Foursquare POI search
│   │       ├── expenses.py       # Expense tracking
│   │       ├── favorites.py      # Saved destinations
│   │       └── ...               # + 20 more
│   ├── models/                   # SQLAlchemy models
│   ├── services/                 # Business logic layer
│   │   ├── gemini_service.py     # Google Gemini AI
│   │   ├── weather_service.py    # OpenWeatherMap
│   │   ├── maps_service.py       # TomTom routing
│   │   ├── foursquare_service.py # Places API
│   │   ├── unsplash_service.py   # Photo service
│   │   ├── recommendation_engine.py # ML recommendations
│   │   ├── jwt_service_v2.py     # Token management
│   │   └── ...                   # + 25 more
│   └── main.py                   # App factory
│
├── TimeTravelMobile/             # React Native Frontend
│   ├── App.tsx                   # Root component
│   ├── src/
│   │   ├── api/                  # Axios client + React Query
│   │   ├── components/           # Shared UI components
│   │   ├── core/                 # Telemetry, error handling
│   │   ├── domain/               # Domain models
│   │   ├── features/             # Feature modules
│   │   │   ├── auth/             # Authentication flow
│   │   │   ├── profile/          # User profile
│   │   │   ├── phrasebook/       # Language phrasebook
│   │   │   ├── compare/          # Destination comparison
│   │   │   └── travel-intelligence/ # AI insights
│   │   ├── hooks/                # Custom React hooks
│   │   ├── navigation/           # NavOS routing system
│   │   │   ├── NavOS/            # Enterprise navigation
│   │   │   ├── stacks/           # Stack navigators
│   │   │   └── BottomTabNavigator.tsx
│   │   ├── screens/              # 23 screen components
│   │   ├── services/             # API service layer
│   │   ├── stores/               # Zustand state stores
│   │   ├── theme/                # Colors, typography, tokens
│   │   └── types/                # TypeScript definitions
│   ├── app.json                  # Expo configuration
│   └── package.json
│
├── data/                         # Seed data & datasets
├── scripts/                      # Dev & migration scripts
├── tests/                        # Backend test suite
├── run.py                        # Backend entry point
├── requirements.txt              # Python dependencies
└── docker-compose.yml            # Docker setup
```

---

## 🧪 Testing

### Backend Tests

```bash
# From project root (with venv activated)
pytest tests/ -v --cov=app
```

### Validate Destinations Data

```bash
python scripts/validate_destinations.py
```

---

## 🐳 Docker

```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📡 API Reference (Key Endpoints)

All endpoints are prefixed with `/api`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/v2/login` | Email/password login → JWT tokens |
| `POST` | `/auth/v2/register` | Create account |
| `POST` | `/auth/v2/refresh` | Refresh access token |
| `GET` | `/destinations` | List all destinations |
| `GET` | `/destinations/trending` | Trending destinations |
| `GET` | `/destinations/featured` | Featured collections |
| `GET` | `/destinations/:id` | Destination detail |
| `GET` | `/weather/:city` | Current weather |
| `POST` | `/chatbot/message` | AI chat message |
| `POST` | `/itinerary/generate` | AI itinerary generation |
| `GET` | `/places/nearby` | Nearby POIs (Foursquare) |
| `GET` | `/maps/route` | Route calculation (TomTom) |
| `GET/POST` | `/expenses` | Expense CRUD |
| `GET` | `/expenses/summary` | Expense summary |
| `POST` | `/budget/estimate` | Budget estimation |
| `POST` | `/packing/generate` | Smart packing list |
| `GET` | `/news/trending` | Trending travel news |
| `GET` | `/currency/convert` | Currency conversion |
| `GET/POST` | `/favorites` | Favorites CRUD |
| `GET/POST` | `/notes` | Travel notes CRUD |
| `GET` | `/trips/planner` | Trip planner data |
| `GET` | `/stats` | Travel statistics |
| `GET` | `/health` | Health check |

---

## 🛡️ Security

- **JWT v2** access + refresh token architecture
- **bcrypt** password hashing
- **Flask-Limiter** rate limiting on all endpoints
- **CORS** configured for allowed origins
- **expo-secure-store** for encrypted token storage on device
- **Input validation** on all API endpoints

---

## 📄 License

This project is private and proprietary. All rights reserved.

---

<p align="center">
  Built with ❤️ for travelers who love India
</p>
