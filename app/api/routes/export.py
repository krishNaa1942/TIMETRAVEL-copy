"""
PDF Export API Routes
========================
POST /api/export/itinerary  – Itinerary PDF
POST /api/export/budget     – Budget PDF
POST /api/export/comparison – Comparison PDF

All endpoints accept JSON and return application/pdf.
"""

import logging

from flask import Blueprint, request, jsonify, Response
from werkzeug.utils import secure_filename

from app.main import limiter
from app.services.pdf_service import (
    generate_itinerary_pdf,
    generate_budget_pdf,
    generate_comparison_pdf,
)

logger = logging.getLogger(__name__)

export_bp = Blueprint("export", __name__)


@export_bp.route("/api/export/itinerary", methods=["POST"])
@limiter.limit("10 per hour")
def export_itinerary():
    """Export an itinerary as PDF."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    destination = data.get("destination", "Trip")
    itinerary = data.get("itinerary")
    if not itinerary or not isinstance(itinerary, list):
        return jsonify({"error": "Missing or invalid itinerary data"}), 400

    try:
        pdf_bytes = generate_itinerary_pdf(data)
    except Exception as exc:
        logger.error("Itinerary PDF generation failed: %s", exc)
        return jsonify({"error": "Failed to generate PDF"}), 500

    filename = secure_filename(f"{destination}_Itinerary.pdf") or "Itinerary.pdf"
    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by no UI (exportBudgetPdf client exists but is never called). See FRONTEND_AUDIT.md Phase D.
@export_bp.route("/api/export/budget", methods=["POST"])
@limiter.limit("10 per hour")
def export_budget():
    """Export budget breakdown as PDF."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    if "total" not in data:
        return jsonify({"error": "Missing budget data"}), 400

    try:
        pdf_bytes = generate_budget_pdf(data)
    except Exception as exc:
        logger.error("Budget PDF generation failed: %s", exc)
        return jsonify({"error": "Failed to generate PDF"}), 500

    destination = data.get("destination", "Trip")
    filename = secure_filename(f"{destination}_Budget.pdf") or "Budget.pdf"
    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by no UI. See FRONTEND_AUDIT.md Phase D.
@export_bp.route("/api/export/comparison", methods=["POST"])
@limiter.limit("10 per hour")
def export_comparison():
    """Export destination comparison as PDF."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    if "dest1" not in data or "dest2" not in data:
        return jsonify({"error": "Missing comparison data"}), 400

    try:
        pdf_bytes = generate_comparison_pdf(data)
    except Exception as exc:
        logger.error("Comparison PDF generation failed: %s", exc)
        return jsonify({"error": "Failed to generate PDF"}), 500

    d1 = data.get("dest1", {}).get("destination", "A")
    d2 = data.get("dest2", {}).get("destination", "B")
    filename = secure_filename(f"{d1}_vs_{d2}_Comparison.pdf") or "Comparison.pdf"
    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
