"""
Cache Service
Production-grade caching layer with Redis support and in-memory fallback
"""

import os
import json
import logging
import hashlib
import threading
import asyncio
from typing import Any, Dict, List, Optional, Union, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import wraps
import pickle

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    key: str
    value: Any
    created_at: datetime
    expires_at: Optional[datetime]
    ttl: int  # seconds
    hits: int = 0
    size_bytes: int = 0


class InMemoryCache:
    """
    Thread-safe in-memory cache with TTL support.
    Used as fallback when Redis is not available.
    """
    
    def __init__(self, max_size: int = 10000, default_ttl: int = 3600):
        """
        Initialize in-memory cache.
        
        Args:
            max_size: Maximum number of entries
            default_ttl: Default TTL in seconds
        """
        self._cache: Dict[str, CacheEntry] = {}
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0
        
        logger.info(f"In-memory cache initialized (max_size={max_size}, default_ttl={default_ttl}s)")
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        with self._lock:
            entry = self._cache.get(key)
            
            if entry is None:
                self._misses += 1
                return None
            
            # Check expiration
            if entry.expires_at and datetime.utcnow() > entry.expires_at:
                del self._cache[key]
                self._misses += 1
                return None
            
            entry.hits += 1
            self._hits += 1
            return entry.value
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: int = None
    ) -> bool:
        """Set value in cache."""
        with self._lock:
            # Evict if at capacity
            if len(self._cache) >= self._max_size and key not in self._cache:
                self._evict_oldest()
            
            ttl = ttl or self._default_ttl
            expires_at = datetime.utcnow() + timedelta(seconds=ttl) if ttl else None
            
            # Estimate size
            try:
                size_bytes = len(pickle.dumps(value))
            except:
                size_bytes = 0
            
            entry = CacheEntry(
                key=key,
                value=value,
                created_at=datetime.utcnow(),
                expires_at=expires_at,
                ttl=ttl,
                size_bytes=size_bytes
            )
            
            self._cache[key] = entry
            return True
    
    def delete(self, key: str) -> bool:
        """Delete value from cache."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    def exists(self, key: str) -> bool:
        """Check if key exists."""
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return False
            
            # Check expiration
            if entry.expires_at and datetime.utcnow() > entry.expires_at:
                del self._cache[key]
                return False
            
            return True
    
    def clear(self) -> int:
        """Clear all cache entries."""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            return count
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            total_requests = self._hits + self._misses
            hit_rate = (self._hits / total_requests * 100) if total_requests > 0 else 0
            
            total_size = sum(e.size_bytes for e in self._cache.values())
            
            return {
                "entries": len(self._cache),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(hit_rate, 2),
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2)
            }
    
    def _evict_oldest(self):
        """Evict oldest entries to make room."""
        if not self._cache:
            return
        
        # Sort by created_at and remove oldest 10%
        sorted_entries = sorted(
            self._cache.items(),
            key=lambda x: x[1].created_at
        )
        
        to_remove = max(1, len(sorted_entries) // 10)
        for key, _ in sorted_entries[:to_remove]:
            del self._cache[key]
        
        logger.debug(f"Evicted {to_remove} cache entries")


class RedisCache:
    """
    Redis-backed cache for production use.
    """
    
    def __init__(self, redis_url: str = None, default_ttl: int = 3600):
        """
        Initialize Redis cache.
        
        Args:
            redis_url: Redis connection URL
            default_ttl: Default TTL in seconds
        """
        self._redis = None
        self._default_ttl = default_ttl
        self._hits = 0
        self._misses = 0
        
        redis_url = redis_url or os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        
        try:
            import redis
            self._redis = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            self._redis.ping()
            logger.info(f"Redis cache connected: {redis_url}")
        except ImportError:
            logger.warning("Redis package not installed - falling back to in-memory cache")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e} - falling back to in-memory cache")
            self._redis = None
    
    @property
    def is_available(self) -> bool:
        """Check if Redis is available."""
        return self._redis is not None
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from Redis."""
        if not self._redis:
            return None
        
        try:
            value = self._redis.get(key)
            if value is None:
                self._misses += 1
                return None
            
            self._hits += 1
            return json.loads(value)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            self._misses += 1
            return None
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: int = None
    ) -> bool:
        """Set value in Redis."""
        if not self._redis:
            return False
        
        try:
            ttl = ttl or self._default_ttl
            serialized = json.dumps(value)
            
            if ttl:
                self._redis.setex(key, ttl, serialized)
            else:
                self._redis.set(key, serialized)
            
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete value from Redis."""
        if not self._redis:
            return False
        
        try:
            self._redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """Check if key exists in Redis."""
        if not self._redis:
            return False
        
        try:
            return self._redis.exists(key) > 0
        except Exception as e:
            logger.error(f"Redis exists error: {e}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get Redis statistics."""
        if not self._redis:
            return {"available": False}
        
        try:
            info = self._redis.info("memory")
            total_requests = self._hits + self._misses
            hit_rate = (self._hits / total_requests * 100) if total_requests > 0 else 0
            
            return {
                "available": True,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(hit_rate, 2),
                "used_memory": info.get("used_memory_human", "unknown"),
                "connected_clients": info.get("connected_clients", 0)
            }
        except Exception as e:
            logger.error(f"Redis stats error: {e}")
            return {"available": False, "error": str(e)}


