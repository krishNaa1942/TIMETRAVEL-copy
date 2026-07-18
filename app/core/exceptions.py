"""
Custom Exception Classes
========================
Structured exceptions for consistent error handling.
"""

from app.core.response import ErrorCode


class AppException(Exception):
    """Base exception for all application errors"""
    
    def __init__(
        self,
        message: str,
        code: ErrorCode = ErrorCode.INTERNAL_ERROR,
        status: int = 500,
        details: dict = None
    ):
        self.message = message
        self.code = code
        self.status = status
        self.details = details
        super().__init__(self.message)


class ValidationError(AppException):
    """Validation error with field details"""
    
    def __init__(self, errors: list):
        self.errors = errors
        super().__init__(
            message="Validation failed",
            code=ErrorCode.VALIDATION_ERROR,
            status=400,
            details={"errors": errors}
        )


class NotFoundError(AppException):
    """Resource not found"""
    
    def __init__(self, resource: str, identifier: str = None):
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} with id '{identifier}' not found"
        super().__init__(
            message=message,
            code=ErrorCode.NOT_FOUND,
            status=404
        )


class UnauthorizedError(AppException):
    """Authentication required"""
    
    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            code=ErrorCode.UNAUTHORIZED,
            status=401
        )


class ForbiddenError(AppException):
    """Permission denied"""
    
    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            message=message,
            code=ErrorCode.FORBIDDEN,
            status=403
        )


class RateLimitError(AppException):
    """Rate limit exceeded"""
    
    def __init__(self, retry_after: int):
        super().__init__(
            message="Rate limit exceeded. Please try again later.",
            code=ErrorCode.RATE_LIMIT_EXCEEDED,
            status=429,
            details={"retry_after": retry_after}
        )


class ExternalServiceError(AppException):
    """External service failure"""
    
    def __init__(self, service: str, details: dict = None):
        super().__init__(
            message=f"{service} service is temporarily unavailable",
            code=ErrorCode.EXTERNAL_SERVICE_ERROR,
            status=503,
            details=details
        )