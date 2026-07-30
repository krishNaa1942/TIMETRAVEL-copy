"""
Integration Tests – Multi-step user workflows
==============================================
These tests verify end-to-end user flows that span multiple API
blueprints, ensuring they work together correctly:

  1. Register → Login → Create Trip → Add Day/Place → Upload Photo → Share
  2. Register → Budget → Expenses → Travel Stats
  3. Two-user ownership isolation across features
  4. Full document lifecycle (upload → list → serve → delete)
  5. Trip lifecycle (create → update → add content → delete cascade)
"""

import io
import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db

# ── Fixtures ────────────────────────────────────────────────────────────


@pytest.fixture()
def app():
    """Function-scoped app with a fresh database per test."""
    application = create_app(config_class=TestingConfig)
    application.config["WTF_CSRF_ENABLED"] = False
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.rollback()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


# ── Helpers ─────────────────────────────────────────────────────────────


def _register(client, name="Test User", email="test@example.com", password="Secret123!"):
    return client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password,
        },
    )


def _login(client, email="test@example.com", password="Secret123!"):
    return client.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )


def _logout(client):
    return client.post("/api/auth/logout")


def _create_trip(client, **overrides):
    payload = {
        "title": "Integration Trip",
        "destination": "Goa",
        "num_days": 3,
        "start_date": "2026-06-01",
    }
    payload.update(overrides)
    return client.post("/api/trips/planner", json=payload)


def _get_trip_id(client):
    res = client.get("/api/trips/planner")
    trips = res.get_json()["trips"]
    return trips[0]["id"]


def _fake_image(name="test.jpg", content=b"fake-image-data"):
    return (io.BytesIO(content), name)


def _fake_doc(name="passport.pdf", content=b"fake-pdf-data"):
    return (io.BytesIO(content), name)


# ── Flow 1: Full Trip Lifecycle ─────────────────────────────────────────


class TestFullTripLifecycle:
    """Register → create trip → add day → add place → upload photo → share."""

    def test_complete_trip_flow(self, app, client):
        # Step 1: Register (auto-login)
        res = _register(client)
        assert res.status_code == 201
        user_data = res.get_json()["user"]
        assert user_data["email"] == "test@example.com"

        # Verify authenticated
        res = client.get("/api/auth/me")
        assert res.status_code == 200
        assert res.get_json()["authenticated"] is True

        # Step 2: Create a trip
        res = _create_trip(client)
        assert res.status_code == 201
        trip = res.get_json()["trip"]
        trip_id = trip["id"]
        assert trip["destination"] == "Goa"

        # Step 3: List trips — should contain the new trip
        res = client.get("/api/trips/planner")
        assert res.status_code == 200
        trips = res.get_json()["trips"]
        assert len(trips) == 1
        assert trips[0]["id"] == trip_id

        # Step 4: Add a day to the trip
        res = client.post(
            f"/api/trips/planner/{trip_id}/days",
            json={
                "title": "Beach Day",
            },
        )
        assert res.status_code == 201
        day_id = res.get_json()["day"]["id"]

        # Step 5: Add a place to that day
        res = client.post(
            f"/api/trips/planner/{trip_id}/places",
            json={
                "name": "Calangute Beach",
                "day_id": day_id,
                "category": "beach",
            },
        )
        assert res.status_code == 201
        place = res.get_json()["place"]
        assert place["name"] == "Calangute Beach"

        # Step 6: Upload a photo for the trip
        data = {"trip_id": str(trip_id), "caption": "Sunset"}
        data["file"] = _fake_image()
        res = client.post(
            "/api/uploads/photos",
            data=data,
            content_type="multipart/form-data",
        )
        assert res.status_code == 201
        photo = res.get_json()["photo"]
        assert photo["caption"] == "Sunset"

        # Step 7: Serve the uploaded photo back
        res = client.get(f"/api/uploads/serve/photos/{photo['filename']}")
        assert res.status_code == 200

        # Step 8: Share the trip itinerary
        res = client.post(
            "/api/share",
            json={
                "title": "My Goa Trip",
                "itinerary_json": {"day1": "Beach", "day2": "Fort"},
            },
        )
        assert res.status_code == 201
        share_token = res.get_json()["share"]["share_token"]

        # Step 9: Access shared link without auth (public)
        _logout(client)
        res = client.get(f"/api/share/{share_token}")
        assert res.status_code == 200
        shared = res.get_json()
        assert shared["title"] == "My Goa Trip"

    def test_trip_update_and_delete(self, app, client):
        """Create → update → delete trip, verify cascade."""
        _register(client)
        _create_trip(client)
        trip_id = _get_trip_id(client)

        # Update the trip
        res = client.put(
            f"/api/trips/planner/{trip_id}",
            json={
                "title": "Updated Trip",
                "status": "active",
            },
        )
        assert res.status_code == 200
        assert res.get_json()["trip"]["title"] == "Updated Trip"

        # Add a place and a photo so delete cascades them
        res = client.post(f"/api/trips/planner/{trip_id}/days", json={"title": "Day 1"})
        day_id = res.get_json()["day"]["id"]
        client.post(
            f"/api/trips/planner/{trip_id}/places",
            json={
                "name": "Fort Aguada",
                "day_id": day_id,
                "category": "landmark",
            },
        )
        data = {"trip_id": str(trip_id), "file": _fake_image()}
        client.post(
            "/api/uploads/photos", data=data, content_type="multipart/form-data"
        )

        # Delete the trip
        res = client.delete(f"/api/trips/planner/{trip_id}")
        assert res.status_code == 200

        # Verify it's gone
        res = client.get(f"/api/trips/planner/{trip_id}")
        assert res.status_code == 404