class CacheService:
    """
    Production cache service with Redis primary and in-memory fallback.
    
    Features:
    - Redis primary (when available)
    - In-memory fallback
    - Decorator for caching function results
    - Pattern-based key invalidation
    - Statistics and monitoring
    """
    
    def __init__(self, redis_url: str = None, default_ttl: int = 3600):
        """
        Initialize cache service.
        
        Args:
            redis_url: Redis connection URL
            default_ttl: Default TTL in seconds
        """
        self._redis = RedisCache(redis_url, default_ttl)
        self._memory = InMemoryCache(default_ttl=default_ttl)
        self._default_ttl = default_ttl
        
        # Key prefixes for namespacing
        self._prefixes = {
            "destination": "dest",
            "trip": "trip",
            "user": "user",
            "search": "search",
            "recommendation": "rec",
            "weather": "weather",
            "price": "price",
            "embedding": "emb"
        }
    
    def get(
        self,
        key: str,
        namespace: str = None
    ) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            namespace: Optional namespace prefix
            
        Returns:
            Cached value or None
        """
        full_key = self._build_key(key, namespace)
        
        # Try Redis first
        value = self._redis.get(full_key)
        if value is not None:
            return value
        
        # Fall back to in-memory
        return self._memory.get(full_key)
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: int = None,
        namespace: str = None
    ) -> bool:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: TTL in seconds
            namespace: Optional namespace prefix
            
        Returns:
            True if cached successfully
        """
        full_key = self._build_key(key, namespace)
        ttl = ttl or self._default_ttl
        
        # Set in both Redis and memory
        redis_result = self._redis.set(full_key, value, ttl)
        memory_result = self._memory.set(full_key, value, ttl)
        
        return redis_result or memory_result
    
    def delete(
        self,
        key: str,
        namespace: str = None
    ) -> bool:
        """Delete value from cache."""
        full_key = self._build_key(key, namespace)
        
        redis_result = self._redis.delete(full_key)
        memory_result = self._memory.delete(full_key)
        
        return redis_result or memory_result
    
    def exists(
        self,
        key: str,
        namespace: str = None
    ) -> bool:
        """Check if key exists in cache."""
        full_key = self._build_key(key, namespace)
        
        return self._redis.exists(full_key) or self._memory.exists(full_key)
    
    def invalidate_pattern(self, pattern: str, namespace: str = None):
        """
        Invalidate all keys matching a pattern.
        
        Args:
            pattern: Key pattern (supports * wildcard)
            namespace: Optional namespace prefix
        """
        full_pattern = self._build_key(pattern, namespace)
        
        # Invalidate in-memory cache
        with self._memory._lock:
            keys_to_delete = [
                k for k in self._memory._cache.keys()
                if self._match_pattern(k, full_pattern)
            ]
            for key in keys_to_delete:
                del self._memory._cache[key]
        
        # Invalidate Redis if available
        if self._redis.is_available:
            try:
                keys = self._redis._redis.keys(full_pattern)
                if keys:
                    self._redis._redis.delete(*keys)
            except Exception as e:
                logger.error(f"Redis pattern invalidation error: {e}")
    
    def cached(
        self,
        key_builder: Callable = None,
        ttl: int = None,
        namespace: str = None
    ):
        """
        Decorator to cache function results.
        
        Usage:
            @cache_service.cached(key_builder=lambda args: f"user_{args[0]}")
            def get_user(user_id):
                ...
        """
        def decorator(func: Callable):
            @wraps(func)
            def wrapper(*args, **kwargs):
                # Build cache key
                if key_builder:
                    cache_key = key_builder(*args, **kwargs)
                else:
                    cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"
                
                # Try to get from cache
                cached_value = self.get(cache_key, namespace)
                if cached_value is not None:
                    return cached_value
                
                # Execute function
                result = func(*args, **kwargs)
                
                # Cache result
                if result is not None:
                    self.set(cache_key, result, ttl, namespace)
                
                return result
            
            return wrapper
        return decorator
    
    def get_or_set(
        self,
        key: str,
        factory: Callable[[], Any],
        ttl: int = None,
        namespace: str = None
    ) -> Any:
        """
        Get from cache or execute factory and cache result.
        
        Args:
            key: Cache key
            factory: Function to execute if not cached
            ttl: TTL in seconds
            namespace: Optional namespace
            
        Returns:
            Cached or fresh value
        """
        value = self.get(key, namespace)
        if value is not None:
            return value
        
        value = factory()
        if value is not None:
            self.set(key, value, ttl, namespace)
        
        return value
    
    async def get_or_set_async(
        self,
        key: str,
        factory: Callable[[], Any],
        ttl: int = None,
        namespace: str = None
    ) -> Any:
        """
        Async version of get_or_set.
        """
        value = self.get(key, namespace)
        if value is not None:
            return value
        
        if asyncio.iscoroutinefunction(factory):
            value = await factory()
        else:
            value = factory()
        
        if value is not None:
            self.set(key, value, ttl, namespace)
        
        return value
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            "redis": self._redis.get_stats(),
            "memory": self._memory.get_stats()
        }
    
    def clear_all(self) -> Dict[str, int]:
        """Clear all cache entries."""
        return {
            "memory_cleared": self._memory.clear()
        }
    
    def _build_key(self, key: str, namespace: str = None) -> str:
        """Build full cache key with namespace."""
        if namespace and namespace in self._prefixes:
            return f"{self._prefixes[namespace]}:{key}"
        elif namespace:
            return f"{namespace}:{key}"
        return key
    
    def _match_pattern(self, key: str, pattern: str) -> bool:
        """Match key against pattern with * wildcard."""
        import fnmatch
        return fnmatch.fnmatch(key, pattern)


