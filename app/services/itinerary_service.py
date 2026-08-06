"""
Itinerary Generator Service
=============================
Uses Google Gemini AI to generate day-by-day travel itineraries
with morning / afternoon / evening activity slots.
"""

import json
import logging
import re
import threading
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from google import genai
from google.genai import types

from app.models.schemas import BudgetRequest
from app.services.ai_security import AIPromptSanitizer
from app.services.budget_service import estimate_budget
from app.services.maps_service import geocode
from app.utils.constants import DESTINATION_COORDS, resolve_destination_key

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------
_client: genai.Client | None = None
_configured = False
_configure_lock = threading.Lock()
_BUDGET_BASELINES_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "budget_baselines.json"
)
_ROUTE_POINT_GEOCODE_CACHE: dict[str, dict] = {}

ITINERARY_PROMPT = """You are an expert Indian travel planner. Generate a detailed day-by-day itinerary.

**Rules:**
1. Respond ONLY with a valid JSON array — no markdown, no code fences, no extra text.
2. Each element represents one day and must have this exact schema:
   {{
     "day": <int>,
     "title": "<short theme for the day>",
    "morning": {{ "place": "<real place name>", "activity": "<name>", "description": "<1-2 sentences>", "duration": "<e.g. 2-3 hours>", "cost": "<approx ₹ per person>" }},
    "afternoon": {{ "place": "<real place name>", "activity": "<name>", "description": "<1-2 sentences>", "duration": "<e.g. 2-3 hours>", "cost": "<approx ₹ per person>" }},
    "evening": {{ "place": "<real place name>", "activity": "<name>", "description": "<1-2 sentences>", "duration": "<e.g. 2-3 hours>", "cost": "<approx ₹ per person>" }},
     "tip": "<one practical tip for this day>"
   }}
3. Make activities specific to the destination with real place names.
4. Consider travel class: economy = budget-friendly street food & public transport; comfort = mid-range restaurants & cabs; premium = luxury dining & private cars.
5. Consider family size for group-friendly activities.
6. All costs in Indian Rupees (₹).
7. Include a mix of sightseeing, food, culture, adventure, and relaxation.
8. Make day 1 arrival-friendly (lighter schedule), last day departure-friendly.

Generate an itinerary for:
- **Destination:** {destination}
- **Duration:** {num_days} days
- **Family size:** {family_size} people
- **Travel class:** {travel_class}
- **Interests:** {interests}
"""


def _configure(api_key: str) -> None:
    """Configure Gemini with the API key (done once)."""
    global _configured, _client
    if _configured:
        return

    with _configure_lock:
        if _configured:
            return
        # Hard 60s HTTP timeout so a hung model call can never pin a
        # background job forever (the per-day workers fallback on timeout).
        _client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=60000),
        )
        _configured = True
    logger.info("Itinerary service: Gemini configured")


def _extract_json(text: str) -> list:
    """Extract JSON array from Gemini response, stripping markdown fences.

    Bug 4.3 fix: also handles the case where Gemini wraps the array inside
    an object like {"itinerary": [...]}, which caused a silent fallback.
    """
    text = re.sub(r"```(?:json)?\s*", "", text).strip()
    text = text.rstrip("`").strip()
    parsed = json.loads(text)

    # Unwrap object envelope if Gemini returned {"itinerary": [...]}
    if isinstance(parsed, dict):
        for key in ("itinerary", "days", "schedule", "plan"):
            if key in parsed and isinstance(parsed[key], list):
                return parsed[key]
        # Fallback: return the dict values concatenated if they are lists
        for v in parsed.values():
            if isinstance(v, list):
                return v
        raise ValueError(f"Unexpected dict response shape: {list(parsed.keys())}")

    return parsed


def _build_budget_estimate(
    destination: str,
    num_days: int,
    family_size: int,
    travel_class: str,
) -> dict | None:
    try:
        request = BudgetRequest(
            destination=destination,
            num_days=num_days,
            family_size=family_size,
            travel_class=travel_class,
        )
        return estimate_budget(request, str(_BUDGET_BASELINES_PATH)).to_dict()
    except Exception as exc:
        logger.warning("Budget estimate unavailable for %s: %s", destination, exc)
        return None


