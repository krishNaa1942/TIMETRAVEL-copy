# Frontend Screen Audit — Time To Travel Mobile

**Date:** 2026-08-02 (live-verified: backend running on :5001, API responses probed)
**Scope:** All 23 screens — frontend↔backend↔database integration, screen-to-screen navigation, per-screen strengths/drawbacks/improvements, phased remediation plan.

---

## Executive Summary

| Dimension | Verdict |
|---|---|
| Screen coverage | All 23 screens registered + reachable; 5 tabs + 17 stack screens |
| Frontend↔Backend integration | **🔴 8 dead endpoint groups** (mobile calls routes that 404) |
| Database integration | **🔴 Schema drift** (`chat_messages.destination` missing in `supabase/schema.sql`); alembic initial migration is a no-op |
| Navigation integrity | **🔴 3 unregistered routes** + 7 wrong tab names (`ExploreTab`→`Explore` etc.) + 3 conflicting `RootStackParamList` definitions |
| Screen quality | 🟡 Mixed — 10 screens strong (Home, Explore, Chat, Trips, TripWorkspace, DestinationDetail, Budget, Itinerary, Compare, Places), 6 broken or dead-end (TravelJournal, TripSharing partial, Reservations partial, TripWorkspace sub-views), rest functional-but-shallow |
| Dead code | 🟡 AuthContext, LazyScreenWrapper, NavigationErrorBoundary, NavigationAnalytics, legacy nav types, authStore.refactored |

**Bottom line:** Screens are *built* but not all *integrated*. The largest user-visible defects are dead navigations (tapping a button does nothing), journal/notes hitting a nonexistent endpoint, and profile actions pointing at a nonexistent `/api/user/*` backend. Everything else is polish, consolidation, and data-quality work.

---

## Part 1 — Screen Inventory & Integration Matrix

Legend: ✅ integrated · 🟡 partial (works, but weak/fallback) · 🔴 broken (404 / dead link / schema mismatch) · ⚪ static/local-only

