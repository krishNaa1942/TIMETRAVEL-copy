"""
Tests for Budget Estimation API
=================================
"""

class TestBudgetEndpoint:
    """Tests for POST /api/budget/estimate."""

    def test_budget_returns_200_with_valid_data(self, client):
        resp = client.post("/api/budget/estimate", json={
            "destination": "Goa",
            "num_days": 5,
            "family_size": 4,
            "travel_class": "economy",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["destination"] == "Goa"
        assert data["total"] > 0
        assert data["currency"] == "INR"

    def test_budget_returns_400_for_empty_body(self, client):
        resp = client.post("/api/budget/estimate", data="not json")
        assert resp.status_code == 400

    def test_budget_returns_400_for_invalid_days(self, client):
        resp = client.post("/api/budget/estimate", json={
            "destination": "Goa",
            "num_days": 0,
            "family_size": 4,
        })
        assert resp.status_code == 400

    def test_budget_comfort_class_costs_more(self, client):
        economy = client.post("/api/budget/estimate", json={
            "destination": "Jaipur",
            "num_days": 3,
            "family_size": 2,
            "travel_class": "economy",
        }).get_json()

        comfort = client.post("/api/budget/estimate", json={
            "destination": "Jaipur",
            "num_days": 3,
            "family_size": 2,
            "travel_class": "comfort",
        }).get_json()

        assert comfort["total"] > economy["total"]

    def test_budget_uses_defaults_for_unknown_destination(self, client):
        resp = client.post("/api/budget/estimate", json={
            "destination": "Atlantis",
            "num_days": 3,
            "family_size": 2,
        })
        assert resp.status_code == 200
        assert resp.get_json()["total"] > 0
