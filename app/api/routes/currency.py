"""
Currency Conversion API Route
================================
GET  /api/currency/convert?amount=100&from=USD&to=INR
GET  /api/currency/supported
"""

from flask import Blueprint, request, jsonify

from app.services.currency_service import convert_currency, get_supported_currencies

currency_bp = Blueprint("currency", __name__)


@currency_bp.route("/api/currency/convert", methods=["GET"])
def currency_convert():
    """Convert amount between two currencies."""
    try:
        amount = float(request.args.get("amount", 1))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount"}), 400

    from_c = (request.args.get("from") or "INR").upper()
    to_c = (request.args.get("to") or "USD").upper()

    result = convert_currency(amount, from_c, to_c)
    return jsonify(result)


@currency_bp.route("/api/currency/supported", methods=["GET"])
def supported_currencies():
    """List all supported currencies."""
    return jsonify({"currencies": get_supported_currencies()})