| # | Screen | File | Tabs/Stack | Data source | Backend integration | DB tables used | Screen-to-screen links |
|---|---|---|---|---|---|---|---|
| 1 | **Auth** | `features/auth/AuthScreen` | Root (guest) | `useAuth`/`authService` | ✅ v1+v2 register/login/refresh | users | → MainTabs |
| 2 | **Home** | `HomeScreen.tsx` | Tab Home | `useDestinations`, `useFeaturedDestinations`, `useTrendingDestinations`, `useRecommendations`, `destinationsService`, `weatherService` | ✅ (P10-11 live) | chat_messages (via chat) | 🔴 → MainTabs w/ wrong tab names (`ExploreTab`,`ProfileTab`,`TripsTab`) |
| 3 | **Explore** | `ExploreScreen.tsx` | Tab Explore | `useExploreEngine` (destinations/search), `useRecommendations` | ✅ (P11 filters live) | — (static JSON) | ✅ → DestinationDetail |
| 4 | **Chat** | `ChatScreen.tsx` | Tab Chat | `useChatAgent` | ✅ real ML metadata (P9) | chat_messages (persisted) | ✅ → Budget/Itinerary/Places/Compare via smart suggestions |
| 5 | **Trips** | `TripsScreen.tsx` | Tab Trips | `useTripsFeatures`, `useTripsStore` | 🟡 `/api/trips` (TripQuery) + `/api/trips/planner` (Trip) mixed | trip_queries + trips | 🔴 `MainApp` unregistered; 🔴 service calls `POST/PUT /api/trips` that don't exist |
| 6 | **Profile** | `features/profile/screens/ProfileScreen` | Tab Profile | `useProfileData`, `useProfileActions` | 🟡 `/api/profile/summary` ✅; 🔴 `/api/user/*` (6 endpoints) don't exist | users + aggregate queries | 🟡 action routes (valid names, but features behind them 404) |
| 7 | **DestinationDetail** | `DestinationDetailScreen.tsx` | Stack | `useDestinationDetail`, related | ✅ | — | ✅ → Budget/Itinerary/Packing/Chat/Compare |
| 8 | **Budget** | `BudgetScreen.tsx` | Stack | `useBudgetPlanner` | ✅ `/api/budget/estimate` | trip_queries (writes) | 🟡 route param `destination` vs `destinationId` mismatch |
| 9 | **Itinerary** | `ItineraryScreen.tsx` | Stack | `useItinerary`, `mapsService` | ✅ `/api/itinerary/generate` | — | ✅ → Export? (no UI) |
| 10 | **Packing** | `PackingScreen.tsx` | Stack | `packingService`, weather | ✅ `/api/packing/*` | packing_items | ✅ |
| 11 | **Favorites** | `FavoritesScreen.tsx` | Stack | `favoritesService` | 🟡 `/api/favorites/*` ✅; 🔴 `useDestinations.ts:179` calls `POST /favorites/toggle` (404) | favorites | ✅ → DestinationDetail |
| 12 | **Currency** | `CurrencyScreen.tsx` | Stack | `currencyService` | ✅ `/api/currency/*` | — | ⚪ deep-link/feature-grid only |
| 13 | **Compare** | `CompareScreen.tsx` | Stack | `useCompare` | ✅ `/api/compare` | — | ⚪ chat + grid only |
| 14 | **Places** | `PlacesScreen.tsx` | Stack | `usePlaces`, `useLocation` | ✅ `/api/places/search` etc. | — | ✅ |
| 15 | **RoutePlanner** | `RoutePlannerScreen.tsx` | Stack | `useRouteStore`, `useLocation` | ✅ `/api/maps/route` | — | ⚪ profile+grid only |
| 16 | **TripWorkspace** | `TripWorkspaceScreen.tsx` | Stack | `tripPlanner` service | ✅ `/api/trips/planner/*` | trips, trip_days, trip_places, companions | 🔴 PlaceDetail/CompanionDetail/AddCompanion unregistered; param mismatches to TripSharing/Expenses/Packing/Reservations |
| 17 | **Expenses** | `ExpenseTrackerScreen.tsx` | Stack | `expenseService` | ✅ `/api/expenses/*` | expenses | ✅ |
| 18 | **TravelJournal** | `TravelJournalScreen.tsx` | Stack | `journalService` | 🔴 **`/api/journal/notes*` 404** — backend has `/api/notes` (live-verified) | travel_notes (intended) | 🔴 breaks everything on the screen |
| 19 | **Reservations** | `ReservationsScreen.tsx` | Stack | `reservationService`, `tripPlannerService` | ✅ `/api/reservations/*` | reservations | ✅ |
| 20 | **TripSharing** | `TripSharingScreen.tsx` | Stack | `features/trip-sharing` | 🟡 `/api/share/*` ✅ but param mismatch (trip object vs tripId) | shared_trips | 🟡 never preselected from workspace |
| 21 | **NewsFeed** | `NewsFeedScreen.tsx` | Stack | `newsService` | ✅ `/api/news/travel|trending|safety` | — | ⚪ grid+deep-link only |
| 22 | **TravelStats** | `TravelStatsScreen.tsx` | Stack | travel-intelligence feature | ✅ `/api/stats` | aggregates | ⚪ profile+grid only |
| 23 | **Phrasebook** | `PhrasebookScreen.tsx` | Stack | `phrasebookService`, store | ✅ `/api/language/phrases` | — | ⚪ grid+deep-link only |

---

## Part 2 — Cross-Cutting Findings (highest impact first)

### 🔴 F1. Dead navigation links (buttons that do nothing)
Verified at `TripWorkspaceScreen.tsx:749,840,858` — `PlaceDetail`, `CompanionDetail`, `AddCompanion` are **not registered routes** (survive TS via `as any`). Tapping opens nothing.
Also `TripsScreen.tsx:199-203` navigates to `MainApp` (phantom route) with inner tab `ExploreTab` (wrong name).

### 🔴 F2. Wrong tab names in HomeScreen (7 call sites)
`HomeScreen.tsx:723-797,891` navigates `MainTabs → {screen: "ExploreTab"|"ProfileTab"|"TripsTab"}`. Real tab routes are `Explore`, `Profile`, `Trips`. Tapping these silently fails (no-op) or crashes to error boundary. `QUICK_ACTIONS` routes `Itinerary`/`Budget` wrapped as tabs also fail.

### 🔴 F3. TravelJournal hits a nonexistent endpoint
`journalService.ts` calls `/journal/notes*` (→ `/api/journal/notes*` via baseURL) → **404, live-verified**. Backend implements `/api/notes` (notes.py). The whole screen is non-functional; also `/journal/notes/<id>/recommendations` and `/places/autocomplete` don't exist.

### 🔴 F4. Profile screen depends on a missing `/api/user/*` backend
`profileService.ts:135-196` — avatar upload URL, avatar POST, account DELETE, export GET, preferences PUT, achievements GET — **no `/api/user` blueprint exists at all**. These profile actions will 404.

