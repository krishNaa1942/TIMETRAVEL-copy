"""
Maps API Routes
================
GET  /api/maps/destinations   – All destination markers
GET  /api/maps/geocode        – Geocode a place name → lat/lon
GET  /api/maps/nearby         – Find POIs near a destination
GET  /api/maps/route          – Calculate route between two destinations
GET  /api/maps/suggest        – Smart suggestions based on live location

All endpoints use the TomTom Maps API.
"""

from flask import Blueprint, request, jsonify, current_app

from app.services.maps_service import (
    get_all_destinations,
    geocode,
    search_nearby,
    calculate_route,
    get_smart_suggestions,
    reverse_geocode,
    find_nearest_destination,
    DESTINATION_COORDS,
)

maps_bp = Blueprint("maps", __name__)


def _tomtom_key() -> str:
    return current_app.config.get("TOMTOM_API_KEY", "")


# ---------------------------------------------------------------------------
# GET /api/maps/config – return map SDK key for client-side init
# ---------------------------------------------------------------------------
@maps_bp.route("/api/maps/config", methods=["GET"])
def map_config():
    """Return the TomTom SDK key for map initialisation."""
    key = _tomtom_key()
    return jsonify({"key": key if key else "", "available": bool(key)}), 200


# ---------------------------------------------------------------------------
# GET /api/maps/destinations – pre-seeded markers
# ---------------------------------------------------------------------------
@maps_bp.route("/api/maps/destinations", methods=["GET"])
def destinations():
    """Return all supported destinations with coordinates."""
    return jsonify({"destinations": get_all_destinations()}), 200


# ---------------------------------------------------------------------------
# GET /api/maps/geocode?q=<place>
# ---------------------------------------------------------------------------
@maps_bp.route("/api/maps/geocode", methods=["GET"])
def geocode_place():
    """Geocode a place name to lat/lon."""
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return jsonify({"error": "Query parameter 'q' is required (min 2 chars)"}), 400

    key = _tomtom_key()
    if not key:
        return jsonify({"error": "TomTom API key not configured"}), 503

    result = geocode(q, key)
    if not result:
        return jsonify({"error": f"Could not geocode '{q}'"}), 404

    return jsonify(result), 200


# ---------------------------------------------------------------------------
# GET /api/maps/nearby?dest=<name>&category=<cat>&limit=<n>
# ---------------------------------------------------------------------------
@maps_bp.route("/api/maps/nearby", methods=["GET"])
def nearby():
    """Find points of interest near a destination."""
    dest = request.args.get("dest", "").strip().lower()
    category = request.args.get("category", "tourist attraction").strip()
    try:
        limit = min(int(request.args.get("limit", "10")), 20)
    except (TypeError, ValueError):
        limit = 10

    if not dest:
        return jsonify({"error": "Query parameter 'dest' is required"}), 400

    key = _tomtom_key()
    if not key:
        return jsonify({"error": "TomTom API key not configured"}), 503

    # Resolve coordinates
    coords = DESTINATION_COORDS.get(dest)
    if not coords:
        geo = geocode(dest, key)
        if not geo:
            return jsonify({"error": f"Could not locate '{dest}'"}), 404
        lat, lon = geo["lat"], geo["lon"]
    else:
        lat, lon = coords["lat"], coords["lon"]

    pois = search_nearby(lat, lon, key, category=category, limit=limit)
    return jsonify({
        "destination": dest,
        "category": category,
        "count": len(pois),
        "pois": pois,
    }), 200


# ---------------------------------------------------------------------------
# GET /api/maps/route?from=<dest>&to=<dest>&mode=car
# ---------------------------------------------------------------------------
@maps_bp.route("/api/maps/route", methods=["GET"])
def route():
    """Calculate route between two destinations."""
    origin = request.args.get("from", "").strip().lower()
    destination = request.args.get("to", "").strip().lower()
    mode = request.args.get("mode", "car").strip().lower()

    if not origin or not destination:
        return jsonify({"error": "'from' and 'to' parameters are required"}), 400

    key = _tomtom_key()
    if not key:
        return jsonify({"error": "TomTom API key not configured"}), 503

    # Resolve origin coordinates
    o = DESTINATION_COORDS.get(origin)
    if not o:
        geo = geocode(origin, key)
        if not geo:
            return jsonify({"error": f"Could not locate origin '{origin}'"}), 404
        o = {"lat": geo["lat"], "lon": geo["lon"]}

    # Resolve destination coordinates
    d = DESTINATION_COORDS.get(destination)
    if not d:
        geo = geocode(destination, key)
        if not geo:
            return jsonify({"error": f"Could not locate destination '{destination}'"}), 404
        d = {"lat": geo["lat"], "lon": geo["lon"]}

    result = calculate_route(o["lat"], o["lon"], d["lat"], d["lon"], key, mode)
    if not result:
        return jsonify({"error": "Could not calculate route"}), 502

    return jsonify({
        "origin": origin,
        "destination": destination,
        "travel_mode": mode,
        **result,
    }), 200


# ---------------------------------------------------------------------------
# GET /api/maps/suggest?lat=<lat>&lon=<lon>
# ---------------------------------------------------------------------------
@maps_bp.route("/api/maps/suggest", methods=["GET"])
def suggest():
    """Smart suggestions based on user's live GPS location."""
    try:
        lat = float(request.args.get("lat", 0))
        lon = float(request.args.get("lon", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Valid 'lat' and 'lon' parameters are required"}), 400

    if lat == 0 and lon == 0:
        return jsonify({"error": "'lat' and 'lon' parameters are required"}), 400

    key = _tomtom_key()
    if not key:
        return jsonify({"error": "TomTom API key not configured"}), 503

    try:
        limit = min(int(request.args.get("limit", "5")), 10)
    except (TypeError, ValueError):
        limit = 5
    result = get_smart_suggestions(lat, lon, key, limit_per_cat=limit)

    return jsonify(result), 200


# ---------------------------------------------------------------------------
# GET /api/maps/reverse?lat=<lat>&lon=<lon>
# ---------------------------------------------------------------------------
@maps_bp.route("/api/maps/reverse", methods=["GET"])
def reverse():
    """Reverse geocode: lat/lon → address."""
    try:
        lat = float(request.args.get("lat", 0))
        lon = float(request.args.get("lon", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Valid 'lat' and 'lon' are required"}), 400

    key = _tomtom_key()
    if not key:
        return jsonify({"error": "TomTom API key not configured"}), 503

    place = reverse_geocode(lat, lon, key)
    if not place:
        return jsonify({"error": "Could not reverse geocode location"}), 404

    nearest = find_nearest_destination(lat, lon)
    return jsonify({**place, "nearest_destination": nearest}), 200
