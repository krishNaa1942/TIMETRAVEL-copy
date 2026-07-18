"""
Tests for Safety Score API
============================
"""

import pytest


class TestSafetyEndpoint:
    """Tests for GET /api/safety/<destination>."""

    def test_safety_returns_200_for_known_destination(self, client):
        resp = client.get("/api/safety/Goa")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["destination"] == "Goa"
        assert 0 <= data["overall_score"] <= 10
        assert "advisory" in data

    def test_safety_returns_200_for_unknown_destination(self, client):
        resp = client.get("/api/safety/Atlantis")
        assert resp.status_code == 200
        # Should use default scores
        data = resp.get_json()
        assert data["overall_score"] == 5.0

    def test_safety_returns_400_for_short_name(self, client):
        resp = client.get("/api/safety/X")
        assert resp.status_code == 400

    def test_safety_has_all_subscores(self, client):
        resp = client.get("/api/safety/Kerala")
        data = resp.get_json()
        for key in ("crime_score", "health_score", "infrastructure_score", "tourist_friendliness"):
            assert key in data
            assert isinstance(data[key], (int, float))
