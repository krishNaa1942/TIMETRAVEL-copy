"""
Itinerary Generator API Route
================================
v1 (legacy, sync):
    POST /api/itinerary/generate – AI-powered day-by-day trip itinerary.

v2 (background job + streaming):
    POST /api/itinerary/jobs            – start generation, returns {job_id}
    GET  /api/itinerary/jobs/<id>       – current status + streamed days
    GET  /api/itinerary/jobs/<id>/stream – SSE: step/day/done/error/cancelled
    POST /api/itinerary/jobs/<id>/cancel – request cancellation

v2 accepts a raw free-text `query` ("3-day trip to Goa from Bangalore") and
parses it server-side through the intent parser — the single authority for
destination resolution and duration/travel-class extraction.
"""

import json
import time

from flask import Blueprint, Response, request, jsonify, current_app, stream_with_context
from app.services.intent_parser import parse_trip_intent
from app.services.itinerary_jobs import (
    cancel_job,
    create_job,
    get_job,
    start_job,
)
from app.services.itinerary_service import generate_itinerary
from app.utils.constants import (
    VALID_DESTINATION_NAMES as VALID_DESTINATIONS,
    resolve_destination_key,
)
from app.main import limiter

itinerary_bp = Blueprint("itinerary", __name__)

_VALID_CLASSES = ("economy", "comfort", "premium")


def _resolve_request_fields(data: dict) -> dict | tuple[dict, int]:
    """Validate + resolve generation params from a request body.

    If a raw `query` is provided it wins for destination/days/class
    extraction; explicit fields override parsed values.
    """
    query = (data.get("query") or "").strip()

    parsed = parse_trip_intent(query) if query else {}

    destination_raw = (data.get("destination") or "").strip() or (parsed.get("destination") or "")
    destination = resolve_destination_key(destination_raw) if destination_raw else None
    if not destination or destination not in VALID_DESTINATIONS:
        return (
            jsonify(
                {
                    "error": f"Invalid destination. Choose from: {', '.join(sorted(VALID_DESTINATIONS))}"
                }
            ),
            400,
        )

    # num_days: explicit beats parsed
    num_days = data.get("num_days")
    if num_days is None:
        num_days = parsed.get("num_days", 3)
    try:
        num_days = int(num_days)
    except (TypeError, ValueError):
        return jsonify({"error": "num_days must be an integer"}), 400
    if num_days < 1 or num_days > 14:
        return jsonify({"error": "num_days must be between 1 and 14"}), 400

    # family_size: only explicit (no NLP for this)
    family_size = data.get("family_size", 1)
    try:
        family_size = int(family_size)
    except (TypeError, ValueError):
        return jsonify({"error": "family_size must be an integer"}), 400
    if family_size < 1 or family_size > 20:
        return jsonify({"error": "family_size must be between 1 and 20"}), 400

    travel_class = (data.get("travel_class") or "").strip() or parsed.get("travel_class", "economy")
    if travel_class not in _VALID_CLASSES:
        return (
            jsonify({"error": "travel_class must be economy, comfort, or premium"}),
            400,
        )

    interests = (data.get("interests") or "").strip()
    if not interests and query:
        interests = parsed.get("interests", "")

    return {
        "destination": destination,
        "num_days": num_days,
        "family_size": family_size,
        "travel_class": travel_class,
        "interests": interests,
        "origin": parsed.get("origin", ""),
        "query": query,
    }


@itinerary_bp.route("/api/itinerary/generate", methods=["POST"])
@limiter.limit("10 per minute")
def itinerary_generate():
    """Legacy sync generation — kept for backwards compatibility."""

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    resolved = _resolve_request_fields(data)
    if isinstance(resolved, tuple):
        return resolved

    api_key = current_app.config.get("GOOGLE_API_KEY", "")
    if not api_key:
        return (
            jsonify({"error": "Gemini AI is not configured. Set GOOGLE_API_KEY."}),
            503,
        )

    result = generate_itinerary(
        destination=resolved["destination"],
        num_days=resolved["num_days"],
        family_size=resolved["family_size"],
        travel_class=resolved["travel_class"],
        interests=resolved["interests"],
        api_key=api_key,
        maps_api_key=current_app.config.get("TOMTOM_API_KEY", ""),
    )

    # Bug 3.2 fix: only treat as a hard error if itinerary is missing.
    if "error" in result and "itinerary" not in result:
        return jsonify(result), 502

    return jsonify(result)


# ── v2: background jobs ──────────────────────────────────────────────────


@itinerary_bp.route("/api/itinerary/jobs", methods=["POST"])
@limiter.limit("10 per minute")
def itinerary_create_job():
    """Start a background generation job. Returns {job_id} immediately."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    resolved = _resolve_request_fields(data)
    if isinstance(resolved, tuple):
        return resolved

    api_key = current_app.config.get("GOOGLE_API_KEY", "")
    if not api_key:
        return (
            jsonify({"error": "Gemini AI is not configured. Set GOOGLE_API_KEY."}),
            503,
        )

    params = {
        **resolved,
        "api_key": api_key,
        "maps_api_key": current_app.config.get("TOMTOM_API_KEY", ""),
    }
    job_id = create_job(params)
    start_job(job_id)
    return jsonify({"job_id": job_id, "status": "queued"}), 202


@itinerary_bp.route("/api/itinerary/jobs/<job_id>", methods=["GET"])
def itinerary_job_status(job_id):
    """Fetch job status + days streamed so far (polling-friendly)."""
    job = get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found or expired."}), 404

    snapshot = job.snapshot()
    if job.result:
        snapshot["result"] = job.result
    return jsonify(snapshot)


@itinerary_bp.route("/api/itinerary/jobs/<job_id>/stream", methods=["GET"])
def itinerary_job_stream(job_id):
    """SSE stream of job events: step, day, done, error, cancelled."""
    job = get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found or expired."}), 404

    def _format(seq: int, event_type: str, data: dict) -> str:
        payload = json.dumps({"seq": seq, "type": event_type, **data}, default=str)
        return f"id: {seq}\nevent: {event_type}\ndata: {payload}\n\n"

    def generate():
        seq = 0
        # Replay history first, then live events
        while True:
            events, seq = job.events_since(seq)
            for event in events:
                yield _format(event["seq"], event["type"], event)
            if job.status in {"done", "error", "cancelled"}:
                break
            if not job.wait_for_events(seq, timeout=1.0):
                yield ": keepalive\n\n"  # heartbeat so proxies don't drop us

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@itinerary_bp.route("/api/itinerary/jobs/<job_id>/cancel", methods=["POST"])
def itinerary_cancel_job(job_id):
    """Request cancellation of a running job."""
    if not get_job(job_id):
        return jsonify({"error": "Job not found or expired."}), 404
    cancelled = cancel_job(job_id)
    return jsonify({"job_id": job_id, "cancelled": cancelled})
