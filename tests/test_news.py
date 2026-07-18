"""
Tests for the Travel News API (NewsAPI integration).
"""

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


MOCK_NEWS_RESPONSE = {
    "status": "ok",
    "totalResults": 2,
    "articles": [
        {
            "source": {"id": None, "name": "Times of India"},
            "author": "Travel Desk",
            "title": "Top 10 Beaches in Goa for 2025",
            "description": "Discover the best beaches in Goa this season.",
            "url": "https://example.com/goa-beaches",
            "urlToImage": "https://example.com/img/goa.jpg",
            "publishedAt": "2025-06-01T10:30:00Z",
            "content": "Goa is known for its beautiful beaches...",
        },
        {
            "source": {"id": None, "name": "NDTV Travel"},
            "author": "Staff Reporter",
            "title": "Monsoon Travel Guide to Goa",
            "description": "Best monsoon travel tips for Goa.",
            "url": "https://example.com/monsoon-goa",
            "urlToImage": None,
            "publishedAt": "2025-05-28T08:00:00Z",
            "content": "Monsoon in Goa is magical...",
        },
    ],
}


# ── Status endpoint ───────────────────────────────────────
class TestNewsStatus:
    def test_status_no_key(self, client, app):
        """Returns unavailable when no API key is set."""
        with app.app_context():
            app.config["NEWSAPI_KEY"] = ""
            resp = client.get("/api/news/status")
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["available"] is False
            assert data["provider"] == "NewsAPI"

    def test_status_with_key(self, client, app):
        """Returns available when API key is set."""
        with app.app_context():
            app.config["NEWSAPI_KEY"] = "test_key_1234567890"
            resp = client.get("/api/news/status")
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["available"] is True


# ── Destinations endpoint ─────────────────────────────────
class TestNewsDestinations:
    def test_destinations_list(self, client):
        """Returns sorted list of supported destinations."""
        resp = client.get("/api/news/destinations")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "destinations" in data
        dests = data["destinations"]
        assert isinstance(dests, list)
        assert len(dests) > 0
        # Should be sorted alphabetically
        assert dests == sorted(dests)
        # Should contain known destinations
        assert "goa" in dests
        assert "jaipur" in dests


# ── Travel news endpoint ─────────────────────────────────
class TestTravelNews:
    def test_travel_news_no_key(self, client, app):
        """Returns 503 when no API key configured."""
        with app.app_context():
            app.config["NEWSAPI_KEY"] = ""
            resp = client.get("/api/news/travel?destination=goa")
            assert resp.status_code == 503

    @patch("app.services.news_service.requests.get")
    def test_travel_news_success(self, mock_get, client, app):
        """Returns articles for a destination."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = MOCK_NEWS_RESPONSE
        mock_get.return_value = mock_resp

        with app.app_context():
            app.config["NEWSAPI_KEY"] = "test_key_1234567890"
            resp = client.get("/api/news/travel?destination=goa&limit=5")
            assert resp.status_code == 200
            data = resp.get_json()
            assert "articles" in data
            assert "count" in data
            assert data["destination"] == "goa"
            assert isinstance(data["articles"], list)

    @patch("app.services.news_service.requests.get")
    def test_travel_news_with_category(self, mock_get, client, app):
        """Returns articles filtered by category."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = MOCK_NEWS_RESPONSE
        mock_get.return_value = mock_resp

        with app.app_context():
            app.config["NEWSAPI_KEY"] = "test_key_1234567890"
            resp = client.get("/api/news/travel?destination=goa&category=food")
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["category"] == "food"


# ── Trending endpoint ─────────────────────────────────────
class TestTrendingNews:
    @patch("app.services.news_service.requests.get")
    def test_trending_success(self, mock_get, client, app):
        """Returns trending travel articles."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = MOCK_NEWS_RESPONSE
        mock_get.return_value = mock_resp

        with app.app_context():
            app.config["NEWSAPI_KEY"] = "test_key_1234567890"
            resp = client.get("/api/news/trending?limit=5")
            assert resp.status_code == 200
            data = resp.get_json()
            assert "articles" in data
            assert "count" in data

    def test_trending_no_key(self, client, app):
        """Returns 503 when no API key."""
        with app.app_context():
            app.config["NEWSAPI_KEY"] = ""
            resp = client.get("/api/news/trending")
            assert resp.status_code == 503


# ── Safety news endpoint ──────────────────────────────────
class TestSafetyNews:
    @patch("app.services.news_service.requests.get")
    def test_safety_news_success(self, mock_get, client, app):
        """Returns safety-related news articles."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = MOCK_NEWS_RESPONSE
        mock_get.return_value = mock_resp

        with app.app_context():
            app.config["NEWSAPI_KEY"] = "test_key_1234567890"
            resp = client.get("/api/news/safety?destination=goa&limit=5")
            assert resp.status_code == 200
            data = resp.get_json()
            assert "articles" in data
            assert data["destination"] == "goa"

    def test_safety_no_key(self, client, app):
        """Returns 503 when no API key."""
        with app.app_context():
            app.config["NEWSAPI_KEY"] = ""
            resp = client.get("/api/news/safety")
            assert resp.status_code == 503
