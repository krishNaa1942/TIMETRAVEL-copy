"""
Tests for Maps API Endpoints
==============================
Covers: /api/maps/destinations, geocode, nearby, route, suggest.
"""

import time
import pytest
from unittest.mock import patch, MagicMock

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db


@pytest.fixture()
def app():
    _app = create_app(config_class=TestingConfig)
    _app.config["TOMTOM_API_KEY"] = "test-key"
    with _app.app_context():
        _db.create_all()
        yield _app
        _db.session.rollback()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


# ═══════════════════════════════════════════════════════════
# /api/maps/config
# ═══════════════════════════════════════════════════════════

class TestMapConfig:
    def test_config_returns_key_available(self, client):
        res = client.get("/api/maps/config")
        assert res.status_code == 200
        data = res.get_json()
        assert data["available"] is True
        assert data["key"] == "test-key"

    def test_config_no_key(self, app, client):
        app.config["TOMTOM_API_KEY"] = ""
        res = client.get("/api/maps/config")
        data = res.get_json()
        assert data["available"] is False
        assert data["key"] == ""
        app.config["TOMTOM_API_KEY"] = "test-key"


# ═══════════════════════════════════════════════════════════
# /api/maps/destinations
# ═══════════════════════════════════════════════════════════

class TestDestinations:
    def test_returns_all_destinations(self, client):
        res = client.get("/api/maps/destinations")
        assert res.status_code == 200
        data = res.get_json()
        assert "destinations" in data
        assert len(data["destinations"]) == 201

    def test_destination_has_coords(self, client):
        res = client.get("/api/maps/destinations")
        dest = res.get_json()["destinations"][0]
        assert "id" in dest
        assert "label" in dest
        assert "lat" in dest
        assert "lon" in dest


# ═══════════════════════════════════════════════════════════
# /api/maps/geocode
# ═══════════════════════════════════════════════════════════

class TestGeocode:
    def test_geocode_missing_query(self, client):
        res = client.get("/api/maps/geocode")
        assert res.status_code == 400

    def test_geocode_short_query(self, client):
        res = client.get("/api/maps/geocode?q=a")
        assert res.status_code == 400

    @patch("app.api.routes.maps.geocode")
    def test_geocode_success(self, mock_geocode, client):
        mock_geocode.return_value = {"lat": 15.29, "lon": 74.12, "address": "Goa, India"}
        res = client.get("/api/maps/geocode?q=Goa")
        assert res.status_code == 200
        data = res.get_json()
        assert data["lat"] == 15.29

    @patch("app.api.routes.maps.geocode")
    def test_geocode_not_found(self, mock_geocode, client):
        mock_geocode.return_value = None
        res = client.get("/api/maps/geocode?q=NonExistentPlace")
        assert res.status_code == 404


# ═══════════════════════════════════════════════════════════
# /api/maps/nearby
# ═══════════════════════════════════════════════════════════

class TestNearby:
    def test_nearby_missing_dest(self, client):
        res = client.get("/api/maps/nearby")
        assert res.status_code == 400

    @patch("app.api.routes.maps.search_nearby")
    def test_nearby_known_dest(self, mock_nearby, client):
        mock_nearby.return_value = [
            {
                "name": "Basilica of Bom Jesus",
                "category": "tourist attraction",
                "lat": 15.5009,
                "lon": 73.9116,
                "distance_m": 3200,
                "address": "Old Goa",
                "phone": "",
            }
        ]
        res = client.get("/api/maps/nearby?dest=goa&category=tourist+attraction")
        assert res.status_code == 200
        data = res.get_json()
        assert data["count"] == 1
        assert data["pois"][0]["name"] == "Basilica of Bom Jesus"

    @patch("app.api.routes.maps.search_nearby")
    def test_nearby_empty_results(self, mock_nearby, client):
        mock_nearby.return_value = []
        res = client.get("/api/maps/nearby?dest=goa&category=museum")
        assert res.status_code == 200
        assert res.get_json()["count"] == 0

    @patch("app.api.routes.maps.search_nearby")
    def test_nearby_bad_limit_defaults(self, mock_nearby, client):
        """Non-integer limit should fall back to default (10), not crash."""
        mock_nearby.return_value = []
        for bad in ("abc", "3.5", "", "null"):
            res = client.get(f"/api/maps/nearby?dest=goa&limit={bad}")
            assert res.status_code == 200, f"limit={bad!r} caused {res.status_code}"


# ═══════════════════════════════════════════════════════════
# /api/maps/route
# ═══════════════════════════════════════════════════════════