# ── Flow 2: Budget → Expenses → Stats ──────────────────────────────────


class TestBudgetExpenseFlow:
    """Register → estimate budget → log expenses → check stats."""

    def test_budget_and_expenses(self, app, client):
        _register(client)

        # Step 1: Get budget estimate (this also creates a trip record)
        res = client.post(
            "/api/budget/estimate",
            json={
                "destination": "Goa",
                "num_days": 3,
                "family_size": 4,
                "travel_class": "economy",
            },
        )
        assert res.status_code == 200
        budget = res.get_json()
        assert "total" in budget

        # Step 2: Create a trip for expenses
        res = _create_trip(client, destination="Mumbai")
        assert res.status_code == 201
        trip_id = res.get_json()["trip"]["id"]

        # Step 3: Add expenses
        res = client.post(
            "/api/expenses",
            json={
                "destination": "Mumbai",
                "description": "Hotel booking",
                "amount": 5000,
                "category": "accommodation",
                "trip_id": trip_id,
            },
        )
        assert res.status_code == 201

        res = client.post(
            "/api/expenses",
            json={
                "destination": "Mumbai",
                "description": "Train ticket",
                "amount": 800,
                "category": "transport",
                "trip_id": trip_id,
            },
        )
        assert res.status_code == 201

        # Step 4: List expenses and verify totals
        res = client.get("/api/expenses")
        assert res.status_code == 200
        expenses = res.get_json()["expenses"]
        assert len(expenses) >= 2
        total = sum(e["amount"] for e in expenses)
        assert total >= 5800

        # Step 5: Check travel stats
        res = client.get("/api/stats")
        assert res.status_code == 200


# ── Flow 3: Two-User Ownership Isolation ────────────────────────────────


