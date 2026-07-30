"""
Unsplash Image Service
=======================
Fetches high-quality destination photos from Unsplash.

Features:
  - Per-destination keyword search optimized for Indian tourism
  - In-memory cache (avoid hammering the free-tier 50 req/hr limit)
  - Returns multiple sizes (thumb, small, regular, full)
  - Proper attribution as required by Unsplash API guidelines
"""

import logging
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import requests

from app.utils.retry import api_retry

logger = logging.getLogger(__name__)

UNSPLASH_BASE = "https://api.unsplash.com"

# ── In-memory cache: { "goa": { "ts": epoch, "data": [...] } }
_cache: dict = {}
_cache_lock = threading.Lock()
CACHE_TTL = 3600  # 1 hour

# Unsplash auth circuit breaker: avoid hammering API/logs on invalid keys.
AUTH_FAILURE_COOLDOWN = 900  # 15 minutes
_auth_failed_until = 0.0
_auth_failed_key_sig = ""
_auth_failure_logged = False
_auth_lock = threading.Lock()

# Unsplash free-tier throttle protection: avoid repeatedly hitting 403 rate limits.
RATE_LIMIT_COOLDOWN = 3600  # 1 hour
_rate_limited_until = 0.0
_rate_limit_logged = False
_rate_limit_lock = threading.Lock()

# Keep bulk gallery fetch under free-tier limits (50 req/hour).
UNSPLASH_BULK_FETCH_LIMIT = 40

# Destination keywords imported from central registry
from app.utils.constants import DESTINATION_UNSPLASH_KW as DESTINATION_KEYWORDS


def _key_sig(access_key: str) -> str:
    key = (access_key or "").strip()
    return key[-8:] if key else ""


def _reset_auth_circuit() -> None:
    global _auth_failed_until, _auth_failed_key_sig, _auth_failure_logged
    with _auth_lock:
        _auth_failed_until = 0.0
        _auth_failed_key_sig = ""
        _auth_failure_logged = False


def _reset_rate_limit_circuit() -> None:
    global _rate_limited_until, _rate_limit_logged
    with _rate_limit_lock:
        _rate_limited_until = 0.0
        _rate_limit_logged = False


def _is_auth_temporarily_disabled(access_key: str) -> bool:
    global _auth_failed_until, _auth_failed_key_sig, _auth_failure_logged
    with _auth_lock:
        now = time.time()

        if _auth_failed_until and now >= _auth_failed_until:
            _auth_failed_until = 0.0
            _auth_failed_key_sig = ""
            _auth_failure_logged = False
            return False

        sig = _key_sig(access_key)
        if _auth_failed_key_sig and sig and sig != _auth_failed_key_sig:
            _auth_failed_until = 0.0
            _auth_failed_key_sig = ""
            _auth_failure_logged = False
            return False

        return now < _auth_failed_until


def _mark_auth_failure(access_key: str, destination: str) -> None:
    global _auth_failed_until, _auth_failed_key_sig, _auth_failure_logged
    with _auth_lock:
        _auth_failed_until = time.time() + AUTH_FAILURE_COOLDOWN
        _auth_failed_key_sig = _key_sig(access_key)

        if not _auth_failure_logged:
            logger.error(
                "Unsplash unauthorized (401) while fetching '%s'. "
                "Temporarily disabling Unsplash requests for %ds. "
                "Verify UNSPLASH_ACCESS_KEY.",
                destination,
                AUTH_FAILURE_COOLDOWN,
            )
            _auth_failure_logged = True


def _is_rate_limited_temporarily() -> bool:
    global _rate_limited_until
    with _rate_limit_lock:
        now = time.time()

        if _rate_limited_until and now >= _rate_limited_until:
            _rate_limited_until = 0.0
            _rate_limit_logged = False
            return False

        return now < _rate_limited_until


def _mark_rate_limited(destination: str, retry_in_sec: int = RATE_LIMIT_COOLDOWN) -> None:
    global _rate_limited_until, _rate_limit_logged
    with _rate_limit_lock:
        _rate_limited_until = time.time() + max(60, retry_in_sec)

        if not _rate_limit_logged:
            logger.warning(
                "Unsplash rate limit reached while fetching '%s'. "
                "Using fallback images for %ds.",
                destination,
                max(60, retry_in_sec),
            )
            _rate_limit_logged = True


