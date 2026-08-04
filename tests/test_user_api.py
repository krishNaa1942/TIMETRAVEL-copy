"""
Tests for the User Account & Profile API (Phase A: /api/user/*)
=================================================================
avatar upload-url / upload / serve, preferences, achievements,
export, account deletion, and offline sync acknowledgment.
"""

import io
import re

import pytest


@pytest.fixture()
def auth(client):
    """Register and login a test user, returning the authenticated client."""
    client.post(
        "/api/auth/register",
        json={
            "name": "Tester",
            "email": "userapi@example.com",
            "password": "Test1234!",
        },
    )
    return client


class TestAvatarEndpoints:
    def test_upload_url_requires_auth(self, app):
        fresh = app.test_client()
        resp = fresh.get("/api/user/avatar/upload-url")
        assert resp.status_code == 401

    def test_upload_url_returns_destination_and_key(self, auth):
        resp = auth.get("/api/user/avatar/upload-url")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["uploadUrl"].endswith("/api/user/avatar")
        assert isinstance(data["key"], str) and data["key"]

    def test_upload_avatar_accepts_image(self, auth):
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
        resp = auth.post(
            "/api/user/avatar",
            data={"avatar": (io.BytesIO(png), "avatar.png")},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert re.search(r"/api/user/avatar/user_\d+\.png$", data["avatar_url"])

    def test_upload_avatar_rejects_unsupported_type(self, auth):
        resp = auth.post(
            "/api/user/avatar",
            data={"avatar": (io.BytesIO(b"x" * 16), "avatar.txt")},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400

    def test_upload_avatar_requires_file(self, auth):
        resp = auth.post(
            "/api/user/avatar",
            data={},
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400


class TestPreferencesEndpoint:
    def test_updates_preferences(self, auth):
        resp = auth.put(
            "/api/user/preferences",
            json={"travel_style": "cultural", "budget_preference": "budget"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["preferences"]["travel_style"] == "cultural"
        assert data["preferences"]["budget_preference"] == "budget"

    def test_rejects_invalid_style(self, auth):
        resp = auth.put("/api/user/preferences", json={"travel_style": "bogus"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["preferences"]["travel_style"] != "bogus"

    def test_rejects_non_object_body(self, auth):
        resp = auth.put("/api/user/preferences", json=[1, 2, 3])
        assert resp.status_code == 400


class TestAchievementsEndpoint:
    def test_fresh_user_has_no_badges(self, auth):
        resp = auth.get("/api/user/achievements")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["badges"] == []


class TestExportEndpoint:
    def test_returns_download_url(self, auth):
        resp = auth.get("/api/user/export")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["downloadUrl"].endswith("/api/user/export?download=1")

    def test_download_returns_json_dump(self, auth):
        resp = auth.get("/api/user/export?download=1")
        assert resp.status_code == 200
        assert resp.headers["Content-Disposition"].startswith("attachment")
        data = resp.get_json()
        assert data["user"]["email"] == "userapi@example.com"
        assert "trips" in data and "notes" in data and "favorites" in data


class TestSyncEndpoint:
    def test_acks_events(self, auth):
        resp = auth.post(
            "/api/user/sync",
            json={"events": [{"type": "view", "data": {}, "timestamp": 1}]},
        )
        assert resp.status_code == 200
        assert resp.get_json()["synced"] == 1

    def test_rejects_non_array_events(self, auth):
        resp = auth.post("/api/user/sync", json={"events": "nope"})
        assert resp.status_code == 400


class TestAccountDeletion:
    def test_delete_account_removes_user(self, app, client):
        client.post(
            "/api/auth/register",
            json={
                "name": "Doomed",
                "email": "doomed@example.com",
                "password": "Test1234!",
            },
        )
        resp = client.delete("/api/user/account")
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

        # Credentials must no longer authenticate after deletion.
        resp = client.post(
            "/api/auth/login",
            json={"email": "doomed@example.com", "password": "Test1234!"},
        )
        assert resp.status_code == 401
