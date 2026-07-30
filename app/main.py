"""
Flask Application Factory
==========================
Creates and configures the Flask app instance with all blueprints,
extensions, and middleware registered.
"""

from flask import Flask, current_app
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from app.config import get_config

import logging
import os

# Shared extension instances
login_manager = LoginManager()
csrf = CSRFProtect()
_redis_url = os.environ.get("REDIS_URL", "")
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[
        lambda: current_app.config.get("GLOBAL_RATE_LIMIT_PER_DAY", "2000 per day"),
        lambda: current_app.config.get("GLOBAL_RATE_LIMIT_PER_HOUR", "500 per hour"),
    ],
    storage_uri=_redis_url or "memory://",
)


def _configure_logging(app):
    """Set up structured logging so all getLogger() calls have handlers."""
    level = logging.DEBUG if app.debug else logging.INFO
    fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"

    # Configure the root logger so every service's getLogger(__name__) works
    logging.basicConfig(level=level, format=fmt, datefmt=datefmt, force=True)

    # Also attach to Flask's built-in logger
    app.logger.setLevel(level)
    if not app.logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(fmt, datefmt=datefmt))
        app.logger.addHandler(handler)


def create_app(config_class=None):
    """
    Application factory pattern – creates a fully configured Flask app.

    Args:
        config_class: Optional config class override (useful for tests).

    Returns:
        Configured Flask application instance.
    """
    app = Flask(__name__)

    # ── Load configuration ──────────────────────────────────────────
    if config_class is None:
        config_class = get_config()
    app.config.from_object(config_class)

    # ── Configure logging ───────────────────────────────────────────
    _configure_logging(app)

    # ── Ensure instance directory exists (for local SQLite fallback) ───
    import os
    os.makedirs(app.instance_path, exist_ok=True)

    # ── Initialise database ─────────────────────────────────────────
    from app.models.database import init_db, db
    init_db(app)

    # ── Initialise CSRF protection ──────────────────────────────────
    csrf.init_app(app)
    # ── Initialise CORS for mobile app support ──────────────────
    # Allow requests from mobile app running via Expo Go or built APK
    # NOTE: When using credentials, we must specify explicit origins (not "*")
    # For development, we use a dynamic origin handler
    def get_cors_origin():
        """Get allowed origins for CORS."""
        import os
        # Default localhost origins for web development
        origins = [
            "http://localhost:8081",
            "http://localhost:8083",
            "http://localhost:3000",
            "http://localhost:5001",
            "http://127.0.0.1:8081",
            "http://127.0.0.1:8083",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5001",
        ]
        # Add LAN origins from environment (for mobile/Expo Go)
        lan_ip = os.environ.get("LAN_IP")
        if lan_ip:
            origins.extend([
                f"http://{lan_ip}:8081",
                f"http://{lan_ip}:8083",
                f"http://{lan_ip}:3000",
            ])
        return origins

    CORS(app, resources={
        r"/api/*": {
            "origins": get_cors_origin(),
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
            "allow_headers": [
                "Content-Type",
                "Authorization",
                "X-Requested-With",
                "X-Device-ID",
                "X-Platform",
                "X-App-Version",
            ],
            "supports_credentials": True,
            "expose_headers": ["Set-Cookie"],
            "max_age": 3600
        }
    })
    # ── Initialise rate limiting ────────────────────────────────────
    limiter.init_app(app)

    # ── Initialise Flask-Login ──────────────────────────────────────
    login_manager.init_app(app)
    login_manager.login_view = None  # API-only, no redirect

    @login_manager.user_loader
    def load_user(user_id):
        from app.models.entities import User
        return db.session.get(User, int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        from flask import jsonify
        return jsonify({"error": "Authentication required"}), 401

    # ── Bridge JWT Bearer tokens to Flask-Login sessions ───────────
    # Mobile clients authenticate via JWT (Authorization header) while
    # most backend endpoints rely on Flask-Login's @login_required.
    # This before_request handler sets g.user from a valid Bearer token
    # and the request_loader bridges g.user into current_user so that
    # @login_required works without creating a session cookie (eliminating
    # the CSRF vector that a session cookie would introduce).

    @login_manager.request_loader
    def load_user_from_request(request):
        from flask import g
        user = getattr(g, "user", None)
        if user:
            from app.models.entities import User as UserModel
            return UserModel.query.get(user["user_id"])
        return None

    @app.before_request
    def bridge_jwt_to_flask_login():
        from flask import request, g
        from flask_login import current_user
        from app.services.jwt_service_v2 import jwt_service_v2, TokenType

        if current_user.is_authenticated:
            return

        auth = request.headers.get("Authorization", "")
        if not auth.lower().startswith("bearer "):
            return

        token = auth.split(" ", 1)[1]
        payload = jwt_service_v2.verify_token(token, TokenType.ACCESS)
        if payload is None:
            return

        g.user = {
            "user_id": payload.get("sub"),
            "email": payload.get("email"),
            "session_id": payload.get("sid"),
        }

    # ── Exempt API routes from CSRF (mobile apps use JWT, not CSRF tokens) ──
    @app.before_request
    def exempt_api_from_csrf():
        from flask import request
        if request.path.startswith('/api/'):
            request.environ['CSRF_EXEMPT'] = True
    # ── Register API blueprints ─────────────────────────────────────
    from app.api.routes.health import health_bp
    from app.api.routes.auth import auth_bp
    from app.api.routes.auth_v2 import auth_v2_bp
    from app.api.routes.chatbot import chatbot_bp
    from app.api.routes.budget import budget_bp
    from app.api.routes.safety import safety_bp
    from app.api.routes.weather import weather_bp
    from app.api.routes.trips import trips_bp
    from app.api.routes.maps import maps_bp
    from app.api.routes.images import images_bp
    from app.api.routes.places import places_bp
    from app.api.routes.news import news_bp
    from app.api.routes.itinerary import itinerary_bp
    from app.api.routes.compare import compare_bp
    from app.api.routes.export import export_bp
    from app.api.routes.favorites import favorites_bp
    from app.api.routes.destinations import destinations_bp
    from app.api.routes.currency import currency_bp
    from app.api.routes.language import language_bp
    from app.api.routes.booking import booking_bp
    from app.api.routes.notes import notes_bp
    from app.api.routes.sharing import sharing_bp
    from app.api.routes.expenses import expenses_bp
    from app.api.routes.packing import packing_bp
    from app.api.routes.trip_planner import trip_planner_bp
    from app.api.routes.reservations import reservations_bp
    from app.api.routes.uploads import uploads_bp
    from app.api.routes.templates import templates_bp
    from app.api.routes.travel_stats import travel_stats_bp
    from app.api.routes.profile import profile_bp
    from app.api.routes.newsletter import newsletter_bp

    # ── Exempt all API blueprints from CSRF ────────────────────────
    # Mobile apps cannot send CSRF tokens; they rely on CORS + session cookies.
    api_blueprints = [
        auth_bp, auth_v2_bp, chatbot_bp, budget_bp, safety_bp, weather_bp, trips_bp,
        maps_bp, images_bp, places_bp, news_bp, itinerary_bp, compare_bp,
        export_bp, favorites_bp, destinations_bp, currency_bp, language_bp,
        booking_bp, notes_bp, sharing_bp, expenses_bp, packing_bp,
        trip_planner_bp, reservations_bp, uploads_bp, templates_bp,
        travel_stats_bp, profile_bp, newsletter_bp, health_bp,
    ]
    for bp in api_blueprints:
        csrf.exempt(bp)

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(auth_v2_bp)
    app.register_blueprint(chatbot_bp)
    app.register_blueprint(budget_bp)
    app.register_blueprint(safety_bp)
    app.register_blueprint(weather_bp)
    app.register_blueprint(trips_bp)
    app.register_blueprint(maps_bp)
    app.register_blueprint(images_bp)
    app.register_blueprint(places_bp)
    app.register_blueprint(news_bp)
    app.register_blueprint(itinerary_bp)
    app.register_blueprint(compare_bp)
    app.register_blueprint(export_bp)
    app.register_blueprint(favorites_bp)
    app.register_blueprint(destinations_bp)
    app.register_blueprint(currency_bp)
    app.register_blueprint(language_bp)
    app.register_blueprint(booking_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(sharing_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(packing_bp)
    app.register_blueprint(trip_planner_bp)
    app.register_blueprint(reservations_bp)
    app.register_blueprint(uploads_bp)
    app.register_blueprint(templates_bp)
    app.register_blueprint(travel_stats_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(newsletter_bp)

    # ── Security headers ───────────────────────────────────────────
    _register_security_headers(app)

    # ── Global error handlers ───────────────────────────────────────
    _register_error_handlers(app)

    # ── Startup environment validation ──────────────────────────────
    if not app.config.get("TESTING"):
        with app.app_context():
            _validate_env(app)

    return app


def _register_security_headers(app: Flask):
    """Inject CSP and other security headers on every response."""

    # ── Content-Security-Policy ─────────────────────────────────────
    CSP_DIRECTIVES = {
        "default-src": "'self'",
        "script-src":  "'self' blob: https://api.tomtom.com https://cdn.jsdelivr.net",
        "worker-src":  "'self' blob:",
        "style-src":   "'self' 'unsafe-inline' https://fonts.googleapis.com "
                       "https://cdnjs.cloudflare.com https://api.tomtom.com",
        "font-src":    "'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "img-src":     "'self' data: blob: https://images.unsplash.com https://api.tomtom.com https://*.api.tomtom.com",
        "connect-src": "'self' blob: https://api.tomtom.com https://*.api.tomtom.com",
        "frame-src":   "'none'",
        "object-src":  "'none'",
        "base-uri":    "'self'",
        "form-action": "'self'",
    }
    csp_value = "; ".join(f"{k} {v}" for k, v in CSP_DIRECTIVES.items())

    @app.after_request
    def set_security_headers(response):
        response.headers["Content-Security-Policy"] = csp_value
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(self), payment=()"
        )
        # Enforce HTTPS in production (browsers remember for 1 year)
        if not app.debug:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


def _validate_env(app):
    """Log which API services are available and which are missing keys."""
    services = {
        "OpenWeatherMap": "OPENWEATHER_API_KEY",
        "TomTom Maps":    "TOMTOM_API_KEY",
        "Google Gemini":  "GOOGLE_API_KEY",
        "Unsplash":       "UNSPLASH_ACCESS_KEY",
        "Foursquare":     "FOURSQUARE_API_KEY",
        "NewsAPI":        "NEWSAPI_KEY",
    }

    ready = []
    missing = []
    for name, key in services.items():
        if app.config.get(key):
            ready.append(name)
        else:
            missing.append(name)

    app.logger.info("─── Service Status ───────────────────────────────")

    # Database backend
    from app.services.supabase_db import get_db_backend
    backend = get_db_backend()
    app.logger.info("  Database: %s", backend)

    # Supabase API (PostgREST + Storage)
    if app.config.get("SUPABASE_URL") and app.config.get("SUPABASE_KEY"):
        app.logger.info("  ✓ Supabase API: connected")
        try:
            from app.services.supabase_db import ensure_storage_buckets
            ensure_storage_buckets()
        except Exception as exc:
            app.logger.warning("  Supabase storage bucket setup: %s", exc)
    else:
        app.logger.info("  ○ Supabase API: not configured (using local storage)")

    if ready:
        app.logger.info("  ✓ Ready: %s", ", ".join(ready))
    if missing:
        app.logger.warning(
            "  ✗ Degraded (no API key): %s", ", ".join(missing)
        )
        app.logger.warning(
            "  Set missing keys in .env — see .env.example for details"
        )
    if not missing:
        app.logger.info("  All API services configured!")
    app.logger.info("──────────────────────────────────────────────────")


def _register_error_handlers(app: Flask):
    """Attach JSON error handlers so API always returns structured responses."""

    from flask import jsonify

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": "Bad request"}), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        retry_after = getattr(error, "retry_after", None)
        if isinstance(retry_after, (int, float)):
            retry_after = int(retry_after)
        return jsonify({
            "error": "Rate limit exceeded",
            "message": "Too many requests – please try again later.",
            "retry_after": retry_after,
        }), 429

    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error("Internal server error: %s", error)
        return jsonify({"error": "Internal server error"}), 500
