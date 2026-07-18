"""
Tests for Destinations Registry & API
=========================================
Verifies the central DESTINATIONS registry in constants.py and
the GET /api/destinations endpoint.
"""

import pytest
from app.utils.constants import (
    DESTINATIONS,
    VALID_DESTINATION_NAMES,
    DESTINATION_COORDS,
    DESTINATION_UNSPLASH_KW,
    DESTINATION_NEWS_KW,
    DESTINATION_LABELS,
)


# ═══════════════════════════════════════════════════════════
# Registry unit tests
# ═══════════════════════════════════════════════════════════

class TestDestinationsRegistry:
    """Verify the central DESTINATIONS dict and derived helpers."""

    def test_has_201_destinations(self):
        assert len(DESTINATIONS) == 201

    def test_all_keys_lowercase(self):
        for key in DESTINATIONS:
            assert key == key.lower(), f"Key '{key}' should be lowercase"

    def test_each_entry_has_required_fields(self):
        required = {"label", "lat", "lon", "unsplash_kw", "news_kw"}
        for key, d in DESTINATIONS.items():
            missing = required - d.keys()
            assert not missing, f"{key} missing fields: {missing}"

    def test_labels_are_title_case(self):
        for key, d in DESTINATIONS.items():
            assert d["label"][0].isupper(), f"{key} label should be title case"

    def test_coords_are_floats(self):
        for key, d in DESTINATIONS.items():
            assert isinstance(d["lat"], (int, float)), f"{key} lat not numeric"
            assert isinstance(d["lon"], (int, float)), f"{key} lon not numeric"

    def test_valid_names_includes_labels_and_keys(self):
        labels = {d["label"] for d in DESTINATIONS.values()}
        keys = set(DESTINATIONS.keys())
        # VALID_DESTINATION_NAMES should include labels, keys, and title-cased keys
        assert labels.issubset(VALID_DESTINATION_NAMES)
        assert keys.issubset(VALID_DESTINATION_NAMES)

    def test_coords_dict_matches(self):
        assert len(DESTINATION_COORDS) == len(DESTINATIONS)
        for key in DESTINATIONS:
            assert key in DESTINATION_COORDS
            assert DESTINATION_COORDS[key]["lat"] == DESTINATIONS[key]["lat"]
            assert DESTINATION_COORDS[key]["lon"] == DESTINATIONS[key]["lon"]
            assert DESTINATION_COORDS[key]["label"] == DESTINATIONS[key]["label"]

    def test_unsplash_kw_dict_matches(self):
        assert len(DESTINATION_UNSPLASH_KW) == len(DESTINATIONS)
        for key in DESTINATIONS:
            assert DESTINATION_UNSPLASH_KW[key] == DESTINATIONS[key]["unsplash_kw"]

    def test_news_kw_dict_matches(self):
        assert len(DESTINATION_NEWS_KW) == len(DESTINATIONS)
        for key in DESTINATIONS:
            assert DESTINATION_NEWS_KW[key] == DESTINATIONS[key]["news_kw"]

    def test_labels_dict_matches(self):
        assert len(DESTINATION_LABELS) == len(DESTINATIONS)
        for key in DESTINATIONS:
            assert DESTINATION_LABELS[key] == DESTINATIONS[key]["label"]

    def test_known_destinations_present(self):
        expected = {"goa", "jaipur", "manali", "shimla",
                    "varanasi", "udaipur", "mumbai", "delhi", "agra",
                    "rishikesh", "ooty", "darjeeling", "pondicherry", "andaman",
                    "munnar", "mysore", "amritsar", "leh_ladakh", "coorg",
                    "jaisalmer", "alleppey"}
        assert expected.issubset(set(DESTINATIONS.keys()))


# ═══════════════════════════════════════════════════════════
# API endpoint tests
# ═══════════════════════════════════════════════════════════

class TestDestinationsAPI:
    """GET /api/destinations should return the full destination list."""

    def test_returns_200(self, client):
        res = client.get("/api/destinations")
        assert res.status_code == 200

    def test_returns_all_destinations(self, client):
        res = client.get("/api/destinations")
        data = res.get_json()
        assert "destinations" in data
        assert len(data["destinations"]) == 201

    def test_destinations_sorted_alphabetically(self, client):
        res = client.get("/api/destinations")
        labels = [d["label"] for d in res.get_json()["destinations"]]
        assert labels == sorted(labels)

    def test_each_destination_has_id_and_label(self, client):
        res = client.get("/api/destinations")
        for d in res.get_json()["destinations"]:
            assert "id" in d
            assert "label" in d
            assert d["id"] == d["id"].lower()  # id is lowercase key

    def test_known_destination_in_list(self, client):
        res = client.get("/api/destinations")
        labels = {d["label"] for d in res.get_json()["destinations"]}
        assert "Goa" in labels
        assert "Munnar" in labels
        assert any("Andaman" in l for l in labels)

    def test_each_destination_has_rich_metadata(self, client):
        res = client.get("/api/destinations")
        for d in res.get_json()["destinations"]:
            assert "region" in d, f"{d['id']} missing region"
            assert "best_season" in d, f"{d['id']} missing best_season"
            assert "highlight" in d, f"{d['id']} missing highlight"
            assert "tagline" in d, f"{d['id']} missing tagline"
            assert d["region"], f"{d['id']} has empty region"
            assert d["tagline"], f"{d['id']} has empty tagline"


# ═══════════════════════════════════════════════════════════
# Integration: services import from registry
# ═══════════════════════════════════════════════════════════

class TestServicesUseRegistry:
    """Verify that services import destination data from the central registry."""

    def test_maps_service_uses_registry_coords(self):
        from app.services.maps_service import DESTINATION_COORDS as maps_coords
        assert maps_coords is DESTINATION_COORDS

    def test_unsplash_service_uses_registry_keywords(self):
        from app.services.unsplash_service import DESTINATION_KEYWORDS
        assert DESTINATION_KEYWORDS is DESTINATION_UNSPLASH_KW

    def test_news_service_uses_registry_keywords(self):
        from app.services.news_service import DESTINATION_KEYWORDS
        assert DESTINATION_KEYWORDS is DESTINATION_NEWS_KW

    def test_itinerary_route_uses_registry_names(self):
        from app.api.routes.itinerary import VALID_DESTINATIONS
        assert VALID_DESTINATIONS is VALID_DESTINATION_NAMES

    def test_compare_route_uses_registry_names(self):
        from app.api.routes.compare import VALID_DESTINATIONS
        assert VALID_DESTINATIONS is VALID_DESTINATION_NAMES