def _destination_coordinates(destination: str) -> dict | None:
    destination_key = (
        resolve_destination_key(destination) or destination.strip().lower()
    )
    info = DESTINATION_COORDS.get(destination_key)
    if not info:
        return None

    return {
        "key": destination_key,
        "lat": info["lat"],
        "lon": info["lon"],
        "label": info["label"],
    }


def _route_point_coordinates(place: str, destination: str, api_key: str) -> dict | None:
    if not api_key:
        return None

    query = f"{place}, {destination}".strip().strip(",")
    if not query:
        return None

    cached = _ROUTE_POINT_GEOCODE_CACHE.get(query)
    if cached:
        return cached

    result = geocode(query, api_key)
    if not result:
        return None

    lat = result.get("lat")
    lon = result.get("lon")
    if lat is None or lon is None:
        return None

    coordinates = {
        "lat": lat,
        "lon": lon,
        "label": result.get("address") or query,
    }
    _ROUTE_POINT_GEOCODE_CACHE[query] = coordinates
    return coordinates


def _build_route_points(
    destination: str, itinerary_days: list[dict], api_key: str = ""
) -> list[dict]:
    destination_key = (
        resolve_destination_key(destination) or destination.strip().lower()
    )

    route_points: list[dict] = []
    for day in itinerary_days:
        day_number = day.get("day")
        for order, slot_name in enumerate(("morning", "afternoon", "evening"), start=1):
            slot = day.get(slot_name) or {}
            place = (slot.get("place") or slot.get("activity") or "").strip()
            if not place:
                continue

            route_points.append(
                {
                    "day": day_number,
                    "slot": slot_name,
                    "order": order,
                    "place": place,
                    "activity": slot.get("activity", place),
                    "query": f"{place} {destination}".strip(),
                    "description": slot.get("description", ""),
                    "duration": slot.get("duration", ""),
                    "cost": slot.get("cost", ""),
                    "destination": destination,
                    "destination_key": destination_key,
                    "coordinates": _route_point_coordinates(
                        place, destination, api_key
                    ),
                }
            )

    return route_points


def _split_interests(interests: str) -> list[str]:
    parts = [
        p.strip().lower() for p in re.split(r"[,/;]", interests or "") if p.strip()
    ]
    return parts[:5] if parts else ["sightseeing", "food", "culture"]


def _cost_band(travel_class: str) -> tuple[str, str, str]:
    if travel_class == "premium":
        return ("₹1,800-3,500", "₹2,500-5,500", "₹3,000-7,000")
    if travel_class == "comfort":
        return ("₹900-1,800", "₹1,200-2,600", "₹1,600-3,200")
    return ("₹300-900", "₹500-1,200", "₹700-1,800")


def _fallback_slot(activity: str, desc: str, duration: str, cost: str) -> dict:
    return {
        "place": activity,
        "activity": activity,
        "description": desc,
        "duration": duration,
        "cost": cost,
    }


