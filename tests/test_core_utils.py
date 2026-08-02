"""
Tests for app.utils.pagination, app.utils.api_error,
app.core.response, and app.core.exceptions
====================================================
Unit tests for pagination helpers and standardized API error/response types.
"""

import pytest

from app.utils.pagination import (
    PaginationParams,
    PaginatedResult,
    paginate_list,
)
from app.utils.api_error import (
    ApiError,
    bad_request,
    unauthorized,
    not_found,
    conflict,
    validation_error,
    rate_limited,
    internal_error,
    service_unavailable,
)
from app.core.response import (
    ErrorCode,
    ApiMeta,
    ApiError as CoreApiError,
    ApiResponse,
)
from app.core.exceptions import (
    AppException,
    ValidationError as CoreValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    RateLimitError,
    ExternalServiceError,
)

# ── PaginationParams ─────────────────────────────────────────────────


class TestPaginationParams:
    def test_defaults(self):
        params = PaginationParams()
        assert params.page == 1
        assert params.per_page == 20
        assert params.offset == 0
        assert params.limit == 20

    def test_offset(self):
        params = PaginationParams(page=3, per_page=25)
        assert params.offset == 50

    def test_from_request_defaults(self, app):
        with app.test_request_context("/"):
            params = PaginationParams.from_request(pytest.importorskip("flask").request)
            assert params.page == 1
            assert params.per_page == 20

    def test_from_request_values(self, app):
        with app.test_request_context("/?page=3&per_page=50"):
            from flask import request

            params = PaginationParams.from_request(request)
            assert params.page == 3
            assert params.per_page == 50

    def test_from_request_clamps(self, app):
        with app.test_request_context("/?page=0&per_page=1000"):
            from flask import request

            params = PaginationParams.from_request(request)
            assert params.page == 1
            assert params.per_page == 100

    def test_from_request_sort(self, app):
        with app.test_request_context("/?sort_by=name&sort_order=asc"):
            from flask import request

            params = PaginationParams.from_request(request)
            assert params.sort_by == "name"
            assert params.sort_order == "asc"


# ── PaginatedResult ──────────────────────────────────────────────────


class TestPaginatedResult:
    def test_total_pages(self):
        assert PaginatedResult(items=[], total=25, page=1, per_page=10).total_pages == 3

    def test_total_pages_zero_per_page(self):
        assert PaginatedResult(items=[], total=25, page=1, per_page=0).total_pages == 0

    def test_has_next(self):
        result = PaginatedResult(items=[], total=30, page=2, per_page=10)
        assert result.has_next is True
        assert result.has_prev is True

    def test_no_next_on_last_page(self):
        result = PaginatedResult(items=[], total=20, page=2, per_page=10)
        assert result.has_next is False

    def test_no_prev_on_first_page(self):
        result = PaginatedResult(items=[], total=50, page=1, per_page=10)
        assert result.has_prev is False

    def test_to_dict(self):
        result = PaginatedResult(items=[1, 2], total=2, page=1, per_page=10)
        d = result.to_dict()
        assert d["total_pages"] == 1
        assert d["has_next"] is False
        assert d["items"] == [1, 2]


# ── paginate_list ────────────────────────────────────────────────────


class TestPaginateList:
    def test_basic_pagination(self):
        result = paginate_list(list(range(25)), page=2, per_page=10)
        assert len(result.items) == 10
        assert result.total == 25
        assert result.page == 2

    def test_last_page_short(self):
        result = paginate_list(list(range(25)), page=3, per_page=10)
        assert result.items == list(range(20, 25))

    def test_out_of_range_page(self):
        result = paginate_list(list(range(10)), page=99, per_page=10)
        assert result.items == []


# ── ApiError (app.utils.api_error) ───────────────────────────────────


class TestApiError:
    def test_default_code_from_status(self):
        assert ApiError("x", 404).code == "not_found"
        assert ApiError("x", 429).code == "rate_limited"
        assert ApiError("x", 500).code == "internal_error"
        assert ApiError("x", 503).code == "service_unavailable"
        assert ApiError("x", 418).code == "error"

    def test_explicit_code(self):
        assert ApiError("x", 400, "custom").code == "custom"

    def test_retryable_flag(self):
        assert ApiError("x", 429, retryable=True).retryable is True

    def test_to_dict(self):
        d = ApiError("boom", 422, details=["a"]).to_dict()
        assert d == {
            "error": "validation_error",
            "message": "boom",
            "status": 422,
            "details": ["a"],
        }

    def test_to_dict_no_details(self):
        d = ApiError("boom", 400).to_dict()
        assert "details" not in d

    def test_to_response(self, app):
        with app.test_request_context("/"):
            resp = ApiError("nope", 404).to_response()
            assert resp[1] == 404
            assert resp[0].json["message"] == "nope"


