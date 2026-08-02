"""
Tests for the Destinations API filters (Phase 11: server-side filtering)
=========================================================================
GET /api/destinations now honors query/category/region/budget/sortBy and
enriches items with budgetLevel/daily_cost/rating.
"""

import pytest

from app.api.routes.destinations import (
    _budget_level,
    _category_matches,
    _DATA_DIR,
)
from app.utils.constants import DESTINATIONS

TOTAL_DESTINATIONS = len(DESTINATIONS)


@pytest.fixture()
def api(client):
    return client


class TestListFilters:
    def test_returns_all_destinations_by_default(self, api):
        resp = api.get("/api/destinations")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["destinations"]) == TOTAL_DESTINATIONS

    def test_items_are_enriched(self, api):
        data = api.get("/api/destinations").get_json()
        for item in data["destinations"][:10]:
            assert item["budgetLevel"] in {"budget", "mid-range", "luxury"}
            assert isinstance(item["rating"], float)
            assert item["daily_cost"] is None or item["daily_cost"] > 0

    def test_query_filters(self, api):
        data = api.get("/api/destinations?query=goa").get_json()
        assert len(data["destinations"]) >= 1
        for item in data["destinations"]:
            searchable = (
                f"{item['label']} {item['region']} {item['tagline']} "
                f"{' '.join(item['category'])} {item['highlight']} {item['id']}"
            ).lower()
            assert "goa" in searchable

    def test_category_filters(self, api):
        data = api.get("/api/destinations?category=beach").get_json()
        assert len(data["destinations"]) >= 1
        for item in data["destinations"]:
            assert _category_matches(item["category"], "beach")

    def test_region_filters_case_insensitive(self, api):
        data = api.get("/api/destinations?region=rajasthan").get_json()
        assert len(data["destinations"]) >= 1
        assert all(
            "rajasthan" in item["region"].lower() for item in data["destinations"]
        )

    def test_budget_filters(self, api):
        data = api.get("/api/destinations?budget=budget").get_json()
        assert len(data["destinations"]) >= 1
        assert all(item["budgetLevel"] == "budget" for item in data["destinations"])

    def test_combined_filters(self, api):
        data = api.get(
            "/api/destinations?region=rajasthan&category=heritage&budget=mid-range"
        ).get_json()
        for item in data["destinations"]:
            assert "rajasthan" in item["region"].lower()
            assert item["budgetLevel"] == "mid-range"

    def test_unknown_category_returns_empty(self, api):
        data = api.get("/api/destinations?category=volcano").get_json()
        assert data["destinations"] == []


class TestSorting:
    def test_sort_by_price_ascending(self, api):
        data = api.get("/api/destinations?sortBy=price").get_json()
        costs = [item["daily_cost"] or 0 for item in data["destinations"]]
        assert costs == sorted(costs)

    def test_sort_by_rating_descending(self, api):
        data = api.get("/api/destinations?sortBy=rating").get_json()
        ratings = [item["rating"] for item in data["destinations"]]
        assert ratings == sorted(ratings, reverse=True)

    def test_sort_by_popularity_descending(self, api):
        data = api.get("/api/destinations?sortBy=popularity").get_json()
        from app.api.routes.destinations import _popularity

        scores = [_popularity(i["id"], i["label"]) for i in data["destinations"]]
        assert scores == sorted(scores, reverse=True)

    def test_default_sort_is_alphabetical(self, api):
        data = api.get("/api/destinations").get_json()
        labels = [i["label"] for i in data["destinations"]]
        assert labels == sorted(labels)


class TestOtherEndpoints:
    def test_featured_returns_enriched_items(self, api):
        data = api.get("/api/destinations/featured").get_json()
        assert len(data["destinations"]) >= 1
        assert all("budgetLevel" in item for item in data["destinations"])

    def test_trending_returns_enriched_items(self, api):
        data = api.get("/api/destinations/trending").get_json()
        assert 1 <= len(data["destinations"]) <= 6
        assert all("rating" in item for item in data["destinations"])

    def test_search_still_works(self, api):
        data = api.get("/api/destinations/search?q=manali").get_json()
        assert len(data["destinations"]) >= 1

    def test_detail_returns_enriched_destination(self, api):
        key = "goa"
        resp = api.get(f"/api/destinations/{key}")
        assert resp.status_code == 200
        item = resp.get_json()["destination"]
        assert item["id"] == key
        assert item["budgetLevel"] in {"budget", "mid-range", "luxury"}
        assert "related" in resp.get_json()

    def test_detail_unknown_returns_404(self, api):
        assert api.get("/api/destinations/nope").status_code == 404


class TestHelpers:
    def test_budget_level_thresholds(self):
        assert _budget_level(1500) == "budget"
        assert _budget_level(3000) == "mid-range"
        assert _budget_level(4999) == "mid-range"
        assert _budget_level(5000) == "luxury"
        assert _budget_level(0) == "mid-range"

    def test_category_matches_keywords(self):
        assert _category_matches(["beach"], "beach")
        assert _category_matches(["island"], "beach")
        assert _category_matches(["hill_station"], "mountain")
        assert _category_matches(["urban"], "city")
        assert _category_matches(["religious"], "spiritual")
        assert not _category_matches(["urban"], "beach")
        assert _category_matches(["beach"], "")

    def test_data_files_exist(self):
        assert (_DATA_DIR / "budget_baselines.json").exists()
        assert (_DATA_DIR / "safety_scores.json").exists()
