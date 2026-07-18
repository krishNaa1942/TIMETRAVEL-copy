"""
Rate Limiting Middleware
Production-grade rate limiting for API endpoints
"""

import time
from typing import Dict, Optional, Callable, Any
from dataclasses import dataclass, field
from functools import wraps
import threading
import logging

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Rate limit configuration"""
    requests: int
    window_seconds: int
    key_prefix: str = ""
    
    @property
    def requests_per_second(self) -> float:
        return self.requests / self.window_seconds


@dataclass
class RateLimitEntry:
    """Rate limit tracking entry"""
    timestamps: list = field(default_factory=list)
    blocked_until: float = 0


class InMemoryRateLimiter:
    """
    In-memory rate limiter with sliding window.
    
    Features:
    - Sliding window algorithm
    - Per-key rate limiting
    - Automatic cleanup
    - Thread-safe
    """
    
    def __init__(self):
        self._entries: Dict[str, RateLimitEntry] = {}
        self._lock = threading.Lock()
        self._cleanup_interval = 3600  # 1 hour
        self._last_cleanup = time.time()
    
    def is_allowed(
        self,
        key: str,
        max_requests: int,
        window_seconds: int
    ) -> Dict[str, Any]:
        """
        Check if a request is allowed under rate limiting.
        
        Args:
            key: Unique identifier (e.g., IP + user ID)
            max_requests: Maximum requests allowed
            window_seconds: Time window in seconds
            
        Returns:
            Dictionary with allowed status and metadata
        """
        with self._lock:
            now = time.time()
            window_start = now - window_seconds
            
            # Get or create entry
            if key not in self._entries:
                self._entries[key] = RateLimitEntry()
            
            entry = self._entries[key]
            
            # Check if blocked
            if entry.blocked_until > now:
                return {
                    "allowed": False,
                    "retry_after": int(entry.blocked_until - now),
                    "remaining": 0,
                    "reset_at": int(entry.blocked_until)
                }
            
            # Clean old timestamps
            entry.timestamps = [
                ts for ts in entry.timestamps
                if ts > window_start
            ]
            
            # Check limit
            if len(entry.timestamps) >= max_requests:
                # Block for the remaining window time
                oldest = min(entry.timestamps) if entry.timestamps else now
                entry.blocked_until = oldest + window_seconds
                
                return {
                    "allowed": False,
                    "retry_after": int(entry.blocked_until - now),
                    "remaining": 0,
                    "reset_at": int(entry.blocked_until)
                }
            
            # Add timestamp
            entry.timestamps.append(now)
            
            # Periodic cleanup
            if now - self._last_cleanup > self._cleanup_interval:
                self._cleanup()
            
            return {
                "allowed": True,
                "retry_after": 0,
                "remaining": max_requests - len(entry.timestamps),
                "reset_at": int(now + window_seconds)
            }
    
    def _cleanup(self):
        """Remove old entries"""
        now = time.time()
        keys_to_remove = []
        
        for key, entry in self._entries.items():
            # Remove if no timestamps in last hour
            if not entry.timestamps or entry.timestamps[-1] < now - 3600:
                if entry.blocked_until < now:
                    keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self._entries[key]
        
        self._last_cleanup = now
        logger.debug(f"Cleaned up {len(keys_to_remove)} rate limit entries")
    
    def reset(self, key: str):
        """Reset rate limit for a key"""
        with self._lock:
            if key in self._entries:
                del self._entries[key]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get rate limiter statistics"""
        with self._lock:
            return {
                "total_keys": len(self._entries),
                "blocked_keys": sum(
                    1 for e in self._entries.values()
                    if e.blocked_until > time.time()
                )
            }


class RedisRateLimiter:
    """
    Redis-based rate limiter for distributed systems.
    
    Requires Redis server for multi-instance deployments.
    """
    
    def __init__(self, redis_client, key_prefix: str = "ratelimit:"):
        self.redis = redis_client
        self.key_prefix = key_prefix
    
    def is_allowed(
        self,
        key: str,
        max_requests: int,
        window_seconds: int
    ) -> Dict[str, Any]:
        """Check rate limit using Redis"""
        import redis  # Lazy import
        
        redis_key = f"{self.key_prefix}{key}"
        now = time.time()
        window_start = now - window_seconds
        
        try:
            # Use Redis transaction
            pipe = self.redis.pipeline()
            
            # Remove old entries
            pipe.zremrangebyscore(redis_key, 0, window_start)
            
            # Get current count
            pipe.zcard(redis_key)
            
            # Execute
            results = pipe.execute()
            current_count = results[1]
            
            if current_count >= max_requests:
                # Get oldest timestamp for retry_after
                oldest = self.redis.zrange(redis_key, 0, 0, withscores=True)
                if oldest:
                    retry_after = int(oldest[0][1] + window_seconds - now)
                else:
                    retry_after = window_seconds
                
                return {
                    "allowed": False,
                    "retry_after": max(1, retry_after),
                    "remaining": 0,
                    "reset_at": int(now + retry_after)
                }
            
            # Add new timestamp
            self.redis.zadd(redis_key, {str(now): now})
            self.redis.expire(redis_key, window_seconds)
            
            return {
                "allowed": True,
                "retry_after": 0,
                "remaining": max_requests - current_count - 1,
                "reset_at": int(now + window_seconds)
            }
            
        except redis.RedisError as e:
            logger.error(f"Redis rate limiter error: {e}")
            # Fail open on Redis error
            return {
                "allowed": True,
                "retry_after": 0,
                "remaining": max_requests,
                "reset_at": int(now + window_seconds)
            }