### 🔴 F5. Mobile expects CRUD + duplicate on `/api/trips` that don't exist
`services/trips.ts:51,56,72` — `POST /api/trips`, `PUT /api/trips/<id>`, `POST /api/trips/<id>/duplicate`. Backend `trips.py` has only GET/DELETE (TripQuery history). The full CRUD lives on `/api/trips/planner` (different model). TripsScreen mixes two trip concepts.

### 🟡 F6. Favorites toggle dead endpoint
`useDestinations.ts:179` → `POST /api/favorites/toggle` (404). Backend has GET/POST/DELETE `/api/favorites` + `/check`. Favoriting from DestinationCard on some paths will fail.

### 🟡 F7. Recommendations detail endpoint missing
`useRecommendations.ts:103` → `GET /api/recommendations/<id>` (404). Only the list route exists.

### 🔴 F8. DB schema drift
- `supabase/schema.sql` **missing `chat_messages.destination`** (ORM + alembic `f7c9b2a1d4e6` have it). Chat persistence breaks on Supabase-provisioned DBs.
- Alembic `5b48fcd422ba` initial migration is a **no-op**; schema is built only via `create_all()`.
- `Destination` ORM model orphaned (unseeded, unqueried — recommendations degrade to fallback).

### 🔴 F9. Three conflicting `RootStackParamList` definitions
NavOS (`navigation/NavOS/index.tsx:50-70`, real), legacy (`navigation/types.ts:86-125`, phantom routes: `MainApp`, `SharedTrip`, `CurrencyModal`, `NetworkError`, stack entries), and `types/index.ts:142-162` (stale params). Screens import different ones; hence the `as any` casts.

### 🟡 F10. Duplicate auth stores + dead nav scaffolding
`authStore.ts` (live) vs `authStore.refactored.ts` (initialized but unused). Dead: `navigation/context/AuthContext.tsx`, `components/LazyScreenWrapper.tsx`, `NavigationErrorBoundary.tsx`, `utils/NavigationAnalytics.ts`, `tabConfig` deep-link helpers, `BottomTabNavigator` `LoadingFallback`/`onTabPress`.

### 🟡 F11. Endpoints without mobile consumers (backend-side dead weight)
`/api/uploads/*` (8), `/api/templates/*`, `/api/export/*` (3 PDFs), `/api/places/detail|photos|tips`, `/api/images/hero|status`, `/api/newsletter`, `/api/auth/status`, `/api/news/destinations`. Services: realtime, websocket, push_notification, trip_management, itinerary_engine, embedding_service, cache_service (tests-only).

### 🟡 F12. Route-param drift (broken intent, not crashes)
TripWorkspace passes `{trip: currentTrip}` → TripSharing (expects `tripId`; screen never preselects); `{tripId, destination}` → Expenses; `{destination}` → Packing (both accept nothing); `{tripId}` → Reservations (expects `type`). HomeScreen quick actions pass `{screen: ...}` with non-tab routes.

---

## Part 3 — Per-Screen Detail (strengths / drawbacks / improvements)

### 1. Auth (`features/auth/AuthScreen`)
- ✅ Dual v1/v2 auth, JWT refresh loop, social (Google/Apple) via v2
- 🔴 `forgot-password`/`reset-password` whitelisted in `apiClientImpl.ts:212` but backend only stubs `password-reset` (logs only, no email)
- 💡 Implement real reset (token + email) or remove the UI; dedupe to a single auth stack (v2) and delete `authStore.refactored`

### 2. Home
- ✅ Best-in-class: P10 recommendations carousel (skeleton/fallback/match%), seasonal insight card, quick actions, live trip card, filters
- 🔴 F2 — all `MainTabs` navigations use wrong tab names; QUICK_ACTIONS wrap stack routes into tabs
- 💡 Fix tab names; make QUICK_ACTIONS navigate directly to stack routes; add "See All" → Explore with real filter param; show server `budgetLevel` on cards

### 3. Explore
- ✅ P11 server filters live; Hidden Gems + Weekend Escapes sections; search intent; responsive grid
- 🟡 Image loading via `getAllDestinationImages()` (one big request); client-side scoring duplicates server `sortBy`
- 💡 Since server now sorts, simplify client scoring to only search/filter overlays; add pull-to-refresh of images; surface `daily_cost` chips on cards

