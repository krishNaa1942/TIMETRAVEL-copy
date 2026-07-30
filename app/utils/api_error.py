"""
Shared API error type for consistent error handling across all routes and clients.

All API routes should return errors using these types so that mobile clients
get a consistent error shape regardless of which endpoint they hit.
"""

from typing import Optional


class ApiError:
    """Standardized API error response.

    Usage:
        return jsonify(ApiError("Not found", 404).to_dict()), 404
    """

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        code: Optional[str] = None,
        details: Optional[list] = None,
        retryable: bool = False,
    ):
        self.message = message
        self.status_code = status_code
        self.code = code or _code_from_status(status_code)
        self.details = details or []
        self.retryable = retryable

    def to_dict(self) -> dict:
        result = {
            "error": self.code,
            "message": self.message,
            "status": self.status_code,
        }
        if self.details:
            result["details"] = self.details
        return result

    def to_response(self):
        from flask import jsonify
        return jsonify(self.to_dict()), self.status_code


def _code_from_status(status: int) -> str:
    if status == 400:
        return "bad_request"
    if status == 401:
        return "unauthorized"
    if status == 403:
        return "forbidden"
    if status == 404:
        return "not_found"
    if status == 409:
        return "conflict"
    if status == 422:
        return "validation_error"
    if status == 429:
        return "rate_limited"
    if status == 500:
        return "internal_error"
    if status == 503:
        return "service_unavailable"
    return "error"


# Convenience factories
def bad_request(message: str = "Bad request", details: Optional[list] = None) -> ApiError:
    return ApiError(message, 400, "bad_request", details)


def unauthorized(message: str = "Authentication required") -> ApiError:
    return ApiError(message, 401, "unauthorized")


def not_found(message: str = "Resource not found") -> ApiError:
    return ApiError(message, 404, "not_found")


def conflict(message: str = "Resource already exists") -> ApiError:
    return ApiError(message, 409, "conflict")


def validation_error(message: str = "Validation failed", details: Optional[list] = None) -> ApiError:
    return ApiError(message, 422, "validation_error", details)


def rate_limited(message: str = "Rate limit exceeded") -> ApiError:
    return ApiError(message, 429, "rate_limited", retryable=True)


def internal_error(message: str = "Internal server error") -> ApiError:
    return ApiError(message, 500, "internal_error")


def service_unavailable(message: str = "Service temporarily unavailable") -> ApiError:
    return ApiError(message, 503, "service_unavailable", retryable=True)
