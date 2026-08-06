# Frontend Deep Audit — Line-by-Line Findings

> Date: 2026-08-05 · Scope: `TimeTravelMobile/` — all 26 screens, all stores, hooks, navigation, services, components, features, core. ~95k lines read.
> Method: 8 parallel line-by-line passes (screens ×4, services/api/core, components, features/domain, stores/hooks/nav/types) + independent grep verification of every dead-code / liveness claim.
> Severity: CRITICAL = visible breakage or data-integrity failure · HIGH = user-visible wrong behavior or dead flagship feature · MED = real bug, hidden path, or maintenance risk.

---

## 1. Executive Summary

The app is **functionally live but architecturally over-built**: roughly **25k of 95k lines (~26%) are orphaned dead code** — most of it an "enterprise" rewrite generation (Chat v2 suite, ItineraryMap, Weather suite, `core/`, `services/api.v2`, `services/api`, `services/maps`, `services/tomtom`, `services/recommendations`, `domain/`) that no screen imports.

Three systemic problems cut across every area:

1. **Six parallel API client stacks** — only ~2.5 are wired (see §7).
2. **Fabricated data presented as real**: `tripsStore.refresh()` mock stats, `routeService` fake POIs/routes labeled `source:"api"`, `travelIntelligenceEngine` invented trend stats, hardcoded news insights. These are live in production UI.
3. **Dead CTAs everywhere**: "Start Navigation" (`RoutePlannerScreen:856`), "Plan with AI" (`ExploreScreen`), Bookmarks on place cards, Favorites "Explore/Plan", Trains/Insight actions, Home "AI Pro" — users tap and nothing happens.

### Severity totals (across all passes)
| Severity | Count |
|---|---|
| CRITICAL | 4 |
| HIGH | ~45 |
| MED | ~110 |
| LOW | ~300+ |

---

## 2. CRITICAL (visible breakage / data integrity)

| # | Location | Finding |
|---|---|---|
| C1 | `screens/ExpenseTrackerScreen.tsx:155-182` | `AnimatedNumber` writes to a ref, never `setState` → hero expense total **renders "₹0" forever**. |
| C2 | `services/export.ts:25-29` | PDF export does a raw `fetch` **without Authorization header** → protected `/export/*` calls run unauthenticated (live ItineraryScreen + BudgetScreen path). |
| C3 | `screens/RoutePlannerScreen.tsx:856` | **"Start Navigation" button has no `onPress`** while `routeStore.startNavigation` exists but is never invoked — flagship CTA dead. |
| C4 | `domain/` + `services/recommendations/` | Two fully engineered recommendation/AI layers orphaned 100% — the intended pipeline never wired (see §7). |

---

## 3. Screens (per-file, verified)

### HomeScreen.tsx — 1418 lines
| Line | Sev | Finding |
|---|---|---|
| 636-645 | MED | Weather effect: no stale-response guard — switching trips can show wrong trip's weather. |
| 701-706 | MED | Smart filter chips "For You/Budget/Weekend" substring-match nothing → empty carousels. |
| 668-680 | MED | API-rec fallback fabricates destination with lat/lon 0, empty tagline. |
| 994-1017 | MED | "Unlock AI Travel Pro / Try Free" → navigates to Itinerary; no paywall exists. |
| 726-729 | LOW | `travelInsight` memo deps exclude wall-clock rotation → same insight all session. |
| 655-660 | LOW | `daysUntilTrip` clamps negatives to 0 → ongoing trip shows "Starts today!". |
| 149-155 | LOW | `CURRENT_SEASON`: spring branch unreachable (months 0-11 all resolve to winter/summer). |
| 21,34,35,47,64 | LOW | 5 unused imports (`useRef`, `Animated`, `Easing`, `FadeInRight`, `colors`). |
| 332,871 | LOW | Hardcoded Unsplash / `i.pravatar.cc` fallback URLs. |

### ExploreScreen.tsx — 490 lines
| Line | Sev | Finding |
|---|---|---|
| 283-304 | HIGH | "Plan with AI" FAB shows a "coming soon" Alert while HomeScreen's identical FAB navigates to a real Itinerary — inconsistent dead feature. |
| 220-226 | MED | Search-bar microphone icon is decorative (no `onPress`). |
| 80-89 | MED | Effect suppress lint; re-navigating with same category param is ignored. |
| 91 | LOW | `listRef` `any`-typed, assigned but never read. |

### DestinationDetailScreen.tsx — 1763 lines
| Line | Sev | Finding |
|---|---|---|
| 966-968 | MED | `navigate("Budget",{destination})` passes full `Destination` object vs `{label?,id?}` param shape. |
| 579-584 | MED | `setTimeout(...,100)` in photo-viewer effect without cleanup. |
| 1134-1136 | LOW | `Math.round(weather.temperature_c || 0)` → missing temp shows "0°C". |
| 1162-1166 | LOW | Rating shown as `x/5`; API ratings may be /10 — unverified scale. |
| 418-423 | LOW | Magic budget fallback `25000`/thresholds 15000/35000. |
| 29,608 | LOW | Unused `Pressable` import; `(viewableItems:any)`. |