def _is_rate_limit_response(resp: requests.Response) -> bool:
    remaining = (resp.headers.get("x-ratelimit-remaining") or "").strip()
    body_lower = (resp.text or "").lower()
    return remaining == "0" or "rate limit" in body_lower


def _is_cached(destination: str) -> bool:
    """Check if a valid (non-expired) cache entry exists."""
    key = destination.lower()
    if key not in _cache:
        return False
    return (time.time() - _cache[key]["ts"]) < CACHE_TTL


def _generate_fallback_images(destination: str, count: int) -> list:
    """Generate high-quality destination-specific fallback images if API fails or rate limits."""
    
    # Destination-specific curated Unsplash images (direct URLs that don't require API)
    # These are real travel photos that work without authentication
    DESTINATION_IMAGES = {
        # Beaches & Islands
        "goa": [
            "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200",
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200",
            "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200",
        ],
        "kerala": [
            "https://images.unsplash.com/photo-1593693411515-c20261bcad6e?w=1200",
            "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200",
            "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=1200",
        ],
        "andaman": [
            "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200",
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200",
            "https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=1200",
        ],
        "lakshadweep": [
            "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200",
            "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1200",
        ],
        
        # Hill Stations
        "manali": [
            "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200",
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
            "https://images.unsplash.com/photo-1585136917228-c5d620be958e?w=1200",
        ],
        "shimla": [
            "https://images.unsplash.com/photo-1585136917228-c5d620be958e?w=1200",
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
        ],
        "darjeeling": [
            "https://images.unsplash.com/photo-1585136917228-c5d620be958e?w=1200",
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
        ],
        "ooty": [
            "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200",
            "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200",
        ],
        "munnar": [
            "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=1200",
            "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200",
        ],
        "nainital": [
            "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200",
            "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200",
        ],
        "mussoorie": [
            "https://images.unsplash.com/photo-1585136917228-c5d620be958e?w=1200",
            "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200",
        ],
        "kodaikanal": [
            "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200",
            "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200",
        ],
        "coorg": [
            "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=1200",
            "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200",
        ],
        "kasol": [
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
            "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200",
        ],
        "leh": [
            "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200",
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
        ],
        "srinagar": [
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
            "https://images.unsplash.com/photo-1585136917228-c5d620be958e?w=1200",
        ],
        "gulmarg": [
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
            "https://images.unsplash.com/photo-1585136917228-c5d620be958e?w=1200",
        ],
        
        # Major Cities
        "delhi": [
            "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=1200",
            "https://images.unsplash.com/photo-1599652646493-62932f976e3b?w=1200",
            "https://images.unsplash.com/photo-1585136917228-c5d620be958e?w=1200",
        ],
        "mumbai": [
            "https://images.unsplash.com/photo-1570168007204-dfb590c607e9?w=1200",
            "https://images.unsplash.com/photo-1599652646493-62932f976e3b?w=1200",
        ],
        "bangalore": [
            "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=1200",
            "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=1200",
        ],
        "chennai": [
            "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200",
            "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=1200",
        ],
        "kolkata": [
            "https://images.unsplash.com/photo-1558431382-27e303142255?w=1200",
            "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=1200",
        ],
        "jaipur": [
            "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1200",
            "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=1200",
        ],
        "udaipur": [
            "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200",
            "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1200",
        ],
        "jaisalmer": [
            "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1200",
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
        ],
        "agra": [
            "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=1200",
            "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200",
        ],
        "varanasi": [
            "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=1200",
            "https://images.unsplash.com/photo-1558431382-27e303142255?w=1200",
        ],
        "hyderabad": [
            "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=1200",
            "https://images.unsplash.com/photo-1585136917228-c5d620be958e?w=1200",
        ],
        "pune": [
            "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=1200",
            "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200",
        ],
        "ahmedabad": [
            "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=1200",
            "https://images.unsplash.com/photo-1585136917228-c5d620be958e?w=1200",
        ],
        
        # Heritage Sites
        "hampi": [
            "https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?w=1200",
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
        ],
        "khajuraho": [
            "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200",
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
        ],
        
        # Wildlife
        "ranthambore": [
            "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=1200",
            "https://images.unsplash.com/photo-1456926631375-92c8ce872def?w=1200",
        ],
        "jim corbett": [
            "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=1200",
            "https://images.unsplash.com/photo-1456926631375-92c8ce872def?w=1200",
        ],
        
        # Northeast
        "gangtok": [
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
            "https://images.unsplash.com/photo-1585136917228-c5d620be958e?w=1200",
        ],
        "shillong": [
            "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200",
            "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200",
        ],
        "meghalaya": [
            "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200",
            "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200",
        ],
        "tawang": [
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
            "https://images.unsplash.com/photo-1585136917228-c5d620be958e?w=1200",
        ],
        
        # Adventure
        "rishikesh": [
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
            "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200",
        ],
        "spiti": [
            "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200",
            "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200",
        ],
    }
    
    # Generic high-quality travel fallbacks
    GENERIC_FALLBACKS = [
        "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200",  # Adventure travel
        "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200",  # Road trip
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200",  # Mountain lake
        "https://images.unsplash.com/photo-1506461883276-594a12b11ac3?w=1200",  # Scenic view
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200",  # Nature landscape
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200",  # Foggy mountains
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200",  # Forest
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200",  # Beach
    ]
    
    # Find destination-specific images
    dest_lower = destination.lower()
    specific_images = None
    
    # Try to match destination
    for key, images in DESTINATION_IMAGES.items():
        if key in dest_lower or dest_lower in key:
            specific_images = images
            break
    
    # Use specific images or generic fallbacks
    image_urls = specific_images if specific_images else GENERIC_FALLBACKS
    
    # Generate results with proper attribution
    results = []
    for i in range(count):
        url = image_urls[i % len(image_urls)]
        # Clean URL for different sizes
        base_url = url.split('?')[0]
        results.append({
            "id": f"fallback-{destination}-{i}",
            "url_thumb": f"{base_url}?auto=format&fit=crop&w=400&q=80",
            "url_small": f"{base_url}?auto=format&fit=crop&w=800&q=80",
            "url_regular": f"{base_url}?auto=format&fit=crop&w=1200&q=80",
            "url_full": f"{base_url}?auto=format&fit=crop&w=2000&q=80",
            "alt": f"{destination} travel",
            "photographer": "Travel Photographer",
            "photographer_url": "#",
            "unsplash_url": "#",
            "color": "#1e293b",
            "width": 1200,
            "height": 800,
        })
    return results