def _generate_fallback_itinerary(
    destination: str,
    num_days: int,
    family_size: int,
    travel_class: str,
    interests: str,
    maps_api_key: str = "",
) -> dict:
    """Generate a deterministic local itinerary when AI quota/network fails."""
    interests_list = _split_interests(interests)
    morning_cost, afternoon_cost, evening_cost = _cost_band(travel_class)

    days = []
    for day in range(1, num_days + 1):
        is_arrival = day == 1
        is_departure = day == num_days
        focus = interests_list[(day - 1) % len(interests_list)]

        if is_arrival:
            title = "Arrival and Easy Orientation"
            morning = _fallback_slot(
                "Arrival and check-in",
                f"Arrive in {destination}, settle in, and keep the schedule light for the first day.",
                "1-2 hours",
                morning_cost,
            )
            afternoon = _fallback_slot(
                f"Local orientation walk ({focus})",
                "Visit one nearby landmark and map out transport options for upcoming days.",
                "2-3 hours",
                afternoon_cost,
            )
            evening = _fallback_slot(
                "Early dinner and rest",
                "Try a local meal and rest to avoid fatigue before full sightseeing starts.",
                "2 hours",
                evening_cost,
            )
            tip = "Keep buffers for delays on arrival day and hydrate well."
        elif is_departure:
            title = "Wrap-up and Departure"
            morning = _fallback_slot(
                "Short nearby visit",
                "Do one short attraction close to your stay to avoid checkout-time pressure.",
                "1-2 hours",
                morning_cost,
            )
            afternoon = _fallback_slot(
                "Shopping and transfer prep",
                "Pick up souvenirs and confirm transfer timing to station/airport.",
                "2 hours",
                afternoon_cost,
            )
            evening = _fallback_slot(
                "Departure",
                f"Leave {destination} with at least a 2-hour transport buffer.",
                "1-2 hours",
                evening_cost,
            )
            tip = "Keep documents, chargers, and medicines in an easy-access pouch."
        else:
            title = f"Day {day}: {focus.title()} and City Highlights"
            morning = _fallback_slot(
                f"Top {focus} attraction",
                f"Visit a priority {focus} spot in {destination} during cooler/less crowded hours.",
                "2-3 hours",
                morning_cost,
            )
            afternoon = _fallback_slot(
                "Food and culture circuit",
                "Explore a local market or museum area and try signature dishes.",
                "2-3 hours",
                afternoon_cost,
            )
            evening = _fallback_slot(
                "Leisure and viewpoints",
                "Take an easy evening experience such as a promenade, sunset point, or cultural show.",
                "2-3 hours",
                evening_cost,
            )
            tip = f"For a family of {family_size}, pre-book tickets for major attractions to reduce queues."

        days.append(
            {
                "day": day,
                "title": title,
                "morning": morning,
                "afternoon": afternoon,
                "evening": evening,
                "tip": tip,
            }
        )

    return {
        "destination": destination,
        "num_days": num_days,
        "family_size": family_size,
        "travel_class": travel_class,
        "interests": interests,
        "itinerary": days,
        "budget_estimate": _build_budget_estimate(
            destination, num_days, family_size, travel_class
        ),
        "route_points": _build_route_points(destination, days, maps_api_key),
        "destination_coordinates": _destination_coordinates(destination),
        "source": "fallback",
        "warning": "AI quota/availability limit reached. Generated a local smart itinerary instead.",
    }