### PlacesScreen.tsx — 1020 lines
| Line | Sev | Finding |
|---|---|---|
| 462 | HIGH | Retry button in unavailable state is `onPress={() => {}}` — black screen, no recovery. |
| 275-283 / 412-418 | HIGH | "Current Location" chip sets a city not in `DEFAULT_CITIES` → `handleSearch` silently `return`s, no feedback. |
| 204 | MED | PlaceCard bookmark button has no `onPress`. |
| 426-431 | MED | `selectPlace` only toggles border highlight; feeds nothing. |
| 275 | LOW | Current-location chip disappears after selection (can't re-select). |
| 118 | LOW | `"💰".repeat(price_level)` — huge emoji string on bad data. |
| 15,16,384,386 | LOW | Unused imports + destructured-but-unused `locationLoading`/`hasPermission`. |

### PlaceDetailScreen.tsx — 237 lines
| Line | Sev | Finding |
|---|---|---|
| 27 | MED | `route.params.place` typed `any`; no shape guard. |
| 94,101,108 | LOW | Truthiness guards hide legit 0 values (duration/cost/rating). |
| 111 | LOW | `rating / 5` — unverified scale. |

### CompareScreen.tsx — 414 lines
| Line | Sev | Finding |
|---|---|---|
| 38-40 | MED | Local `CompareRoute` re-declares route diverging from canonical `RootStackParamList["Compare"]` (`dest1/dest2/days` + `familySize/travelClass/priority`). |
| 311-314 | LOW | Inline styles in JSX. |

### TripWorkspaceScreen.tsx — 2156 lines
| Line | Sev | Finding |
|---|---|---|
| 255-343 | HIGH | Optimistic cache-key mismatch: mutations write `["trips","list"]`, query registered at `["trips","list",undefined]` — `setQueryData` is exact-match so **all optimistic UI + rollback is dead**, masked by `onSettled` refetch. |
| 627-631 | LOW | Deep-link: string `tripId` never matches numeric `t.id`. |
| 468 | LOW | `parseInt(numDays)||3` no radix; `-5` passes through. |
| 598 | LOW | `parseFloat(placeCost)` unvalidated → `NaN` to backend on "abc". |
| 1236 | MED | Trip list via `ScrollView`+`.map` not `FlashList` (imported but unused) → jank. |
| 40,41,33,32,190,209,1515-1586 | LOW | Unused imports/`FlashList`), dead `screenWidth/isWide`, dead `startDate` state, orphaned create-form styles, `setStartDate` never used. |
| 973-999 | OK | All `navigate` targets verified against types. |

### ItineraryScreen.tsx — 1196 lines
| Line | Sev | Finding |
|---|---|---|
| 552-563 | HIGH | **"Save Itinerary" discards the generated plan** — only trip header persisted; day-by-day/route/budget never written anywhere. |
| 507-517 | MED | Effect missing deps (`query`, `logSearch`, `setActiveTrip`). |
| 509 | MED | `logSearch(query)` duplicated (fires twice per generation). |
| 700 | MED | `onChangeText` auto-generates any text >10 chars + overlaps with `onSubmit` — interleaved generations. |
| 513 | MED | `setActiveTrip({id,name} as any, …)` — store receives malformed `Destination`. |
| 777-783 | MED | DayCard is `React.memo` but inline closures defeat memo. |
| 561 | LOW | `travel_class as "economy"|"comfort"|"premium"` cast sm may smuggle `"luxury"` (cross-screen vocab mismatch). |
| 628 | LOW | `initialRegion` hardcoded India center regardless of destination. |
| 35,41-43,71,313,980 | LOW | Dead imports (`FadeOut`, `interpolate`, `useDerivedValue`, unused `width`, `bottomSheetRef` never read), dead `intentBar` style. |

### BudgetScreen.tsx — 1265 lines
| Line | Sev | Finding |
|---|---|---|
| 646-754 | HIGH | `destinationError` + `retryDestinations` exist in hook but **never surfaced**; on fetch failure the chip input silently disappears with no retry. |
| 753 | MED | `onRetry` exists on `EmptyState` but never passed → "Refresh" button unreachable. |
| 739 | MED | If a prior estimate exists and re-calc fails, error swallowed. |
| 574 | LOW | `BudgetResultDestinationSkeleton` never shown during its intended state. |
| 80-92 | LOW | Category list duplicated two places; `formatCurrency` N/A. |
| 584 | LOW | Route params `destinationId`/`days` never read. |
| 667 | LOW | With a preselected destination, no way to change it on-screen. |
| 31 | LOW | `getAnalytics` imported unused. |

