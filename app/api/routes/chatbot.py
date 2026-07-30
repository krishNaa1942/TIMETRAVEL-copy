"""
Chatbot API Route
==================
POST /api/chat      – Send a message (auto-selects best engine)
POST /api/chat/ai   – Force Gemini AI response
POST /api/chat/classic – Force classic ML response
GET  /api/chat/status  – Check which engines are available

Request JSON:
    { "message": "Is Goa safe for families?", "session_id": "optional-uuid" }

Response JSON:
    {
        "reply": "...",
        "intent": "safety",       (classic mode only)
        "confidence": 0.89,       (classic mode only)
        "model": "gemini-2.5-flash" or "tfidf-logreg",
        "mode": "ai" or "classic",
        "session_id": "..."
    }
"""

import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_login import current_user, login_required

from app.chatbot.engine import chat
from app.models.database import db
from app.models.entities import ChatMessage
from app.services.gemini_service import (
    chat_with_gemini,
    is_available as gemini_available,
)
from app.main import limiter

chatbot_bp = Blueprint("chatbot", __name__)


def _google_key() -> str:
    return current_app.config.get("GOOGLE_API_KEY", "")


def _persist_message(session_id, user_msg_text, bot_reply, intent=None):
    """Save conversation to DB for future training (non-critical)."""
    try:
        uid = current_user.id if current_user.is_authenticated else None
        user_msg = ChatMessage(
            user_id=uid,
            user_session=session_id,
            role="user",
            message=user_msg_text,
            detected_intent=intent,
        )
        bot_msg = ChatMessage(
            user_id=uid,
            user_session=session_id,
            role="bot",
            message=bot_reply,
            detected_intent=intent,
        )
        db.session.add_all([user_msg, bot_msg])
        db.session.commit()
    except Exception:
        db.session.rollback()


# ---------------------------------------------------------------------------
# POST /api/chat – Smart auto-select (Gemini if available, else classic)
# ---------------------------------------------------------------------------
@chatbot_bp.route("/api/chat", methods=["POST"])
@login_required
@limiter.limit("20 per minute")
def chat_endpoint():
    """Handle a chatbot message – uses Gemini AI if available, else classic ML."""

    try:
        data = request.get_json(silent=True)
        if not data or "message" not in data:
            return jsonify({"error": "Missing 'message' in request body"}), 400

        message = data["message"]
        if not isinstance(message, str) or len(message.strip()) == 0:
            return jsonify({"error": "Message cannot be empty"}), 400
        if len(message) > 2000:
            return jsonify({"error": "Message too long (max 2000 characters)"}), 400

        message = message.strip()
        session_id = data.get("session_id", str(uuid.uuid4()))
        mode = data.get("mode", "auto")  # "auto", "ai", "classic"
        destination_context = data.get("destination", None)
        agent_mode = bool(data.get("agent_mode", False))
        route_context = str(data.get("route_context", "") or "").strip()
        tools_context = data.get("tools_context", [])

        # Force classic mode explicitly.
        if mode == "classic":
            return _classic_response(message, session_id)

        key = _google_key()

        # If Gemini is unavailable, always fall back to the classic engine.
        if not key:
            current_app.logger.info(
                "Gemini API key unavailable; using classic chatbot fallback"
            )
            return _classic_response(message, session_id)

        # Try Gemini AI first for auto/ai/travel modes.
        if mode in ("ai", "auto", "travel"):
            ai_message = message
            if agent_mode:
                tools_text = ", ".join(
                    [str(t).strip() for t in tools_context if str(t).strip()]
                )
                route_text = route_context or "chat"
                ai_message = (
                    "[Agent mode enabled] "
                    "You are a proactive travel planning agent for Time To Travel. "
                    "Respond with practical next steps and helpful tool-oriented guidance. "
                    "Keep responses concise and action-oriented. "
                    f"[Current route: {route_text}] "
                    f"[Available tools: {tools_text or 'chat, itinerary, budget, safety, weather, maps, places, news, booking'}] "
                    + ai_message
                )
            if destination_context:
                ai_message = (
                    f"[User is currently exploring {destination_context}] {ai_message}"
                )

            result = chat_with_gemini(ai_message, session_id, key)
            if result.get("model") != "error":
                _persist_message(
                    session_id, message, result["reply"], intent="gemini_ai"
                )
                return (
                    jsonify(
                        {
                            **result,
                            "session_id": session_id,
                            "intent": "ai_response",
                            "confidence": 1.0,
                        }
                    ),
                    200,
                )

            # Fallback to classic ML
            classic_response, status_code = _classic_response(message, session_id)
            payload = classic_response.get_json() or {}
            payload["fallback_from"] = "gemini"
            return jsonify(payload), status_code

        current_app.logger.warning(
            "Unsupported chat mode '%s'; using classic fallback", mode
        )
        return _classic_response(message, session_id)

    except Exception:
        current_app.logger.exception("Unhandled error in /api/chat")
        return (
            jsonify(
                {
                    "error": "Internal Server Error",
                }
            ),
            500,
        )