# Cache key builders for common use cases
class CacheKeys:
    """Utility class for building cache keys."""
    
    @staticmethod
    def destination(destination_id: str) -> str:
        return f"dest:{destination_id}"
    
    @staticmethod
    def destination_search(query: str, filters: Dict = None) -> str:
        filter_hash = hashlib.md5(str(filters or {}).encode()).hexdigest()[:8]
        return f"search:{query}:{filter_hash}"
    
    @staticmethod
    def user_preferences(user_id: str) -> str:
        return f"user:{user_id}:prefs"
    
    @staticmethod
    def user_trips(user_id: str) -> str:
        return f"user:{user_id}:trips"
    
    @staticmethod
    def trip(trip_id: str) -> str:
        return f"trip:{trip_id}"
    
    @staticmethod
    def recommendations(user_id: str, context_hash: str = None) -> str:
        return f"rec:{user_id}:{context_hash or 'default'}"
    
    @staticmethod
    def weather(location: str) -> str:
        return f"weather:{location.lower().replace(' ', '_')}"
    
    @staticmethod
    def embedding(entity_type: str, entity_id: str) -> str:
        return f"emb:{entity_type}:{entity_id}"


# Cache TTL constants
class CacheTTL:
    """Cache TTL constants in seconds."""
    
    SHORT = 300  # 5 minutes
    MEDIUM = 3600  # 1 hour
    LONG = 86400  # 24 hours
    VERY_LONG = 604800  # 1 week
    
    # Specific TTLs
    DESTINATION = 86400  # 24 hours
    WEATHER = 1800  # 30 minutes
    USER_PREFERENCES = 3600  # 1 hour
    SEARCH_RESULTS = 300  # 5 minutes
    RECOMMENDATIONS = 3600  # 1 hour
    EMBEDDINGS = 604800  # 1 week
    PRICE = 3600  # 1 hour


# Singleton instance
cache_service = CacheService()