### ExpenseTrackerScreen.tsx — 1378 lines
| Resp | Sev | Finding |
|---|---|---|
| 155-182 | CRITICAL | AnimatedNumber never re-renders (see C1). |
| 194-209 | HIGH | **BudgetProgressRing static**: `strokeDashoffset` computed but never applied → ring is always ¾-arc. |
| 783-789 | HIGH | `load()` ignores trip/destination context → trip-scoped "Track Expenses" shows the user's **global** spend. |
| 843-872 | MED | Budget editing local-only, never persisted; Android has only 3 presets. |
| 140 | MED | `triggerHaptic` is a documented no-op while `utils/haptics` is unused here. |
| 608 | LOW | `handleModalClose` setTimeout without cleanup. |
| 924, 196 | LOW | `any`-typed render; `Math.min(spent/budget,1)` with budget 0 → NaN. |
| 312,37,760,947,213,224 | LOW | Dead `dailyAverage`, `SCREEN_WIDTH`, `activeFilter`, keys; pointless `<Animated.View>` wrappers. |

### PackingScreen.tsx — 1816 lines
| Line | Sev | Finding |
|---|---|---|
| 230-233 | HIGH | Progress ring: `strokeDashoffset` computed but never applied → static full ring, only text reflects progress. |
| 664-704 | MED | `tripId` route param never read; `listDocuments(undefined)`/`uploadDocument(undefined)` not trip-scoped. |
| 746-768 | MED | Init effect re-runs on every activeTrip change and overrides user's manual destination selection. |
| 863-900 | MED | Optimistic updates capture `items` from stale closure → rapid double-tap loses a toggle / double-toggle. |
| 780-822 | LOW | Empty `catch` swallowing cache corruption. |
| 59,572 | LOW | Dead `SCREEN_WIDTH`, empty skeleton interface. |

### PhrasebookScreen.tsx — 2049 lines
| Line | Sev | Finding |
|---|---|---|
| 90-116 | HIGH | **TTS "polyfill" is a no-op on native** (`window` undefined → `onDone()` immediately) — pronunciation never works on device. Match: `Haptics` polyfill (74-87) is no-op too. |
| 1025-1053 | HIGH | Init effect deps `[activeTrip.label, selectedDestination]` — chip selection snaps back to activeTrip and double-fetches. |
| 540, 1217 | MED | `Speech.stop()` on card unmount cuts audio; bookmark key `${english}|${local}` collides across destinations. |
| 1609-1619 | MED | `FlashList` nested inside ScrollView (virtualized nesting hazard). |
| 1055-1090 | LOW | Empty catches. |

### ReservationsScreen.tsx — 1519 lines
| Line | Sev | Finding |
|---|---|---|
| 656-667 | HIGH | `toggleBookmark` is **local-only AsyncStorage**; `is_bookmarked` backend field unused. |
| 894-901 | HIGH | `AIInsightCard` has no `onPress` — insight routes ("Places") never dispatched. |
| 464-476 | HIGH | `update()` invalidates keys `@reservations:` that never exist — cache util uses `@ttt_cache_` prefix → stale data after edit for full TTL. |
| 684-704 | MED | Parse-email drops `start_datetime`/`end_datetime`/`location`. |
| 587 | MED | `parseFloat(formAmount)` no NaN guard. |
| 219-223 | MED | Amount always `₹` — `reservation.currency` ignored. |
| 935-948 | MED | No trips → no FAB/add path; screen dead-ends. |
| 954-956 | MED | `onPress` literally `` TODO: Navigate to detail ``. |
| 25,52-53,369,120 | LOW | Dead `Divider`, `SCREEN_WIDTH`, unused `navigation`, no-op haptic. |

### FavoritesScreen.tsx — 1501 lines
| Line | Sev | Finding |
|---|---|---|
| 950 | MED | Error-state "Try Again" is `onPress={() => {}}` → bricked on error. |
| 996 | MED | EmptyState "Explore Destinations" does nothing; FAB "Plan Trip" (`1022`) does nothing. |
| 982 | MED | "folder-plus" header button no `onPress`. |
| 596-599 | MED | `stats.estimatedBudget` hardcoded `"₹50K-₹2L"` though per-item estimator exists. |
| 479-496 | MED | `Animated.loop` never stopped — animation continues after unmount. |
| 128-132 | LOW | `getDaysAgo` yields negative "days ago". |
| 777-779 | LOW | Share failure swallowed. |
| 35-40 | LOW | Unused `Linking`, `BlurView`, `GlassCard` imports. |

### CurrencyScreen.tsx — 1242 lines
| Line | Sev | Finding |
|---|---|---|
| 173-190 | MED | `CURRENCY_STRENGTH` static rate table drifts from live rates — strength "indicator" is fiction. |
| 577-582 | MED | "Recent" list never persisted — session-only. |
| 682-692 | MED | Debounce cancels timer, not in-flight request → late slow response can overwrite. |
| 688-700 | LOW | To-currency picked from main list doesn't update recents (selectToCurrency does). |
| 823-831 | LOW | No input sanitization. |
| 35 | LOW | Unused SCREEN_WIDTH. |
| 155-170 | LOW | Comment "values in USD / approximate" but INR values. |

