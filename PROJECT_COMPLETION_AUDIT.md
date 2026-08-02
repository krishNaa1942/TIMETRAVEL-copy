# Project Completion Audit — Time To Travel

**Date:** 2026-08-02 (all numbers verified by live checks)
**Scope:** Full project — ML track, backend/frontend integration, remaining product vision phases, deployment tracks

---

## Executive Summary

| Area | Status | Grade |
|---|---|---|
| Backend tests | **857 passed, 2 skipped, 0 failed** | 🟢 A |
| Test coverage | **65.4%** (CI gate 60% — PASSES) | 🟢 A |
| flake8 / black | 0 issues, clean | 🟢 A |
| TypeScript | 0 errors (`tsc --noEmit`) | 🟢 A |
| CI | lint → test → integration → typescript → ml (validate/audit/smoke-train/eval/chat-QA) | 🟢 A |
| ML track (Phases 1–3, 5–8) | **Complete, shipped, gated** | 🟢 A |
| Chat + recommendation integration (Phases 9–10) | **Planned, not yet executed** | 🟡 B |
| Seasonality/cost/safety models (Phase 4) | **Blocked — no real data** (audit-verified) | 🔴 D |
| Explore alignment (Phase 11) + vision backlog (12–17) | Not started | 🔴 D |
| Deploy path (Docker/VPS/CI/CD) | Ready (certbot, lowmem, monitoring) — needs user actions (domain/VPS/keys) | 🟡 B |
| Play Store release | **Not done** (keystore/AAB/listing — roadmap item still unchecked) | 🔴 D |
| Documentation | `IMPLEMENTATION_ROADMAP.md` is a stale starter checklist (3/580+ checked despite the project being built) — needs rewrite | 🔴 D |

**Bottom line:** The ML brain is built, measured, and gated; the product surfaces for it (chat metadata, recommendations route) are planned but not yet wired. The remaining work to "complete the vision" is: execute Phases 9–10 (integration), build a real India QA dataset (12), then personalization/agentic/offline (13–17), plus the non-ML tracks (Play Store, roadmap rewrite, vision doc).

---

## Part 1 — Verified Current State

- `python3 -m pytest tests/ -q --cov=app` → **857 passed, 2 skipped, coverage 65.4%** (gate 60%).
- `flake8 app/ scripts/ tests/ --max-line-length=120` → clean; `black` → clean.
- `tsc --noEmit` (TimeTravelMobile) → 0 errors (per earlier CI runs; re-verify in Phase 9).
- CI `ml` job pipeline: `prepare_training_data.py` → `audit_targets.py` → `train_models.py --smoke` → `evaluate_models.py --smoke --real-only` → `evaluate_chat_qa.py --smoke` — all green.
- Full model run (local, real data): quality MAE 0.338, popularity MAE 0.494, content same-state precision@5 0.652, intent accuracy 0.820/f1 0.824, chat flow accuracy 0.930, fallback 1%.

---

## Part 2 — ML Track: Completed Phases (shipped + gated)

| Phase | Deliverable | Commit | Key metrics |
|---|---|---|---|
| 1 | Training-data pipeline: ingest/clean/validate, corpora committed | `8072d29` | Findings: `tourism_destinations.csv` 100% synthetic (`Place_0..2999`); `expanded_destinations.csv` = 5 unique names × 200 rows |
| 2 | Learnability audit (`audit_targets.py`) — reject noise targets | `e0565d5` | `peak_season` acc 0.32 vs chance 0.33; cost/safety all at/below baseline (−0.9%…−3.7%); QA intent learnable 0.79 vs 0.14 |
| 3 | Offline ML layer: quality/popularity regressors + TF-IDF content matcher, `LearnedPriors` runtime, 0.6/0.4 blending | `1dd687a` | quality MAE 0.338, popularity MAE 0.494, precision@5 0.652 |
| 5 | QA intent classifier + retrieval index (4 new artifacts), two-tier `classify_intent` | `c16c472` | intent acc 0.820 vs chance 0.143; gate `intent_accuracy ≥ 0.80` |
| 6 | Chat QA end-to-end gate (`evaluate_chat_qa.py`) + singleton bugfix | `236aeeb` | full-flow acc 0.840 → 0.930 after Phase 7; gate 0.85 |
| 7 | Classic chatbot tier trained on 5000 real QA questions (balanced) | `86f94f6` | classic tier 0.177 → 0.933 acc, 11% → 98% coverage; fallback 8% → 1% |
| 8 | Destination-aware responses (`destinations.py`, template variants, API `destination` field) | `2add0f1` | extraction unit-tested on Indian places; corpus note documented |