### 4. Chat
- ✅ P9 real ML metadata (intent/confidence/destination), persisted to `chat_messages`, smart suggestions navigate correctly
- 🟡 Uses `/api/chat` legacy path? (v1 session vs v2 token both bridged); Gemini key required for AI mode
- 💡 Add conversation list/history UI (data exists in `chat_messages`); show persistence status; add "travel" mode selector parity with backend `mode` param

### 5. Trips
- ✅ Feature grid with "Coming soon" guard; workspace navigation; template system (grid) works client-side
- 🔴 F5 — service calls missing endpoints; `MainApp` phantom navigate; TripQuery vs Trip model confusion means the list can show planner trips while history CRUD fails
- 💡 Migrate `services/trips.ts` to `/api/trips/planner` CRUD; unify single trip model in store; remove phantom `MainApp`; add duplicate-trip button (backend `trip_management.py` has logic, zero callers)

### 6. Profile
- ✅ `/api/profile/summary` is rich (XP, DNA, insights, smart actions)
- 🔴 F4 — `/api/user/*` missing (avatar, export, preferences, achievements, account delete)
- 💡 Either implement `/api/user/*` blueprint or point UI at existing endpoints (e.g., `PUT /api/auth/v2/profile` for preferences); wrap actions in graceful error toasts so a failed 404 doesn't kill the section

### 7. DestinationDetail
- ✅ Related destinations, image fallbacks, good exit paths (Budget/Itinerary/Packing/Chat/Compare)
- 🟡 Favorites button may 404 (F6); reads `route.params.destination` (fine) but also `id` param unused
- 💡 Wire favorites through `/api/favorites` POST/check (no toggle route); add cost/rating chips (now server-provided)

### 8. Budget
- ✅ Live `/api/budget/estimate`, writes `trip_queries`
- 🟡 Route param mismatch (`destination` vs `destinationId`); family_size/travel_class UI may not match backend enum
- 💡 Normalize params; show daily breakdown chart; add persistence of estimates to planner trips

### 9. Itinerary
- ✅ `/api/itinerary/generate` (Gemini, 10/min) + fallback; maps integration
- 🟡 No save/export of generated itinerary (backend `/api/export/*` PDFs exist but unused!)
- 💡 Add "Save to Trip" (trip_planner create) + "Export PDF" buttons; add trip template cloning

### 10. Packing
- ✅ Full CRUD + toggle + custom items + weather-driven suggestions
- 🟡 No UI for documents (backend `/api/uploads/documents` exists unused)
- 💡 Add document upload section; sync progress to trip workspace

### 11. Favorites
- ✅ List/remove working
- 🔴 F6 toggle endpoint 404
- 💡 Add POST/check-based toggle; show destination images; add place favorites filter parity

### 12. Currency — ✅ solid converter; 💡 add rates cache + offline persistence, exit CTA into Budget
### 13. Compare — ✅ rich side-by-side (budget/safety/weather); 🟡 only reachable via chat/grid — 💡 add "Compare" entry from DestinationDetail
### 14. Places — ✅ Foursquare search/recommend; 🟡 detail/photos/tips unused — 💡 add place detail modal
### 15. RoutePlanner — ✅ maps route; ⚪ hard to discover — 💡 add entry from DestinationDetail "Directions"
### 16. TripWorkspace
- ✅ Deep planner (days/places/companions/photos/reservations), best DB integration of the app
- 🔴 F1 — three unregistered navigations; F12 param mismatches
- 💡 Register PlaceDetail/CompanionDetail/AddCompanion routes (or convert to modals); fix param passing; add photo upload (backend exists!)

### 17. Expenses — ✅ full CRUD + summary; 💡 add per-trip linking UI + currency conversion display
### 18. TravelJournal
- 🔴 F3 — entire screen 404s (`/api/journal/notes*` vs `/api/notes`)
- 💡 Highest-priority fix: repoint `journalService.ts` paths to `/notes` (route + service test); add AI journal insights via `journalAI.ts` (already exists)

### 19. Reservations — ✅ CRUD per trip; 💡 add confirmation-code scan/import + status timeline
### 20. TripSharing — 🟡 works but never preselects the trip from workspace (F12); 💡 accept `tripId` param and auto-load; add copy-link UX (backend returns `share_url`)
### 21. NewsFeed — ✅ travel/trending/safety feeds; 💡 offline cache + destination filter chips
### 22. TravelStats — ✅ stats endpoint rich (XP/spending/top destinations); 💡 add charts + export button
### 23. Phrasebook — ✅ phrases per destination + search; 💡 add TTS playback + pronunciation