# ---------------------------------------------------------------------------
# POST /api/chat/ai – Force Gemini AI mode
# ---------------------------------------------------------------------------
@chatbot_bp.route("/api/chat/ai", methods=["POST"])
@login_required
@limiter.limit("20 per minute")
def chat_ai_endpoint():
    """Force Gemini AI response."""
    data = request.get_json(silent=True)
    if not data or "message" not in data:
        return jsonify({"error": "Missing 'message' in request body"}), 400

    key = _google_key()
    if not key:
        return jsonify({"error": "Google Gemini AI not configured"}), 503

    message = data["message"]
    if not isinstance(message, str) or len(message.strip()) == 0:
        return jsonify({"error": "Message cannot be empty"}), 400
    if len(message) > 2000:
        return jsonify({"error": "Message too long (max 2000 characters)"}), 400
    session_id = data.get("session_id", str(uuid.uuid4()))
    result = chat_with_gemini(message, session_id, key)

    if result.get("model") == "error":
        classic_response, status_code = _classic_response(message, session_id)
        payload = classic_response.get_json() or {}
        payload["fallback_from"] = "gemini"
        return jsonify(payload), status_code

    _persist_message(session_id, message, result["reply"], intent="gemini_ai")

    return (
        jsonify(
            {
                **result,
                "session_id": session_id,
                "intent": "ai_response",
                "confidence": 1.0,
            }
        ),
        200,
    )


# ---------------------------------------------------------------------------
# POST /api/chat/classic – Force classic ML mode
# ---------------------------------------------------------------------------
@chatbot_bp.route("/api/chat/classic", methods=["POST"])
@login_required
@limiter.limit("20 per minute")
def chat_classic_endpoint():
    """Force classic ML response."""
    data = request.get_json(silent=True)
    if not data or "message" not in data:
        return jsonify({"error": "Missing 'message' in request body"}), 400

    message = data["message"]
    if not isinstance(message, str) or len(message.strip()) == 0:
        return jsonify({"error": "Message cannot be empty"}), 400
    if len(message) > 2000:
        return jsonify({"error": "Message too long (max 2000 characters)"}), 400
    session_id = data.get("session_id", str(uuid.uuid4()))
    return _classic_response(message, session_id)


# ---------------------------------------------------------------------------
# GET /api/chat/status – Check available engines
# ---------------------------------------------------------------------------
@chatbot_bp.route("/api/chat/status", methods=["GET"])
def chat_status():
    """Return which chat engines are available."""
    key = _google_key()
    ai_ok = gemini_available(key) if key else False
    return (
        jsonify(
            {
                "engines": {
                    "classic": {"available": True, "model": "tfidf-logreg"},
                    "ai": {
                        "available": ai_ok,
                        "model": "gemini-2.5-flash" if ai_ok else None,
                    },
                },
                "default": "ai" if ai_ok else "classic",
            }
        ),
        200,
    )


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------
def _classic_response(message, session_id):
    """Run the local TF-IDF + LogReg pipeline."""
    reply, intent, confidence = chat(message)
    _persist_message(session_id, message, reply, intent=intent)

    return (
        jsonify(
            {
                "reply": reply,
                "intent": intent,
                "confidence": confidence,
                "model": "tfidf-logreg",
                "mode": "classic",
                "session_id": session_id,
            }
        ),
        200,
    )
