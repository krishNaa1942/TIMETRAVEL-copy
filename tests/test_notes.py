"""
Tests for Travel Notes / Journal API
========================================
POST   /api/notes             – Create note
GET    /api/notes             – List notes
GET    /api/notes/<id>        – Get note
PUT    /api/notes/<id>        – Update note
DELETE /api/notes/<id>        – Delete note
GET    /api/notes/community   – Public notes (no auth)
"""

import json
import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db
from app.models.entities import User, TravelNote


# ── Fixtures ────────────────────────────────────────────────

@pytest.fixture()
def app():
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


@pytest.fixture()
def auth_client(app, client):
    with app.app_context():
        user = User(name="Tester", email="test@example.com")
        user.set_password("password123")
        _db.session.add(user)
        _db.session.commit()
        client.post("/api/auth/login", json={"email": "test@example.com", "password": "password123"})
    return client


def _create_note(client, **overrides):
    payload = {
        "title": "Beautiful Beaches",
        "content": "The beaches in Goa are amazing!",
        "destination": "Goa",
        "mood": "happy",
        "rating": 5,
    }
    payload.update(overrides)
    return client.post("/api/notes", json=payload)


# ═══════════════════════════════════════════════════════════
# Unauthenticated access
# ═══════════════════════════════════════════════════════════

class TestNotesUnauth:
    def test_create_note_unauth(self, client):
        res = _create_note(client)
        assert res.status_code == 401

    def test_list_notes_unauth(self, client):
        res = client.get("/api/notes")
        assert res.status_code == 401

    def test_get_note_unauth(self, client):
        res = client.get("/api/notes/1")
        assert res.status_code == 401

    def test_update_note_unauth(self, client):
        res = client.put("/api/notes/1", json={"title": "X"})
        assert res.status_code == 401

    def test_delete_note_unauth(self, client):
        res = client.delete("/api/notes/1")
        assert res.status_code == 401

    def test_community_notes_no_auth_required(self, client):
        """Community endpoint should work without authentication."""
        res = client.get("/api/notes/community")
        assert res.status_code == 200
        assert "notes" in res.get_json()


# ═══════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════

class TestNotesCRUD:
    def test_create_note_success(self, auth_client):
        res = _create_note(auth_client)
        assert res.status_code == 201
        note = res.get_json()["note"]
        assert note["title"] == "Beautiful Beaches"
        assert note["destination"] == "Goa"
        assert note["mood"] == "happy"
        assert note["rating"] == 5

    def test_create_note_missing_fields(self, auth_client):
        res = auth_client.post("/api/notes", json={"title": "X"})
        assert res.status_code == 400

    def test_create_note_no_json(self, auth_client):
        res = auth_client.post("/api/notes", data="not json")
        assert res.status_code == 400

    def test_list_notes_empty(self, auth_client):
        res = auth_client.get("/api/notes")
        assert res.status_code == 200
        assert res.get_json()["notes"] == []

    def test_list_notes_after_create(self, auth_client):
        _create_note(auth_client)
        _create_note(auth_client, title="Second Note", destination="Delhi")
        res = auth_client.get("/api/notes")
        assert len(res.get_json()["notes"]) == 2

    def test_list_notes_filter_by_destination(self, auth_client):
        _create_note(auth_client, destination="Goa")
        _create_note(auth_client, destination="Delhi", title="Delhi Trip")
        res = auth_client.get("/api/notes?destination=Goa")
        notes = res.get_json()["notes"]
        assert len(notes) == 1
        assert notes[0]["destination"] == "Goa"

    def test_get_note(self, auth_client):
        _create_note(auth_client)
        notes = auth_client.get("/api/notes").get_json()["notes"]
        note_id = notes[0]["id"]
        res = auth_client.get(f"/api/notes/{note_id}")
        assert res.status_code == 200
        assert res.get_json()["note"]["title"] == "Beautiful Beaches"

    def test_update_note(self, auth_client):
        _create_note(auth_client)
        notes = auth_client.get("/api/notes").get_json()["notes"]
        note_id = notes[0]["id"]
        res = auth_client.put(f"/api/notes/{note_id}", json={
            "title": "Updated Title",
            "mood": "excited",
            "is_public": True,
        })
        assert res.status_code == 200
        note = res.get_json()["note"]
        assert note["title"] == "Updated Title"
        assert note["mood"] == "excited"
        assert note["is_public"] is True

    def test_delete_note(self, auth_client):
        _create_note(auth_client)
        notes = auth_client.get("/api/notes").get_json()["notes"]
        note_id = notes[0]["id"]
        res = auth_client.delete(f"/api/notes/{note_id}")
        assert res.status_code == 200
        remaining = auth_client.get("/api/notes").get_json()["notes"]
        assert len(remaining) == 0


# ═══════════════════════════════════════════════════════════
# Community Notes
# ═══════════════════════════════════════════════════════════

class TestCommunityNotes:
    def test_community_shows_public_notes(self, auth_client, client):
        _create_note(auth_client, is_public=True, title="Public Note")
        _create_note(auth_client, is_public=False, title="Private Note")
        # Use un-authed client for community endpoint
        auth_client.post("/api/auth/logout")
        res = client.get("/api/notes/community")
        notes = res.get_json()["notes"]
        assert len(notes) == 1
        assert notes[0]["title"] == "Public Note"

    def test_community_filter_by_destination(self, auth_client, client):
        _create_note(auth_client, is_public=True, destination="Goa")
        _create_note(auth_client, is_public=True, destination="Delhi", title="Delhi Note")
        auth_client.post("/api/auth/logout")
        res = client.get("/api/notes/community?destination=Goa")
        notes = res.get_json()["notes"]
        assert len(notes) == 1


# ═══════════════════════════════════════════════════════════
# Ownership
# ═══════════════════════════════════════════════════════════

class TestNotesOwnership:
    def test_cannot_update_other_users_note(self, app, client):
        with app.app_context():
            user_a = User(name="A", email="a@example.com")
            user_a.set_password("password123")
            _db.session.add(user_a)
            _db.session.commit()

        client.post("/api/auth/login", json={"email": "a@example.com", "password": "password123"})
        _create_note(client)
        notes = client.get("/api/notes").get_json()["notes"]
        note_id = notes[0]["id"]
        client.post("/api/auth/logout")

        with app.app_context():
            user_b = User(name="B", email="b@example.com")
            user_b.set_password("password123")
            _db.session.add(user_b)
            _db.session.commit()

        client.post("/api/auth/login", json={"email": "b@example.com", "password": "password123"})
        res = client.put(f"/api/notes/{note_id}", json={"title": "Hacked!"})
        assert res.status_code == 403

    def test_cannot_delete_other_users_note(self, app, client):
        with app.app_context():
            user_a = User(name="A", email="a@example.com")
            user_a.set_password("password123")
            _db.session.add(user_a)
            _db.session.commit()

        client.post("/api/auth/login", json={"email": "a@example.com", "password": "password123"})
        _create_note(client)
        notes = client.get("/api/notes").get_json()["notes"]
        note_id = notes[0]["id"]
        client.post("/api/auth/logout")

        with app.app_context():
            user_b = User(name="B", email="b@example.com")
            user_b.set_password("password123")
            _db.session.add(user_b)
            _db.session.commit()

        client.post("/api/auth/login", json={"email": "b@example.com", "password": "password123"})
        res = client.delete(f"/api/notes/{note_id}")
        assert res.status_code == 403
