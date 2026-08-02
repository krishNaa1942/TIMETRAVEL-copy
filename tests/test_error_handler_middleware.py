"""
Tests for app.api.middleware.error_handler
============================================
Unit tests for the central error handler middleware.
"""

import pytest

from app.core.exceptions import AppException, ValidationError, NotFoundError
from app.core.response import ErrorCode
from app.api.middleware.error_handler import ErrorHandler


def _make_app():
    from flask import Flask, jsonify

    app = Flask(__name__)
    app.config["TESTING"] = True
    ErrorHandler.init_app(app)

    @app.route("/boom-app")
    def boom_app():
        raise AppException("custom failure", ErrorCode.DATABASE_ERROR, status=500)

    @app.route("/boom-validation")
    def boom_validation():
        raise ValidationError([{"field": "email", "message": "invalid"}])

    @app.route("/boom-404")
    def boom_404():
        raise NotFoundError("Trip")

    @app.route("/boom-generic")
    def boom_generic():
        raise RuntimeError("unexpected thing happened")

    @app.route("/ok")
    def ok():
        return jsonify({"success": True})

    return app


class TestErrorHandler:
    @pytest.fixture
    def app(self):
        return _make_app()

    def test_app_exception_formatted(self, app):
        client = app.test_client()
        resp = client.get("/boom-app")
        assert resp.status_code == 500
        body = resp.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "DATABASE_ERROR"
        assert body["error"]["message"] == "custom failure"

    def test_validation_error_formatted(self, app):
        client = app.test_client()
        resp = client.get("/boom-validation")
        assert resp.status_code == 400
        body = resp.get_json()
        assert body["error"]["code"] == "VALIDATION_ERROR"
        assert body["error"]["details"]["errors"] == [
            {"field": "email", "message": "invalid"}
        ]

    def test_not_found_formatted(self, app):
        client = app.test_client()
        resp = client.get("/boom-404")
        assert resp.status_code == 404
        assert resp.get_json()["error"]["message"] == "Trip not found"

    def test_flask_404_handler(self, app):
        client = app.test_client()
        resp = client.get("/does-not-exist")
        assert resp.status_code == 404
        assert resp.get_json()["error"]["code"] == "NOT_FOUND"

    def test_generic_exception_hidden_from_client(self, app):
        client = app.test_client()
        resp = client.get("/boom-generic")
        assert resp.status_code == 500
        body = resp.get_json()
        assert "unexpected thing happened" not in str(body["error"]["message"])

    def test_healthy_endpoint_untouched(self, app):
        client = app.test_client()
        resp = client.get("/ok")
        assert resp.status_code == 200
        assert resp.get_json() == {"success": True}