def generate_itinerary(
    destination: str,
    num_days: int,
    family_size: int,
    travel_class: str,
    interests: str,
    api_key: str,
    maps_api_key: str = "",
) -> dict:
    """
    Generate a Gemini-powered day-by-day itinerary.

    Returns:
        {
            "destination": str,
            "num_days": int,
            "family_size": int,
            "travel_class": str,
            "interests": str,
            "itinerary": [ {day, title, morning, afternoon, evening, tip}, ... ],
        }
    """
    try:
        _configure(api_key)

        sanitized_interests = AIPromptSanitizer.sanitize_input(
            interests or "general sightseeing",
            context="itinerary",
            max_length=500,
            strict_mode=False,
        )
        if sanitized_interests.threats_detected:
            logger.warning(
                "Itinerary input threats: %s", sanitized_interests.threats_detected
            )
        safe_interests = sanitized_interests.sanitized_input or "general sightseeing"

        prompt = ITINERARY_PROMPT.format(
            destination=destination,
            num_days=num_days,
            family_size=family_size,
            travel_class=travel_class,
            interests=safe_interests,
        )

        gen_config = types.GenerateContentConfig(
            temperature=0.35,
            top_p=0.85,
            max_output_tokens=4096,
            response_mime_type="application/json",
            safety_settings=[
                types.SafetySettingDict(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_MEDIUM_AND_ABOVE",
                ),
                types.SafetySettingDict(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_MEDIUM_AND_ABOVE",
                ),
                types.SafetySettingDict(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_MEDIUM_AND_ABOVE",
                ),
                types.SafetySettingDict(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_MEDIUM_AND_ABOVE",
                ),
            ],
        )
        response = _client.models.generate_content(
            model="gemini-2.5-flash", contents=prompt, config=gen_config
        )
        raw = response.text.strip()
        logger.debug("Itinerary raw response length: %d chars", len(raw))

        days = _extract_json(raw)

        # Validate structure — Bug 4.4 fix: per-day schema check
        if not isinstance(days, list) or len(days) == 0:
            raise ValueError("Empty itinerary returned")

        REQUIRED_SLOT_KEYS = {"activity", "description", "duration", "cost"}
        REQUIRED_DAY_KEYS = {"day", "title", "morning", "afternoon", "evening", "tip"}

        validated_days = []
        for i, day in enumerate(days):
            if not isinstance(day, dict):
                logger.warning("Day %d is not a dict, skipping", i + 1)
                continue
            # Fill missing top-level keys with safe defaults
            if not REQUIRED_DAY_KEYS.issubset(day.keys()):
                missing = REQUIRED_DAY_KEYS - day.keys()
                logger.warning(
                    "Day %d missing keys %s — filling defaults", i + 1, missing
                )
                for k in missing:
                    if k in ("morning", "afternoon", "evening"):
                        morning_cost, afternoon_cost, evening_cost = _cost_band(
                            travel_class
                        )
                        slot_cost = {
                            "morning": morning_cost,
                            "afternoon": afternoon_cost,
                            "evening": evening_cost,
                        }[k]
                        day[k] = _fallback_slot(
                            k.capitalize(),
                            "Activity details not available for this slot.",
                            "2-3 hours",
                            slot_cost,
                        )
                    elif k == "tip":
                        day[k] = "Have a great day exploring!"
                    elif k == "title":
                        day[k] = f"Day {day.get('day', i + 1)}"
                    elif k == "day":
                        day[k] = i + 1
            # Validate slot keys
            for slot in ("morning", "afternoon", "evening"):
                if isinstance(day.get(slot), dict):
                    for skey in REQUIRED_SLOT_KEYS:
                        if skey not in day[slot]:
                            day[slot][skey] = "N/A"
                    if not day[slot].get("place"):
                        day[slot]["place"] = day[slot].get("activity", "N/A")
            validated_days.append(day)

        if not validated_days:
            raise ValueError("No valid days after schema validation")

        return {
            "destination": destination,
            "num_days": num_days,
            "family_size": family_size,
            "travel_class": travel_class,
            "interests": interests,
            "itinerary": validated_days,  # Bug 4.4 fix: use schema-validated list
            "budget_estimate": _build_budget_estimate(
                destination, num_days, family_size, travel_class
            ),
            "route_points": _build_route_points(
                destination, validated_days, maps_api_key
            ),
            "destination_coordinates": _destination_coordinates(destination),
        }

    except json.JSONDecodeError as e:
        logger.error("Itinerary JSON parse error: %s", e)
        fallback = _generate_fallback_itinerary(
            destination=destination,
            num_days=num_days,
            family_size=family_size,
            travel_class=travel_class,
            interests=interests,
            maps_api_key=maps_api_key,
        )
        fallback["error"] = (
            "AI returned an invalid response format. Generated a fallback itinerary."
        )
        fallback["ai_error"] = "invalid response"
        return fallback
    except Exception as e:
        err_text = str(e)
        logger.error("Itinerary generation error: %s", err_text)

        fallback = _generate_fallback_itinerary(
            destination=destination,
            num_days=num_days,
            family_size=family_size,
            travel_class=travel_class,
            interests=interests,
            maps_api_key=maps_api_key,
        )

        if any(
            token in err_text.lower()
            for token in ["429", "quota", "resource exhausted", "rate limit"]
        ):
            fallback["warning"] = (
                "Gemini quota reached (429). Showing a locally generated itinerary so you can continue planning."
            )
        else:
            fallback["warning"] = (
                "AI temporarily unavailable. Showing a locally generated itinerary so your planning is not blocked."
            )

        fallback["ai_error"] = err_text[:150]
        fallback["error"] = (
            "Could not generate itinerary from AI. Fallback itinerary generated."
        )
        return fallback