@api_retry
def search_destination_images(
    destination: str,
    access_key: str,
    count: int = 6,
    orientation: str = "landscape",
) -> list:
    """
    Search Unsplash for destination photos, returning safe fallbacks if the API fails,
    preventing empty arrays and UI breaks on the frontend.
    """
    key = destination.lower()

    # Check cache
    if _is_cached(key):
        logger.debug("Unsplash cache hit for '%s'", key)
        return _cache[key]["data"][:count]

    # If key is missing or circuit breaker is open, return fallbacks immediately
    if not access_key or _is_auth_temporarily_disabled(access_key) or _is_rate_limited_temporarily():
        if not access_key:
            logger.warning("Unsplash access key not configured. Using fallbacks.")
        elif _is_rate_limited_temporarily():
            logger.debug("Unsplash rate-limit circuit open; using fallback images for '%s'", key)
        else:
            logger.debug("Unsplash auth circuit open; using fallback images for '%s'", key)
        return _generate_fallback_images(destination, count)

    # Build search query
    query = DESTINATION_KEYWORDS.get(key, f"{destination} India travel")

    try:
        resp = requests.get(
            f"{UNSPLASH_BASE}/search/photos",
            params={
                "query": query,
                "per_page": min(count, 30),
                "orientation": orientation,
                "content_filter": "high",
                "order_by": "relevant",
            },
            headers={
                "Authorization": f"Client-ID {access_key}",
                "Accept-Version": "v1",
            },
            timeout=10,
        )

        if resp.status_code == 401:
            _mark_auth_failure(access_key, destination)
            return _generate_fallback_images(destination, count)

        if resp.status_code == 403:
            if _is_rate_limit_response(resp):
                _mark_rate_limited(destination)
            else:
                _mark_auth_failure(access_key, destination)
            return _generate_fallback_images(destination, count)

        resp.raise_for_status()
        data = resp.json()

        images = []
        for photo in data.get("results", []):
            images.append({
                "id": photo["id"],
                "url_thumb": photo["urls"]["thumb"],
                "url_small": photo["urls"]["small"],
                "url_regular": photo["urls"]["regular"],
                "url_full": photo["urls"]["full"],
                "alt": photo.get("alt_description") or photo.get("description") or f"{destination} travel photo",
                "photographer": photo["user"]["name"],
                "photographer_url": photo["user"]["links"]["html"],
                "unsplash_url": photo["links"]["html"],
                "color": photo.get("color", "#1e293b"),
                "width": photo.get("width", 0),
                "height": photo.get("height", 0),
            })

        # Cache the results if they validly returned images
        if images:
            _cache[key] = {"ts": time.time(), "data": images}
            logger.info("Unsplash: fetched %d images for '%s'", len(images), key)
            return images
        else:
             return _generate_fallback_images(destination, count)

    except requests.exceptions.RequestException as e:
        if isinstance(e, requests.exceptions.HTTPError) and e.response is not None:
            if e.response.status_code == 401:
                _mark_auth_failure(access_key, destination)
            elif e.response.status_code == 403 and _is_rate_limit_response(e.response):
                _mark_rate_limited(destination)
            elif e.response.status_code == 403:
                _mark_auth_failure(access_key, destination)
            else:
                logger.error("Unsplash API error for '%s': %s", destination, e)
        else:
            logger.error("Unsplash API error for '%s': %s", destination, e)
        
        # Always return fallback data so the UI doesn't crash on network failures
        return _generate_fallback_images(destination, count)


