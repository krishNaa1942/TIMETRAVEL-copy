"""
Tests for PDF Export API
=========================
POST /api/export/itinerary
POST /api/export/budget
POST /api/export/comparison
"""

import json
import pytest

# Uses app & client fixtures from conftest.py


# ── Sample payloads ─────────────────────────────────────────

ITINERARY_PAYLOAD = {
    "destination": "Goa",
    "num_days": 3,
    "family_size": 4,
    "travel_class": "economy",
    "interests": "beaches, food",
    "itinerary": [
        {
            "day": 1,
            "title": "Arrival & Beach Vibes",
            "morning": {
                "activity": "Check-in at hotel",
                "description": "Settle in and freshen up.",
                "duration": "2 hours",
                "cost": "₹0",
            },
            "afternoon": {
                "activity": "Baga Beach",
                "description": "Relax on the famous sandy shores.",
                "duration": "3 hours",
                "cost": "₹200",
            },
            "evening": {
                "activity": "Tito's Lane",
                "description": "Explore nightlife and street food.",
                "duration": "2 hours",
                "cost": "₹800",
            },
            "tip": "Apply sunscreen generously.",
        },
        {
            "day": 2,
            "title": "Culture & Cuisine",
            "morning": {
                "activity": "Old Goa Churches",
                "description": "Visit Basilica of Bom Jesus.",
                "duration": "3 hours",
                "cost": "₹0",
            },
            "afternoon": {
                "activity": "Spice Plantation",
                "description": "Guided tour with lunch.",
                "duration": "3 hours",
                "cost": "₹500",
            },
            "evening": {
                "activity": "Fontainhas Walk",
                "description": "Stroll through Latin Quarter.",
                "duration": "2 hours",
                "cost": "₹100",
            },
            "tip": "Carry a water bottle.",
        },
    ],
}

BUDGET_PAYLOAD = {
    "destination": "Jaipur",
    "num_days": 5,
    "family_size": 4,
    "travel_class": "economy",
    "accommodation": 7500.0,
    "food": 16000.0,
    "transport": 2500.0,
    "activities": 8000.0,
    "miscellaneous": 1500.0,
    "total": 35500.0,
    "currency": "INR",
}

COMPARISON_PAYLOAD = {
    "dest1": {
        "destination": "Goa",
        "budget": {
            "destination": "Goa",
            "num_days": 5,
            "family_size": 4,
            "travel_class": "economy",
            "accommodation": 8000,
            "food": 15000,
            "transport": 3000,
            "activities": 6000,
            "miscellaneous": 2000,
            "total": 34000,
            "currency": "INR",
        },
        "safety": {
            "destination": "Goa",
            "overall_score": 7.5,
            "crime_score": 7.0,
            "health_score": 7.0,
            "infrastructure_score": 6.5,
            "tourist_friendliness": 9.0,
            "advisory": "Generally safe for tourists.",
        },
        "weather": {
            "destination": "Goa",
            "temperature_c": 32.5,
            "feels_like_c": 35.0,
            "humidity": 75,
            "description": "Clear sky",
            "wind_speed_kmh": 12.0,
            "packing_suggestions": ["Sunscreen"],
        },
    },
    "dest2": {
        "destination": "Jaipur",
        "budget": {
            "destination": "Jaipur",
            "num_days": 5,
            "family_size": 4,
            "travel_class": "economy",
            "accommodation": 6000,
            "food": 12000,
            "transport": 2000,
            "activities": 5000,
            "miscellaneous": 1500,
            "total": 26500,
            "currency": "INR",
        },
        "safety": {
            "destination": "Jaipur",
            "overall_score": 7.0,
            "crime_score": 6.5,
            "health_score": 7.5,
            "infrastructure_score": 7.0,
            "tourist_friendliness": 8.5,
            "advisory": "Safe with normal precautions.",
        },
        "weather": None,
    },
    "params": {
        "num_days": 5,
        "family_size": 4,
        "travel_class": "economy",
    },
}


# ═══════════════════════════════════════════════════════════
# Itinerary Export Tests
# ═══════════════════════════════════════════════════════════


class TestExportItinerary:
    """Tests for POST /api/export/itinerary"""

    def test_export_itinerary_returns_pdf(self, client):
        res = client.post(
            "/api/export/itinerary",
            data=json.dumps(ITINERARY_PAYLOAD),
            content_type="application/json",
        )
        assert res.status_code == 200
        assert res.content_type == "application/pdf"
        # PDF magic bytes + reasonable size
        assert res.data[:5] == b"%PDF-"
        assert len(res.data) > 500

    def test_export_itinerary_content_disposition(self, client):
        res = client.post(
            "/api/export/itinerary",
            data=json.dumps(ITINERARY_PAYLOAD),
            content_type="application/json",
        )
        assert "Goa_Itinerary.pdf" in res.headers.get("Content-Disposition", "")

    def test_export_itinerary_missing_data(self, client):
        res = client.post(
            "/api/export/itinerary",
            data=json.dumps({"destination": "Goa"}),
            content_type="application/json",
        )
        assert res.status_code == 400

    def test_export_itinerary_no_json(self, client):
        res = client.post("/api/export/itinerary")
        assert res.status_code == 400

    def test_export_itinerary_empty_itinerary(self, client):
        res = client.post(
            "/api/export/itinerary",
            data=json.dumps({"destination": "Goa", "itinerary": []}),
            content_type="application/json",
        )
        assert res.status_code == 400