# ---------------------------------------------------------------------------
# Streaming / per-day generation (v2)
# ---------------------------------------------------------------------------

DAY_PROMPT = """You are an expert Indian travel planner. Generate the itinerary for ONE single day.

**Context:**
- Destination: {destination}
- Trip length: {num_days} days total, generating Day {day_number}
- Family size: {family_size} people
- Travel class: {travel_class} (economy = budget-friendly street food & public transport; comfort = mid-range restaurants & cabs; premium = luxury dining & private cars)
- Interests: {interests}
- Rule: If this is the first day, make it arrival-friendly (lighter schedule). If it is the last day, make it departure-friendly.

**Rules:**
1. Respond ONLY with valid JSON for ONE day — no markdown, no code fences, no extra text.
2. Use this exact schema:
   {{
     "day": {day_number},
     "title": "<short theme for the day>",
     "morning": {{ "place": "<real place name>", "activity": "<name>", "description": "<1-2 sentences>", "duration": "<e.g. 2-3 hours>", "cost": "<approx ₹ per person>" }},
     "afternoon": {{ "place": "<real place name>", "activity": "<name>", "description": "<1-2 sentences>", "duration": "<e.g. 2-3 hours>", "cost": "<approx ₹ per person>" }},
     "evening": {{ "place": "<real place name>", "activity": "<name>", "description": "<1-2 sentences>", "duration": "<e.g. 2-3 hours>", "cost": "<approx ₹ per person>" }},
     "tip": "<one practical tip for the day>"
   }}
3. Use real place names specific to the destination.
4. Mix sightseeing, food, culture, adventure, and relaxation.
5. All costs in Indian Rupees (₹).
"""


def _build_gen_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        temperature=0.35,
        top_p=0.85,
        max_output_tokens=2048,
        response_mime_type="application/json",
        safety_settings=[
            types.SafetySettingDict(
                category="HARM_CATEGORY_HARASSMENT",
                threshold="BLOCK_MEDIUM_AND_ABOVE",
            ),
            types.SafetySettingDict(
                category="HARM_CATEGORY_HATE_SPEECH",
                threshold="BLOCK_MEDIUM_AND_ABOVE",
            ),
            types.SafetySettingDict(
                category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold="BLOCK_MEDIUM_AND_ABOVE",
            ),
            types.SafetySettingDict(
                category="HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold="BLOCK_MEDIUM_AND_ABOVE",
            ),
        ],
    )


REQUIRED_SLOT_KEYS = {"activity", "description", "duration", "cost"}
REQUIRED_DAY_KEYS = {"day", "title", "morning", "afternoon", "evening", "tip"}


def _validate_single_day(day: dict, travel_class: str, day_number: int) -> dict:
    """Fill missing top-level/slot keys with safe defaults (per-day schema)."""
    if not isinstance(day, dict):
        raise ValueError("Day schema violation — not an object")

    for k in REQUIRED_DAY_KEYS - day.keys():
        if k in ("morning", "afternoon", "evening"):
            morning_cost, afternoon_cost, evening_cost = _cost_band(travel_class)
            slot_cost = {
                "morning": morning_cost,
                "afternoon": afternoon_cost,
                "evening": evening_cost,
            }[k]
            day[k] = _fallback_slot(
                k.capitalize(),
                "Activity details not available for this slot.",
                "2-3 hours",
                slot_cost,
            )
        elif k == "tip":
            day[k] = "Have a great day exploring!"
        elif k == "title":
            day[k] = f"Day {day_number}"
        elif k == "day":
            day[k] = day_number

    day["day"] = day_number
    for slot in ("morning", "afternoon", "evening"):
        if isinstance(day.get(slot), dict):
            for skey in REQUIRED_SLOT_KEYS:
                if skey not in day[slot]:
                    day[slot][skey] = "N/A"
            if not day[slot].get("place"):
                day[slot]["place"] = day[slot].get("activity", "N/A")
    return day


def _unwrap_day(parsed) -> dict | None:
    """Extract a single day object from Gemini output (list or dict wrapper)."""
    if isinstance(parsed, list):
        return parsed[0] if parsed else None
    if isinstance(parsed, dict):
        for key in ("itinerary", "days", "schedule", "plan"):
            value = parsed.get(key)
            if isinstance(value, list) and value:
                return value[0]
        return parsed
    return None


