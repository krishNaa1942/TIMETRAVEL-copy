"""
Standardized API Response Format
================================
All API responses follow a consistent envelope pattern.
"""

from typing import Any, Optional, Dict, List
from dataclasses import dataclass
from flask import jsonify
from enum import Enum


class ErrorCode(Enum):
    """Standard error codes for the API"""
    # Validation errors (1000-1999)
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_INPUT = "INVALID_INPUT"
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_FORMAT = "INVALID_FORMAT"
    
    # Authentication errors (2000-2999)
    UNAUTHORIZED = "UNAUTHORIZED"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    INVALID_TOKEN = "INVALID_TOKEN"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    
    # Authorization errors (3000-3999)
    FORBIDDEN = "FORBIDDEN"
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS"
    
    # Resource errors (4000-4999)
    NOT_FOUND = "NOT_FOUND"
    ALREADY_EXISTS = "ALREADY_EXISTS"
    RESOURCE_DELETED = "RESOURCE_DELETED"
    
    # Rate limiting (5000-5999)
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    
    # Server errors (9000-9999)
    INTERNAL_ERROR = "INTERNAL_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    TIMEOUT = "TIMEOUT"
    NETWORK_ERROR = "NETWORK_ERROR"


@dataclass
class ApiMeta:
    """Metadata for paginated responses"""
    page: int = 1
    per_page: int = 20
    total: int = 0
    total_pages: int = 0
    has_next: bool = False
    has_prev: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "page": self.page,
            "per_page": self.per_page,
            "total": self.total,
            "total_pages": self.total_pages,
            "has_next": self.has_next,
            "has_prev": self.has_prev,
        }


@dataclass
class ApiError:
    """Structured error response"""
    message: str
    code: ErrorCode
    details: Optional[Dict[str, Any]] = None
    field: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "message": self.message,
            "code": self.code.value,
        }
        if self.details:
            result["details"] = self.details
        if self.field:
            result["field"] = self.field
        return result


class ApiResponse:
    """
    Standardized API Response Builder.
    
    All responses follow this format:
    {
        "success": true/false,
        "data": {...} or [...],
        "error": null or {...},
        "meta": null or {...}
    }
    """
    
    @staticmethod
    def success(
        data: Any = None,
        meta: Optional[ApiMeta] = None,
        status: int = 200
    ) -> tuple:
        """Build a successful response"""
        response = {
            "success": True,
            "data": data,
            "error": None,
            "meta": meta.to_dict() if meta else None,
        }
        return jsonify(response), status
    
    @staticmethod
    def created(data: Any = None) -> tuple:
        """201 Created response"""
        return ApiResponse.success(data, status=201)
    
    @staticmethod
    def no_content() -> tuple:
        """204 No Content response"""
        return jsonify({"success": True}), 204
    
    @staticmethod
    def error(
        message: str,
        code: ErrorCode = ErrorCode.INTERNAL_ERROR,
        status: int = 500,
        details: Optional[Dict[str, Any]] = None,
        field: Optional[str] = None
    ) -> tuple:
        """Build an error response"""
        error = ApiError(
            message=message,
            code=code,
            details=details,
            field=field
        )
        response = {
            "success": False,
            "data": None,
            "error": error.to_dict(),
            "meta": None,
        }
        return jsonify(response), status
    
    @staticmethod
    def validation_error(errors: List[Dict[str, str]]) -> tuple:
        """400 Validation error response"""
        return ApiResponse.error(
            message="Validation failed",
            code=ErrorCode.VALIDATION_ERROR,
            status=400,
            details={"errors": errors}
        )
    
    @staticmethod
    def not_found(resource: str, identifier: Optional[str] = None) -> tuple:
        """404 Not Found response"""
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} with id '{identifier}' not found"
        return ApiResponse.error(
            message=message,
            code=ErrorCode.NOT_FOUND,
            status=404
        )
    
    @staticmethod
    def unauthorized(message: str = "Authentication required") -> tuple:
        """401 Unauthorized response"""
        return ApiResponse.error(
            message=message,
            code=ErrorCode.UNAUTHORIZED,
            status=401
        )
    
    @staticmethod
    def forbidden(message: str = "Permission denied") -> tuple:
        """403 Forbidden response"""
        return ApiResponse.error(
            message=message,
            code=ErrorCode.FORBIDDEN,
            status=403
        )
    
    @staticmethod
    def paginated(
        items: List[Any],
        page: int,
        per_page: int,
        total: int
    ) -> tuple:
        """Paginated list response"""
        total_pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        meta = ApiMeta(
            page=page,
            per_page=per_page,
            total=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        )
        return ApiResponse.success(data=items, meta=meta)