# ═══════════════════════════════════════════════════════════
# Budget Export Tests
# ═══════════════════════════════════════════════════════════


class TestExportBudget:
    """Tests for POST /api/export/budget"""

    def test_export_budget_returns_pdf(self, client):
        res = client.post(
            "/api/export/budget",
            data=json.dumps(BUDGET_PAYLOAD),
            content_type="application/json",
        )
        assert res.status_code == 200
        assert res.content_type == "application/pdf"
        assert res.data[:5] == b"%PDF-"

    def test_export_budget_content_disposition(self, client):
        res = client.post(
            "/api/export/budget",
            data=json.dumps(BUDGET_PAYLOAD),
            content_type="application/json",
        )
        assert "Jaipur_Budget.pdf" in res.headers.get("Content-Disposition", "")

    def test_export_budget_missing_total(self, client):
        payload = {"destination": "Jaipur", "num_days": 5}
        res = client.post(
            "/api/export/budget",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert res.status_code == 400

    def test_export_budget_no_json(self, client):
        res = client.post("/api/export/budget")
        assert res.status_code == 400


# ═══════════════════════════════════════════════════════════
# Comparison Export Tests
# ═══════════════════════════════════════════════════════════


class TestExportComparison:
    """Tests for POST /api/export/comparison"""

    def test_export_comparison_returns_pdf(self, client):
        res = client.post(
            "/api/export/comparison",
            data=json.dumps(COMPARISON_PAYLOAD),
            content_type="application/json",
        )
        assert res.status_code == 200
        assert res.content_type == "application/pdf"
        assert res.data[:5] == b"%PDF-"

    def test_export_comparison_content_disposition(self, client):
        res = client.post(
            "/api/export/comparison",
            data=json.dumps(COMPARISON_PAYLOAD),
            content_type="application/json",
        )
        cd = res.headers.get("Content-Disposition", "")
        assert "Goa_vs_Jaipur" in cd

    def test_export_comparison_missing_dest(self, client):
        res = client.post(
            "/api/export/comparison",
            data=json.dumps({"dest1": {}}),
            content_type="application/json",
        )
        assert res.status_code == 400

    def test_export_comparison_no_json(self, client):
        res = client.post("/api/export/comparison")
        assert res.status_code == 400

    def test_export_comparison_weather_none(self, client):
        """Comparison where one destination has no weather."""
        res = client.post(
            "/api/export/comparison",
            data=json.dumps(COMPARISON_PAYLOAD),
            content_type="application/json",
        )
        assert res.status_code == 200
        assert res.content_type == "application/pdf"


# ═══════════════════════════════════════════════════════════
# PDF Service Unit Tests
# ═══════════════════════════════════════════════════════════


class TestPDFService:
    """Direct tests on the PDF-generation functions."""

    def test_itinerary_pdf_bytes(self):
        from app.services.pdf_service import generate_itinerary_pdf

        result = generate_itinerary_pdf(ITINERARY_PAYLOAD)
        assert isinstance(result, bytes)
        assert len(result) > 100
        assert result[:5] == b"%PDF-"

    def test_budget_pdf_bytes(self):
        from app.services.pdf_service import generate_budget_pdf

        result = generate_budget_pdf(BUDGET_PAYLOAD)
        assert isinstance(result, bytes)
        assert len(result) > 100
        assert result[:5] == b"%PDF-"

    def test_comparison_pdf_bytes(self):
        from app.services.pdf_service import generate_comparison_pdf

        result = generate_comparison_pdf(COMPARISON_PAYLOAD)
        assert isinstance(result, bytes)
        assert len(result) > 100
        assert result[:5] == b"%PDF-"

    def test_itinerary_pdf_multipage(self):
        """Itinerary with 2 days should produce a valid multi-content PDF."""
        from app.services.pdf_service import generate_itinerary_pdf

        result = generate_itinerary_pdf(ITINERARY_PAYLOAD)
        # PDF must contain pages and end marker
        assert b"%%EOF" in result
        assert len(result) > 1000

    def test_budget_pdf_has_pages(self):
        from app.services.pdf_service import generate_budget_pdf

        result = generate_budget_pdf(BUDGET_PAYLOAD)
        assert b"%%EOF" in result
        assert len(result) > 500

    def test_comparison_pdf_has_pages(self):
        from app.services.pdf_service import generate_comparison_pdf

        result = generate_comparison_pdf(COMPARISON_PAYLOAD)
        assert b"%%EOF" in result
        assert len(result) > 500
