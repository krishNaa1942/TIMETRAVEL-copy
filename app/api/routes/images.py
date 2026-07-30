"""
Images API Route
=================
GET /api/images/destinations            – One image per destination (gallery)
GET /api/images/destination/<name>      – Multiple images for a single destination
GET /api/images/hero/<name>             – Single hero image for a destination
GET /api/images/status                  – Check if Unsplash is configured

Image responses include proper Unsplash attribution fields.
"""

from flask import Blueprint, jsonify, current_app

from app.main import limiter
from app.services.unsplash_service import (
    search_destination_images,
    get_hero_image,
    get_all_destination_images,
    is_available,
    get_availability,
    _generate_fallback_images,
)
from app.utils.constants import DESTINATION_UNSPLASH_KW

images_bp = Blueprint("images", __name__)


def _unsplash_key() -> str:
    return current_app.config.get("UNSPLASH_ACCESS_KEY", "")


# ── GET /api/images/destinations – gallery card images ────
@images_bp.route("/api/images/destinations", methods=["GET"])
def all_destination_images():
    """Return one representative image per destination with fallbacks."""
    key = _unsplash_key()

    # Return fallback images if Unsplash is not configured or unavailable
    avail = (
        get_availability(key)
        if key
        else {"available": False, "reason": "missing_key", "retry_in_sec": 0}
    )

    if not avail["available"]:
        # Generate fallback images for all destinations
        fallback_images = {}
        for dest_key in DESTINATION_UNSPLASH_KW.keys():
            fallbacks = _generate_fallback_images(dest_key, 1)
            if fallbacks:
                fallback_images[dest_key] = fallbacks[0]
        return (
            jsonify(
                {
                    "images": fallback_images,
                    "provider_status": avail,
                    "using_fallbacks": True,
                }
            ),
            200,
        )

    unsplash_images = get_all_destination_images(key, count_per_dest=1)

    merged_images = {}
    for dest_key in DESTINATION_UNSPLASH_KW.keys():
        image = unsplash_images.get(dest_key)
        if image:
            merged_images[dest_key] = image
            continue

        fallbacks = _generate_fallback_images(dest_key, 1)
        if fallbacks:
            merged_images[dest_key] = fallbacks[0]

    fallback_count = max(0, len(merged_images) - len(unsplash_images))

    return (
        jsonify(
            {
                "images": merged_images,
                "provider_status": get_availability(key),
                "using_fallbacks": fallback_count > 0,
                "source_counts": {
                    "unsplash": len(unsplash_images),
                    "fallback": fallback_count,
                },
            }
        ),
        200,
    )


# ── GET /api/images/destination/<name> – multi-photo view ─
@images_bp.route("/api/images/destination/<destination>", methods=["GET"])
@limiter.limit("30 per minute")
def destination_images(destination: str):
    """Return multiple images for a single destination with fallbacks."""
    destination = destination.strip()
    if len(destination) < 2 or len(destination) > 100:
        return jsonify({"error": "Invalid destination name"}), 400

    key = _unsplash_key()
    avail = (
        get_availability(key)
        if key
        else {"available": False, "reason": "missing_key", "retry_in_sec": 0}
    )

    # Use fallback images if Unsplash is unavailable
    if not avail["available"]:
        images = _generate_fallback_images(destination, 6)
        return (
            jsonify(
                {
                    "destination": destination,
                    "count": len(images),
                    "images": images,
                    "provider_status": avail,
                    "using_fallbacks": True,
                }
            ),
            200,
        )

    images = search_destination_images(destination, key, count=6)
    using_fallbacks = any(
        str(img.get("id", "")).startswith("fallback-") for img in images
    )

    return (
        jsonify(
            {
                "destination": destination,
                "count": len(images),
                "images": images,
                "provider_status": get_availability(key),
                "using_fallbacks": using_fallbacks,
            }
        ),
        200,
    )


# ── GET /api/images/hero/<name> – single hero banner ──────
@images_bp.route("/api/images/hero/<destination>", methods=["GET"])
@limiter.limit("30 per minute")
def hero_image(destination: str):
    """Return a single hero/banner image for a destination with fallback."""
    destination = destination.strip()
    if not destination or len(destination) > 100:
        return jsonify({"error": "Invalid destination name"}), 400

    key = _unsplash_key()
    avail = (
        get_availability(key)
        if key
        else {"available": False, "reason": "missing_key", "retry_in_sec": 0}
    )

    # Return fallback if Unsplash is unavailable
    if not avail["available"]:
        fallbacks = _generate_fallback_images(destination, 1)
        if fallbacks:
            return (
                jsonify(
                    {
                        "destination": destination,
                        "image": fallbacks[0],
                        "provider_status": avail,
                        "using_fallback": True,
                    }
                ),
                200,
            )
        return jsonify({"error": "No image found", "image": None}), 404

    image = get_hero_image(destination, key)
    if not image:
        # Try fallback if API returns no results
        fallbacks = _generate_fallback_images(destination, 1)
        if fallbacks:
            return (
                jsonify(
                    {
                        "destination": destination,
                        "image": fallbacks[0],
                        "using_fallback": True,
                    }
                ),
                200,
            )
        return jsonify({"error": "No image found", "image": None}), 404

    return (
        jsonify({"destination": destination, "image": image, "using_fallback": False}),
        200,
    )


# ── GET /api/images/status ─────────────────────────────────
@images_bp.route("/api/images/status", methods=["GET"])
def images_status():
    """Check if the Unsplash image service is available."""
    key = _unsplash_key()
    avail = get_availability(key)
    return (
        jsonify(
            {
                "available": is_available(key),
                "reason": avail["reason"],
                "retry_in_sec": avail["retry_in_sec"],
                "provider": "Unsplash",
            }
        ),
        200,
    )