# Rate limit configurations
RATE_LIMITS = {
    # Authentication endpoints - stricter limits
    "auth_login": RateLimitConfig(10, 60, "auth:login"),  # 10 per minute
    "auth_register": RateLimitConfig(5, 3600, "auth:register"),  # 5 per hour
    "auth_refresh": RateLimitConfig(30, 60, "auth:refresh"),  # 30 per minute
    "auth_forgot_password": RateLimitConfig(3, 3600, "auth:forgot"),  # 3 per hour
    
    # API endpoints - moderate limits
    "api_general": RateLimitConfig(100, 60, "api"),  # 100 per minute
    "api_search": RateLimitConfig(30, 60, "api:search"),  # 30 per minute
    "api_write": RateLimitConfig(50, 60, "api:write"),  # 50 per minute
    
    # AI endpoints - expensive operations
    "ai_recommendations": RateLimitConfig(30, 3600, "ai:rec"),  # 30 per hour
    "ai_chat": RateLimitConfig(50, 3600, "ai:chat"),  # 50 per hour
    "ai_itinerary": RateLimitConfig(20, 3600, "ai:itinerary"),  # 20 per hour
    
    # Upload endpoints
    "upload_image": RateLimitConfig(20, 3600, "upload"),  # 20 per hour
    "upload_document": RateLimitConfig(10, 3600, "upload:doc"),  # 10 per hour
}

# Default limiter instance
limiter = InMemoryRateLimiter()


def get_client_key(request) -> str:
    """
    Get unique client key for rate limiting.
    
    Combines IP address and user ID if authenticated.
    """
    # Get IP address
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if isinstance(ip, list):
        ip = ip[0]
    elif "," in ip:
        ip = ip.split(",")[0].strip()
    
    # Get user ID if authenticated
    user_id = getattr(request, "user_id", None)
    
    if user_id:
        return f"{ip}:{user_id}"
    return str(ip)


def rate_limit(
    config_name: str,
    key_func: Optional[Callable] = None
):
    """
    Rate limit decorator for Flask routes.
    
    Usage:
        @app.route('/api/endpoint')
        @rate_limit('api_general')
        def my_endpoint():
            return {"status": "ok"}
    
    Args:
        config_name: Name of rate limit config
        key_func: Optional function to generate rate limit key
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get rate limit config
            config = RATE_LIMITS.get(config_name)
            if not config:
                logger.warning(f"Unknown rate limit config: {config_name}")
                return f(*args, **kwargs)
            
            # Get key
            from flask import request
            key = key_func(request) if key_func else get_client_key(request)
            key = f"{config.key_prefix}:{key}"
            
            # Check rate limit
            result = limiter.is_allowed(
                key,
                config.requests,
                config.window_seconds
            )
            
            if not result["allowed"]:
                from flask import jsonify, make_response
                response = make_response(jsonify({
                    "error": "Rate limit exceeded",
                    "retry_after": result["retry_after"]
                }), 429)
                response.headers["Retry-After"] = str(result["retry_after"])
                response.headers["X-RateLimit-Limit"] = str(config.requests)
                response.headers["X-RateLimit-Remaining"] = "0"
                response.headers["X-RateLimit-Reset"] = str(result["reset_at"])
                return response
            
            # Add rate limit headers
            from flask import g
            g.rate_limit_remaining = result["remaining"]
            g.rate_limit_reset = result["reset_at"]
            g.rate_limit_limit = config.requests
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def add_rate_limit_headers(response):
    """Add rate limit headers to response"""
    from flask import g
    
    if hasattr(g, 'rate_limit_limit'):
        response.headers["X-RateLimit-Limit"] = str(g.rate_limit_limit)
        response.headers["X-RateLimit-Remaining"] = str(g.rate_limit_remaining)
        response.headers["X-RateLimit-Reset"] = str(g.rate_limit_reset)
    
    return response


# Export
__all__ = [
    "RateLimiter",
    "InMemoryRateLimiter",
    "RedisRateLimiter",
    "RateLimitConfig",
    "RateLimitEntry",
    "rate_limit",
    "get_client_key",
    "add_rate_limit_headers",
    "RATE_LIMITS",
    "limiter"
]