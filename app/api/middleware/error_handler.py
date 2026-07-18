"""
Central Error Handler Middleware
================================
Provides consistent error handling across all API endpoints.
"""

from flask import Flask, request
import logging
import traceback

from app.core.response import ApiResponse, ErrorCode
from app.core.exceptions import (
    AppException,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    RateLimitError,
)

logger = logging.getLogger(__name__)


class ErrorHandler:
    """Central error handling for the API"""
    
    @staticmethod
    def init_app(app: Flask):
        """Register error handlers with Flask app"""
        
        @app.errorhandler(AppException)
        def handle_app_exception(error: AppException):
            """Handle custom application exceptions"""
            logger.warning(
                f"AppException: {error.code.value} - {error.message}",
                extra={
                    "path": request.path,
                    "method": request.method,
                    "error_code": error.code.value,
                }
            )
            return ApiResponse.error(
                message=error.message,
                code=error.code,
                status=error.status,
                details=error.details,
            )
        
        @app.errorhandler(ValidationError)
        def handle_validation_error(error: ValidationError):
            """Handle validation errors"""
            return ApiResponse.validation_error(error.errors)
        
        @app.errorhandler(404)
        def handle_not_found(error):
            """Handle 404 errors"""
            return ApiResponse.not_found("Endpoint", request.path)
        
        @app.errorhandler(500)
        def handle_internal_error(error):
            """Handle 500 errors"""
            logger.error(
                f"Internal Server Error: {str(error)}",
                extra={
                    "path": request.path,
                    "method": request.method,
                    "traceback": traceback.format_exc(),
                }
            )
            return ApiResponse.error(
                message="An unexpected error occurred",
                code=ErrorCode.INTERNAL_ERROR,
                status=500,
            )
        
        @app.errorhandler(Exception)
        def handle_unexpected_error(error):
            """Handle any unexpected exceptions"""
            logger.error(
                f"Unexpected Error: {type(error).__name__}: {str(error)}",
                extra={
                    "path": request.path,
                    "method": request.method,
                    "traceback": traceback.format_exc(),
                }
            )
            # Don't leak internal errors to client
            return ApiResponse.error(
                message="An unexpected error occurred",
                code=ErrorCode.INTERNAL_ERROR,
                status=500,
            )