---

## Part 4 — Phased Remediation Plan (step-by-step)

### Phase A — Fix Broken Integrations (do first; unblocks user-visible features) — effort M
- A1. **F2**: Fix 7 HomeScreen tab-name navigations (`ExploreTab`→`Explore`, `ProfileTab`→`Profile`, `TripsTab`→`Trips`); make QUICK_ACTIONS navigate to stack routes directly.
- A2. **F3**: Repoint `journalService.ts` `/journal/notes*` → `/notes*` (align GET/POST/PUT/DELETE + recommendations endpoint → use `/api/recommendations` search or drop); add integration test.
- A3. **F4**: Add minimal `/api/user/*` blueprint (avatar upload-url/avatar, preferences PUT → reuse auth_v2 profile or add column, achievements GET → compute from stats, export GET, account DELETE) — or hide unsupported profile actions behind graceful errors.
- A4. **F5**: Extend `trips.py` with POST/PUT/duplicate mapping to `TripQuery`-or-planner; or switch `services/trips.ts` to `/api/trips/planner`.
- A5. **F6**: Add `POST /api/favorites/toggle` (or change client to POST+check pattern).
- A6. **F7**: Add `GET /api/recommendations/<id>` (reuse list engine) or remove detail query from client.
- A7. **F8**: Add `chat_messages.destination` to `supabase/schema.sql`; fix alembic initial migration to real `create_all()` equivalent.
- A8. **F1**: Register `PlaceDetail`/`CompanionDetail`/`AddCompanion` (as modals) in TripWorkspace.
- Verify: full pytest + coverage, tsc, manual smoke of Home/Trips/Journal/Profile/Workspace.

### Phase B — Navigation & Type Consolidation — effort S–M ✅ (shipped `a92101a`)
- B1. Single source of truth: NavOS `RootStackParamList`; delete phantom routes from `navigation/types.ts`; repoint screens off stale `types/index.ts` params; remove `as any` casts.
- B2. Delete dead scaffolding: AuthContext, LazyScreenWrapper, NavigationErrorBoundary, NavigationAnalytics, `authStore.refactored.ts`, unused `tabConfig` exports, `LoadingFallback`.
- B3. Fix F12 param flows (TripSharing `tripId`, Expenses `tripId`, Packing destination, Reservations `type`).
- Verify: `tsc --noEmit` clean (no ESLint wired in project); manual smoke: Workspace → share (auto-selects trip), Workspace → Expenses (destination prefilled + trip_id attached), Workspace → Packing (destination preselect), Workspace → Reservations (type filter + trip preselect).

### Phase C — Screen Experience Upgrades — effort M–L (per screen, priority order) ✅ (shipped `52e79cc`)
- C1. Chat: conversation history UI backend `GET /api/chat/history` + `GET /api/chat/history/<session_id>` (per-user scoping), `chatService` `getHistory`/`getSessionMessages`, `useChatAgent.restoreSession`, ChatScreen header history button + sessions modal. Verified: `TestChatHistory` (5 tests).
- C2. Itinerary: `exportService.exportItineraryPdf` (fetch→base64→expo-file-system→expo-sharing) hitting `POST /api/export/itinerary`; genuine `createTrip` save with "Go to trips" alert + Export PDF button.
- C3. TripWorkspace: `uploadsService` (upload/list/delete photos + documents: one FormData per file, backend reads `files[0]`); multi-photo picker (max 10), photo grid with delete + set-cover, cover in header gradient.
- C4. DestinationDetail: `daily_cost` budget preview, Rating + Cost/Day quick stats, Compare (preloads dest1) + Directions (Apple/Google maps, Alert fallback).
- C5. Packing: documents section — type chips (passport/visa/ticket/insurance/other), upload/delete via documents endpoints.
- C6. Profile: real preferences save (`Record<string, unknown>`), AchievementsCard + PreferencesCard, avatar upload helper (`getAvatarSource` carries full URL).
- C7. TravelStats/Home: spending breakdown % bars in Overview; `budgetLevel` badge on DestinationCard.
- C8. Discoverability: Home tools row (Currency/RoutePlanner/Phrasebook/NewsFeed) + profile shortcut grid (deduped against existing routes).
- Verify: `tsc --noEmit` clean; 25/25 `tests/test_chatbot.py` pass (5 new history tests); all routes pre-existing (Currency, Compare, RoutePlanner, NewsFeed, Phrasebook). Pickers: `expo-image-picker`, `expo-document-picker`.