### ChatScreen.tsx — 926 lines
| Line | Sev | Finding |
|---|---|---|
| 329 | MED | `openHistory` catch → `[]` shows "No past conversations" on network failure (misleading, no retry). |
| 413 | LOW | Error detection via `startsWith("⚠️")` heuristic. |
| 147,383 | LOW | Untyped icon names. |
| 261 | LOW | Defined `EmptyState` never rendered. |

### TripsScreen.tsx — 881 lines
| Line | Sev | Finding |
|---|---|---|
| 595-599 | HIGH | **`tripsStore.refresh()` is a mock** (`totalTrips:12, countries:8…`) shown in header as real; real `statsService` exists. |
| 221-193 | MED | Hardcoded quick actions incl. "Resume Trip / Paris 2024"; `useQuickActions` behavior-hook ignored. |
| 56-59 | MED | `NAVIGABLE_ROUTES` contains phantom tab names ("HomeTab" etc.) — guard no-ops. |
| 581-575 | MED | `scrollEnabled={false}` FlatList + `RefreshControl` → pull-to-refresh impossible. |
| 79 | LOW | `navigateFeature(navigation: any)` bypasses typed params. |
| 284-288, 468 | LOW | Hardcoded hex colors / gradient. |
| 377-380 | LOW | `setLoading(false)` races 500ms skeleton. |

### TripSharingScreen.tsx — 575 lines
| Line | Sev | Finding |
|---|---|---|
| — | OK | **Cleaned this file; no CRITICAL/HIGH** — param flow `TripWorkspace → TripSharing{tripId}` verified. |
| 110-132 | LOW | Redundant reselect loop candidate. |
| 474, 525 | LOW | Magic constants. |

### NewsFeedScreen.tsx — 1174 lines
| Line | Sev | Finding |
|---|---|---|
| 444-450 | MED | `getStatus().catch()` sets both `available=false` AND `isOffline=true` → `!available && !isOffline` can't be true → error EmptyState unreachable. |
| 73-80 | MED | `MOCK_INSIGHTS` hardcoded fake alerts. |
| 460-482 | MED | Cache applied to whatever tab is active — cached "safety" shows under "Trending". |
| 599 | MED | Share is stub — opens URL in browser. |
| 640 | MED | Notification bell has no `onPress`. |
| 621 | LOW | Error retry re-runs getStatus without catch → unhandled rejection. |
| 55 | LOW | `CachedNews.tab` written, never read. |

### RoutePlannerScreen.tsx — 1664 lines
| Line | Sev | Finding |
|---|---|---|
| 856 | CRIT-3 | "Start Navigation": no `onPress` (store action never called). |
| 712 | HIGH | Preferences panel opacity bound to `fadeAnim` that's 0 until `routes.length>0` → user toggles options, still sees nothing. |
| 254 | MED | `setTimeout(300)` in fit-map effect, no cleanup. |
| 470 | LOW | Hardcoded India initial region ignores user location (hook fetched but region never updated). |
| 323-413 | LOW | 5 render helpers recreated → no memoized `renderItem`. |
| 846-850 | LOW | `formatTime(undefined)` → "Invalid Date". |
| 20-31, 68, 176 | LOW | Dead imports (`ScrollView/Image/Pressable/RefreshControl`), dead `CARD_WIDTH`/`MAP_HEIGHT`, dead `refreshing`. |

### TravelStatsScreen.tsx — 223 lines (clean)
- No missing connections; fully backed by travelIntelligence → statsService. `renderItem` recreated per render (LOW). Modal-as-ListFooter fragile (LOW).

### TravelJournalScreen.tsx — 210 lines
| Line | Sev | Finding |
|---|---|---|
| 36-41 | MED | Empty `catch{}` → API failure shows blank "No entries". |
| 54 | MED | `catch (e:any){ Alert("Error", e.message) }` — `e.message` may be undefined. |
| 19-30 | LOW | Community notes fetch-on-mount then never re-fetch on tab switch. |

### AddCompanionScreen.tsx — 178 lines
| Line | Sev | Finding |
|---|---|---|
| 35 | MED | `mutationFn` silently `return`s when `tripId` missing — button enabled but does nothing. |

### CompanionDetailScreen.tsx — 131 lines
| Line | Sev | Finding |
|---|---|---|
| 20 | LOW | `route.params.companion` typed `any` (from types.ts). |