Artifacts (gitignored, reproducible from committed data): `data/models/*.joblib` (9) + `app/chatbot/model_cache/` (2).

---

## Part 3 — In-Plan Phases (next to execute)

### Phase 9 — Chat ML Integration (backend + mobile)
- Backend: Gemini paths return real `intent`/`confidence`/`destination` (`app/api/routes/chatbot.py` ~L130, ~L202); `_persist_message` stores `destination`; new `ChatMessage.destination` column + alembic migration (`app/models/entities.py:102`).
- Templates: rephrase 4 destination-aware variants to drop dead URLs (`/api/transport|hotels|food|things-to-do` don't exist; weather/safety/budget links live).
- Mobile: `ChatMessage`/`ChatResponse` types gain metadata (`TimeTravelMobile/src/types/index.ts:55-71`); `useChatAgent.ts:281-286` uses server values (client heuristics stay as offline fallback); `ChatBubble.tsx` metadata row (destination chip + intent chip + model/confidence) between message text and footer (L143–152).
- Verify: extend `tests/test_chatbot.py` (AI-path fields, DB persistence), `tsc --noEmit`, full suite + coverage.

### Phase 10 — Recommendation Engine Exposure
- Backend: new `GET /api/recommendations` blueprint (`season, trip_duration, group_size, budget_max, limit, offset`), `@login_required`, rate-limited, backed by `AIRecommendationService` (learned-priors blended by default); register in `app/main.py:292-320`; activate priors in `recommendation_engine.RecommendationService` (`ScoringEngine(priors=LearnedPriors.get_instance())` — currently dormant, `recommendation_engine.py:557`).
- Mobile: HomeScreen "Recommended for You" (L843–851) switches from `featuredDestinations` slice to the orphaned `useRecommendations()` hook (`src/api/queries/useRecommendations.ts`, params already match); skeleton loading; featured-fallback on error/empty; server score as "• N% match".
- Verify: route tests (auth/params/mocked fallback), priors-activation test, `tsc --noEmit`, full suite.

### Phase 11 — Explore Screen Alignment (deferred)
- Add "Hidden Gems"/"Weekend Escapes" sections (copy exists, no UI — `featureConfig.ts:268`, `journalAI.ts:255`).
- Make server honor `query/category/region/budget/sortBy` on `GET /api/destinations` (params sent by `useDestinations.ts:91-93` but ignored server-side).
- Optionally feed Explore's "Curated for You"/seasonal/trending sections (`useExploreEngine.ts:106-175`) from the Phase 10 route.

---

## Part 4 — Blocked Phase

### Phase 4 — Seasonality / Cost / Safety Models — 🔴 BLOCKED
- Audit evidence (`e0565d5`): all five targets (`peak_season`, `avg_hotel_cost_inr`, `entry_fee_inr`, `safety_rating_1_5`, `women_traveler_safety_1_5`, `avg_monthly_visitors`) score at/below the mean baseline (−0.9% to −3.7%) — the synthetic file has no signal, and no state-level correlation exists.
- **Unblock requires:** real visitor counts / hotel costs / safety ratings per destination. Until then these models must NOT ship (contamination guard: `quality_synthetic_rows: 0`).
- CI keeps the audit wired so the moment real data lands, the phase can proceed.

---

## Part 5 — Remaining Product-Vision Phases (backlog)

| # | Phase | Effort | Dependencies |
|---|---|---|---|
| 12 | **India-specific QA dataset** — build/annotate real Indian travel questions (current corpus is Cape Town/South Africa forum Q&A) | M | — |
| 13 | **Personalization loop** — capture feedback (favorites, trip completions, likes) → per-user preference model (today priors are global) | L | 12 |
| 14 | **Agentic dynamic replanning** — itinerary updates on weather/crowd/closure events (vision's core differentiator; today generation is static) | XL | 13 |
| 15 | **AI memory** — persist learned affinities across sessions (`TripQuery`-based inference exists but shallow, `trip_management.py:510`) | M | 13 |
| 16 | **Offline support** — maps/itinerary/notes/emergency contacts for poor-connectivity regions | L | — |
| 17 | **Booking integrations** — hotels/flights/transport links ("planned integration" per vision) | L | 14 |

Known orphaned code to be consumed by these phases: `AIRecommendationService` (no route calls it), `get_ai_recommendations` (`trip_management.py:510`, zero callers), `recommendation_engine` (only imported by tests), mobile `useRecommendations.ts` (unimported).

---

## Part 6 — Other Tracks

| Track | Status | Remaining |
|---|---|---|
| Docker/CI/CD deploy | 🟢 deploy scripts hardened (`deploy_vps.sh`, `renew_ssl.sh` certbot cron, lowmem override, monitoring) | User actions: domain + VPS + real keys (Maps/EAS/Sentry); rotate exposed keys (LIVE_AUDIT_REPORT Part 6) |
| Oracle Cloud + DuckDNS free path | ✅ committed `24d82cc` | Signup/account creation (user action) |
| Supabase migration | ✅ `migrate_to_supabase.py` exists | Verify state before switching prod DB |
| Play Store release | 🔴 **Not done** — no keystore/AAB/listing; `IMPLEMENTATION_ROADMAP.md:580` unchecked | Keystore, `eas build`, store listing assets |
| Vision/branding | 🔴 Vision doc (agentic travel OS pitch) exists only in conversation — not in repo | Add as `VISION.md` / investor section |
| `IMPLEMENTATION_ROADMAP.md` | 🔴 Stale starter checklist (3/580+ checked though project is built) | Rewrite against actual state |

---

## Part 7 — Key Findings & Risks

1. **Corpus geography mismatch** — the 5,000-question QA corpus is generic travel Q&A (Cape Town / South Africa forum threads); intent model generalizes well (0.93 chat flow) but destination extraction can't be benchmarked on it. Highest-leverage fix = Phase 12.
2. **Learned-priors blending was dormant at engine level** — `RecommendationService` builds `ScoringEngine()` without priors (`recommendation_engine.py:557`); Phase 10 activates it.
3. **4 dead endpoint links** in destination-aware chat templates (transport/hotels/food/things-to-do) — Phase 9 rephrases them.
4. **AI chat path faked ML fields** (`"ai_response"`, `confidence: 1.0`, no destination) — Phase 9 fixes contract parity.
5. **Per-message artifact reload bug** (Phase 6) — fixed via `get_instance()`; regression covered by tests.
6. **Model reproducibility** — all artifacts gitignored by design (`531a551`); CI reproduces from committed data; keep `train_models.py`/data in sync with app expectations.
7. **Seasonality risk** — if real data never arrives, seasonal sections ("Perfect For This Season") must remain heuristic-only; do not ship unlearnable models.

---

## Part 8 — Recommended Execution Order

1. **Phase 9** — chat ML integration (small, unblocks user-visible ML) 
2. **Phase 10** — recommendation route + HomeScreen wiring (largest unused ML asset)
3. **Phase 12** — India QA dataset (improves everything downstream; unblocks 13–14 honesty)
4. **Phase 13 → 15** — personalization + memory
5. **Phase 11** — Explore alignment (can fold into 12/13 delivery windows)
6. **Phase 16 → 17** — offline, bookings
7. Non-ML in parallel: Play Store release, roadmap rewrite, `VISION.md`, Oracle signup + domain
