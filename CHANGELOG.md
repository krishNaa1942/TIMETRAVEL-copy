# Changelog

All notable changes to the TimeTravel project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.0.0] — 2026-07-08

### Added
- **ExploreScreen V6**: Responsive layout (2/3/4 columns), FlashList performance optimizations, Reanimated search overlay, skeleton loading, pull-to-refresh
- **NavOS Navigation**: Production-grade auth-gated navigation with error boundaries, token refresh, and lazy-loaded tab stacks
- **Auth V2**: JWT token management with secure refresh, blacklisting, and device-aware sessions
- **AI Chat**: Gemini-powered travel assistant with streaming responses
- **Budget Planner**: Real-time expense tracking with currency conversion
- **Route Planner**: Multi-stop itinerary with TomTom Maps integration
- **Travel Intelligence**: Zustand-powered recommendation engine with offline-first architecture
- **Itinerary System**: AI-generated day-by-day plans with drag-and-drop reordering
- **Destination Detail**: Weather, safety scores, Unsplash photos, Foursquare places, budget estimates
- **200+ Indian Destinations**: Curated database with categories, regions, and seasonal recommendations

### Infrastructure
- Flask backend with blueprints, SQLAlchemy ORM, rate limiting, CORS
- Supabase PostgreSQL for persistent data
- Docker & Docker Compose for production deployment
- GitHub Actions CI/CD pipeline

## [1.0.0] — 2026-02-15

### Added
- Initial web-based travel planning application
- Basic destination browsing and search
- Flask backend with SQLite
- User authentication with Flask-Login
