"""
NLP Chatbot Engine
===================
Uses scikit-learn (TF-IDF + Logistic Regression) to classify user
messages into intents and return context-appropriate responses.

The model is trained lazily on first use from `intents.json`.

Architecture:
    User message
        → TF-IDF vectorisation
        → Logistic Regression classifier
        → Intent tag + confidence
        → Response lookup from responses.py

Future upgrades:
    • Swap classifier with a fine-tuned transformer (e.g. DistilBERT).
    • Add entity extraction (destination names, dates, numbers).
    • Maintain multi-turn conversation context.
"""

import json
import logging
import random
from pathlib import Path
from typing import List, Optional, Tuple

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from app.chatbot.responses import RESPONSES

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level model cache
# ---------------------------------------------------------------------------
_pipeline: Optional[Pipeline] = None
_intent_tags: List[str] = []

# Minimum confidence to accept an intent (else fallback)
CONFIDENCE_THRESHOLD = 0.35

# Persisted model path
_MODEL_DIR = Path(__file__).parent / "model_cache"
_MODEL_PATH = _MODEL_DIR / "pipeline.joblib"
_INTENTS_PATH = _MODEL_DIR / "intent_tags.joblib"


def _train_pipeline() -> Pipeline:
    """
    Load intents.json and train the TF-IDF + LogReg pipeline.

    Returns:
        Fitted sklearn Pipeline.
    """
    global _intent_tags

    intents_path = Path(__file__).parent / "intents.json"
    with open(intents_path, "r") as fh:
        data = json.load(fh)

    texts = []
    labels = []
    for intent in data["intents"]:
        tag = intent["tag"]
        for pattern in intent["patterns"]:
            texts.append(pattern.lower())
            labels.append(tag)

    _intent_tags = sorted(set(labels))

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 4),
            max_features=5000,
            sublinear_tf=True,
        )),
        ("clf", LogisticRegression(
            max_iter=1000,
            C=5.0,
            solver="lbfgs",
        )),
    ])

    pipeline.fit(texts, labels)

    _MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, _MODEL_PATH)
    joblib.dump(_intent_tags, _INTENTS_PATH)

    logger.info(
        "Chatbot pipeline trained and persisted – %d patterns, %d intents",
        len(texts),
        len(_intent_tags),
    )
    return pipeline


def _get_pipeline() -> Pipeline:
    """Load persisted pipeline or train if not cached."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    if _MODEL_PATH.exists() and _INTENTS_PATH.exists():
        try:
            _pipeline = joblib.load(_MODEL_PATH)
            _intent_tags = joblib.load(_INTENTS_PATH)
            logger.info("Chatbot pipeline loaded from disk (%d intents)", len(_intent_tags))
            return _pipeline
        except Exception:
            logger.warning("Failed to load persisted pipeline; retraining")

    _pipeline = _train_pipeline()
    return _pipeline


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify_intent(message: str) -> Tuple[str, float]:
    """
    Classify a user message into an intent tag.

    Args:
        message: Raw user text.

    Returns:
        (intent_tag, confidence) – confidence in [0, 1].
    """
    pipe = _get_pipeline()
    cleaned = message.strip().lower()

    proba = pipe.predict_proba([cleaned])[0]
    best_idx = proba.argmax()
    confidence = float(proba[best_idx])
    intent = pipe.classes_[best_idx]

    if confidence < CONFIDENCE_THRESHOLD:
        return "fallback", confidence

    return intent, round(confidence, 4)


def get_response(intent: str) -> str:
    """
    Pick a response string for the given intent.

    Args:
        intent: Intent tag (e.g. "budget", "safety").

    Returns:
        A randomly chosen response string.
    """
    options = RESPONSES.get(intent, RESPONSES["fallback"])
    return random.choice(options)


def chat(message: str) -> Tuple[str, str, float]:
    """
    End-to-end chat: classify + respond.

    Args:
        message: Raw user text.

    Returns:
        (response_text, intent_tag, confidence)
    """
    intent, confidence = classify_intent(message)
    reply = get_response(intent)
    return reply, intent, confidence
