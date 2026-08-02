"""
Tests for app.utils.rate_limiter
=================================
Unit tests for in-memory and Redis rate limiters, client key extraction,
and the Flask rate_limit decorator.
"""

import time

import pytest

from app.utils.rate_limiter import (
    InMemoryRateLimiter,
    RedisRateLimiter,
    RateLimitConfig,
    RateLimitEntry,
    rate_limit,
    get_client_key,
    add_rate_limit_headers,
    RATE_LIMITS,
    limiter,
)

# ── RateLimitConfig ──────────────────────────────────────────────────


class TestRateLimitConfig:
    def test_requests_per_second(self):
        config = RateLimitConfig(requests=100, window_seconds=60)
        assert config.requests_per_second == pytest.approx(100 / 60)

    def test_key_prefix_default(self):
        assert RateLimitConfig(10, 60).key_prefix == ""


# ── InMemoryRateLimiter ──────────────────────────────────────────────


class TestInMemoryRateLimiter:
    def test_allows_up_to_limit(self):
        rl = InMemoryRateLimiter()
        for _ in range(3):
            result = rl.is_allowed("k", 3, 60)
            assert result["allowed"] is True
            assert result["remaining"] >= 0

    def test_blocks_after_limit(self):
        rl = InMemoryRateLimiter()
        for _ in range(3):
            rl.is_allowed("k", 3, 60)
        result = rl.is_allowed("k", 3, 60)
        assert result["allowed"] is False
        assert result["retry_after"] > 0
        assert result["remaining"] == 0

    def test_separate_keys_independent(self):
        rl = InMemoryRateLimiter()
        for _ in range(3):
            rl.is_allowed("a", 3, 60)
        assert rl.is_allowed("b", 3, 60)["allowed"] is True
        assert rl.is_allowed("a", 3, 60)["allowed"] is False

    def test_window_expiry_allows_again(self):
        rl = InMemoryRateLimiter()
        for _ in range(3):
            rl.is_allowed("k", 3, 1)
        rl._entries["k"].timestamps = [time.time() - 5]
        rl._entries["k"].blocked_until = 0
        assert rl.is_allowed("k", 3, 1)["allowed"] is True

    def test_reset_clears_key(self):
        rl = InMemoryRateLimiter()
        for _ in range(3):
            rl.is_allowed("k", 3, 60)
        rl.reset("k")
        assert rl.is_allowed("k", 3, 60)["allowed"] is True

    def test_get_stats(self):
        rl = InMemoryRateLimiter()
        rl.is_allowed("k1", 1, 60)
        rl.is_allowed("k2", 1, 60)
        rl.is_allowed("k1", 1, 60)
        stats = rl.get_stats()
        assert stats["total_keys"] == 2
        assert stats["blocked_keys"] == 1

    def test_cleanup_removes_stale_entries(self):
        rl = InMemoryRateLimiter()
        rl._entries["old"] = RateLimitEntry(timestamps=[time.time() - 7200])
        rl._last_cleanup = time.time() - 7200
        rl.is_allowed("new", 5, 60)
        assert "old" not in rl._entries


# ── RedisRateLimiter (fake client, no server needed) ─────────────────


class FakeRedis:
    """Minimal fake redis client implementing the methods used."""

    def __init__(self):
        self.data = {}

    def pipeline(self):
        return FakePipeline(self)

    def zrange(self, key, start, stop, withscores=False):
        scores = sorted(self.data.get(key, {}).values())
        if withscores:
            items = [(str(s), s) for s in scores]
            return items[start:stop]
        return [str(s) for s in scores]

    def zadd(self, key, mapping):
        self.data.setdefault(key, {}).update(mapping)

    def expire(self, key, seconds):
        pass

    def zremrangebyscore(self, key, min_, max_):
        if key in self.data:
            self.data[key] = {
                m: s for m, s in self.data[key].items() if not (min_ <= s <= max_)
            }


class FakePipeline:
    def __init__(self, client):
        self.client = client
        self.ops = []

    def zremrangebyscore(self, key, min_, max_):
        self.ops.append(("zrem", key, min_, max_))
        return self

    def zcard(self, key):
        self.ops.append(("zcard", key))
        return self

    def execute(self):
        results = []
        for op in self.ops:
            if op[0] == "zrem":
                self.client.zremrangebyscore(op[1], op[2], op[3])
                results.append(0)
            elif op[0] == "zcard":
                results.append(len(self.client.data.get(op[1], {})))
        return results


