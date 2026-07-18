"""
API Middleware Module
=====================
Contains middleware for error handling, rate limiting, etc.
"""

from app.api.middleware.error_handler import ErrorHandler

__all__ = ["ErrorHandler"]