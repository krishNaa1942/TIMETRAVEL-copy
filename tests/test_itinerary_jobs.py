"""
Tests for the itinerary v2 background-job pipeline and bulk trip save.
"""

import json
import time

import pytest

from app.services.intent_parser import parse_trip_intent
from app.services import itinerary_jobs


# ---------------------------------------------------------------------------
# Intent parser
# ---------------------------------------------------------------------------
class TestIntentParser:
    def test_full_query(self):
        parsed = parse_trip_intent("3-day trip to Goa from Bangalore on a budget")
        assert parsed["destination"] == "goa"
        assert parsed["origin"] == "Bangalore"
        assert parsed["num_days"] == 3
        assert parsed["travel_class"] == "economy"
        assert "budget" in parsed["styles"]

    def test_origin_never_beats_destination(self):
        parsed = parse_trip_intent("weekend getaway from Mumbai to Lonavala")
        assert parsed["destination"] == "lonavala"
        assert parsed["origin"] == "Mumbai"

    def test_days_and_class(self):
        parsed = parse_trip_intent("5 days in Munnar with family, luxury")
        assert parsed["destination"] == "munnar"
        assert parsed["num_days"] == 5
        assert parsed["travel_class"] == "premium"

    def test_defaults(self):
        parsed = parse_trip_intent("plan a trip to Udaipur")
        assert parsed["destination"] == "udaipur"
        assert parsed["num_days"] == 3
        assert parsed["travel_class"] == "economy"

    def test_unknown_destination(self):
        parsed = parse_trip_intent("moon vacation")
        assert parsed["destination"] is None


# ---------------------------------------------------------------------------
# Job store + worker (with a fake day generator)
# ---------------------------------------------------------------------------
def _fake_day_generator(destination, num_days, family_size, travel_class, interests, api_key, stop_event=None):
    for index in range(1, num_days + 1):
        if stop_event is not None and stop_event.is_set():
            break
        yield {
            "day": index,
            "title": f"Day {index} in {destination}",
            "morning": {"place": "A", "activity": "a", "description": "d", "duration": "1h", "cost": "₹100"},
            "afternoon": {"place": "B", "activity": "b", "description": "d", "duration": "1h", "cost": "₹200"},
            "evening": {"place": "C", "activity": "c", "description": "d", "duration": "1h", "cost": "₹300"},
            "tip": "t",
        }


class TestJobStore:
    def test_create_get_cancel(self):
        job_id = itinerary_jobs.create_job({"destination": "goa", "num_days": 3})
        assert itinerary_jobs.get_job(job_id) is not None
        assert itinerary_jobs.get_job("nope") is None
        assert itinerary_jobs.cancel_job(job_id) is True
        assert itinerary_jobs.get_job(job_id).status in ("cancelling",)

    def test_worker_completes_job(self, monkeypatch):
        monkeypatch.setattr(
            itinerary_jobs, "generate_itinerary_days", _fake_day_generator
        )
        job_id = itinerary_jobs.create_job(
            {
                "destination": "goa",
                "num_days": 3,
                "family_size": 2,
                "travel_class": "economy",
                "interests": "beaches",
                "api_key": "fake",
                "maps_api_key": "",
            }
        )
        itinerary_jobs.start_job(job_id)

        deadline = time.time() + 10
        job = None
        while time.time() < deadline:
            job = itinerary_jobs.get_job(job_id)
            if job.status in itinerary_jobs.TERMINAL_STATUSES:
                break
            time.sleep(0.05)
        assert job is not None
        assert job.status == "done", job.error
        assert len(job.days) == 3
        assert [d["day"] for d in job.days] == [1, 2, 3]
        assert job.result is not None
        assert job.result["destination"] == "goa"
        assert job.result["num_days"] == 3
        assert "itinerary" in job.result

        snapshot = job.snapshot()
        assert snapshot["status"] == "done"
        assert snapshot["day_count"] == 3

    def test_worker_cancel(self, monkeypatch):
        def slow_generator(destination, num_days, family_size, travel_class, interests, api_key, stop_event=None):
            for index in range(1, num_days + 1):
                yield {"day": index, "title": f"D{index}"}
                if index == 1:
                    while not (stop_event and stop_event.is_set()):
                        time.sleep(0.02)

        monkeypatch.setattr(itinerary_jobs, "generate_itinerary_days", slow_generator)
        job_id = itinerary_jobs.create_job(
            {"destination": "goa", "num_days": 3, "family_size": 2,
             "travel_class": "economy", "interests": "", "api_key": "fake",
             "maps_api_key": ""}
        )
        itinerary_jobs.start_job(job_id)
        time.sleep(0.3)
        assert itinerary_jobs.cancel_job(job_id) is True

        deadline = time.time() + 5
        while time.time() < deadline:
            if itinerary_jobs.get_job(job_id).status == "cancelled":
                break
            time.sleep(0.05)
        assert itinerary_jobs.get_job(job_id).status == "cancelled"


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------
class TestItineraryJobAPI:
    def test_create_job_requires_valid_destination(self, client):
        resp = client.post("/api/itinerary/jobs", json={"query": "trip to nowhere"})
        assert resp.status_code == 400

    def test_create_job_and_poll(self, client, monkeypatch):
        monkeypatch.setattr(
            itinerary_jobs, "generate_itinerary_days", _fake_day_generator
        )
        with client.application.app_context():
            client.application.config["GOOGLE_API_KEY"] = "test-key"

        resp = client.post(
            "/api/itinerary/jobs",
            json={"query": "3-day trip to Goa from Bangalore"},
        )
        assert resp.status_code == 202
        job_id = resp.get_json()["job_id"]

        deadline = time.time() + 10
        status = None
        while time.time() < deadline:
            status = client.get(f"/api/itinerary/jobs/{job_id}").get_json()
            if status["status"] == "done":
                break
            time.sleep(0.05)
        assert status["status"] == "done"
        assert status["day_count"] == 3
        assert "itinerary" in status["result"]
        assert status["result"]["itinerary"][0]["day"] == 1

    def test_stream_endpoint(self, client, monkeypatch):
        monkeypatch.setattr(
            itinerary_jobs, "generate_itinerary_days", _fake_day_generator
        )
        with client.application.app_context():
            client.application.config["GOOGLE_API_KEY"] = "test-key"

        resp = client.post("/api/itinerary/jobs", json={"destination": "goa", "num_days": 2})
        job_id = resp.get_json()["job_id"]

        deadline = time.time() + 10
        while time.time() < deadline:
            if itinerary_jobs.get_job(job_id).status == "done":
                break
            time.sleep(0.05)

        stream = client.get(f"/api/itinerary/jobs/{job_id}/stream")
        assert stream.status_code == 200
        assert stream.mimetype == "text/event-stream"
        body = stream.get_data(as_text=True)
        assert "event: day" in body
        assert "event: done" in body

    def test_missing_job_404(self, client):
        assert client.get("/api/itinerary/jobs/doesnotexist").status_code == 404


