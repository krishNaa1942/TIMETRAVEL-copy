"""
Tests for app.models.validation (pydantic schemas)
====================================================
Unit tests for request/response validation models and decorators.
"""

from datetime import date

import pytest
from pydantic import ValidationError

from app.models.validation import (
    LoginRequest,
    RegisterRequest,
    PasswordResetRequest,
    UpdatePasswordRequest,
    DestinationInput,
    TripCreate,
    TripUpdate,
    TripQuery,
    ItineraryActivity,
    ItineraryDay,
    ItineraryCreate,
    BudgetItem,
    BudgetCreate,
    RecommendationRequest,
    SearchRequest,
    ErrorResponse,
    SuccessResponse,
    PaginatedResponse,
    validate_request,
    validate_query_params,
    TripStatus,
    Currency,
)

# ── LoginRequest ─────────────────────────────────────────────────────


class TestLoginRequest:
    def test_valid_login(self):
        req = LoginRequest(email="  User@Example.com  ", password="Str0ng!Pass")
        assert req.email == "user@example.com"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="not-an-email", password="Str0ng!Pass")

    def test_short_password(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="a@b.co", password="short")

    def test_missing_fields(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="a@b.co")


# ── RegisterRequest ──────────────────────────────────────────────────


class TestRegisterRequest:
    def test_valid_register(self):
        req = RegisterRequest(
            email="New@Example.com", password="Str0ng!Pass1", name="  Alice  "
        )
        assert req.email == "new@example.com"
        assert req.name == "Alice"

    def test_password_needs_uppercase(self):
        with pytest.raises(ValidationError):
            RegisterRequest(email="a@b.co", password="strongpass1", name="Alice")

    def test_password_needs_lowercase(self):
        with pytest.raises(ValidationError):
            RegisterRequest(email="a@b.co", password="STRONGPASS1", name="Alice")

    def test_password_needs_digit(self):
        with pytest.raises(ValidationError):
            RegisterRequest(email="a@b.co", password="StrongPass", name="Alice")

    def test_short_name(self):
        with pytest.raises(ValidationError):
            RegisterRequest(email="a@b.co", password="Str0ng!Pass", name="A")


# ── Password / UpdatePassword ────────────────────────────────────────


class TestPasswordRequests:
    def test_valid_password_reset(self):
        assert PasswordResetRequest(email="a@b.co").email == "a@b.co"

    def test_invalid_reset_email(self):
        with pytest.raises(ValidationError):
            PasswordResetRequest(email="nope")

    def test_valid_update_password(self):
        req = UpdatePasswordRequest(
            current_password="Old!Pass1", new_password="New!Pass2"
        )
        assert req.new_password == "New!Pass2"

    def test_weak_new_password(self):
        with pytest.raises(ValidationError):
            UpdatePasswordRequest(current_password="Old!Pass1", new_password="weak")


# ── DestinationInput / TripCreate / TripUpdate ───────────────────────


class TestTripModels:
    def test_valid_destination(self):
        d = DestinationInput(name="  Goa  ", country="India", city="Panaji")
        assert d.name == "Goa"

    def test_destination_lat_bounds(self):
        with pytest.raises(ValidationError):
            DestinationInput(name="X", country="Y", latitude=91)

    def test_valid_trip_create(self):
        t = TripCreate(
            name="Goa Trip",
            destinations=[{"name": "Goa", "country": "India"}],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 10),
        )
        assert t.currency == Currency.USD
        assert t.travelers == 1
        assert t.status == TripStatus.PLANNING

    def test_trip_dates_reversed_rejected(self):
        with pytest.raises(ValidationError):
            TripCreate(
                name="Bad Trip",
                destinations=[{"name": "Goa", "country": "India"}],
                start_date=date(2026, 1, 10),
                end_date=date(2026, 1, 1),
            )

    def test_trip_requires_destination(self):
        with pytest.raises(ValidationError):
            TripCreate(
                name="Empty",
                destinations=[],
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 2),
            )

    def test_trip_tags_normalized(self):
        t = TripCreate(
            name="Goa Trip",
            destinations=[{"name": "Goa", "country": "India"}],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 2),
            tags=["  BEACH ", "", "HISTORY "],
        )
        assert t.tags == ["beach", "history"]

    def test_trip_budget_negative_rejected(self):
        with pytest.raises(ValidationError):
            TripCreate(
                name="Goa",
                destinations=[{"name": "Goa", "country": "India"}],
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 2),
                budget=-5,
            )

    def test_trip_travelers_range(self):
        with pytest.raises(ValidationError):
            TripCreate(
                name="Goa",
                destinations=[{"name": "Goa", "country": "India"}],
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 2),
                travelers=51,
            )

    def test_trip_update_allows_partial(self):
        t = TripUpdate(name="Renamed")
        assert t.name == "Renamed"

    def test_trip_update_date_check(self):
        with pytest.raises(ValidationError):
            TripUpdate(start_date=date(2026, 5, 1), end_date=date(2026, 4, 1))


# ── TripQuery ────────────────────────────────────────────────────────