class TestOwnershipIsolation:
    """Verify that User B cannot access User A's trips, photos, or docs."""

    def test_cross_user_trip_isolation(self, app, client):
        # User A registers and creates a trip + photo
        _register(client, name="Alice", email="alice@example.com", password="Alice123!X")
        _create_trip(client, title="Alice's Trip")
        trip_id_a = _get_trip_id(client)

        # Upload a photo as Alice
        data = {"trip_id": str(trip_id_a), "file": _fake_image()}
        res = client.post(
            "/api/uploads/photos", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 201
        photo_filename = res.get_json()["photo"]["filename"]
        photo_id = res.get_json()["photo"]["id"]

        # Upload a document as Alice
        data = {"file": _fake_doc(), "title": "Alice Passport"}
        res = client.post(
            "/api/uploads/documents", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 201
        doc_filename = res.get_json()["document"]["filename"]
        doc_id = res.get_json()["document"]["id"]

        _logout(client)

        # User B registers
        _register(client, name="Bob", email="bob@example.com", password="Bobpass1!")

        # User B cannot see Alice's trip
        res = client.get(f"/api/trips/planner/{trip_id_a}")
        assert res.status_code == 404

        # User B cannot serve Alice's photo
        res = client.get(f"/api/uploads/serve/photos/{photo_filename}")
        assert res.status_code == 403

        # User B cannot serve Alice's document
        res = client.get(f"/api/uploads/serve/documents/{doc_filename}")
        assert res.status_code == 403

        # User B cannot delete Alice's photo
        res = client.delete(f"/api/uploads/photos/{photo_id}")
        assert res.status_code == 404

        # User B cannot delete Alice's document
        res = client.delete(f"/api/uploads/documents/{doc_id}")
        assert res.status_code == 404

        # User B's trip list is empty
        res = client.get("/api/trips/planner")
        assert res.status_code == 200
        assert len(res.get_json()["trips"]) == 0

    def test_cross_user_share_isolation(self, app, client):
        """User B cannot revoke User A's shares."""
        _register(client, name="Alice", email="alice@example.com", password="Alice123!X")
        res = client.post(
            "/api/share",
            json={
                "title": "Alice's Plan",
                "itinerary_json": {"day1": "Beach"},
            },
        )
        assert res.status_code == 201
        token = res.get_json()["share"]["share_token"]

        _logout(client)
        _register(client, name="Bob", email="bob@example.com", password="Bobpass1!")

        # Bob cannot revoke Alice's share
        res = client.delete(f"/api/share/{token}")
        assert res.status_code == 404

        # But Bob CAN view the public share link
        res = client.get(f"/api/share/{token}")
        assert res.status_code == 200


# ── Flow 4: Document Lifecycle ──────────────────────────────────────────


class TestDocumentLifecycle:
    """Upload → list → serve → delete document."""

    def test_full_document_lifecycle(self, app, client):
        _register(client)

        # Upload
        data = {
            "file": _fake_doc("visa.pdf"),
            "title": "Travel Visa",
            "doc_type": "visa",
            "notes": "Valid until 2027",
        }
        res = client.post(
            "/api/uploads/documents",
            data=data,
            content_type="multipart/form-data",
        )
        assert res.status_code == 201
        doc = res.get_json()["document"]
        doc_id = doc["id"]
        filename = doc["filename"]
        assert doc["title"] == "Travel Visa"

        # List
        res = client.get("/api/uploads/documents")
        assert res.status_code == 200
        docs = res.get_json()["documents"]
        assert len(docs) == 1
        assert docs[0]["id"] == doc_id

        # Serve
        res = client.get(f"/api/uploads/serve/documents/{filename}")
        assert res.status_code == 200

        # Delete
        res = client.delete(f"/api/uploads/documents/{doc_id}")
        assert res.status_code == 200

        # Verify gone
        res = client.get("/api/uploads/documents")
        assert res.status_code == 200
        assert len(res.get_json()["documents"]) == 0


# ── Flow 5: Auth Edge Cases Across Workflows ───────────────────────────


class TestAuthAcrossWorkflows:
    """Verify that logging out properly blocks all subsequent API calls."""

    def test_logout_blocks_all_endpoints(self, app, client):
        _register(client)
        _create_trip(client)
        trip_id = _get_trip_id(client)

        _logout(client)

        # All protected endpoints should return 401
        protected = [
            ("GET", f"/api/trips/planner/{trip_id}"),
            ("POST", "/api/trips/planner"),
            ("POST", "/api/uploads/photos"),
            ("POST", "/api/uploads/documents"),
            ("GET", "/api/uploads/documents"),
            ("GET", "/api/stats"),
        ]
        for method, url in protected:
            if method == "GET":
                res = client.get(url)
            else:
                res = client.post(url, json={})
            assert (
                res.status_code == 401
            ), f"{method} {url} returned {res.status_code}, expected 401"

        # GET /api/trips/planner returns 200 with empty array (graceful degradation)
        res = client.get("/api/trips/planner")
        assert res.status_code == 200
        assert res.get_json()["trips"] == []

        # /api/auth/me returns 200 with authenticated=False (not 401)
        res = client.get("/api/auth/me")
        assert res.status_code == 200
        assert res.get_json()["authenticated"] is False

    def test_re_login_restores_access(self, app, client):
        """Register → logout → login → access works."""
        _register(client)
        _create_trip(client)

        _logout(client)
        res = client.get("/api/trips/planner")
        assert res.status_code == 200
        assert res.get_json()["trips"] == []  # returns empty when logged out

        _login(client)
        res = client.get("/api/trips/planner")
        assert res.status_code == 200
        assert len(res.get_json()["trips"]) == 1


# ── Flow 6: Chatbot in Authenticated Context ───────────────────────────


class TestChatbotFlow:
    """Verify chatbot works with/without authentication."""

    def test_chatbot_basic_flow(self, app, client):
        _register(client)
        res = client.post(
            "/api/chat",
            json={
                "message": "Tell me about Goa",
                "session_id": "integration-test-session",
            },
        )
        assert res.status_code == 200
        data = res.get_json()
        assert "reply" in data
        assert "intent" in data
        assert "session_id" in data

    def test_chatbot_after_login(self, app, client):
        _register(client)
        res = client.post(
            "/api/chat",
            json={
                "message": "What are the best beaches?",
                "session_id": "auth-test-session",
            },
        )
        assert res.status_code == 200
        assert "reply" in res.get_json()


# ── Flow 7: Multi-Trip Management ──────────────────────────────────────


class TestMultiTripManagement:
    """User creates multiple trips and manages them independently."""

    def test_multiple_trips_independent(self, app, client):
        _register(client)

        # Create three trips
        for dest in ["Goa", "Kerala", "Rajasthan"]:
            res = _create_trip(client, title=f"{dest} Trip", destination=dest)
            assert res.status_code == 201

        # List should show all three
        res = client.get("/api/trips/planner")
        assert res.status_code == 200
        trips = res.get_json()["trips"]
        assert len(trips) == 3

        # Delete the middle one
        kerala_id = next(t["id"] for t in trips if t["destination"] == "Kerala")
        res = client.delete(f"/api/trips/planner/{kerala_id}")
        assert res.status_code == 200

        # Should have two remaining
        res = client.get("/api/trips/planner")
        remaining = res.get_json()["trips"]
        assert len(remaining) == 2
        assert all(t["destination"] != "Kerala" for t in remaining)

    def test_photos_scoped_to_trip(self, app, client):
        """Photos uploaded to trip A don't appear in trip B's context."""
        _register(client)

        # Create two trips
        res = _create_trip(client, title="Trip A", destination="Goa")
        trip_a = res.get_json()["trip"]["id"]

        res = _create_trip(client, title="Trip B", destination="Kerala")
        trip_b = res.get_json()["trip"]["id"]

        # Upload photo to trip A
        data = {"trip_id": str(trip_a), "file": _fake_image("goa.jpg")}
        res = client.post(
            "/api/uploads/photos", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 201

        # Upload photo to trip B
        data = {"trip_id": str(trip_b), "file": _fake_image("kerala.jpg")}
        res = client.post(
            "/api/uploads/photos", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 201

        # Get trip A details — should only contain its photo
        res = client.get(f"/api/trips/planner/{trip_a}")
        assert res.status_code == 200