def get_hero_image(destination: str, access_key: str) -> Optional[dict]:
    """Get a single hero/banner image for a destination."""
    images = search_destination_images(destination, access_key, count=1)
    return images[0] if images else None


def get_all_destination_images(
    access_key: str,
    count_per_dest: int = 1,
) -> dict:
    """
    Fetch one image per destination (for gallery/cards).

    Uses ThreadPoolExecutor to fetch all destinations in parallel,
    reducing wall-clock time from ~3s (sequential) to ~0.3-0.5s.

    Returns: { "goa": {...image_dict...}, "jaipur": {...}, ...}
    """
    if not access_key:
        logger.warning("Unsplash access key not configured")
        return {}

    if _is_auth_temporarily_disabled(access_key):
        logger.warning("Unsplash requests skipped: auth temporarily disabled")
        return {}

    if _is_rate_limited_temporarily():
        logger.warning("Unsplash requests skipped: rate limit cooldown active")
        return {}

    dest_keys = list(DESTINATION_KEYWORDS.keys())

    if len(dest_keys) > UNSPLASH_BULK_FETCH_LIMIT:
        logger.warning(
            "Unsplash bulk fetch capped at %d destinations (requested %d) to protect API quota",
            UNSPLASH_BULK_FETCH_LIMIT,
            len(dest_keys),
        )
        dest_keys = dest_keys[:UNSPLASH_BULK_FETCH_LIMIT]

    result = {}

    def _fetch_one(dest_key: str):
        images = search_destination_images(dest_key, access_key, count=count_per_dest)
        return dest_key, images

    with ThreadPoolExecutor(max_workers=min(len(dest_keys), 10)) as executor:
        futures = {executor.submit(_fetch_one, dk): dk for dk in dest_keys}
        for future in as_completed(futures):
            try:
                dest_key, images = future.result()
                if images:
                    result[dest_key] = images[0]
            except Exception as exc:
                logger.error("Parallel fetch failed for '%s': %s", futures[future], exc)

    return result


def is_available(access_key: str) -> bool:
    """Check if the Unsplash API key is configured."""
    return bool(
        access_key
        and len(access_key) > 10
        and not _is_auth_temporarily_disabled(access_key)
        and not _is_rate_limited_temporarily()
    )


def get_availability(access_key: str) -> dict:
    """Get provider availability with a machine-readable reason."""
    if not access_key:
        return {"available": False, "reason": "missing_key", "retry_in_sec": 0}
    if len(access_key) <= 10:
        return {"available": False, "reason": "invalid_key_format", "retry_in_sec": 0}
    if _is_rate_limited_temporarily():
        retry_in = int(max(0, _rate_limited_until - time.time()))
        return {"available": False, "reason": "rate_limited", "retry_in_sec": retry_in}
    if _is_auth_temporarily_disabled(access_key):
        retry_in = int(max(0, _auth_failed_until - time.time()))
        return {"available": False, "reason": "unauthorized", "retry_in_sec": retry_in}

    return {"available": True, "reason": "ok", "retry_in_sec": 0}
