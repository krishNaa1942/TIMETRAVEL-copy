"""
Gemini AI Service
==================
Integrates Google's Gemini generative AI for intelligent, context-aware
travel chat. Maintains per-session conversation history for multi-turn
dialogue.

Uses the google-generativeai SDK with Gemini 2.5 Flash model.

Session lifecycle:
  - Each session has a TTL (default 30 min); idle sessions are reaped.
  - Conversation history is capped at MAX_HISTORY_TURNS to bound memory.
  - Total session count is hard-capped at MAX_SESSIONS.
"""

import functools
import logging
import time
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Optional

import google.generativeai as genai

from app.services.ai_security import AIPromptSanitizer
from app.utils.constants import VALID_DESTINATION_NAMES

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level session store  {session_id: {"chat": ChatSession, "ts": float}}
# ---------------------------------------------------------------------------
_sessions: dict = {}
_model = None
_configured = False
_configure_lock = threading.Lock()

# Session limits
SESSION_TTL = 1800          # 30 minutes of inactivity before expiry
MAX_SESSIONS = 200          # hard cap on concurrent sessions
MAX_HISTORY_TURNS = 20      # keep last N user+model turn pairs (40 messages)

# Timeout and retry config
_GEMINI_TIMEOUT = 25
_MAX_RETRIES = 2
_RETRY_BASE_DELAY = 1.0

_executor = ThreadPoolExecutor(max_workers=4)


def _call_with_timeout(fn, timeout_secs=_GEMINI_TIMEOUT, *args, **kwargs):
    future = _executor.submit(fn, *args, **kwargs)
    try:
        return future.result(timeout=timeout_secs)
    except TimeoutError:
        future.cancel()
        raise TimeoutError(f"Gemini call timed out after {timeout_secs}s")


def _call_with_retry(fn, max_retries=_MAX_RETRIES, base_delay=_RETRY_BASE_DELAY, *args, **kwargs):
    import time as _time
    last_exc = None
    for attempt in range(max_retries + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last_exc = e
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                logger.warning("Retry %d/%d after: %s", attempt + 1, max_retries, e)
                _time.sleep(delay)
    raise last_exc


# ---------------------------------------------------------------------------
# System prompt – defines the AI personality and knowledge
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = f"""You are **Time Travel AI** – a smart, friendly, and knowledgeable tourism assistant for India.

Your mission: Help middle-class Indian families plan budget-friendly, safe, and memorable trips.

**Your expertise covers:**
• Knowledge of {len(VALID_DESTINATION_NAMES)} popular Indian destinations across all states
• Budget estimation (hotels ₹500-₹8000/night, transport, food, activities)
• Safety advice (women safety, night safety, scam alerts, medical facilities)
• Weather & packing recommendations
• Nearby attractions, restaurants, temples, beaches, museums
• Route planning between destinations
• Local culture, festivals, best time to visit

**Personality:**
• Warm, helpful, conversational – like a well-traveled friend
• Use emojis occasionally for warmth 🌍 ✈️ 🏖️
• Give specific, actionable advice with approximate costs in ₹ (INR)
• When asked about budgets, break down into hotels, transport, food, activities
• Mention safety tips proactively for family travelers
• Suggest off-season travel for budget savings
• Keep responses concise but informative (2-4 paragraphs max)
• If asked something outside travel scope, politely redirect to travel topics

**Important:**
• Always recommend budget-friendly options first, then mid-range
• ALWAYS mention prices in Indian Rupees (₹)
• Consider family-friendly aspects (child safety, vegetarian food options, etc.)
• Suggest both popular and hidden-gem attractions
• Warn about common tourist scams at each destination
"""


def _configure(api_key: str) -> None:
    """Configure Gemini with the API key (done once)."""
    global _configured, _model
    if _configured:
        return

    with _configure_lock:
        if _configured:
            return
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                top_p=0.9,
                max_output_tokens=1024,
            ),
            safety_settings=[
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            ],
        )
        _configured = True
    logger.info("Gemini AI configured with model: gemini-2.5-flash")


