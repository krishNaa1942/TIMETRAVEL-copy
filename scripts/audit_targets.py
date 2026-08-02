#!/usr/bin/env python3
"""audit_targets.py — learnability audit for ML training targets.

Before investing in model training, verify that the text features of a
dataset actually carry signal for each candidate target:

* categorical targets: classifier accuracy vs the chance baseline
  (1 / n_classes)
* numeric targets: regressor MAE vs the mean-predicting baseline
  (positive improvement % = the model extracts real signal)

Exit code is 0 even when nothing is learnable — this is an informational
gate that CI logs and that prevents garbage models from being shipped.

Usage:
    python3 scripts/audit_targets.py
        --source data/training/clean/tourism_destinations_clean.csv
        --text-cols region category famous_for ...       (default: curated)
        --categorical peak_season safety_rating_1_5 ...
        --numeric avg_hotel_cost_inr entry_fee_inr ...
"""

import argparse
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, mean_absolute_error
from sklearn.model_selection import train_test_split

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("audit_targets")

REPO_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = (
    REPO_DIR / "data" / "training" / "clean" / "tourism_destinations_clean.csv"
)

# Feature columns excluded from the default text input because they are
# targets themselves (peak_season/off_season/most_visited_month) or pure
# identifiers (destination_name, DestinationID).
DEFAULT_TEXT_COLS = [
    "state_ut",
    "region",
    "category",
    "famous_for",
    "nearby_cities",
    "local_language",
    "popular_festival",
    "top_local_cuisine",
    "adventure_activities",
]

DEFAULT_CATEGORICAL = ["peak_season"]
DEFAULT_NUMERIC = [
    "avg_hotel_cost_inr",
    "entry_fee_inr",
    "safety_rating_1_5",
    "women_traveler_safety_1_5",
    "avg_monthly_visitors",
]

RANDOM_STATE = 42


def _clean_text(value) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(str(value).lower().split())


def _build_text(df: pd.DataFrame, text_cols) -> pd.Series:
    return (
        df[text_cols]
        .fillna("")
        .astype(str)
        .agg(lambda row: " ".join(_clean_text(v) for v in row), axis=1)
    )


def audit(source: Path, text_cols, categorical, numeric, max_rows=None) -> dict:
    df = pd.read_csv(source)
    if max_rows and len(df) > max_rows:
        df = df.sample(n=max_rows, random_state=RANDOM_STATE)

    text_cols = [c for c in text_cols if c in df.columns]
    if not text_cols:
        logger.error("no usable text columns in %s", source.name)
        return {}

    text = _build_text(df, text_cols)
    vectorizer = TfidfVectorizer(
        max_features=2000,
        sublinear_tf=True,
        ngram_range=(1, 2),
        stop_words="english",
    )
    X = vectorizer.fit_transform(text)
    idx_tr, idx_te = train_test_split(
        np.arange(len(df)), test_size=0.2, random_state=RANDOM_STATE
    )

    results = {}
    for col in categorical:
        if col not in df.columns:
            logger.warning("categorical column %s not in %s", col, source.name)
            continue
        y = df[col].astype(str).str.strip()
        y = y[y != ""]
        if y.nunique() < 2:
            logger.warning("column %s is constant — skipped", col)
            continue
        results[col] = audit_categorical(X, y, idx_tr, idx_te)

    for col in numeric:
        if col not in df.columns:
            logger.warning("numeric column %s not in %s", col, source.name)
            continue
        y = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(y) < 50:
            logger.warning("column %s too few rows — skipped", col)
            continue
        results[col] = audit_numeric(X, y, idx_tr, idx_te)

    return results


def audit_categorical(X, y, idx_tr, idx_te):
    classes = sorted(set(y.iloc[idx_tr]))
    chance = 1.0 / max(len(classes), 1)
    pipe = LogisticRegression(
        multi_class="multinomial",
        solver="lbfgs",
        max_iter=2000,
        class_weight="balanced",
        random_state=RANDOM_STATE,
    )
    pipe.fit(X[idx_tr], y.iloc[idx_tr])
    acc = accuracy_score(y.iloc[idx_te], pipe.predict(X[idx_te]))
    return {
        "kind": "categorical",
        "classes": len(classes),
        "chance": round(chance, 3),
        "accuracy": round(acc, 3),
        "improvement": round(acc - chance, 3),
        "learnable": acc > chance + 0.10,
    }


def audit_numeric(X, y, idx_tr, idx_te):
    ytr, yte = y.iloc[idx_tr], y.iloc[idx_te]
    baseline = mean_absolute_error(yte, np.full(len(yte), float(ytr.mean())))
    gbr = GradientBoostingRegressor(
        n_estimators=150, max_depth=3, random_state=RANDOM_STATE
    )
    gbr.fit(X[idx_tr], ytr)
    mae = mean_absolute_error(yte, gbr.predict(X[idx_te]))
    improvement = (baseline - mae) / max(baseline, 1e-9)
    return {
        "kind": "numeric",
        "mae": round(float(mae), 2),
        "baseline_mae": round(float(baseline), 2),
        "improvement": round(float(improvement), 4),
        "learnable": improvement > 0.10,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Learnability audit for ML training targets"
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--text-cols", nargs="+", default=DEFAULT_TEXT_COLS)
    parser.add_argument(
        "--categorical",
        nargs="*",
        default=None,
        help="categorical targets (default: %s)" % " ".join(DEFAULT_CATEGORICAL),
    )
    parser.add_argument(
        "--numeric",
        nargs="*",
        default=None,
        help="numeric targets (default: %s)" % " ".join(DEFAULT_NUMERIC),
    )
    parser.add_argument("--max-rows", type=int, default=None)
    args = parser.parse_args(argv)

    if not args.source.exists():
        logger.error("source not found: %s", args.source)
        return 1

    results = audit(
        args.source,
        args.text_cols,
        args.categorical if args.categorical is not None else DEFAULT_CATEGORICAL,
        args.numeric if args.numeric is not None else DEFAULT_NUMERIC,
        max_rows=args.max_rows,
    )
    if not results:
        logger.error("no auditable targets found")
        return 1

    print(f"\nLearnability audit: {args.source.name}")
    print(f"{'target':32s} {'kind':12s} {'metric':>28s} {'improvement':>12s}  verdict")
    for col, res in results.items():
        if res["kind"] == "categorical":
            metric = f"acc {res['accuracy']:.3f} (chance {res['chance']:.3f})"
        else:
            metric = f"MAE {res['mae']:.2f} (baseline {res['baseline_mae']:.2f})"
        verdict = "LEARNABLE" if res["learnable"] else "no signal"
        print(
            f"{col:32s} {res['kind']:12s} {metric:>28s} "
            f"{res['improvement']:>11.1%}  {verdict}"
        )
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
