"""
Tests for Chatbot API & NLP Engine + Gemini Session Lifecycle
================================================================
"""

import time
import uuid
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


class TestChatAIMetadata:
    """AI chat responses must carry the real ML intent/destination metadata."""

    def _patch_gemini(self):
        return patch(
            "app.api.routes.chatbot.chat_with_gemini",
            return_value={
                "reply": "Here is your Goa plan!",
                "model": "gemini-2.5-flash",
                "mode": "ai",
            },
        )

    @patch("app.api.routes.chatbot._google_key", return_value="test-key")
    def test_ai_path_returns_real_metadata(self, _mock_key, auth):
        with self._patch_gemini():
            resp = auth.post(
                "/api/chat",
                json={"message": "best restaurants in goa", "mode": "ai"},
            )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["mode"] == "ai"
        assert data["model"] == "gemini-2.5-flash"
        assert data["intent"] == "food_dining"
        assert data["destination"] == "Goa"
        assert 0.0 < data["confidence"] <= 1.0

    @patch("app.api.routes.chatbot._google_key", return_value="test-key")
    def test_ai_path_destination_null_when_absent(self, _mock_key, auth):
        with self._patch_gemini():
            resp = auth.post(
                "/api/chat",
                json={"message": "hello there", "mode": "ai"},
            )
        data = resp.get_json()
        assert data["mode"] == "ai"
        assert data["destination"] is None

    @patch("app.api.routes.chatbot._google_key", return_value="test-key")
    def test_chat_ai_route_returns_real_metadata(self, _mock_key, auth):
        with self._patch_gemini():
            resp = auth.post(
                "/api/chat/ai",
                json={"message": "safe for family in Goa?"},
            )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["intent"] == "safety"
        assert data["destination"] == "Goa"

    @patch("app.api.routes.chatbot._google_key", return_value="test-key")
    def test_ai_path_persists_intent_and_destination(self, _mock_key, app, auth):
        from app.models.database import db
        from app.models.entities import ChatMessage

        with self._patch_gemini():
            auth.post(
                "/api/chat",
                json={
                    "message": "best restaurants in goa",
                    "mode": "ai",
                    "session_id": "meta-ai-1",
                },
            )
        with app.app_context():
            rows = (
                db.session.query(ChatMessage)
                .filter(ChatMessage.user_session == "meta-ai-1")
                .order_by(ChatMessage.id)
                .all()
            )
            assert len(rows) == 2  # user + bot
            for row in rows:
                assert row.detected_intent == "food_dining"
                assert row.destination == "Goa"
            db.session.query(ChatMessage).filter(
                ChatMessage.user_session == "meta-ai-1"
            ).delete()
            db.session.commit()

    @patch("app.api.routes.chatbot._google_key", return_value="test-key")
    def test_classic_path_persists_destination(self, _mock_key, app, auth):
        from app.models.database import db
        from app.models.entities import ChatMessage

        auth.post(
            "/api/chat",
            json={
                "message": "best restaurants in goa",
                "mode": "classic",
                "session_id": "meta-classic-1",
            },
        )
        with app.app_context():
            rows = (
                db.session.query(ChatMessage)
                .filter(ChatMessage.user_session == "meta-classic-1")
                .order_by(ChatMessage.id)
                .all()
            )
            assert len(rows) == 2
            for row in rows:
                assert row.detected_intent == "food_dining"
                assert row.destination == "Goa"
            db.session.query(ChatMessage).filter(
                ChatMessage.user_session == "meta-classic-1"
            ).delete()
            db.session.commit()


# ═══════════════════════════════════════════════════════════
# Gemini Session Lifecycle (TTL, history cap, eviction)
# ═══════════════════════════════════════════════════════════


class TestChatHistory:
    """Tests for GET /api/chat/history (sessions + messages)."""

    @pytest.fixture()
    def fresh_user(self, client):
        """Register + login a brand-new user so DB state cannot leak in.
        Subsequent calls re-login the same user (shared client keeps the
        session cookie, but re-login is idempotent)."""

        state = {"email": None}

        def _make():
            if state["email"] is None:
                state["email"] = f"u-{uuid.uuid4().hex[:8]}@example.com"
                client.post(
                    "/api/auth/register",
                    json={
                        "name": "Tester",
                        "email": state["email"],
                        "password": "Test1234!",
                    },
                )
            client.post(
                "/api/auth/login",
                json={"email": state["email"], "password": "Test1234!"},
            )
            return client

        return _make

    def test_history_requires_auth(self, app):
        fresh = app.test_client()
        resp = fresh.get("/api/chat/history")
        assert resp.status_code == 401

    def test_history_empty_for_new_user(self, fresh_user):
        resp = fresh_user().get("/api/chat/history")
        assert resp.status_code == 200
        assert resp.get_json()["sessions"] == []

    def test_history_lists_sessions_after_chat(self, fresh_user):
        fresh_user().post("/api/chat", json={"message": "best restaurants in goa"})
        resp = fresh_user().get("/api/chat/history")
        assert resp.status_code == 200
        sessions = resp.get_json()["sessions"]
        assert len(sessions) == 1
        assert sessions[0]["count"] == 2  # user + bot rows persisted
        assert "restaurants" in sessions[0]["preview"]

    def test_session_messages_returned_in_order(self, fresh_user):
        chat_resp = fresh_user().post(
            "/api/chat",
            json={"message": "best restaurants in goa"},
        )
        session_id = chat_resp.get_json()["session_id"]
        resp = fresh_user().get(f"/api/chat/history/{session_id}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["session_id"] == session_id
        roles = [msg["role"] for msg in data["messages"]]
        assert roles == ["user", "bot"]
        assert data["messages"][0]["text"] == "best restaurants in goa"
        assert data["messages"][1]["destination"] == "Goa"

    def test_session_messages_scoped_to_owner(self, client, app):
        owner = app.test_client()
        owner_email = f"owner-{uuid.uuid4().hex[:8]}@example.com"
        owner.post(
            "/api/auth/register",
            json={
                "name": "Owner",
                "email": owner_email,
                "password": "Test1234!",
            },
        )
        owner.post(
            "/api/auth/login",
            json={"email": owner_email, "password": "Test1234!"},
        )
        # Persist a chat row via the owner client, then read as a different user
        chat_resp = owner.post(
            "/api/chat",
            json={"message": "hello there"},
        )
        sid = chat_resp.get_json()["session_id"]
        other = app.test_client()
        other_email = f"other-{uuid.uuid4().hex[:8]}@example.com"
        other.post(
            "/api/auth/register",
            json={
                "name": "Other",
                "email": other_email,
                "password": "Test1234!",
            },
        )
        other.post(
            "/api/auth/login",
            json={"email": other_email, "password": "Test1234!"},
        )
        other_resp = other.get(f"/api/chat/history/{sid}")
        assert other_resp.status_code == 200
        assert other_resp.get_json()["messages"] == []


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
