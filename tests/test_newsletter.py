"""
Tests for newsletter API endpoint.
"""

import pytest
from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db


@pytest.fixture
def app():
    _app = create_app(config_class=TestingConfig)
    yield _app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def setup_db(app):
    with app.app_context():
        _db.create_all()
        yield
        _db.session.rollback()
        _db.drop_all()


class TestNewsletterSubscribe:
    def test_subscribe_success(self, client):
        resp = client.post("/api/newsletter", json={"email": "test@example.com"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert "Thanks" in data["message"]

    def test_subscribe_no_body(self, client):
        resp = client.post("/api/newsletter", data="", content_type="application/json")
        assert resp.status_code == 400

    def test_subscribe_no_email(self, client):
        resp = client.post("/api/newsletter", json={"name": "Test"})
        assert resp.status_code == 400
        assert "required" in resp.get_json()["error"].lower()

    def test_subscribe_invalid_email(self, client):
        resp = client.post("/api/newsletter", json={"email": "not-an-email"})
        assert resp.status_code == 400
        assert "valid" in resp.get_json()["error"].lower()

    def test_subscribe_email_too_long(self, client):
        long_email = "a" * 250 + "@b.com"
        resp = client.post("/api/newsletter", json={"email": long_email})
        assert resp.status_code == 400
        assert "long" in resp.get_json()["error"].lower()

    def test_subscribe_duplicate(self, client):
        email = "dupe@example.com"
        client.post("/api/newsletter", json={"email": email})
        resp = client.post("/api/newsletter", json={"email": email})
        assert resp.status_code == 200
        assert "already" in resp.get_json()["message"].lower()

    def test_subscribe_normalises_email(self, client):
        resp = client.post("/api/newsletter", json={"email": "  Test@Example.COM  "})
        assert resp.status_code == 201

    def test_subscribe_empty_email(self, client):
        resp = client.post("/api/newsletter", json={"email": ""})
        assert resp.status_code == 400