class TestApiErrorFactories:
    def test_bad_request(self):
        e = bad_request("nope")
        assert e.status_code == 400 and e.code == "bad_request"

    def test_unauthorized(self):
        e = unauthorized()
        assert e.status_code == 401 and e.code == "unauthorized"

    def test_not_found(self):
        e = not_found()
        assert e.status_code == 404 and e.code == "not_found"

    def test_conflict(self):
        e = conflict()
        assert e.status_code == 409 and e.code == "conflict"

    def test_validation_error(self):
        e = validation_error()
        assert e.status_code == 422 and e.code == "validation_error"

    def test_rate_limited(self):
        e = rate_limited()
        assert e.status_code == 429 and e.retryable is True

    def test_internal_error(self):
        e = internal_error()
        assert e.status_code == 500 and e.code == "internal_error"

    def test_service_unavailable(self):
        e = service_unavailable()
        assert e.status_code == 503 and e.retryable is True


# ── app.core.response ────────────────────────────────────────────────


class TestCoreResponse:
    def test_apimeta_to_dict(self):
        meta = ApiMeta(page=2, per_page=10, total=25)
        d = meta.to_dict()
        assert d["page"] == 2
        assert d["total"] == 25

    def test_core_apierror_to_dict(self):
        e = CoreApiError("msg", ErrorCode.NOT_FOUND, details={"a": 1}, field="id")
        d = e.to_dict()
        assert d["code"] == "NOT_FOUND"
        assert d["details"] == {"a": 1}
        assert d["field"] == "id"

    def test_core_apierror_minimal(self):
        e = CoreApiError("msg", ErrorCode.UNAUTHORIZED)
        d = e.to_dict()
        assert d == {"message": "msg", "code": "UNAUTHORIZED"}

    def test_success(self, app):
        with app.test_request_context("/"):
            resp = ApiResponse.success(data={"a": 1})
            assert resp[1] == 200
            assert resp[0].json["success"] is True
            assert resp[0].json["data"] == {"a": 1}

    def test_created(self, app):
        with app.test_request_context("/"):
            assert ApiResponse.created({"a": 1})[1] == 201

    def test_no_content(self, app):
        with app.test_request_context("/"):
            resp = ApiResponse.no_content()
            assert resp[1] == 204

    def test_error(self, app):
        with app.test_request_context("/"):
            resp = ApiResponse.error("boom", ErrorCode.INTERNAL_ERROR, status=500)
            assert resp[1] == 500
            assert resp[0].json["success"] is False
            assert resp[0].json["error"]["code"] == "INTERNAL_ERROR"

    def test_validation_error(self, app):
        with app.test_request_context("/"):
            resp = ApiResponse.validation_error([{"field": "email"}])
            assert resp[1] == 400
            assert resp[0].json["error"]["details"] == {"errors": [{"field": "email"}]}

    def test_not_found_with_identifier(self, app):
        with app.test_request_context("/"):
            resp = ApiResponse.not_found("Trip", "abc")
            assert resp[0].json["error"]["message"] == "Trip with id 'abc' not found"

    def test_not_found_plain(self, app):
        with app.test_request_context("/"):
            resp = ApiResponse.not_found("Trip")
            assert resp[0].json["error"]["message"] == "Trip not found"

    def test_unauthorized(self, app):
        with app.test_request_context("/"):
            assert ApiResponse.unauthorized()[1] == 401

    def test_forbidden(self, app):
        with app.test_request_context("/"):
            assert ApiResponse.forbidden()[1] == 403

    def test_paginated(self, app):
        with app.test_request_context("/"):
            resp = ApiResponse.paginated([1, 2, 3], page=1, per_page=10, total=25)
            assert resp[0].json["meta"]["total_pages"] == 3
            assert resp[0].json["meta"]["has_next"] is True

    def test_paginated_empty(self, app):
        with app.test_request_context("/"):
            resp = ApiResponse.paginated([], page=1, per_page=10, total=0)
            assert resp[0].json["meta"]["total_pages"] == 0


# ── app.core.exceptions ──────────────────────────────────────────────


class TestCoreExceptions:
    def test_app_exception_base(self):
        e = AppException("boom")
        assert e.status == 500
        assert e.code == ErrorCode.INTERNAL_ERROR
        assert str(e) == "boom"

    def test_validation_error_exception(self):
        e = CoreValidationError([{"field": "x"}])
        assert e.status == 400
        assert e.code == ErrorCode.VALIDATION_ERROR
        assert e.errors == [{"field": "x"}]

    def test_not_found_exception(self):
        e = NotFoundError("Trip", "42")
        assert e.status == 404
        assert e.code == ErrorCode.NOT_FOUND
        assert e.message == "Trip with id '42' not found"

    def test_unauthorized_exception(self):
        e = UnauthorizedError()
        assert e.status == 401

    def test_forbidden_exception(self):
        e = ForbiddenError()
        assert e.status == 403

    def test_rate_limit_exception(self):
        e = RateLimitError(30)
        assert e.status == 429
        assert e.details == {"retry_after": 30}

    def test_external_service_exception(self):
        e = ExternalServiceError("weather", {"code": 503})
        assert e.status == 503
        assert e.code == ErrorCode.EXTERNAL_SERVICE_ERROR
