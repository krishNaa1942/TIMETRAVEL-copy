"""
Health Check Endpoint
======================
Liveness / readiness probe exposing service, database, and storage status.
"""

from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__)


@health_bp.route("/api/health", methods=["GET"])
def health_check():
    """Return service health status including database information."""
    from app.services.supabase_db import check_connection

    db_check = check_connection()

    payload = {
        "status": "healthy" if db_check["ok"] else "degraded",
        "service": "Time Travel – AI Smart Tourism Assistant",
        "version": "0.1.0",
        "database": {
            "backend": db_check["backend"],
            "connected": db_check["ok"],
        },
    }

    if "latency_ms" in db_check:
        payload["database"]["latency_ms"] = db_check["latency_ms"]
    if "error" in db_check:
        payload["database"]["error"] = db_check["error"]

    return jsonify(payload)