class TestRedisRateLimiter:
    def test_allows_requests_under_limit(self):
        rl = RedisRateLimiter(FakeRedis())
        result = rl.is_allowed("k", 3, 60)
        assert result["allowed"] is True
        assert result["remaining"] == 2

    def test_blocks_after_limit(self):
        client = FakeRedis()
        rl = RedisRateLimiter(client)
        for _ in range(3):
            rl.is_allowed("k", 3, 60)
        result = rl.is_allowed("k", 3, 60)
        assert result["allowed"] is False
        assert result["retry_after"] >= 1

    def test_prefix_applied(self):
        client = FakeRedis()
        rl = RedisRateLimiter(client, key_prefix="rl:")
        rl.is_allowed("k", 5, 60)
        assert "rl:k" in client.data


# ── get_client_key ───────────────────────────────────────────────────


class TestGetClientKey:
    def test_uses_remote_addr(self):
        req = type(
            "R", (), {"headers": {}, "remote_addr": "1.2.3.4", "user_id": None}
        )()
        assert get_client_key(req) == "1.2.3.4"

    def test_uses_x_forwarded_for(self):
        req = type(
            "R",
            (),
            {
                "headers": {"X-Forwarded-For": "9.9.9.9, 10.0.0.1"},
                "remote_addr": "1.2.3.4",
                "user_id": None,
            },
        )()
        assert get_client_key(req) == "9.9.9.9"

    def test_appends_user_id(self):
        req = type("R", (), {"headers": {}, "remote_addr": "1.2.3.4", "user_id": 7})()
        assert get_client_key(req) == "1.2.3.4:7"

    def test_x_forwarded_for_list(self):
        req = type(
            "R",
            (),
            {
                "headers": {"X-Forwarded-For": ["9.9.9.9"]},
                "remote_addr": "1.2.3.4",
                "user_id": None,
            },
        )()
        assert get_client_key(req) == "9.9.9.9"


# ── rate_limit decorator (Flask) ─────────────────────────────────────


class TestRateLimitDecorator:
    def test_unknown_config_passes_through(self, app):
        with app.test_request_context("/"):
            resp = rate_limit("does_not_exist")(lambda: "ok")()
            assert resp == "ok"

    def test_allows_under_limit(self, app):
        with app.test_request_context("/"):
            from app.utils.rate_limiter import limiter as module_limiter

            module_limiter.reset("rlx:127.0.0.1")
            resp = rate_limit("api_general")(lambda: "ok")()
            assert resp == "ok"

    def test_returns_429_over_limit(self, app):
        with app.test_request_context("/"):
            from flask import g

            config = RATE_LIMITS["auth_login"]
            key = f"{config.key_prefix}:127.0.0.1"
            for _ in range(config.requests):
                resp = rate_limit("auth_login")(lambda: "ok")()
                assert resp == "ok"
            resp = rate_limit("auth_login")(lambda: "ok")()
            assert resp.status_code == 429
            assert resp.json["error"] == "Rate limit exceeded"
            assert "Retry-After" in resp.headers
            assert resp.headers["X-RateLimit-Limit"] == str(config.requests)

    def test_sets_rate_limit_headers_on_success(self, app):
        with app.test_request_context("/"):
            from flask import g

            limiter.reset("auth_refresh:127.0.0.1")
            rate_limit("auth_refresh")(lambda: "ok")()
            assert hasattr(g, "rate_limit_remaining")
            assert g.rate_limit_remaining >= 0

    def test_custom_key_func(self, app):
        with app.test_request_context("/"):
            resp = rate_limit("api_general", key_func=lambda r: "fixed-key")(
                lambda: "ok"
            )()
            assert resp == "ok"


# ── add_rate_limit_headers ───────────────────────────────────────────


class TestAddRateLimitHeaders:
    def test_headers_added_when_present(self, app):
        with app.test_request_context("/"):
            from flask import g

            g.rate_limit_limit = 100
            g.rate_limit_remaining = 99
            g.rate_limit_reset = 123
            response = type("Resp", (), {"headers": {}})()
            result = add_rate_limit_headers(response)
            assert result.headers["X-RateLimit-Limit"] == "100"
            assert result.headers["X-RateLimit-Remaining"] == "99"
            assert result.headers["X-RateLimit-Reset"] == "123"

    def test_no_headers_without_g(self, app):
        with app.test_request_context("/"):
            response = type("Resp", (), {"headers": {}})()
            result = add_rate_limit_headers(response)
            assert result.headers == {}


# ── RATE_LIMITS config sanity ────────────────────────────────────────


class TestRateLimitsConfig:
    def test_all_configs_defined(self):
        for name in (
            "auth_login",
            "auth_register",
            "auth_refresh",
            "auth_forgot_password",
            "api_general",
            "api_search",
            "api_write",
            "ai_recommendations",
            "ai_chat",
            "ai_itinerary",
            "upload_image",
            "upload_document",
        ):
            config = RATE_LIMITS[name]
            assert config.requests > 0
            assert config.window_seconds > 0
