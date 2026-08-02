"""
Hermetic tests for scripts/audit_targets.py — the learnability audit must
detect real signal and reject pure noise.
"""

import numpy as np
import pandas as pd

from scripts.audit_targets import (
    DEFAULT_TEXT_COLS,
    audit,
    audit_categorical,
    audit_numeric,
)

rng = np.random.RandomState(7)
N = 400


def _make_noise_csv(tmp_path):
    """Synthetic generator with NO signal: labels are random."""
    words = ["beach", "mountain", "temple", "desert", "forest", "lake"]
    df = pd.DataFrame(
        {
            "state_ut": rng.choice(["Goa", "Kerala", "Rajasthan"], N),
            "region": rng.choice(words, N),
            "category": rng.choice(words, N),
            "famous_for": rng.choice(words, N),
            "nearby_cities": rng.choice(words, N),
            "local_language": rng.choice(words, N),
            "popular_festival": rng.choice(words, N),
            "top_local_cuisine": rng.choice(words, N),
            "adventure_activities": rng.choice(words, N),
            "peak_season": rng.choice(["summer", "winter", "monsoon"], N),
            "safety_rating_1_5": rng.uniform(1, 5, N),
        }
    )
    path = tmp_path / "noise.csv"
    df.to_csv(path, index=False)
    return path


def _make_signal_csv(tmp_path):
    """Label + cost derived from the text: strong learnable signal."""
    seasons = ["winter" if i % 2 else "summer" for i in range(N)]
    df = pd.DataFrame(
        {
            "desc": [
                (
                    "winter skiing in the snow peaks"
                    if s == "winter"
                    else "summer beach sunbathing"
                )
                for s in seasons
            ],
            "peak_season": seasons,
            "cost": [
                (
                    500.0 + rng.uniform(-10, 10)
                    if s == "winter"
                    else 200.0 + rng.uniform(-10, 10)
                )
                for s in seasons
            ],
        }
    )
    path = tmp_path / "signal.csv"
    df.to_csv(path, index=False)
    return path


class TestAuditRejectsNoise:
    def test_numeric_targets_flagged_unlearnable(self, tmp_path):
        path = _make_noise_csv(tmp_path)
        results = audit(path, DEFAULT_TEXT_COLS, ["peak_season"], ["safety_rating_1_5"])
        assert results["peak_season"]["learnable"] is False
        assert results["safety_rating_1_5"]["learnable"] is False
        assert results["safety_rating_1_5"]["improvement"] < 0.10

    def test_categorical_noise_near_chance(self, tmp_path):
        path = _make_noise_csv(tmp_path)
        results = audit(path, DEFAULT_TEXT_COLS, ["peak_season"], [])
        acc = results["peak_season"]["accuracy"]
        assert abs(acc - results["peak_season"]["chance"]) < 0.10


class TestAuditDetectsSignal:
    def test_categorical_signal_flagged_learnable(self, tmp_path):
        path = _make_signal_csv(tmp_path)
        results = audit(path, ["desc"], ["peak_season"], ["cost"])
        assert results["peak_season"]["learnable"] is True
        assert results["peak_season"]["accuracy"] > 0.9

    def test_numeric_signal_flagged_learnable(self, tmp_path):
        path = _make_signal_csv(tmp_path)
        results = audit(path, ["desc"], [], ["cost"])
        assert results["cost"]["learnable"] is True
        assert results["cost"]["improvement"] > 0.5


class TestAuditHelpers:
    def test_audit_categorical_contract(self, tmp_path):
        df = pd.DataFrame(
            {"t": ["a x", "b y"] * 100, "label": ["winter", "summer"] * 100}
        )
        X = np.zeros((200, 2))
        y = pd.Series(df["label"].values)
        idx_tr, idx_te = np.arange(100), np.arange(100, 200)
        res = audit_categorical(X, y, idx_tr, idx_te)
        assert res["kind"] == "categorical"
        assert 0 <= res["accuracy"] <= 1
        assert res["classes"] == 2

    def test_audit_numeric_contract(self, tmp_path):
        y = pd.Series(np.arange(200, dtype=float))
        X = np.zeros((200, 2))
        res = audit_numeric(X, y, np.arange(100), np.arange(100, 200))
        assert res["kind"] == "numeric"
        assert res["baseline_mae"] > 0

    def test_missing_columns_skipped(self, tmp_path):
        path = _make_noise_csv(tmp_path)
        results = audit(path, ["nope"], ["peak_season"], ["also_missing"])
        assert "peak_season" not in results