def _reap_expired_sessions() -> int:
    """Remove sessions that have been idle longer than SESSION_TTL.
    Returns the number of reaped sessions."""
    now = time.time()
    expired = [sid for sid, s in _sessions.items() if now - s["ts"] > SESSION_TTL]
    for sid in expired:
        del _sessions[sid]
    if expired:
        logger.info("Reaped %d expired Gemini sessions", len(expired))
    return len(expired)


def _enforce_session_cap() -> None:
    """If over MAX_SESSIONS, drop the oldest-accessed sessions."""
    if len(_sessions) <= MAX_SESSIONS:
        return
    # Sort by last-access timestamp, evict the most stale
    by_age = sorted(_sessions.items(), key=lambda kv: kv[1]["ts"])
    to_remove = len(_sessions) - MAX_SESSIONS
    for sid, _ in by_age[:to_remove]:
        del _sessions[sid]
    logger.info("Evicted %d Gemini sessions (cap enforcement)", to_remove)


def _trim_history(chat_session) -> None:
    """Trim conversation history to the last MAX_HISTORY_TURNS turn pairs."""
    history = chat_session.history
    max_messages = MAX_HISTORY_TURNS * 2  # each turn = user + model
    if len(history) > max_messages:
        trimmed = len(history) - max_messages
        chat_session.history = history[-max_messages:]
        logger.debug("Trimmed %d old messages from chat history", trimmed)


def _get_session(session_id: str):
    """Get or create a chat session for the given session ID."""
    now = time.time()

    if session_id in _sessions:
        entry = _sessions[session_id]
        entry["ts"] = now          # refresh last-access time
        return entry["chat"]

    # Housekeeping before creating a new session
    _reap_expired_sessions()
    _enforce_session_cap()

    chat = _model.start_chat(history=[])
    _sessions[session_id] = {"chat": chat, "ts": now}
    return chat


def chat_with_gemini(
    message: str,
    session_id: str,
    api_key: str,
) -> dict:
    """
    Send a message to Gemini and get an AI response.

    Args:
        message:    User's text.
        session_id: Unique conversation session ID.
        api_key:    Google Gemini API key.

    Returns:
        {
            "reply": str,
            "model": "gemini-2.5-flash",
            "mode": "ai",
        }
    """
    try:
        _configure(api_key)

        scan_result = AIPromptSanitizer.sanitize_input(message, context="chat", max_length=2000)
        if scan_result.threats_detected:
            logger.warning("Gemini input threats: %s", scan_result.threats_detected)
        if scan_result.should_block:
            return {
                "reply": "I'm sorry, but I can't respond to that request. Please keep our conversation focused on travel planning.",
                "model": "gemini-2.5-flash",
                "mode": "ai",
            }
        message = scan_result.sanitized_input

        session = _get_session(session_id)
        response = _call_with_retry(
            lambda: _call_with_timeout(
                session.send_message, _GEMINI_TIMEOUT, message
            )
        )

        # Cap conversation history to prevent unbounded growth
        _trim_history(session)

        reply = response.text.strip()

        # Sanitize AI output before returning to user
        sanitized_output, warnings = AIPromptSanitizer.sanitize_output(reply, context="chat")
        if warnings:
            logger.info("Gemini output sanitization warnings: %s", warnings)

        return {
            "reply": sanitized_output,
            "model": "gemini-2.5-flash",
            "mode": "ai",
        }

    except Exception as e:
        error_text = str(e).lower()
        if any(token in error_text for token in ("quota", "resourceexhausted", "resource exhausted", "429")):
            logger.warning("Gemini AI quota exhausted: %s", e)
            return {
                "reply": (
                    "Gemini is temporarily rate-limited for this project. "
                    "Please try again later or use the classic assistant for now."
                ),
                "model": "error",
                "mode": "ai",
                "error_type": "quota_exhausted",
            }

        logger.error("Gemini AI error: %s", e)
        return {
            "reply": "I'm having trouble connecting to AI right now. "
                     "Please try again in a moment, or the basic assistant will handle your query.",
            "model": "error",
            "mode": "ai",
        }


def is_available(api_key: str) -> bool:
    """Check if Gemini AI is configured and usable."""
    if not api_key:
        return False
    try:
        _configure(api_key)
        return True
    except Exception:
        return False


def session_count() -> int:
    """Return the current number of active Gemini sessions."""
    return len(_sessions)
