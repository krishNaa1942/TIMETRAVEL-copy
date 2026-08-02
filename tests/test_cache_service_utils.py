"""
Tests for app.services.cache_service
=====================================
Unit tests for in-memory cache and the cache service layer
(Redis backend stubbed out — no network in tests).
"""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

import app.services.cache_service as cache_module
from app.services.cache_service import (
    InMemoryCache,
    RedisCache,
    CacheService,
    CacheKeys,
    CacheTTL,
)

# ── InMemoryCache ────────────────────────────────────────────────────


class TestInMemoryCache:
    def test_set_get_roundtrip(self):
        cache = InMemoryCache()
        assert cache.set("k", {"a": 1}) is True
        assert cache.get("k") == {"a": 1}

    def test_miss_returns_none(self):
        cache = InMemoryCache()
        assert cache.get("missing") is None

    def test_delete(self):
        cache = InMemoryCache()
        cache.set("k", "v")
        assert cache.delete("k") is True
        assert cache.delete("k") is False
        assert cache.get("k") is None

    def test_exists(self):
        cache = InMemoryCache()
        assert cache.exists("k") is False
        cache.set("k", "v")
        assert cache.exists("k") is True

    def test_exists_expired_returns_false(self):
        cache = InMemoryCache()
        cache.set("k", "v", ttl=-1)
        assert cache.exists("k") is False

    def test_clear(self):
        cache = InMemoryCache()
        cache.set("a", 1)
        cache.set("b", 2)
        assert cache.clear() == 2
        assert cache.get("a") is None

    def test_stats(self):
        cache = InMemoryCache()
        cache.set("k", "hello")
        cache.get("k")
        cache.get("missing")
        stats = cache.get_stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 50.0
        assert stats["entries"] == 1
        assert stats["max_size"] == 10000

    def test_stats_no_requests(self):
        stats = InMemoryCache().get_stats()
        assert stats["hit_rate"] == 0

    def test_eviction_when_full(self):
        cache = InMemoryCache(max_size=10, default_ttl=3600)
        for i in range(20):
            cache.set(f"k{i}", i)
        assert len(cache._cache) <= 10
        # oldest 10% should be gone
        assert cache.get("k0") is None or "k0" not in cache._cache

    def test_custom_ttl_no_expiry_when_none(self):
        cache = InMemoryCache(default_ttl=None)
        cache.set("k", "v")
        entry = cache._cache["k"]
        assert entry.expires_at is None

    def test_size_bytes_recorded(self):
        cache = InMemoryCache()
        cache.set("k", {"data": "x"})
        assert cache._cache["k"].size_bytes > 0

    def test_expired_entry_cleared_on_get(self):
        cache = InMemoryCache()
        cache.set("k", "v", ttl=-10)
        assert cache.get("k") is None
        assert "k" not in cache._cache


# ── RedisCache (stubbed) ─────────────────────────────────────────────


class FakeRedisClient:
    def __init__(self):
        self.data = {}

    def setex(self, key, ttl, value):
        self.data[key] = value

    def set(self, key, value):
        self.data[key] = value

    def get(self, key):
        return self.data.get(key)

    def delete(self, key):
        self.data.pop(key, None)

    def exists(self, key):
        return 1 if key in self.data else 0

    def info(self, section):
        return {"used_memory_human": "1MB", "connected_clients": 2}

    def scan(self, cursor=0, match="*", count=100):
        keys = [k for k in self.data if match == "*" or k.startswith(match)]
        return 0, keys

    def ping(self):
        return True


@pytest.fixture
def redis_cache(monkeypatch):
    client = FakeRedisClient()

    class FakePool:
        pass

    def fake_from_url(*args, **kwargs):
        return FakePool()

    monkeypatch.setattr("redis.ConnectionPool.from_url", fake_from_url)
    cache = RedisCache("redis://fake:6379/0", default_ttl=3600)
    cache._redis = client
    return cache, client


class TestRedisCache:
    def test_get_set_roundtrip(self, redis_cache):
        cache, client = redis_cache
        assert cache.set("k", {"a": 1}) is True
        assert cache.get("k") == {"a": 1}

    def test_set_with_ttl(self, redis_cache):
        cache, client = redis_cache
        cache.set("k", "v", 60)
        assert "k" in client.data

    def test_delete(self, redis_cache):
        cache, client = redis_cache
        cache.set("k", "v")
        assert cache.delete("k") is True

    def test_exists(self, redis_cache):
        cache, client = redis_cache
        cache.set("k", "v")
        assert cache.exists("k") is True
        assert cache.exists("other") is False

    def test_get_stats(self, redis_cache):
        cache, _ = redis_cache
        stats = cache.get_stats()
        assert stats["available"] is True
        assert stats["used_memory"] == "1MB"

    def test_unavailable_returns_false(self):
        cache = RedisCache("redis://fake:6379/0")
        cache._redis = None
        assert cache.get("k") is None
        assert cache.set("k", "v") is False
        assert cache.delete("k") is False
        assert cache.exists("k") is False
        assert cache.get_stats() == {"available": False}


# ── CacheService ─────────────────────────────────────────────────────


@pytest.fixture
def service():
    # Stub RedisCache so no real connection is attempted
    cache_module.RedisCache = lambda *a, **k: _StubRedis()
    svc = CacheService("redis://fake:6379/0", default_ttl=3600)
    cache_module.RedisCache = RedisCache
    return svc