def _fetch_day_from_ai(
    day_number: int,
    num_days: int,
    destination: str,
    family_size: int,
    travel_class: str,
    safe_interests: str,
    api_key: str,
) -> dict:
    _configure(api_key)
    prompt = DAY_PROMPT.format(
        destination=destination,
        num_days=num_days,
        day_number=day_number,
        family_size=family_size,
        travel_class=travel_class,
        interests=safe_interests,
    )
    response = _client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=_build_gen_config(),
    )
    raw = response.text.strip()
    day = _unwrap_day(_extract_json(raw))
    if not day:
        raise ValueError(f"Empty day response for day {day_number}")
    return _validate_single_day(day, travel_class, day_number)


def _fallback_single_day(
    day_number: int,
    num_days: int,
    destination: str,
    family_size: int,
    travel_class: str,
    interests: str,
    maps_api_key: str = "",
) -> dict:
    fb = _generate_fallback_itinerary(
        destination=destination,
        num_days=num_days,
        family_size=family_size,
        travel_class=travel_class,
        interests=interests,
        maps_api_key=maps_api_key,
    )
    for day in fb["itinerary"]:
        if day["day"] == day_number:
            return day
    return fb["itinerary"][-1]


def generate_itinerary_days(
    destination: str,
    num_days: int,
    family_size: int,
    travel_class: str,
    interests: str,
    api_key: str,
    stop_event: threading.Event | None = None,
) -> Generator[dict, None, None]:
    """Generate the itinerary one day at a time, yielding in order.

    Up to 3 Gemini calls run concurrently; days are drained in order, so a
    later day can finish first but is only yielded after its predecessors.
    Individual failures degrade to the deterministic local fallback for that
    day so a job always completes. Passing `stop_event` lets the caller abort
    early (in-flight calls are abandoned, not waited on).
    """
    sanitized = AIPromptSanitizer.sanitize_input(
        interests or "general sightseeing",
        context="itinerary",
        max_length=500,
        strict_mode=False,
    )
    safe_interests = sanitized.sanitized_input or "general sightseeing"

    results: dict[int, dict] = {}
    worker_count = min(3, max(1, num_days))
    pool = ThreadPoolExecutor(max_workers=worker_count)

    try:
        futures = {
            pool.submit(
                _fetch_day_from_ai,
                day_number,
                num_days,
                destination,
                family_size,
                travel_class,
                safe_interests,
                api_key,
            ): day_number
            for day_number in range(1, num_days + 1)
        }
        expected = 1
        for future in as_completed(futures):
            if stop_event is not None and stop_event.is_set():
                break
            day_number = futures[future]
            try:
                results[day_number] = future.result()
            except Exception as exc:
                logger.warning(
                    "Day %d AI generation failed (%s) — using local fallback",
                    day_number,
                    exc,
                )
                results[day_number] = _fallback_single_day(
                    day_number,
                    num_days,
                    destination,
                    family_size,
                    travel_class,
                    interests or "General sightseeing",
                )

            # Drain consecutive days that are already available
            while expected in results:
                yield results.pop(expected)
                expected += 1

        # Any stragglers (or early stop) are still emitted in order
        for day_number in range(1, num_days + 1):
            if day_number in results:
                yield results.pop(day_number)
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


def build_full_response(
    destination: str,
    num_days: int,
    family_size: int,
    travel_class: str,
    interests: str,
    days: list[dict],
    maps_api_key: str = "",
) -> dict:
    """Compose the final itinerary payload around a day list."""
    return {
        "destination": destination,
        "num_days": num_days,
        "family_size": family_size,
        "travel_class": travel_class,
        "interests": interests,
        "itinerary": days,
        "budget_estimate": _build_budget_estimate(
            destination, num_days, family_size, travel_class
        ),
        "route_points": _build_route_points(destination, days, maps_api_key),
        "destination_coordinates": _destination_coordinates(destination),
    }
