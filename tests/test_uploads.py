"""
Tests for Uploads API (Photos & Documents)
=============================================
POST   /api/uploads/photos                       – Upload photo
DELETE /api/uploads/photos/<id>                   – Delete photo
POST   /api/uploads/documents                    – Upload document
GET    /api/uploads/documents                     – List documents
DELETE /api/uploads/documents/<id>                – Delete document
GET    /api/uploads/serve/photos/<filename>       – Serve photo (auth+owner)
GET    /api/uploads/serve/documents/<filename>    – Serve document (auth+owner)
"""

import io
import json
import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db
from app.models.entities import User, Trip, TripPhoto, TripDocument

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
    """Client with a logged-in user who has a trip."""
    with app.app_context():
        user = User(name="Tester", email="test@example.com")
        user.set_password("password123")
        _db.session.add(user)
        _db.session.commit()

        trip = Trip(
            user_id=user.id,
            title="Test Trip",
            destination="Goa",
            num_days=3,
            status="planning",
        )
        _db.session.add(trip)
        _db.session.commit()

        client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "password123"},
        )
    return client


def _get_trip_id(client):
    """Get the first trip's ID for the logged-in user."""
    res = client.get("/api/trips/planner")
    trips = res.get_json()["trips"]
    return trips[0]["id"]


def _fake_image(name="test.jpg", content=b"fake-image-data"):
    return (io.BytesIO(content), name)


def _fake_doc(name="passport.pdf", content=b"fake-pdf-data"):
    return (io.BytesIO(content), name)


# ═══════════════════════════════════════════════════════════
# Unauthenticated access
# ═══════════════════════════════════════════════════════════


class TestUploadsUnauth:
    def test_upload_photo_unauth(self, client):
        data = {"trip_id": "1"}
        data["file"] = _fake_image()
        res = client.post(
            "/api/uploads/photos", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 401

    def test_delete_photo_unauth(self, client):
        res = client.delete("/api/uploads/photos/1")
        assert res.status_code == 401

    def test_upload_document_unauth(self, client):
        data = {"file": _fake_doc()}
        res = client.post(
            "/api/uploads/documents", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 401

    def test_list_documents_unauth(self, client):
        res = client.get("/api/uploads/documents")
        assert res.status_code == 401

    def test_delete_document_unauth(self, client):
        res = client.delete("/api/uploads/documents/1")
        assert res.status_code == 401

    def test_serve_photo_unauth(self, client):
        res = client.get("/api/uploads/serve/photos/test.jpg")
        assert res.status_code == 401

    def test_serve_document_unauth(self, client):
        res = client.get("/api/uploads/serve/documents/test.pdf")
        assert res.status_code == 401


# ═══════════════════════════════════════════════════════════
# Photo Upload
# ═══════════════════════════════════════════════════════════


class TestPhotoUpload:
    def test_upload_photo_success(self, auth_client):
        trip_id = _get_trip_id(auth_client)
        data = {"trip_id": str(trip_id), "caption": "Beach sunset"}
        data["file"] = _fake_image()
        res = auth_client.post(
            "/api/uploads/photos", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 201
        photo = res.get_json()["photo"]
        assert photo["caption"] == "Beach sunset"
        assert photo["trip_id"] == trip_id

    def test_upload_photo_missing_trip_id(self, auth_client):
        data = {"file": _fake_image()}
        res = auth_client.post(
            "/api/uploads/photos", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 400

    def test_upload_photo_no_file(self, auth_client):
        trip_id = _get_trip_id(auth_client)
        res = auth_client.post(
            "/api/uploads/photos",
            data={"trip_id": str(trip_id)},
            content_type="multipart/form-data",
        )
        assert res.status_code == 400

    def test_upload_photo_invalid_format(self, auth_client):
        trip_id = _get_trip_id(auth_client)
        data = {"trip_id": str(trip_id), "file": (io.BytesIO(b"data"), "virus.exe")}
        res = auth_client.post(
            "/api/uploads/photos", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 400

    def test_upload_photo_trip_not_found(self, auth_client):
        data = {"trip_id": "9999", "file": _fake_image()}
        res = auth_client.post(
            "/api/uploads/photos", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 404

    def test_delete_photo_success(self, auth_client):
        trip_id = _get_trip_id(auth_client)
        data = {"trip_id": str(trip_id), "file": _fake_image()}
        upload_res = auth_client.post(
            "/api/uploads/photos", data=data, content_type="multipart/form-data"
        )
        photo_id = upload_res.get_json()["photo"]["id"]
        res = auth_client.delete(f"/api/uploads/photos/{photo_id}")
        assert res.status_code == 200

    def test_delete_photo_not_found(self, auth_client):
        res = auth_client.delete("/api/uploads/photos/9999")
        assert res.status_code == 404


# ═══════════════════════════════════════════════════════════
# Document Upload
# ═══════════════════════════════════════════════════════════


class TestDocumentUpload:
    def test_upload_document_success(self, auth_client):
        data = {"title": "Passport", "doc_type": "passport", "file": _fake_doc()}
        res = auth_client.post(
            "/api/uploads/documents", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 201
        doc = res.get_json()["document"]
        assert doc["title"] == "Passport"
        assert doc["doc_type"] == "passport"

    def test_upload_document_no_file(self, auth_client):
        res = auth_client.post(
            "/api/uploads/documents", data={}, content_type="multipart/form-data"
        )
        assert res.status_code == 400

    def test_upload_document_invalid_format(self, auth_client):
        data = {"file": (io.BytesIO(b"data"), "script.sh")}
        res = auth_client.post(
            "/api/uploads/documents", data=data, content_type="multipart/form-data"
        )
        assert res.status_code == 400

    def test_list_documents_empty(self, auth_client):
        res = auth_client.get("/api/uploads/documents")
        assert res.status_code == 200
        assert res.get_json()["documents"] == []

    def test_list_documents_after_upload(self, auth_client):
        data = {"title": "Visa", "file": _fake_doc()}
        auth_client.post(
            "/api/uploads/documents", data=data, content_type="multipart/form-data"
        )
        res = auth_client.get("/api/uploads/documents")
        docs = res.get_json()["documents"]
        assert len(docs) == 1

    def test_delete_document_success(self, auth_client):
        data = {"title": "Visa", "file": _fake_doc()}
        upload_res = auth_client.post(
            "/api/uploads/documents", data=data, content_type="multipart/form-data"
        )
        doc_id = upload_res.get_json()["document"]["id"]
        res = auth_client.delete(f"/api/uploads/documents/{doc_id}")
        assert res.status_code == 200
        remaining = auth_client.get("/api/uploads/documents").get_json()["documents"]
        assert len(remaining) == 0

    def test_delete_document_not_found(self, auth_client):
        res = auth_client.delete("/api/uploads/documents/9999")
        assert res.status_code == 404


# ═══════════════════════════════════════════════════════════
# Serve Files — ownership checks
# ═══════════════════════════════════════════════════════════


class TestServeFiles:
    def test_serve_photo_access_denied(self, auth_client):
        """Requesting a filename not owned by the user returns 403."""
        res = auth_client.get("/api/uploads/serve/photos/nonexistent.jpg")
        assert res.status_code == 403

    def test_serve_document_access_denied(self, auth_client):
        """Requesting a filename not owned by the user returns 403."""
        res = auth_client.get("/api/uploads/serve/documents/nonexistent.pdf")
        assert res.status_code == 403