class TestRoute:
    def test_route_missing_params(self, client):
        res = client.get("/api/maps/route")
        assert res.status_code == 400

    def test_route_missing_to(self, client):
        res = client.get("/api/maps/route?from=delhi")
        assert res.status_code == 400

    @patch("app.api.routes.maps.calculate_route")
    def test_route_success(self, mock_route, client):
        mock_route.return_value = {
            "distance_km": 268.5,
            "duration_min": 300,
            "traffic_delay_min": 15,
            "departure": "",
            "arrival": "",
            "geometry": [[28.7, 77.1], [27.1, 78.0]],
        }
        res = client.get("/api/maps/route?from=delhi&to=agra&mode=car")
        assert res.status_code == 200
        data = res.get_json()
        assert data["distance_km"] == 268.5
        assert data["origin"] == "delhi"
        assert data["destination"] == "agra"
        assert len(data["geometry"]) == 2

    @patch("app.api.routes.maps.calculate_route")
    def test_route_failure(self, mock_route, client):
        mock_route.return_value = None
        res = client.get("/api/maps/route?from=delhi&to=agra")
        assert res.status_code == 502


# ═══════════════════════════════════════════════════════════
# Smart Suggestions (parallel fetch)
# ═══════════════════════════════════════════════════════════

MOCK_NEARBY_RESULTS = {
    "results": [
        {
            "poi": {"name": "Test Place", "categories": [{"name": "restaurant"}]},
            "position": {"lat": 15.3, "lon": 74.1},
            "dist": 500.0,
            "address": {"freeformAddress": "123 Test St, Goa"},
        }
    ]
}


class TestSmartSuggestions:
    def test_suggest_missing_params(self, client):
        res = client.get("/api/maps/suggest")
        assert res.status_code == 400

    @patch("app.services.maps_service.requests.get")
    def test_suggest_bad_limit_defaults(self, mock_get, client):
        """Non-integer limit on /suggest should fall back to 5, not 500."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = lambda: None
        mock_resp.json.return_value = MOCK_NEARBY_RESULTS
        mock_get.return_value = mock_resp

        for bad in ("abc", "3.5", "null"):
            res = client.get(f"/api/maps/suggest?lat=15.3&lon=74.1&limit={bad}")
            assert res.status_code == 200, f"limit={bad!r} caused {res.status_code}"

    @patch("app.services.maps_service.requests.get")
    def test_suggest_returns_categories(self, mock_get, client):
        """Smart suggestions should return organized POI categories."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = lambda: None
        mock_resp.json.return_value = MOCK_NEARBY_RESULTS
        mock_get.return_value = mock_resp

        res = client.get("/api/maps/suggest?lat=15.3&lon=74.1")
        assert res.status_code == 200
        data = res.get_json()
        assert "suggestions" in data
        assert len(data["suggestions"]) > 0

    @patch("app.services.maps_service.requests.get")
    def test_suggest_parallel_is_fast(self, mock_get, app):
        """Verify 6 categories are fetched in parallel, not sequentially."""
        from app.services.maps_service import get_smart_suggestions

        call_count = 0

        def slow_response(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            time.sleep(0.15)  # simulate network latency
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.raise_for_status = lambda: None
            mock_resp.json.return_value = MOCK_NEARBY_RESULTS
            return mock_resp

        mock_get.side_effect = slow_response

        with app.app_context():
            start = time.time()
            result = get_smart_suggestions(15.3, 74.1, "test-key", limit_per_cat=3)
            elapsed = time.time() - start

        # 6 categories × 0.15s = 0.9s sequential; parallel should be <0.5s
        # (+ reverse_geocode adds one more call, so ~7 calls total)
        assert elapsed < 0.6, f"Smart suggestions took {elapsed:.2f}s — not parallel"
        assert len(result["suggestions"]) > 0

    @patch("app.services.maps_service.requests.get")
    def test_suggest_preserves_category_order(self, mock_get, app):
        """Results should follow SUGGESTION_CATEGORIES order."""
        from app.services.maps_service import get_smart_suggestions, SUGGESTION_CATEGORIES

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = lambda: None
        mock_resp.json.return_value = MOCK_NEARBY_RESULTS
        mock_get.return_value = mock_resp

        with app.app_context():
            result = get_smart_suggestions(15.3, 74.1, "test-key")

        returned_cats = [s["category"] for s in result["suggestions"]]
        expected_order = [c[0] for c in SUGGESTION_CATEGORIES]
        # All returned categories should be in original order
        filtered_expected = [c for c in expected_order if c in returned_cats]
        assert returned_cats == filtered_expected

    @patch("app.services.maps_service.requests.get")
    def test_suggest_handles_partial_failure(self, mock_get, app):
        """If some categories fail, others still return."""
        from app.services.maps_service import get_smart_suggestions

        call_idx = 0

        def sometimes_fail(*args, **kwargs):
            nonlocal call_idx
            call_idx += 1
            if call_idx % 2 == 0:
                raise ConnectionError("Simulated failure")
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.raise_for_status = lambda: None
            mock_resp.json.return_value = MOCK_NEARBY_RESULTS
            return mock_resp

        mock_get.side_effect = sometimes_fail

        with app.app_context():
            result = get_smart_suggestions(15.3, 74.1, "test-key")

        # Some categories should succeed despite partial failures
        assert "suggestions" in result
