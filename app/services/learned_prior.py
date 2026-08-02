"""
Learned Priors — lazy loader for the offline-trained ML artifacts.

Loads the models produced by ``scripts/train_models.py`` from
``data/models/`` (override with the ``MODELS_DIR`` env var) and exposes
three capabilities, all **optional and graceful**:

* ``quality(name)``          — predicted Google rating (0-5) or None
* ``popularity(name)``       — predicted popularity (0-1) or None
* ``content_similarity()``   — TF-IDF nearest destinations for a query text

If artifacts are missing or fail to load, every method degrades to a
safe default (None / empty list) so the existing heuristic engines keep
working unchanged.
"""

import json
import logging
import os
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import joblib
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

_REPO_DIR = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_DIR = os.getenv("MODELS_DIR", str(_REPO_DIR / "data" / "models"))

# Blend weights: how much the learned prior displaces the heuristic.
# 0.6 prior / 0.4 heuristic keeps behaviour anchored to the existing
# deterministic engine while letting real data dominate.
LEARNED_WEIGHT = 0.6
HEURISTIC_WEIGHT = 1.0 - LEARNED_WEIGHT


def _normalize_name(name: str) -> str:
    return (name or "").strip().lower()


class LearnedPriors:
    """Thread-safe lazy singleton wrapper around the ML artifacts."""

    _instance: Optional["LearnedPriors"] = None
    _lock = threading.Lock()

    def __init__(self, model_dir: Optional[str] = None):
        self.model_dir = Path(model_dir or DEFAULT_MODEL_DIR)
        self._load_lock = threading.Lock()
        self._loaded = False
        self._failed = False

        self.quality_pipe = None
        self.popularity_pipe = None
        self.vectorizer = None
        self.matrix = None
        self.names: List[str] = []
        self._name_index: Dict[str, int] = {}
        self.metadata: Dict = {}
        self._popularity_min: float = 0.0
        self._popularity_max: float = 1.0

    # ── Singleton ────────────────────────────────────────────
    @classmethod
    def get_instance(cls) -> "LearnedPriors":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    # ── Loading ──────────────────────────────────────────────
    def _load(self) -> None:
        if self._loaded or self._failed:
            return
        with self._load_lock:
            if self._loaded or self._failed:
                return
            try:
                self.metadata = json.loads(
                    (self.model_dir / "metadata.json").read_text()
                )
                self.quality_pipe = joblib.load(self.model_dir / "quality_model.joblib")
                self.popularity_pipe = joblib.load(
                    self.model_dir / "popularity_model.joblib"
                )
                self.vectorizer = joblib.load(
                    self.model_dir / "content_vectorizer.joblib"
                )
                self.matrix = joblib.load(self.model_dir / "content_matrix.joblib")
                self.names = json.loads(
                    (self.model_dir / "content_names.json").read_text()
                )
                self._name_index = {
                    _normalize_name(n): i for i, n in enumerate(self.names)
                }
                pop_meta = self.metadata.get("popularity", {})
                self._popularity_min = float(pop_meta.get("popularity_min", 0.0))
                self._popularity_max = float(pop_meta.get("popularity_max", 1.0))
                self._loaded = True
                logger.info("Learned priors loaded from %s", self.model_dir)
            except Exception as exc:  # pragma: no cover - defensive
                self._failed = True
                logger.warning(
                    "ML artifacts unavailable (%s) — using heuristic fallbacks", exc
                )

    @property
    def is_available(self) -> bool:
        self._load()
        return self._loaded

    # ── Priors ───────────────────────────────────────────────
    def quality(self, name: str) -> Optional[float]:
        """Predicted Google rating (0-5) for a destination name, else None."""
        if not self.is_available:
            return None
        try:
            text = self._prior_text(name)
            if not text:
                return None
            value = float(
                self.quality_pipe.predict(
                    np.array([[text, np.nan, np.nan]], dtype=object)
                )[0]
            )
            return float(np.clip(value, 0.0, 5.0))
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("quality prior failed for %r: %s", name, exc)
            return None

    def popularity(self, name: str) -> Optional[float]:
        """Predicted popularity normalised to 0-1 for a destination name."""
        if not self.is_available:
            return None
        try:
            text = self._prior_text(name)
            if not text:
                return None
            value = float(self.popularity_pipe.predict(np.array([text]))[0])
            span = max(self._popularity_max - self._popularity_min, 1e-6)
            return float(np.clip((value - self._popularity_min) / span, 0.0, 1.0))
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("popularity prior failed for %r: %s", name, exc)
            return None

    def priors(self, name: str) -> Tuple[Optional[float], Optional[float]]:
        """Return (quality, popularity) priors for a destination name."""
        return self.quality(name), self.popularity(name)

    def _prior_text(self, name: str) -> str:
        """Best-effort destination description used for prediction input."""
        key = _normalize_name(name)
        if key in self._name_index:
            return self.names[self._name_index[key]]
        return key

    # ── Content matcher ──────────────────────────────────────
    def content_similarity(self, query: str, top_k: int = 5) -> List[Tuple[str, float]]:
        """Top-k destinations most similar to ``query`` as (name, sim) pairs."""
        if not self.is_available or not query:
            return []
        try:
            qvec = self.vectorizer.transform([query])
            sims = cosine_similarity(qvec, self.matrix)[0]
            top = np.argsort(sims)[::-1][:top_k]
            return [
                (self.names[int(i)], float(sims[int(i)]))
                for i in top
                if sims[int(i)] > 0
            ]
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("content similarity failed: %s", exc)
            return []

    def content_score(self, query: str, name: str) -> Optional[float]:
        """Similarity (0-1) between ``query`` and ``name``, else None."""
        if not self.is_available or not query:
            return None
        idx = self._name_index.get(_normalize_name(name))
        if idx is None:
            return None
        try:
            qvec = self.vectorizer.transform([query])
            sim = cosine_similarity(qvec, self.matrix[idx])[0][0]
            return float(sim) if sim > 0 else None
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("content score failed: %s", exc)
            return None


def blend_prior(learned: Optional[float], heuristic: float) -> float:
    """Blend a learned prior with the heuristic, clamping to [0, 1]."""
    if learned is None:
        return float(heuristic)
    return float(
        np.clip(LEARNED_WEIGHT * learned + HEURISTIC_WEIGHT * heuristic, 0.0, 1.0)
    )