### features/auth/AuthScreen.tsx — 120 lines
| Line | Sev | Finding |
|---|---|---|
| — | MED | **No social sign-in buttons at all** — entire Google/Apple OAuth (`useSocialAuth`, `socialAuthS`ervice`) unreachable by UI. |
| 76 | LOW | Terms text plain `<Text>`, not tappable. |

### useAuthScreen.ts — 183 lines
| Line | Sev | Finding |
|---|---|---|
| 99, 123-166 | LOW | Real login/register/password-reset wired to v2 APIs (verified OK). |
| 183 | LOW | `submit` deps include whole `values` — recreated per keystroke. |

### useSocialAuth.ts — 104+ lines
| Line | Sev | Finding |
|---|---|---|
| 36-44 | CRIT-2 | `googleClientId` falls back to literal `"disabled-google-client"` — Google OAuth can never succeed. |
| 12 | MED | Orphaned: no consumer. |
| 46 | LOW | `Google.useAuthRequest` runs even when OAuth disabled. |

### socialAuthService.ts — clean. requestPasswordReset uses raw fetch bypassing apiService (LOW).

### auth/config.ts
| Line | Sev | Finding |
|---|---|---|
| 8 | HIGH | Hardcoded production `https://api.timetravel.app/v1` base URL (no env indirection). |
| 26-27 | MED | `expiryLabel:"24h"` vs actual 7-day TTL. |

### features/profile/screens/ProfileScreen.tsx — 198 lines
| Line | Sev | Finding |
|---|---|---|
| 156 | MED | `RefreshControl refreshing={isLoading}` should be `isFetching` → no spinner on pull-to-refresh. |
| 167 | LOW | "Edit profile" only opens image picker; no name/email editing. |
| — | OK | Avatar upload, preferences save, logout wired to real APIs. |

---

## 4. Components

### Orphaned vs Live (grep-verified)

| Suite | Verdict | Lines |
|---|---|---|
| `src/services/api/` (client+AuthManager+NetworkManager+RetryManager+CacheManager+RequestQueue+ErrorHandler) | **DEAD** | ~1,500 |
| `src/services/api.v2/` (ApiClient, AuthManager, CircuitBreaker, RequestDeduplicator) | **DEAD** | ~1,800 |
| `src/core/**` (ApiOrchestrator, offline Queue, streaming, telemetry, errors, cache) | **DEAD except `Analytics`** | ~3,500 |
| `src/services/maps/`, `src/services/tomtom/` | **DEAD** (types only) | ~1,100 |
| `src/services/recommendations/` | **DEAD** scripts | ~800 |
| `src/domain/**` (agents, models, services) | **DEAD 100%** | ~1,500 |
| `src/components/Chat/` (v2 suite incl. MessageStatus/MessageText/TypingIndicator + legacy dupes) | **DEAD** (`@/components/Chat` 0 importers) | ~9,000 |
| `src/components/ItineraryMap/` | **DEAD** | ~11,000 |
| `src/components/Weather/` | **DEAD except `WeatherCard.tsx`** | ~1,000 |
| `src/components/Journal/TravelNoteCard.tsx` | **DEAD** | ~440 |
| `src/components/Features/DestinationCard.optimized.tsx` | **DEAD** | ~240 |
| `src/components/Common/ImageWithFallback.tsx` | **DEAD** | ~78 |
| `src/hooks/useTravelIntelligence.ts` | **DEAD** | 2 |
| `src/hooks/useJournal.ts` | **DEAD** | |
| `src/stores/mapStore.ts`, `itineraryStore.ts` | **DEAD** | |
| `src/api/queries/useAuth.ts` | **DEAD** | |
| `src/services/authSession.ts` | **DEAD** | |
| `src/constants/config.production.ts` | **DEAD** (0 importers) | |

Live in prod: `services/api.ts` (~25 imports), `apiClient`+`tokenManagerCore`, `src/api/client.ts` (useRecommendations), `Features/ChatBubble.tsx` (ChatScreen), `SafetyBadge`, `WeatherCard`, `Trips/*`, `UI/*`, `Common/ExpoMap*` (3 importers), `Descriptors`.

### Component findings (live only)
| Location | Sev | Finding |
|---|---|---|
| `Weather/hooks/useWeather.ts:23-46` | HIGH | AbortController aborted but `signal` never passed to `fetchWeather` — abort machinery dead. AbortError guard untriggered; run in `WeatherCard` real path. |
| `Weather/services/weatherService.ts:21,39` | HIGH | Bare `localStorage` in RN native → ReferenceError caught → caching no-ops on iOS/Android. |
| `Features/DestinationCard.tsx:47` | LOW | Reads/writes `travelIntelligenceStore` from presentational card (coupling). |
| `Features/ChatBubble.tsx:65` | MED | Third independent markdown formatter. |
| `ExpoMap.web.tsx:8` | LOW | Web itinerary maps are a static placeholder. |

---

## 5. Services & API layer

### §5.1 Stack verdict (live vs dead)
- **LIVE**: `services/api.ts` (legacy `apiService`), `services/apiClient.ts` + `apiClientImpl.ts` + `tokenManager*.ts` (auth/v2, refresh+dedup), `src/api/client.ts` (only `useRecommendations`), react-query (`queryClient`, `queryKeys`, `useDestinations`, `useRecommendations`).
- **DEAD**: `services/api/`, `services/api.v2/`, `core/api/ApiOrchestrator`, `core/offline`, `core/streaming`, `services/maps`, `services/tomtom` (part), `services/recommendations`, `src/domain`, `config.production.ts`.
- `services/api/index.ts:35` shadowed-by-file — `@/services/api` resolves to `api.ts`, never the directory barrel (dead import trap).

### Findings
| Location | Sev | Finding |
|---|---|---|
| `services/api.ts:160-167` | HIGH | Legacy path on 401 calls `tokenManager.clearTokens()` — **no refresh**; expired token silently kills session. |
| `src/api/client.ts:25-27` | HIGH | Hardcoded `localhost:8000` (dev) / `api.timetravel.app` (prod) — diverges from canonical `config.ts` :5001. |
| `services/export.ts:25-29` | CRIT-2 | RAF fetch no auth header. |
| `services/auth.ts:19-26` + `stores/authStore.ts:39-70` | HIGH | "Token" is literal marker `"session-active"` — not a real JWT (store consumer may read fake value). |
| `services/routeService.ts:426-519` | HIGH | On ANY error, `computeFallbackRoutes` labeled `source:"api"`; consumers cannot tell simulated from real. |
| `services/routeService.ts:625` | HIGH | `findSmartStops` returns 100% random mock POIs ("In production this would call the API"). |
| `services/travelIntelligenceEngine.ts:1193-1251` | HIGH | Fabricated stats: `thisMonth=total/12`, `lastYear=total*0.8`, `countries=ceil(dest/5)`, hardcoded +20/15/25% vsLastYear. |
| `services/authV2.ts:232-352` | LOW | Emoji console.logs in prod paths. |
| `services/journalService.ts` | MED | `_normalizeNote` defaults `country:'India'`, `compressImage` no-op, `uploadMedia` returns null — journal photos silently dropped. |
| `services/reservations.ts:569` | MED | `list()` without tripId = N+1 (trips then per-trip getByTrip). |
| `services/favorites.ts:180` | LOW | `check()` swallows → `is_favorite:false`. |
| `core/telemetry/Analytics.sendToService` | MED | No-op (console-only) — only Sentry is real. |

---

## 6. Features & domain

| Area | Verdict |
|---|---|
| `features/auth` | Live (screen) — but social OAuth unreachable + `"disabled-google-client"` fallback (C4). |
| `features/compare` | Live via CompareScreen; REST `compareService` import site only — server compare never called. `useCompare.ts:44` defaults duplicate `services/compare.ts:33`. |
| `features/explore` | Live via ExploreScreen. `utils/scoring.ts:41 - `FEATURED_IDS` hardcoded to `["goa","kerala_backwaters","jaipur","varanasi","andaman"]`. `constants/categories.ts:73` `CURRENT_SEASON` frozen at module load + spring unreachable. |
| `features/phrasebook` | Live store/SearchEngine; `VoiceService.ts` dead (PhrasebookScreen ships own polyfill). |
| `features/profile` | Live screen/components; `useInsights` + `useTravelDNA` dead; `SkeletonLoader.tsx:12-16` restarts animation in component body every render; `PreferencesCard` 3rd incompatible `TravelStyle`. |
| `features/travel-intelligence` | Live via TravelStatsScreen. `AI_TIMEOUT_MS` decorative; heuristic engine branded "AI"; `TripAnalytics` duplicated `formatCurrency`/`formatRelative`. `TravelAIAssistantModal` rule-based canned replies. |
| `features/trip-sharing` | Live; hardcoded 7-day expiry in share-link payload (frontend policy). |
| `src/domain` | 100% orphaned (0 external imports). `IntentParsementAgent` (688-line NLU) duplicates live chat; `DestinationScorer` 3rd scoring impl. |

---

## 7. Stores / hooks / navigation / types (verified directly)

### Store usage (import-file count across src, excluding own file)
| Store | Ext. files | Verdict |
|---|---|---|
| `authStore` | 12 | LIVE |
| `uiStore` | 13 | LIVE |
| `travelIntelligenceStore` | 8 | LIVE |
| `userBehaviorStore` | 6 | LIVE |
| `preferenceStore` | 3 | LIVE |
| `tripsStore` | 3 | LIVE (but `refresh()` mock — HIGH) |
| `journalStore` | 1 | LIVE`
| `routeStore` | 1 | LIVE (RoutePlanner) |
| `itineraryStore` | 0 | **DEAD** |
| `mapStore` | 0 | **DEAD** |

### Hooks | External files | Verdict
| `useAuth` | 2 | LIVE |
| `useDebounce` / `useLocation` / `useResponsive` | 3 / 3 / 2 | LIVE |
| `useBudgetPlanner` / `useChatAgent` / `useDestinationDetail` / `useItinerary` / `usePlaces` / `useTripsFeatures` | 1 each | LIVE |
| `useTravelIntelligence` | 1 | LIVE (remote) |
| `useJournal` | 0 | **DEAD** |

### Navigation verdict
- **Root stack in `NavOS/index.tsx` + 26 screens all registered.** All `navigate()` targets in audited screens resolve.
- **Unreachable / never registered**: none — every screen in `src/screens` is wired.
- **Param mismatches**:
  - *Dev*`DestinationDetail → Budget` passes full `Destination` vs param `{destination?: {label?,id?}}` (DestinationDetailScreen:966) — compiles only because Budget uses `label`.
  - `Budget` params `destinationId`/`days` never read (BudgetScreen).
  - `Packing` param `tripId` never read (PackingScreen:664-704).
  - `Reservations` param `type` filter omits `cruise`/`other`.
  - `types.ts:40-41` `PlaceDetail.place` and `CompanionDetail.companion` are `any`.
  - `TripSharing.trip: any` never used by screen.
- **Authentication gating**: NavOS boots `GuestStack` when `!isAuthenticated`; `loadAuthState` calls `tokenManager.loadTokensFromStorage`. Live.
- **Dead empty useEffect** in BottomTabNavigator (line 391).
- **Toast mounted, Splash screen renders through ErrorBoundary** — OK.
- **App.tsx boots `initializeStores()`** (auth restore + offlineQueue init) before UI; Sentry wrap. OK. **No global loading gate between `!ready` and NavOS** — that's handled by `initializeStores` in `stores/index.ts:68-72`.

### config.ts
- `API_BASE_URL` resolution web/mobile/LAN/tunnel/env — correct, canonical.
- **Production fallback `https://api.timetotravel.app/api` will fail** — only `console.warn` (config.ts:152-156).
- `config.production.ts` dead (0 importers).

---

## 8. Cross-cutting / quality

- **Duplication map**: 6 API stacks, 3 cache impls (core/ services/api / utils), 2+ NetworkManagers, 3 markdown formatters, 3 scoring engines (domain / explore / compare), 2 comparing defaults, 3 TravelStyle enums, 2 TTS impls, duplicated `formatCurrency`/`formatRelativeTimeLabel`, 3 skeleton variants, `CURRENT_SEASON` twice (HomeScreen & explore constants).
- **`Trip` travel-class vocab**: `"luxury"` (TripWorkspaceScreen:207, tripPlanner.ts) vs `"premium"` (BudgetScreen:53, trips.ts:16, itinerary.ts:82) — possible 422 / silent mismatch.
- **Auth token semantics**: auth tap uses "session-active" marker in `authStore::setUser` + `tokenManager.subscribe`; real JWT lives in `tokenManager`/SecureStore. `authStore` consumers must not read `token` as a JWT.
- **Consistency**: `type="error"` EmptyState branches unreachable in 2 screens (NewsFeed + Favorites logic), both from mutually exclusive flags set together.
- **Accessibility**: numerous icon-only Touchables without labels (list per file above); `accessibilityRole="button"` on non-interactive Views (DestinationDetail `QuickStatCard`).
- **`require consideration`**: `removeClippedSubviews` inconsistent (ChatScreen confirmed it blocked — keep disabled; TripsScreen had it + enabled).

---

## 9. Repair Plan (recommended order)

### A. True breakage (fix first)
1. ExpenseTracker — `AnimatedNumber` state bug (C1)
2. ExpenseTracker — apply `strokeDashoffset` (ring)
3. ExpenseTracker — load prompt/trip scoping into load()
4. RoutePlanner — wire `startNavigation` to `routeStore.startNavigation`
5. Export — attach auth header to raw fetch PDF export (C2)
6. Favorites — wire "Try Again"/"Explore"/"Plan FAB" handlers; wire error EmptyState properly
7. Reservations — kill `@reservations:` stale-key invalidation; fix to `@ttt_cache_`; add `onPress` → `insights` navigate

### B. Silent dead CTAs
- Explore FAB + Places bookmark + Places select + Favorites folder button + NewsFeed bell + Resv "edit/detail" + `Resume Trip/Paris 2024`, etc.
- Point them at realintended targets or remove the affordance.

### C. Fake-data hygiene
- `tripsStore.refresh` → real `statsService`; `routeService` fallback-`source` honest + label fallback as simulated or disable when unavailable; `travelIntelligenceEngine` trend math — derive from real data or label "estimate".

### D. Dead code removal / consolidation (biggest line win)
- Remove: `services/api/`, `services/api.v2/`, `core/**` except Analytics, `services/maps`, `services/tomtom`, `services/recommendations`, `domain/`, `components/Chat/`, `components/ItineraryMap/`, orrard `Weather` suite (uses `WeatherCard`), `Journal/TravelNoteCard`, `DestinationCard.optimized`, `ImageWithFallback`, `mapStore`, `itineraryStore`, `useJournal`, `api/queries/useAuth`, `authSession`, `config.production.ts`. This deletes ~25k lines.
- **Before removal**, grep to confirm no runtime import; then delete + re-run `tsc --noEmit`.

### E. Consistency roots
- Unify API client (delete all but one), reconcile travel-class enum, dedupe `formatters`, single `CURRENT_SEASON`, single `TravelStyle`, single cache util, single markdown renderer.
- Fix auth token contract so `render.prod` doesn't read "session-active".
- Homogenize loading/error/empty-state pattern across screens.

### F. Hardening
- Add stale-request guards to Home weather, Currency conversions, Packing toggles.
- Memoize DayCard, FlatList renderItems (TripWorkspace `FlashList`, RoutePlanner, Reservations).
- Replace `.map` of stacks with FlatList/FlashList; fix `SkeletonLoader` body animation.
- a11y pass on icon-only buttons.

### Recommended order
C1–C4 → A (#6,7) → B (CTAs) → C (fake data) → D (dead removal) → E (consistency) → F (hardening)

---

## 10. Verified-OK highlights

- All navigation targets resolve; no missing routes; every screen registered.
- Auth v2 flow real: login/register/refresh/logout/me all live endpoints.
- TripSharingScreen clean; ShareCard/TripSelector solid.
- TravelStats backed by real stats.
- Cache util SWR + `offlineQueue` (NetInfo) good.
- Chat history restore real.
- No hardcoded secrets committed (env-keyed only: EXPO_PUBLIC_*).

---

## 11. Fix log (deep-audit repair round)

Commit hashes on `main` (https://github.com/krishNaa1942/TIMETRAVEL-copy), oldest → newest:

| Commit | Scope |
| --- | --- |
| `67c6f09` | PlacesScreen retry + CitySelector chip + current-location fallback + maps Linking toast; AddCompanion tripId guard; `usePlaces.retryServiceCheck`; `tripsStore.refresh` real stats/planner; PackingScreen SVG ring; Reservations cache-key/NaN guard; ItineraryScreen save-trip + activeTrip; NewsFeed Share/insights; Home stale-weather guard |
| `de349e3` | TripsScreen refresh wiring + QuickAction resume; Phrasebook real `expo-speech`; routeService `simulated` source; `findSmartStops` honest; ProfileScreen `isFetching` refresh; RoutePlannerDetails NaN-safe formatTime; Chat history failure retry; api.ts BaseUrl singletons |
| `e65541c` | PackingScreen trip-scoped `tripIdNum` + docs/uploads; ItineraryScreen `setActiveTrip` Destination shape; `FEATURE_CONFIGS` is_ai flags false; currency typing + cache guards |
| `e0a4f2d` | High-frequency DriveOne batch (stats/currency/cache/API lifetime flags) |
| `3eba747` | Packing trip scoping + manual destination init; ProfileScreen refresh; ItineraryScreen generate-path fixes (no interleaved auto-generate) |
| `f3db034` | ItineraryScreen DayCard stable callbacks (memo effective) + debounce removal (no interleaved auto-generation); CurrencyScreen stale-request guard + input sanitization; DestinationDetail photo-viewer timer cleanup; Phrasebook FlashList single scroll owner (no nested ScrollView, header sections in ListHeaderComponent) |
| `a3daf3e` | docs: audit fix-log section added |
| `01bb128` | docs: extend fix log |
| `2743d73` | RoutePlanner 4 render fns memoized (search/recent/alternatives/smart stops); Reservations ReservationCard prop-callbacks stable + AIInsightCard memos; profile SkeletonLoader animation moved into effect with cancelAnimation |
| `36affda` | **§D dead-code removal** — deleted 106 files / ~31.8k lines: `services/api/`, `services/api.v2/`, `services/maps/` (shadowed dir; kept live `maps.ts`), `services/tomtom/`, `services/recommendations/`, `services/authSession.ts`, `core/**` except `telemetry/`, `domain/`, `api/client.ts`+`queries/useAuth.ts`, `components/Chat/`, `components/ItineraryMap/`, `components/Weather/`, `Journal/TravelNoteCard`, `DestinationCard.optimized`, `ImageWithFallback`, `hooks/useJournal.ts`, `stores/mapStore|itineraryStore|journalStore` (+ trimmed `stores/index.ts`), `constants/config.production.ts`. Kept live clusters verified via relative `./` grep: `tokenManager`, `tokenManagerCore`, `apiClientImpl`, `apiClient.ts`, `api/client.ts`, `services/maps.ts`. `tsc --noEmit` clean. |

### Still open (from plan)
- B: Explore FAB, Places select/bookmark, Favorites folder button, NewsFeed bell, Reservations edit/detail — wire or remove.
- D: dead-code removal (~25k lines: services/api/, api.v2/, core/** except Analytics, maps, tomtom, recommendations, domain/, components/Chat/, ItineraryMap/, Weather suite, Journal/TravelNoteCard, optimized cards, mapStore, itineraryStore, useJournal, useAuth, authSession, config.production.ts).
- E: unify API client; travel-class enum; dedupe formatters; single CURRENT_SEASON/TravelStyle/cache/markdown; auth token contract.
- F: Home weather stale guard (done), Packing toggle guard, FlashList renderItem memos in TripWorkspace/RoutePlanner/Reservations; map `.map` stacks to FlatList; SkeletonLoader body animation; a11y icon buttons.