class TestTripQuery:
    def test_defaults(self):
        q = TripQuery()
        assert q.page == 1
        assert q.limit == 20
        assert q.sort_by == "created_at"
        assert q.sort_order == "desc"

    def test_budget_range_validation(self):
        with pytest.raises(ValidationError):
            TripQuery(budget_min=500, budget_max=100)

    def test_bad_sort_by(self):
        with pytest.raises(ValidationError):
            TripQuery(sort_by="hacker")

    def test_bad_sort_order(self):
        with pytest.raises(ValidationError):
            TripQuery(sort_order="sideways")

    def test_limit_cap(self):
        with pytest.raises(ValidationError):
            TripQuery(limit=1000)

    def test_status_enum(self):
        q = TripQuery(status="booked")
        assert q.status == TripStatus.BOOKED


# ── Itinerary models ─────────────────────────────────────────────────


class TestItineraryModels:
    def test_valid_activity(self):
        a = ItineraryActivity(title="Visit fort", start_time="09:30")
        assert a.start_time == "09:30"

    def test_invalid_time_format(self):
        with pytest.raises(ValidationError):
            ItineraryActivity(title="X", start_time="25:99")

    def test_invalid_booking_url(self):
        with pytest.raises(ValidationError):
            ItineraryActivity(title="X", booking_url="ftp://bad.example")

    def test_valid_day(self):
        day = ItineraryDay(
            date=date(2026, 1, 1),
            activities=[{"title": "Beach"}],
        )
        assert len(day.activities) == 1

    def test_valid_itinerary_create(self):
        it = ItineraryCreate(
            trip_id="t1",
            days=[{"date": "2026-01-01", "activities": [{"title": "Visit"}]}],
        )
        assert it.trip_id == "t1"

    def test_itinerary_requires_days(self):
        with pytest.raises(ValidationError):
            ItineraryCreate(trip_id="t1", days=[])


# ── Budget models ────────────────────────────────────────────────────


class TestBudgetModels:
    def test_valid_budget_item(self):
        b = BudgetItem(category="  FOOD ", name="Lunch", amount=250.0)
        assert b.category == "food"

    def test_invalid_category(self):
        with pytest.raises(ValidationError):
            BudgetItem(category="drugs", name="X", amount=1)

    def test_negative_amount(self):
        with pytest.raises(ValidationError):
            BudgetItem(category="food", name="X", amount=-1)

    def test_valid_budget_create(self):
        b = BudgetCreate(
            trip_id="t1",
            total_budget=1000.0,
            items=[{"category": "food", "name": "Lunch", "amount": 100}],
        )
        assert b.total_budget == 1000.0


# ── Recommendation / Search ──────────────────────────────────────────


class TestRecommendationModels:
    def test_valid_recommendation(self):
        r = RecommendationRequest(user_id="u1", limit=5)
        assert r.limit == 5

    def test_limit_bounds(self):
        with pytest.raises(ValidationError):
            RecommendationRequest(user_id="u1", limit=100)

    def test_travel_dates_order(self):
        with pytest.raises(ValidationError):
            RecommendationRequest(
                user_id="u1",
                travel_dates=[date(2026, 2, 1), date(2026, 1, 1)],
            )

    def test_search_sanitizes_query(self):
        s = SearchRequest(query='<script>"hello"')
        assert "<" not in s.query
        assert '"' not in s.query
        assert s.query == "scripthello"

    def test_search_type_restricted(self):
        with pytest.raises(ValidationError):
            SearchRequest(query="hi", type="video")

    def test_search_page_bounds(self):
        with pytest.raises(ValidationError):
            SearchRequest(query="hi", limit=500)


# ── Response models ──────────────────────────────────────────────────


class TestResponseModels:
    def test_error_response_defaults(self):
        e = ErrorResponse(error="x", message="y")
        assert e.timestamp is not None

    def test_success_response(self):
        s = SuccessResponse(message="ok", data={"a": 1})
        assert s.success is True

    def test_paginated_has_more_recomputed(self):
        p = PaginatedResponse(items=[1, 2], total=10, page=1, limit=2, has_more=False)
        assert p.has_more is True  # recomputed: (1*2) < 10

    def test_paginated_no_more(self):
        p = PaginatedResponse(items=[], total=2, page=2, limit=2, has_more=True)
        assert p.has_more is False


# ── validate_request / validate_query_params decorators ──────────────


class TestValidateDecorators:
    def test_validate_request_success(self, app):
        with app.test_request_context(
            json={"email": "a@b.co", "password": "Str0ng!Pass"}
        ):
            resp = validate_request(LoginRequest)(lambda validated_data: "ok")()
            assert resp == "ok"

    def test_validate_request_failure(self, app):
        with app.test_request_context(json={"email": "bad", "password": "short"}):
            resp = validate_request(LoginRequest)(lambda validated_data: "ok")()
            assert resp[1] == 400
            assert resp[0].json["error"] == "Validation error"

    def test_validate_request_empty_body(self, app):
        with app.test_request_context():
            resp = validate_request(LoginRequest)(lambda validated_data: "ok")()
            assert resp[1] == 400

    def test_validate_query_params_success(self, app):
        with app.test_request_context(query_string="page=2&limit=30&sort_order=asc"):
            resp = validate_query_params(TripQuery)(lambda validated_params: "ok")()
            assert resp == "ok"

    def test_validate_query_params_failure(self, app):
        with app.test_request_context(query_string="sort_by=injection"):
            resp = validate_query_params(TripQuery)(lambda validated_params: "ok")()
            assert resp[1] == 400
