"""
Tests for the Images API (Unsplash integration).
"""

import time
from unittest.mock import patch, MagicMock

import pytest


# ── Fixtures ──────────────────────────────────────────────
@pytest.fixture(scope="module")
def app():
    from app.main import create_app
    from app.config import TestingConfig

    return create_app(TestingConfig)


@pytest.fixture(scope="module")
def client(app):
    return app.test_client()


MOCK_UNSPLASH_RESPONSE = {
    "results": [
        {
            "id": "test123",
            "urls": {
                "thumb": "https://example.com/thumb.jpg",
                "small": "https://example.com/small.jpg",
                "regular": "https://example.com/regular.jpg",
                "full": "https://example.com/full.jpg",
            },
            "alt_description": "A beautiful beach in Goa",
            "description": None,
            "user": {
                "name": "Test Photographer",
                "links": {"html": "https://unsplash.com/@testuser"},
            },
            "links": {"html": "https://unsplash.com/photos/test123"},
            "color": "#C0D9D9",
            "width": 4032,
            "height": 3024,
        }
    ]
}


class TestImagesStatus:
    def test_status_no_key(self, client, app):
        """Without UNSPLASH_ACCESS_KEY, status should show unavailable."""
        app.config["UNSPLASH_ACCESS_KEY"] = ""
        resp = client.get("/api/images/status")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["available"] is False
        assert data["provider"] == "Unsplash"

    def test_status_with_key(self, client, app):
        """With a key, status should show available."""
        app.config["UNSPLASH_ACCESS_KEY"] = "test-key-12345678"
        resp = client.get("/api/images/status")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["available"] is True


class TestHeroImage:
    def test_hero_no_key(self, client, app):
        """Without key, hero endpoint returns 200 with a fallback image."""
        app.config["UNSPLASH_ACCESS_KEY"] = ""
        resp = client.get("/api/images/hero/goa")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["using_fallback"] is True

    @patch("app.services.unsplash_service.requests.get")
    def test_hero_success(self, mock_get, client, app):
        """With key and mock API, returns a single image."""
        app.config["UNSPLASH_ACCESS_KEY"] = "test-key-12345678"

        # Clear cache
        from app.services import unsplash_service

        unsplash_service._cache.clear()
        unsplash_service._configured = False

        mock_get.return_value.status_code = 200
        mock_get.return_value.raise_for_status = lambda: None
        mock_get.return_value.json.return_value = MOCK_UNSPLASH_RESPONSE

        resp = client.get("/api/images/hero/goa")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["destination"] == "goa"
        assert data["image"]["id"] == "test123"
        assert data["image"]["photographer"] == "Test Photographer"


class TestDestinationImages:
    def test_short_name(self, client, app):
        """Short destination name returns 400."""
        app.config["UNSPLASH_ACCESS_KEY"] = "test-key-12345678"
        resp = client.get("/api/images/destination/a")
        assert resp.status_code == 400

    @patch("app.services.unsplash_service.requests.get")
    def test_destination_images_success(self, mock_get, client, app):
        """Returns multiple images for a destination."""
        app.config["UNSPLASH_ACCESS_KEY"] = "test-key-12345678"

        from app.services import unsplash_service

        unsplash_service._cache.clear()

        mock_get.return_value.status_code = 200
        mock_get.return_value.raise_for_status = lambda: None
        mock_get.return_value.json.return_value = MOCK_UNSPLASH_RESPONSE

        resp = client.get("/api/images/destination/goa")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["destination"] == "goa"
        assert data["count"] >= 1
        assert data["images"][0]["url_small"] == "https://example.com/small.jpg"

    def test_destination_no_key(self, client, app):
        """Without key returns 200 with fallback images."""
        app.config["UNSPLASH_ACCESS_KEY"] = ""
        resp = client.get("/api/images/destination/goa")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["using_fallbacks"] is True


class TestAllDestinations:
    def test_no_key_returns_fallback(self, client, app):
        """Without key returns 200 with fallback images."""
        app.config["UNSPLASH_ACCESS_KEY"] = ""
        resp = client.get("/api/images/destinations")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get("using_fallbacks") is True or "images" in data

    @patch("app.services.unsplash_service.requests.get")
    def test_all_destinations_returns_images(self, mock_get, client, app):
        """With key and mock API, returns images for all destinations."""
        app.config["UNSPLASH_ACCESS_KEY"] = "test-key-12345678"

        from app.services import unsplash_service

        unsplash_service._cache.clear()

        mock_get.return_value.status_code = 200
        mock_get.return_value.raise_for_status = lambda: None
        mock_get.return_value.json.return_value = MOCK_UNSPLASH_RESPONSE

        resp = client.get("/api/images/destinations")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "images" in data
        # Should have images for multiple destinations
        assert len(data["images"]) > 0

    @pytest.mark.skipif(
        not __import__("os").environ.get("RUN_PERF_TESTS"),
        reason="Performance benchmark — set RUN_PERF_TESTS=1 to run",
    )
    @patch("app.services.unsplash_service.requests.get")
    def test_parallel_fetch_is_faster_than_sequential(self, mock_get, app):
        """Verify get_all_destination_images fetches in parallel (perf benchmark)."""
        from app.services import unsplash_service

        unsplash_service._cache.clear()

        call_count = 0

        def slow_response(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            time.sleep(0.1)  # simulate network latency
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.raise_for_status = lambda: None
            mock_resp.json.return_value = MOCK_UNSPLASH_RESPONSE
            return mock_resp

        mock_get.side_effect = slow_response

        with app.app_context():
            app.config["UNSPLASH_ACCESS_KEY"] = "test-key-12345678"
            start = time.time()
            result = unsplash_service.get_all_destination_images("test-key-12345678")
            elapsed = time.time() - start

        # 201 destinations × 0.1s each = 20.1s sequential; parallel should be <15.0s
        assert (
            elapsed < 15.0
        ), f"Parallel fetch took {elapsed:.2f}s — may not be parallel"
        assert call_count == 201
        assert len(result) == 201

    @patch("app.services.unsplash_service.requests.get")
    def test_parallel_fetch_handles_partial_failure(self, mock_get, app):
        """If some destinations fail, others still succeed."""
        from app.services import unsplash_service

        unsplash_service._cache.clear()

        call_idx = 0

        def sometimes_fail(*args, **kwargs):
            nonlocal call_idx
            call_idx += 1
            if call_idx % 3 == 0:
                raise ConnectionError("Simulated network error")
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.raise_for_status = lambda: None
            mock_resp.json.return_value = MOCK_UNSPLASH_RESPONSE
            return mock_resp

        mock_get.side_effect = sometimes_fail

        with app.app_context():
            result = unsplash_service.get_all_destination_images("test-key-12345678")

        # Some should succeed despite failures
        assert len(result) > 0
        assert len(result) < 201  # some failed
