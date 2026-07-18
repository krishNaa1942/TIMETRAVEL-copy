"""
Frontend Route
===============
Serves the single-page web UI.
Route partials are loaded lazily via AJAX on first navigation.
"""

from flask import Blueprint, render_template, abort, make_response
from app.main import limiter

frontend_bp = Blueprint(
    "frontend",
    __name__,
    template_folder="../templates",
    static_folder="../static",
)


# SPA routes — all served by the same template, client-side router handles navigation
SPA_ROUTES = [
    "/",
    "/trips",
    "/chat",
    "/compare",
    "/budget",
    "/itinerary",
    "/maps",
    "/places",
    "/news",
    "/booking",
    "/currency",
    "/language",
    "/expenses",
    "/packing",
    "/journal",
    "/wishlist",
    "/history",
]

# Route name → list of Jinja2 partial templates to render
ROUTE_PARTIALS = {
    "trips": ["partials/trip_dashboard.html"],
    "chat": ["partials/wave_divider_2.html", "partials/chatbot.html"],
    "compare": ["partials/compare.html"],
    "budget": ["partials/tools.html"],
    "itinerary": ["partials/itinerary.html"],
    "maps": ["partials/maps.html"],
    "places": ["partials/places.html"],
    "news": ["partials/news.html"],
    "booking": ["partials/booking.html"],
    "currency": ["partials/currency.html"],
    "language": ["partials/language.html"],
    "expenses": ["partials/expenses.html"],
    "packing": ["partials/packing.html"],
    "journal": ["partials/journal.html"],
    "wishlist": ["partials/wishlist.html"],
    "history": ["partials/history.html"],
}


@frontend_bp.route("/")
@limiter.exempt
def index():
    """Render the main Time Travel web interface."""
    return render_template("index.html")


@frontend_bp.route("/partials/<route_name>")
@limiter.exempt
def serve_partial(route_name):
    """Serve a route's HTML partial for AJAX lazy-loading."""
    templates = ROUTE_PARTIALS.get(route_name)
    if not templates:
        abort(404)
    fragments = []
    for tpl in templates:
        fragments.append(render_template(tpl))
    resp = make_response("".join(fragments))
    resp.headers["Content-Type"] = "text/html; charset=utf-8"
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp


@frontend_bp.route("/<path:path>")
@limiter.exempt
def spa_catch_all(path):
    """Catch-all for client-side routes — serve the SPA shell."""
    # Only match known SPA routes; let API routes pass through
    if "/" + path in SPA_ROUTES:
        return render_template("index.html")
    # Return 404 for truly unknown paths
    return render_template("index.html"), 404
