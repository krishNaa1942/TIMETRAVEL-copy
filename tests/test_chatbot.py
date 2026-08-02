"""
Tests for Chatbot API & NLP Engine + Gemini Session Lifecycle
================================================================
"""

import time
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def auth(client):
    """Register and login a test user, returning the authenticated client."""
    client.post(
        "/api/auth/register",
        json={"name": "Tester", "email": "test@example.com", "password": "Test1234!"},
    )
    return client


class TestChatEndpoint:
    """Tests for POST /api/chat."""

    def test_chat_returns_200_with_valid_message(self, auth):
        resp = auth.post("/api/chat", json={"message": "hello"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert "reply" in data
        assert "intent" in data
        assert "confidence" in data

    def test_chat_returns_400_without_message(self, auth):
        resp = auth.post("/api/chat", json={})
        assert resp.status_code == 400

    def test_chat_detects_greeting_intent(self, auth):
        resp = auth.post("/api/chat", json={"message": "hi there"})
        data = resp.get_json()
        assert data["intent"] == "greeting"

    def test_chat_returns_destination_when_mentioned(self, auth):
        resp = auth.post(
            "/api/chat",
            json={"message": "best restaurants in goa"},
        )
        data = resp.get_json()
        assert data["destination"] == "Goa"
        assert "Goa" in data["reply"]

    def test_chat_detects_budget_intent(self, auth):
        resp = auth.post(
            "/api/chat",
            json={"message": "how much will a trip to Goa cost?"},
        )
        data = resp.get_json()
        assert data["intent"] == "budget"

    def test_chat_detects_safety_intent(self, auth):
        resp = auth.post(
            "/api/chat",
            json={"message": "is it safe to travel to Delhi?"},
        )
        data = resp.get_json()
        assert data["intent"] == "safety"

    def test_chat_returns_session_id(self, auth):
        resp = auth.post(
            "/api/chat",
            json={"message": "hello", "session_id": "test-123"},
        )
        data = resp.get_json()
        assert data["session_id"] == "test-123"

    @patch("app.api.routes.chatbot._google_key", return_value="")
    def test_chat_falls_back_to_classic_when_gemini_unavailable(self, _mock_key, auth):
        resp = auth.post(
            "/api/chat",
            json={"message": "plan a Goa trip", "mode": "ai"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["model"] == "tfidf-logreg"
        assert data["mode"] == "classic"
        assert "reply" in data


# ═══════════════════════════════════════════════════════════
# Gemini Session Lifecycle (TTL, history cap, eviction)
# ═══════════════════════════════════════════════════════════


class TestGeminiSessionLifecycle:
    """Unit tests for the session management in gemini_service."""

    def setup_method(self):
        """Reset module state before each test."""
        from app.services import gemini_service

        gemini_service._sessions.clear()
        # Provide a mock client so _get_session can call chats.create
        self._orig_client = gemini_service._client
        mock_client = MagicMock()
        mock_client.chats.create.return_value = MagicMock(history=[])
        gemini_service._client = mock_client

    def teardown_method(self):
        from app.services import gemini_service

        gemini_service._sessions.clear()
        gemini_service._client = self._orig_client

    def test_session_created_with_timestamp(self):
        from app.services.gemini_service import _get_session, _sessions

        _get_session("s1")
        assert "s1" in _sessions
        assert "ts" in _sessions["s1"]
        assert "chat" in _sessions["s1"]

    def test_session_timestamp_refreshed_on_access(self):
        from app.services.gemini_service import _get_session, _sessions

        _get_session("s1")
        first_ts = _sessions["s1"]["ts"]
        time.sleep(0.05)
        _get_session("s1")
        assert _sessions["s1"]["ts"] > first_ts

    def test_reap_expired_sessions(self):
        from app.services import gemini_service
        from app.services.gemini_service import _reap_expired_sessions

        # Create sessions with stale timestamps
        now = time.time()
        gemini_service._sessions["old1"] = {"chat": MagicMock(), "ts": now - 3600}
        gemini_service._sessions["old2"] = {"chat": MagicMock(), "ts": now - 7200}
        gemini_service._sessions["fresh"] = {"chat": MagicMock(), "ts": now}

        reaped = _reap_expired_sessions()
        assert reaped == 2
        assert "old1" not in gemini_service._sessions
        assert "old2" not in gemini_service._sessions
        assert "fresh" in gemini_service._sessions

    def test_enforce_session_cap(self):
        from app.services import gemini_service
        from app.services.gemini_service import _enforce_session_cap

        orig_max = gemini_service.MAX_SESSIONS
        gemini_service.MAX_SESSIONS = 3

        now = time.time()
        for i in range(5):
            gemini_service._sessions[f"s{i}"] = {"chat": MagicMock(), "ts": now + i}

        _enforce_session_cap()
        assert len(gemini_service._sessions) == 3
        # Most recent (s2, s3, s4) should survive
        assert "s4" in gemini_service._sessions
        assert "s3" in gemini_service._sessions
        assert "s2" in gemini_service._sessions

        gemini_service.MAX_SESSIONS = orig_max

    def test_trim_history_caps_messages(self):
        from app.services import gemini_service
        from app.services.gemini_service import _trim_history

        orig_max = gemini_service.MAX_HISTORY_TURNS
        gemini_service.MAX_HISTORY_TURNS = 3

        mock_chat = MagicMock()
        # 10 turn pairs = 20 messages, should be trimmed to 3*2=6
        mock_chat._history = list(range(20))
        _trim_history(mock_chat)
        assert len(mock_chat._history) == 6
        # Should keep the most recent messages (14..19)
        assert mock_chat._history == list(range(14, 20))

        gemini_service.MAX_HISTORY_TURNS = orig_max

    def test_trim_history_no_op_below_limit(self):
        from app.services.gemini_service import _trim_history

        mock_chat = MagicMock()
        mock_chat._history = list(range(4))
        _trim_history(mock_chat)
        assert len(mock_chat._history) == 4

    def test_session_count(self):
        from app.services import gemini_service
        from app.services.gemini_service import session_count

        assert session_count() == 0
        gemini_service._sessions["a"] = {"chat": MagicMock(), "ts": time.time()}
        assert session_count() == 1