### Phase D — Data & Consistency — effort M ✅
- D1. `destinations` table extended (`region`, `categories`, `highlights`, `description`, `best_months`) + seeded (201 rows) from `data/india_destinations.json`, enriched with `safety_score` (`data/safety_scores.json` mean) and `avg_daily_cost` (`data/budget_baselines.json` sum). Alembic migration `8a4b2d9c1f6e` seeds via `app/services/seed_destinations.py` (idempotent, session-injectable); dev script `scripts/seed_destinations.py`. `/api/recommendations` now scores real candidates (verified live: Kochi, Wayanad, Alleppey… with budget filter + seasonality from `best_months`).
- D2. TripQuery ↔ Trip unified: `trip_queries.trip_id` FK → `trips.id` (+ `linked_trip` relationship, migration `c9d7e3f1a5b8`); `POST /api/trips` accepts optional `trip_query_id` to link the analytics row; `SharedTrip.trip_id` and `Expense.trip_id` FKs re-pointed from `trip_queries.id` → `trips.id` (matches what the mobile app actually stores), with `view_shared` legacy fallback to `TripQuery`.
- D3. `supabase/schema.sql` reconciled with ORM: header now declares entities.py + alembic as single source; added missing CHECKs (destinations safety_score, trips status/travel_class, favorites item_type), `ix_destinations_country`, `trip_queries.trip_id`, `shared_trips`/`expenses` FK targets, and the ORM now carries `ondelete="CASCADE"` on all trip-child FKs matching schema.sql. RLS stays SQL-only.
- D4. Endpoint fate decided: `GET /api/templates`, `POST /api/templates/<id>/clone`, `POST /api/export/budget|comparison`, `GET /api/places/detail|photos|tips/<id>`, `GET /api/booking/links`, `POST /api/newsletter`, `GET /api/news/destinations`, `GET /api/images/hero|status`, `POST /api/chat/ai`, v1 `/api/auth/*`, and unused v1 `/api/trips` routes (GET/<id>/DELETE/PUT/duplicate) marked `# DEPRECATED` in code — kept for compatibility, no mobile consumer as of Phase D. Fixed `TripPhoto._photo_url`/`TripDocument._doc_url` to match the real `/api/uploads/serve/*` routes.
- Verify: `alembic upgrade head` applied to dev DB (201 seeded); `tests/test_phase_d.py` 8/8 (seed count/idempotency/refresh, engine candidates from DB, trip-query link, share ownership with workspace Trip ids); full suite 947 passed.

### Phase E — Polish & Observability — effort S–M ✅
- E1. Global toast system: `src/components/UI/ToastHost.tsx` — imperative `toast.error/success/show` singleton + paper Snackbar host mounted in `App.tsx`. Wired into the previously silent failures (TravelJournal delete `catch {}`, DestinationDetail share `console.error`); audited remaining catch blocks — all already surface via Alert/inline banners, so no silent paths remain.
- E2. Loading skeletons: generic `ScreenSkeleton` (Shimmer-based) added to `SkeletonLoader.tsx`; `FavoritesScreen` gained a full-screen skeleton (was the only data screen with zero loading state). PackingScreen/PhrasebookScreen already had `PackingSkeleton`/`PhraseSkeleton`; CurrencyScreen's "Converting…" card now uses shimmer.
- E3. Sentry observability: api layer (`src/services/api.ts`) logs a breadcrumb for every failed request and `captureException` for 5xx/timeout/network errors; NavOS `onStateChange` records screen-name navigation breadcrumbs (Splash/Loading blacklisted). Errors are no longer invisible in production.
- E4. Offline caching: `src/services/currency.ts` now uses the shared `@ttt_cache_` util — convert cached 15 min, supported currencies 24 h, with stale-while-revalidate (cached value served instantly/offline, refreshed in background). Phrasebook (30 min) and News (5 min) already had AsyncStorage caches.
- Verify: `tsc --noEmit` clean; manual smoke — navigation produces Sentry breadcrumbs, toast appears on TravelJournal delete failure, currency converts offline after first fetch.

---

## Part 5 — Verification Notes (live)

- Backend `:5001` — `/api/health` ✅, `/api/destinations` ✅, `/api/notes` (401 unauth, expected), `/api/journal/notes` → **404** (confirmed mismatch)
- `tsc --noEmit` clean (dead routes hide behind `as any` — type system doesn't catch them)
- 894 backend tests pass — but **no frontend tests exist** (no jest config for screens); integration risk is only caught at runtime
