"""
Application Configuration
=========================
Centralised config loaded from environment variables with sensible defaults.
Supports development, testing, and production profiles.
"""

import os
import secrets
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_DIR = BASE_DIR / "instance"

# ---------------------------------------------------------------------------
# Base Configuration
# ---------------------------------------------------------------------------
class Config:
    """Base configuration shared across all environments."""

    # A random key is generated each startup when no env var is set.
    # This is fine for dev (sessions reset on restart) but NOT for production.
    SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_hex(32)
    DEBUG = False
    TESTING = False

    # Database – Supabase PostgreSQL when DATABASE_URL is set, else SQLite
    _raw_db_url = os.getenv("DATABASE_URL", f"sqlite:///{DB_DIR / 'timetravel.db'}")
    # Supabase provides postgres:// but SQLAlchemy 2.x requires postgresql://
    if _raw_db_url.startswith("postgres://"):
        _raw_db_url = _raw_db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _raw_db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Supabase
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")               # anon / public key
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")  # service_role key
    SUPABASE_STORAGE_BUCKET_PHOTOS = os.getenv("SUPABASE_STORAGE_BUCKET_PHOTOS", "photos")
    SUPABASE_STORAGE_BUCKET_DOCS = os.getenv("SUPABASE_STORAGE_BUCKET_DOCS", "documents")

    # OpenWeather API
    OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
    OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"

    # TomTom Maps API
    TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY", "")

    # Google Gemini AI
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

    # Unsplash Images
    UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "")
    UNSPLASH_SECRET_KEY = os.getenv("UNSPLASH_SECRET_KEY", "")

    # Foursquare Places
    FOURSQUARE_API_KEY = os.getenv("FOURSQUARE_API_KEY", "")
    FOURSQUARE_CLIENT_ID = os.getenv("FOURSQUARE_CLIENT_ID", "")
    FOURSQUARE_CLIENT_SECRET = os.getenv("FOURSQUARE_CLIENT_SECRET", "")

    # NewsAPI
    NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")

    # Budget defaults
    DEFAULT_CURRENCY = "INR"

    # Safety data file
    SAFETY_DATA_PATH = str(DATA_DIR / "safety_scores.json")
    BUDGET_DATA_PATH = str(DATA_DIR / "budget_baselines.json")

    # Session cookie security
    SESSION_COOKIE_HTTPONLY = True   # Prevent JS access to session cookie
    SESSION_COOKIE_SAMESITE = "Lax"  # CSRF mitigation for cross-site requests
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = "Lax"

    # Rate limits (override via environment in production)
    GLOBAL_RATE_LIMIT_PER_DAY = os.getenv("GLOBAL_RATE_LIMIT_PER_DAY", "2000 per day")
    GLOBAL_RATE_LIMIT_PER_HOUR = os.getenv("GLOBAL_RATE_LIMIT_PER_HOUR", "500 per hour")
    AUTH_REGISTER_RATE_LIMIT = os.getenv("AUTH_REGISTER_RATE_LIMIT", "20 per hour")
    AUTH_LOGIN_RATE_LIMIT = os.getenv("AUTH_LOGIN_RATE_LIMIT", "30 per minute")


class DevelopmentConfig(Config):
    """Development-specific overrides."""
    DEBUG = True


class TestingConfig(Config):
    """Testing-specific overrides."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    WTF_CSRF_ENABLED = False  # Disable CSRF in tests
    RATELIMIT_ENABLED = False  # Disable rate limiting in tests


class ProductionConfig(Config):
    """Production-specific overrides."""
    DEBUG = False
    SESSION_COOKIE_SECURE = True     # Cookies only over HTTPS
    REMEMBER_COOKIE_SECURE = True

    def __init__(self):
        if not os.getenv("SECRET_KEY"):
            raise RuntimeError(
                "SECRET_KEY environment variable is required in production. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )


# ---------------------------------------------------------------------------
# Config selector
# ---------------------------------------------------------------------------
_config_map = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config():
    """Return the config class for the current FLASK_ENV."""
    env = os.getenv("FLASK_ENV", "development").lower()
    return _config_map.get(env, DevelopmentConfig)
