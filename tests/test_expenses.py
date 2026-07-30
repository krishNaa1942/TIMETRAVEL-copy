"""
Tests for Expenses API
========================
POST   /api/expenses          – Add expense
GET    /api/expenses          – List expenses
GET    /api/expenses/summary  – Summary by category
DELETE /api/expenses/<id>     – Delete expense
"""

import json
import pytest

from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db
from app.models.entities import User, Expense

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
    """Client with a logged-in user."""
    with app.app_context():
        user = User(name="Tester", email="test@example.com")
        user.set_password("password123")
        _db.session.add(user)
        _db.session.commit()
        client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "password123"},
        )
    return client


def _add_expense(client, **overrides):
    payload = {
        "destination": "Goa",
        "category": "food",
        "description": "Lunch at cafe",
        "amount": 500,
        "currency": "INR",
    }
    payload.update(overrides)
    return client.post("/api/expenses", json=payload)


# ═══════════════════════════════════════════════════════════
# Unauthenticated access
# ═══════════════════════════════════════════════════════════


class TestExpensesUnauth:
    def test_add_expense_unauth(self, client):
        res = _add_expense(client)
        assert res.status_code == 401

    def test_list_expenses_unauth(self, client):
        res = client.get("/api/expenses")
        assert res.status_code == 401

    def test_summary_unauth(self, client):
        res = client.get("/api/expenses/summary")
        assert res.status_code == 401

    def test_delete_expense_unauth(self, client):
        res = client.delete("/api/expenses/1")
        assert res.status_code == 401


# ═══════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════


class TestExpensesCRUD:
    def test_add_expense_success(self, auth_client):
        res = _add_expense(auth_client)
        assert res.status_code == 201
        data = res.get_json()
        assert data["expense"]["destination"] == "Goa"
        assert data["expense"]["amount"] == 500

    def test_add_expense_missing_fields(self, auth_client):
        res = auth_client.post("/api/expenses", json={"destination": "Goa"})
        assert res.status_code == 400

    def test_add_expense_invalid_amount(self, auth_client):
        res = _add_expense(auth_client, amount="abc")
        assert res.status_code == 400

    def test_add_expense_zero_amount(self, auth_client):
        res = _add_expense(auth_client, amount=0)
        assert res.status_code == 400

    def test_add_expense_negative_amount(self, auth_client):
        res = _add_expense(auth_client, amount=-10)
        assert res.status_code == 400

    def test_list_expenses_empty(self, auth_client):
        res = auth_client.get("/api/expenses")
        assert res.status_code == 200
        assert res.get_json()["expenses"] == []

    def test_list_expenses_after_add(self, auth_client):
        _add_expense(auth_client)
        _add_expense(auth_client, description="Dinner", amount=800)
        res = auth_client.get("/api/expenses")
        assert res.status_code == 200
        assert len(res.get_json()["expenses"]) == 2

    def test_list_expenses_filter_by_destination(self, auth_client):
        _add_expense(auth_client, destination="Goa")
        _add_expense(auth_client, destination="Delhi")
        res = auth_client.get("/api/expenses?destination=Goa")
        expenses = res.get_json()["expenses"]
        assert len(expenses) == 1
        assert expenses[0]["destination"] == "Goa"

    def test_delete_expense_success(self, auth_client):
        _add_expense(auth_client)
        expenses = auth_client.get("/api/expenses").get_json()["expenses"]
        eid = expenses[0]["id"]
        res = auth_client.delete(f"/api/expenses/{eid}")
        assert res.status_code == 200
        remaining = auth_client.get("/api/expenses").get_json()["expenses"]
        assert len(remaining) == 0

    def test_delete_expense_not_found(self, auth_client):
        res = auth_client.delete("/api/expenses/9999")
        assert res.status_code == 404


# ═══════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════


class TestExpenseSummary:
    def test_summary_empty(self, auth_client):
        res = auth_client.get("/api/expenses/summary")
        assert res.status_code == 200
        data = res.get_json()
        assert data["total"] == 0
        assert data["count"] == 0

    def test_summary_with_expenses(self, auth_client):
        _add_expense(auth_client, category="food", amount=500)
        _add_expense(auth_client, category="food", amount=300)
        _add_expense(auth_client, category="transport", amount=200)
        res = auth_client.get("/api/expenses/summary")
        data = res.get_json()
        assert data["total"] == 1000
        assert data["count"] == 3
        categories = {c["category"]: c for c in data["by_category"]}
        assert categories["food"]["total"] == 800
        assert categories["food"]["count"] == 2
        assert categories["transport"]["total"] == 200

    def test_summary_filter_by_destination(self, auth_client):
        _add_expense(auth_client, destination="Goa", amount=500)
        _add_expense(auth_client, destination="Delhi", amount=300)
        res = auth_client.get("/api/expenses/summary?destination=Goa")
        data = res.get_json()
        assert data["total"] == 500
        assert data["destination"] == "Goa"


# ═══════════════════════════════════════════════════════════
# Ownership isolation
# ═══════════════════════════════════════════════════════════


class TestExpenseOwnership:
    def test_cannot_delete_other_users_expense(self, app, client):
        """User B should not be able to delete User A's expense."""
        with app.app_context():
            user_a = User(name="A", email="a@example.com")
            user_a.set_password("password123")
            _db.session.add(user_a)
            _db.session.commit()

        client.post(
            "/api/auth/login",
            json={"email": "a@example.com", "password": "password123"},
        )
        _add_expense(client)
        expenses = client.get("/api/expenses").get_json()["expenses"]
        eid = expenses[0]["id"]
        client.post("/api/auth/logout")

        with app.app_context():
            user_b = User(name="B", email="b@example.com")
            user_b.set_password("password123")
            _db.session.add(user_b)
            _db.session.commit()

        client.post(
            "/api/auth/login",
            json={"email": "b@example.com", "password": "password123"},
        )
        res = client.delete(f"/api/expenses/{eid}")
        assert res.status_code == 403

    def test_cannot_see_other_users_expenses(self, app, client):
        """User B should not see User A's expenses."""
        with app.app_context():
            user_a = User(name="A", email="a@example.com")
            user_a.set_password("password123")
            _db.session.add(user_a)
            _db.session.commit()

        client.post(
            "/api/auth/login",
            json={"email": "a@example.com", "password": "password123"},
        )
        _add_expense(client)
        client.post("/api/auth/logout")

        with app.app_context():
            user_b = User(name="B", email="b@example.com")
            user_b.set_password("password123")
            _db.session.add(user_b)
            _db.session.commit()

        client.post(
            "/api/auth/login",
            json={"email": "b@example.com", "password": "password123"},
        )
        res = client.get("/api/expenses")
        assert res.get_json()["expenses"] == []