# ---------------------------------------------------------------------------
# Bulk trip save
# ---------------------------------------------------------------------------
class TestBulkSave:
    def test_bulk_create(self, app, db):
        fresh = app.test_client()  # shared client may carry a session cookie
        resp = fresh.post(
            "/api/trips/planner/bulk",
            json={
                "trip": {"title": "Goa 3 Day Trip", "destination": "Goa", "num_days": 3},
                "source_id": "job123",
                "itinerary_payload": {"destination": "Goa", "itinerary": []},
                "days": [
                    {
                        "day_number": 1,
                        "title": "Arrival",
                        "places": [
                            {"name": "Baga Beach", "category": "beach", "position_order": 0},
                            {"name": "Dinner", "position_order": 1},
                        ],
                    }
                ],
            },
        )
        assert resp.status_code == 401  # requires login

    def test_bulk_create_authenticated(self, client, db):
        from app.models.entities import User
        from app.services.jwt_service_v2 import jwt_service_v2

        with client.application.app_context():
            user = User.query.first()
            if user is None:
                user = User(
                    name="Test", email="test@bulk.local", password_hash="x"
                )
                db.session.add(user)
                db.session.commit()
            headers = {
                "Authorization": "Bearer "
                + jwt_service_v2.create_access_token(
                    str(user.id), user.email, "sess-test"
                )
            }

            resp = client.post(
                "/api/trips/planner/bulk",
                headers=headers,
                json={
                    "trip": {"title": "Goa 3 Day", "destination": "Goa", "num_days": 2},
                    "source_id": "gen-abc",
                    "days": [
                        {
                            "day_number": 1,
                            "title": "Arrival",
                            "places": [{"name": "Baga", "position_order": 0}],
                        }
                    ],
                },
            )
            assert resp.status_code == 201
            trip = resp.get_json()["trip"]
            assert trip["destination"] == "Goa"
            assert len(trip["days"]) == 1
            assert trip["days"][0]["places"][0]["name"] == "Baga"

            # Idempotent: same source_id returns existing trip, no dup
            resp2 = client.post(
                "/api/trips/planner/bulk",
                headers=headers,
                json={
                    "trip": {"title": "Goa 3 Day", "destination": "Goa", "num_days": 2},
                    "source_id": "gen-abc",
                    "days": [],
                },
            )
            assert resp2.status_code in (200, 201)
            assert resp2.get_json()["trip"].get("duplicate") is True
            assert resp2.get_json()["trip"]["id"] == trip["id"]

            count = client.get("/api/trips/planner").get_json()["trips"]
            assert len(count) == 1
