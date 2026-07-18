"""
Tests for the Places API (Foursquare integration).
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


MOCK_FSQ_SEARCH_RESPONSE = {
    "results": [
        {
            "fsq_id": "abc123",
            "name": "Taj Palace Restaurant",
            "categories": [{"name": "Indian Restaurant", "id": 13199}],
            "location": {
                "formatted_address": "123 Beach Road, Panaji, Goa",
                "locality": "Panaji",
                "region": "Goa",
            },
            "geocodes": {"main": {"latitude": 15.4989, "longitude": 73.8278}},
            "distance": 450,
            "price": 2,
            "rating": 8.3,
            "popularity": 0.92,
            "verified": True,
            "website": "https://tajpalace.example.com",
            "tel": "+91-832-1234567",
            "hours": {"display": "Mon-Sun 11:00-23:00"},
            "closed_bucket": "VeryLikelyOpen",
        }
    ]
}

MOCK_FSQ_DETAIL_RESPONSE = {
    "fsq_id": "abc123",
    "name": "Taj Palace Restaurant",
    "description": "Authentic Goan cuisine with a sea view.",
    "categories": [{"name": "Indian Restaurant", "id": 13199}],
    "location": {
        "formatted_address": "123 Beach Road, Panaji, Goa",
        "locality": "Panaji",
        "region": "Goa",
    },
    "geocodes": {"main": {"latitude": 15.4989, "longitude": 73.8278}},
    "price": 2,
    "rating": 8.3,
    "popularity": 0.92,
    "verified": True,
    "website": "https://tajpalace.example.com",
    "tel": "+91-832-1234567",
    "hours": {"display": "Mon-Sun 11:00-23:00"},
    "closed_bucket": "VeryLikelyOpen",
    "social_media": {"twitter": "tajpalace"},
    "menu": {"url": "https://tajpalace.example.com/menu"},
    "stats": {"total_photos": 42, "total_ratings": 125, "total_tips": 18},
    "tastes": ["biryani", "seafood", "curry"],
    "features": {
        "payment": {"credit_cards": {"accepts_credit_cards": True}},
        "services": {"delivery": True},
    },
}

MOCK_FSQ_TIPS_RESPONSE = [
    {
        "text": "Amazing fish curry, must try!",
        "created_at": "2024-01-15T12:00:00.000Z",
        "agree_count": 7,
    },
    {
        "text": "Great ambience, book a sea-facing table.",
        "created_at": "2024-02-20T18:30:00.000Z",
        "agree_count": 3,
    },
]

MOCK_FSQ_PHOTOS_RESPONSE = [
    {
        "id": "photo1",
        "prefix": "https://fastly.4sqi.net/img/general/",
        "suffix": "/12345_abc.jpg",
        "width": 1920,
        "height": 1080,
    },
    {
        "id": "photo2",
        "prefix": "https://fastly.4sqi.net/img/general/",
        "suffix": "/67890_xyz.jpg",
        "width": 800,
        "height": 600,
    },
]


class TestPlacesStatus:
    def test_status_no_key(self, client, app):
        """Without any Foursquare credentials, status should show unavailable."""
        app.config["FOURSQUARE_API_KEY"] = ""
        app.config["FOURSQUARE_CLIENT_ID"] = ""
        app.config["FOURSQUARE_CLIENT_SECRET"] = ""
        resp = client.get("/api/places/status")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["available"] is False
        assert data["provider"] == "Foursquare"

    def test_status_with_key(self, client, app):
        """With a key, status should show available."""
        app.config["FOURSQUARE_API_KEY"] = "test_key_123"
        resp = client.get("/api/places/status")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["available"] is True


class TestPlacesCategories:
    def test_categories_returns_list(self, client):
        """Categories endpoint returns the preset category list."""
        resp = client.get("/api/places/categories")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "categories" in data
        assert len(data["categories"]) > 0
        cat = data["categories"][0]
        assert "id" in cat
        assert "label" in cat


class TestPlacesSearch:
    def test_search_requires_lat_lon(self, client, app):
        """Search without lat/lon returns 400."""
        app.config["FOURSQUARE_API_KEY"] = "test_key_123"
        resp = client.get("/api/places/search")
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_search_no_api_key(self, client, app):
        """Search without any credentials returns 503."""
        app.config["FOURSQUARE_API_KEY"] = ""
        app.config["FOURSQUARE_CLIENT_ID"] = ""
        app.config["FOURSQUARE_CLIENT_SECRET"] = ""
        resp = client.get("/api/places/search?lat=15.29&lon=74.12")
        assert resp.status_code == 503
        data = resp.get_json()
        assert "error" in data

    @patch("app.services.foursquare_service.requests.get")
    def test_search_success(self, mock_get, client, app):
        """Search with valid params returns parsed places."""
        app.config["FOURSQUARE_API_KEY"] = "test_key_123"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = MOCK_FSQ_SEARCH_RESPONSE
        mock_get.return_value = mock_resp

        resp = client.get("/api/places/search?lat=15.29&lon=74.12&category=restaurant")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "places" in data
        assert data["count"] >= 1
        place = data["places"][0]
        assert place["fsq_id"] == "abc123"
        assert place["name"] == "Taj Palace Restaurant"
        assert place["rating"] == 8.3
        assert place["price_tier"] == 2
        assert place["is_open"] is True

    @patch("app.services.foursquare_service.requests.get")
    def test_search_with_query(self, mock_get, client, app):
        """Search with free text query passes it through."""
        app.config["FOURSQUARE_API_KEY"] = "test_key_123"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"results": []}
        mock_get.return_value = mock_resp

        resp = client.get("/api/places/search?lat=15.29&lon=74.12&query=biryani")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["count"] == 0
        assert data["places"] == []


class TestPlacesDetail:
    def test_detail_invalid_id(self, client, app):
        """Detail with very short ID returns 400."""
        app.config["FOURSQUARE_API_KEY"] = "test_key_123"
        resp = client.get("/api/places/detail/ab")
        assert resp.status_code == 400
        # Also test with a slightly longer but still too short ID
        resp2 = client.get("/api/places/detail/abc123")
        assert resp2.status_code == 400

    @patch("app.services.foursquare_service.requests.get")
    def test_detail_success(self, mock_get, client, app):
        """Detail returns full place info with tips and photos."""
        app.config["FOURSQUARE_API_KEY"] = "test_key_123"

        # First call = details, second = tips, third = photos
        detail_resp = MagicMock()
        detail_resp.status_code = 200
        detail_resp.json.return_value = MOCK_FSQ_DETAIL_RESPONSE

        tips_resp = MagicMock()
        tips_resp.status_code = 200
        tips_resp.json.return_value = MOCK_FSQ_TIPS_RESPONSE

        photos_resp = MagicMock()
        photos_resp.status_code = 200
        photos_resp.json.return_value = MOCK_FSQ_PHOTOS_RESPONSE

        mock_get.side_effect = [detail_resp, tips_resp, photos_resp]

        resp = client.get("/api/places/detail/abc123def456")
        assert resp.status_code == 200
        data = resp.get_json()
        p = data["place"]
        assert p["name"] == "Taj Palace Restaurant"
        assert p["description"] == "Authentic Goan cuisine with a sea view."
        assert len(p["tips"]) == 2
        assert len(p["photos"]) == 2
        assert p["photos"][0]["url"].endswith(".jpg")


class TestPlacesTips:
    @patch("app.services.foursquare_service.requests.get")
    def test_tips_success(self, mock_get, client, app):
        """Tips endpoint returns parsed tips list."""
        app.config["FOURSQUARE_API_KEY"] = "test_key_123"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = MOCK_FSQ_TIPS_RESPONSE
        mock_get.return_value = mock_resp

        resp = client.get("/api/places/tips/abc123def456")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["count"] == 2
        assert data["tips"][0]["text"] == "Amazing fish curry, must try!"


class TestPlacesPhotos:
    @patch("app.services.foursquare_service.requests.get")
    def test_photos_success(self, mock_get, client, app):
        """Photos endpoint returns constructed URLs."""
        app.config["FOURSQUARE_API_KEY"] = "test_key_123"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = MOCK_FSQ_PHOTOS_RESPONSE
        mock_get.return_value = mock_resp

        resp = client.get("/api/places/photos/abc123def456")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["count"] == 2
        photo = data["photos"][0]
        assert "url" in photo
        assert "url_medium" in photo
        assert "url_thumb" in photo
        assert "4sqi.net" in photo["url"]