class _StubRedis:
    is_available = False

    def __init__(self, *a, **k):
        pass

    def get(self, key):
        return None

    def set(self, key, value, ttl=None):
        return False

    def delete(self, key):
        return False

    def exists(self, key):
        return False

    def get_stats(self):
        return {"available": False}


class TestCacheService:
    def test_get_set_with_namespace(self, service):
        service.set("123", "goa", namespace="destination")
        assert service.get("123", namespace="destination") == "goa"
        assert service.get("123") is None  # different key without namespace

    def test_get_set_custom_namespace(self, service):
        service.set("k", "v", namespace="custom")
        assert service.get("k", namespace="custom") == "v"

    def test_delete(self, service):
        service.set("k", "v")
        assert service.delete("k") is True
        assert service.get("k") is None

    def test_exists(self, service):
        assert service.exists("k") is False
        service.set("k", "v")
        assert service.exists("k") is True

    def test_invalidate_pattern(self, service):
        service.set("k1", 1)
        service.set("k2", 2)
        service.set("other", 3)
        service.invalidate_pattern("k*")
        assert service.get("k1") is None
        assert service.get("k2") is None
        assert service.get("other") == 3

    def test_invalidate_pattern_with_namespace(self, service):
        service.set("a", 1, namespace="trip")
        service.set("a", 2, namespace="user")
        service.invalidate_pattern("a*", namespace="trip")
        assert service.get("a", namespace="trip") is None
        assert service.get("a", namespace="user") == 2

    def test_cached_decorator(self, service):
        calls = []

        @service.cached(key_builder=lambda *a: f"user_{a[0]}")
        def get_user(user_id):
            calls.append(user_id)
            return {"id": user_id}

        assert get_user(1) == {"id": 1}
        assert get_user(1) == {"id": 1}
        assert calls == [1]  # second call served from cache

    def test_cached_without_key_builder(self, service):
        @service.cached()
        def compute(x):
            return x * 2

        assert compute(21) == 42
        assert compute(21) == 42

    def test_cached_none_result_not_cached(self, service):
        @service.cached()
        def maybe():
            maybe.calls = getattr(maybe, "calls", 0) + 1
            return None

        maybe()
        maybe()
        assert getattr(maybe, "calls", 0) == 2

    def test_get_or_set(self, service):
        calls = []
        value = service.get_or_set("k", lambda: calls.append(1) or "fresh")
        assert value == "fresh"
        assert service.get_or_set("k", lambda: "cached") == "fresh"
        assert calls == [1]

    def test_get_or_set_none_not_cached(self, service):
        calls = []
        assert service.get_or_set("k", lambda: calls.append(1) or None) is None
        assert service.get_or_set("k", lambda: calls.append(2) or None) is None
        assert calls == [1, 2]

    def test_get_or_set_async(self, service):
        async def factory():
            return "async-value"

        result = asyncio.get_event_loop().run_until_complete(
            service.get_or_set_async("k", factory)
        )
        assert result == "async-value"
        assert service.get("k") == "async-value"

    def test_get_or_set_async_sync_factory(self, service):
        result = asyncio.get_event_loop().run_until_complete(
            service.get_or_set_async("k2", lambda: "sync-value")
        )
        assert result == "sync-value"

    def test_get_stats(self, service):
        stats = service.get_stats()
        assert "redis" in stats
        assert "memory" in stats

    def test_clear_all(self, service):
        service.set("a", 1)
        service.set("b", 2)
        result = service.clear_all()
        assert result["memory_cleared"] == 2
        assert service.get("a") is None

    def test_build_key_known_prefix(self, service):
        assert service._build_key("5", "destination") == "dest:5"
        assert service._build_key("5", "weather") == "weather:5"

    def test_build_key_unknown_namespace(self, service):
        assert service._build_key("5", "mystery") == "mystery:5"

    def test_build_key_no_namespace(self, service):
        assert service._build_key("5") == "5"

    def test_match_pattern(self, service):
        assert service._match_pattern("dest:1", "dest:*") is True
        assert service._match_pattern("trip:1", "dest:*") is False


# ── CacheKeys ────────────────────────────────────────────────────────


class TestCacheKeys:
    def test_destination(self):
        assert CacheKeys.destination("1") == "dest:1"

    def test_destination_search(self):
        key = CacheKeys.destination_search("goa")
        assert key.startswith("search:goa:")

    def test_user_preferences(self):
        assert CacheKeys.user_preferences("u1") == "user:u1:prefs"

    def test_user_trips(self):
        assert CacheKeys.user_trips("u1") == "user:u1:trips"

    def test_trip(self):
        assert CacheKeys.trip("t1") == "trip:t1"

    def test_recommendations(self):
        assert CacheKeys.recommendations("u1") == "rec:u1:default"
        assert CacheKeys.recommendations("u1", "abc") == "rec:u1:abc"

    def test_weather_normalizes(self):
        assert CacheKeys.weather("New York") == "weather:new_york"

    def test_embedding(self):
        assert CacheKeys.embedding("hotel", "5") == "emb:hotel:5"


# ── CacheTTL ─────────────────────────────────────────────────────────


class TestCacheTTL:
    def test_constants(self):
        assert CacheTTL.SHORT == 300
        assert CacheTTL.MEDIUM == 3600
        assert CacheTTL.LONG == 86400
        assert CacheTTL.VERY_LONG == 604800

    def test_specific_ttls(self):
        assert CacheTTL.DESTINATION == 86400
        assert CacheTTL.WEATHER == 1800
        assert CacheTTL.SEARCH_RESULTS == 300
        assert CacheTTL.EMBEDDINGS == 604800
