#!/usr/bin/env python3
"""train_models.py — offline ML trainer for Time To Travel.

Trains small, CPU-only scikit-learn models from the Indian tourism
datasets in data/training/ and writes artifacts to data/models/:

  * quality_model.joblib     — GradientBoosting regressor: predicted Google
                               rating (0-5) from destination text + features
  * popularity_model.joblib  — GradientBoosting regressor: predicted
                               popularity (dataset scale) from destination text
  * content_vectorizer.joblib + content_matrix.npz + content_names.json
                             — TF-IDF content matcher over the full corpus

Runtime artifacts are loaded lazily by app/services/learned_prior.py with a
graceful fallback to the existing heuristics when absent.

Usage:
    python3 scripts/train_models.py                # full training
    python3 scripts/train_models.py --smoke        # tiny fast run (CI)
    python3 scripts/train_models.py --out-dir ...  # custom output dir
"""

import argparse
import json
import logging
import re
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
)
from sklearn.model_selection import train_test_split
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("train_models")

REPO_DIR = Path(__file__).resolve().parent.parent
TRAINING_DIR = REPO_DIR / "data" / "training"
MODEL_DIR = REPO_DIR / "data" / "models"

RANDOM_STATE = 42


# ── Text cleaning ────────────────────────────────────────────
def clean_text(value: str) -> str:
    """Lowercase, strip list numbering and punctuation noise."""
    if not isinstance(value, str):
        return ""
    text = re.sub(r"^\d+\.\s*", "", value.strip())
    text = re.sub(r"\s+", " ", text)
    return text.lower().strip()


def _first_str(row, keys):
    for key in keys:
        val = row.get(key)
        if pd.notna(val) and str(val).strip():
            return clean_text(val)
    return ""


# ── Dataset builders ─────────────────────────────────────────
def load_quality_dataset(
    training_dir: Path, max_rows: int | None = None
) -> pd.DataFrame:
    """Real Google ratings from Top Indian Places + Places.csv (0-5 target)."""
    frames = []

    top = pd.read_csv(training_dir / "top_indian_places.csv")
    top = top.rename(
        columns={
            "Name": "name",
            "State": "state",
            "City": "city",
            "Type": "ptype",
            "Google review rating": "rating",
            "Entrance Fee in INR": "fee",
            "time needed to visit in hrs": "time_needed",
            "Significance": "significance",
        }
    )
    top["text"] = (
        top["name"].astype(str)
        + " "
        + top["state"].astype(str)
        + " "
        + top["city"].astype(str)
        + " "
        + top["ptype"].astype(str)
        + " "
        + top["significance"].astype(str)
    )
    top = top[["name", "state", "text", "rating", "fee", "time_needed"]]
    top["source"] = "top_indian_places"
    frames.append(top)

    places = pd.read_csv(training_dir / "places.csv")
    places = places.rename(
        columns={
            "Place": "name",
            "City": "city",
            "Ratings": "rating",
            "Place_desc": "desc",
        }
    )
    places["name"] = places["name"].apply(clean_text)
    places["text"] = (
        places["name"].astype(str)
        + " "
        + places["city"].astype(str)
        + " "
        + places["desc"].astype(str)
    )
    places["state"] = ""  # resolved later via state lookup
    places["fee"] = np.nan
    places["time_needed"] = np.nan
    places["source"] = "places"
    frames.append(
        places[["name", "state", "text", "rating", "fee", "time_needed", "source"]]
    )

    df = pd.concat(frames, ignore_index=True)
    df = df[pd.to_numeric(df["rating"], errors="coerce").notna()]
    df["rating"] = df["rating"].clip(0, 5).astype(float)
    df["fee"] = pd.to_numeric(df["fee"], errors="coerce")
    df["time_needed"] = pd.to_numeric(df["time_needed"], errors="coerce")

    if max_rows:
        df = df.sample(n=min(max_rows, len(df)), random_state=RANDOM_STATE)
    logger.info("Quality dataset: %d rows (rating 0-5)", len(df))
    return df.reset_index(drop=True)


def load_intent_dataset(
    training_dir: Path, max_rows: int | None = None
) -> pd.DataFrame:
    """Real user questions with coarse intent labels (qa_questions.csv)."""
    df = pd.read_csv(training_dir / "qa_questions.csv")
    df["question"] = df["question"].fillna("").astype(str).str.strip().str.lower()
    df["coarse_intent"] = df["coarse_intent"].fillna("").astype(str).str.strip()
    df = df[(df["question"] != "") & (df["coarse_intent"] != "")]
    if max_rows:
        df = df.sample(n=min(max_rows, len(df)), random_state=RANDOM_STATE)
    logger.info(
        "Intent dataset: %d rows (%d classes)", len(df), df["coarse_intent"].nunique()
    )
    return df.reset_index(drop=True)


def load_popularity_dataset(
    training_dir: Path, max_rows: int | None = None
) -> pd.DataFrame:
    """Popularity scores from Expanded_Destinations.csv."""
    df = pd.read_csv(training_dir / "expanded_destinations.csv")
    df = df.rename(
        columns={
            "Name": "name",
            "State": "state",
            "Type": "ptype",
            "Popularity": "popularity",
        }
    )
    df["text"] = (
        df["name"].astype(str)
        + " "
        + df["state"].astype(str)
        + " "
        + df["ptype"].astype(str)
    )
    df = df[pd.to_numeric(df["popularity"], errors="coerce").notna()]
    df["popularity"] = df["popularity"].astype(float)
    if max_rows:
        df = df.sample(n=min(max_rows, len(df)), random_state=RANDOM_STATE)
    logger.info("Popularity dataset: %d rows", len(df))
    return df.reset_index(drop=True)


def load_content_corpus(
    training_dir: Path, app_data_dir: Path, max_rows: int | None = None
) -> list[dict]:
    """One text blob per destination across all sources (for TF-IDF matching)."""
    records: dict[str, str] = {}

    def add(name, state, text):
        key = clean_text(name)
        if not key or len(key) < 2:
            return
        blob = " ".join(filter(None, [key, clean_text(state), text])).lower()
        records[key] = blob if key not in records else records[key] + " " + blob

    # Rich synthetic features (text only — validated later). Prefer the
    # validated copy from prepare_training_data.py and skip rows flagged
    # synthetic (Place_N style names pollute the similarity space).
    synth_path = training_dir / "clean" / "tourism_destinations_clean.csv"
    if not synth_path.exists():
        synth_path = training_dir / "tourism_destinations.csv"
    synth = pd.read_csv(synth_path)
    if "is_synthetic" in synth.columns:
        synth = synth[synth["is_synthetic"].fillna(False) != True]  # noqa: E712
    for _, row in synth.iterrows():
        add(
            row["destination_name"],
            row["state_ut"],
            " ".join(
                str(row.get(c) or "")
                for c in [
                    "region",
                    "category",
                    "famous_for",
                    "nearby_cities",
                    "local_language",
                    "popular_festival",
                    "top_local_cuisine",
                    "adventure_activities",
                    "peak_season",
                ]
            ),
        )

    # Real places
    top = pd.read_csv(training_dir / "top_indian_places.csv")
    for _, row in top.iterrows():
        add(row["Name"], row["State"], f"{row['Type']} {row['Significance']}")

    exp = pd.read_csv(training_dir / "expanded_destinations.csv")
    for _, row in exp.iterrows():
        add(row["Name"], row["State"], row["Type"])

    places = pd.read_csv(training_dir / "places.csv")
    for _, row in places.iterrows():
        add(row["Place"], row["City"], row["Place_desc"])

    # Cultural corpora (real descriptions of events, sites and traditions)
    for json_name, keys in (
        ("cultural_events.json", ("title", "description", "state")),
        ("historical_sites.json", ("name", "description", "state")),
        ("local_traditions.json", ("name", "summary", "state")),
    ):
        json_path = training_dir / json_name
        if not json_path.exists():
            continue
        for item in json.loads(json_path.read_text()):
            name = item.get(keys[0], "") or item.get(keys[1], "")
            state = item.get("state", "") or ""
            blob = " ".join(str(item.get(k) or "") for k in keys)
            add(name, state, blob)

    # App's canonical dataset
    app_json = app_data_dir / "india_destinations.json"
    if app_json.exists():
        app_data = json.loads(app_json.read_text())
        for dest in app_data.get("destinations", []):
            add(
                dest.get("name", ""),
                dest.get("state", ""),
                " ".join(
                    [
                        " ".join(dest.get("category", [])),
                        dest.get("region", ""),
                        " ".join(dest.get("highlights", [])),
                    ]
                ),
            )

    corpus = [{"name": name, "text": text} for name, text in records.items()]
    if max_rows and len(corpus) > max_rows:
        corpus = corpus[:max_rows]
    logger.info("Content corpus: %d destinations", len(corpus))
    return corpus


# ── Model training ───────────────────────────────────────────
def build_quality_pipeline(max_features: int = 5000):
    # Column indices (0=text, 1=fee, 2=time_needed) so the pipeline works with
    # plain numpy object arrays at runtime — pandas is NOT a prod dependency.
    pre = ColumnTransformer(
        transformers=[
            (
                "tfidf",
                TfidfVectorizer(
                    max_features=max_features,
                    sublinear_tf=True,
                    ngram_range=(1, 2),
                    stop_words="english",
                ),
                0,
            ),
            (
                "num",
                Pipeline(
                    [
                        ("imp", SimpleImputer(strategy="median")),
                        ("sc", StandardScaler()),
                    ]
                ),
                [1, 2],
            ),
        ]
    )
    return Pipeline(
        [
            ("pre", pre),
            (
                "reg",
                GradientBoostingRegressor(
                    n_estimators=300,
                    learning_rate=0.05,
                    max_depth=3,
                    random_state=RANDOM_STATE,
                    subsample=0.9,
                    max_features=0.8,
                ),
            ),
        ]
    )


def build_popularity_pipeline(max_features: int = 3000):
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    max_features=max_features,
                    sublinear_tf=True,
                    ngram_range=(1, 2),
                    stop_words="english",
                ),
            ),
            (
                "reg",
                GradientBoostingRegressor(
                    n_estimators=300,
                    learning_rate=0.05,
                    max_depth=3,
                    random_state=RANDOM_STATE,
                    subsample=0.9,
                    max_features=0.8,
                ),
            ),
        ]
    )


def build_intent_pipeline(max_features: int = 20000):
    """char-ngram TF-IDF + balanced logistic regression over QA intents.

    Char-wb ngrams are robust to typos and partial words in real chat input.
    """
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    analyzer="char_wb",
                    ngram_range=(2, 5),
                    max_features=max_features,
                    sublinear_tf=True,
                    min_df=2,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=3000,
                    C=5.0,
                    class_weight="balanced",
                    random_state=RANDOM_STATE,
                ),
            ),
        ]
    )


def evaluate_classifier(pipeline, X_train, X_test, y_train, y_test):
    pipeline.fit(X_train, y_train)
    preds = pipeline.predict(X_test)
    return {
        "accuracy": float(accuracy_score(y_test, preds)),
        "f1_macro": float(f1_score(y_test, preds, average="macro")),
        "classes": sorted(str(c) for c in pipeline.classes_),
        "test_rows": int(len(y_test)),
        "train_rows": int(len(y_train)),
    }


def evaluate_regressor(pipeline, X_train, X_test, y_train, y_test):
    pipeline.fit(X_train, y_train)
    preds = pipeline.predict(X_test)
    return {
        "mae": float(mean_absolute_error(y_test, preds)),
        "rmse": float(np.sqrt(mean_squared_error(y_test, preds))),
        "test_rows": int(len(y_test)),
        "train_rows": int(len(y_train)),
    }


def build_content_matcher(corpus, max_features: int = 20000):
    vectorizer = TfidfVectorizer(
        max_features=max_features,
        sublinear_tf=True,
        ngram_range=(1, 2),
        stop_words="english",
        norm="l2",
    )
    texts = [c["text"] for c in corpus]
    matrix = vectorizer.fit_transform(texts)
    names = [c["name"] for c in corpus]
    return vectorizer, matrix, names


# ── Main ─────────────────────────────────────────────────────
def train(training_dir: Path, out_dir: Path, smoke: bool = False) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)

    limit = 200 if smoke else None
    max_features = 1000 if smoke else None

    quality = load_quality_dataset(training_dir, max_rows=limit)
    popularity = load_popularity_dataset(training_dir, max_rows=limit)
    corpus = load_content_corpus(training_dir, REPO_DIR / "data", max_rows=limit)

    metadata = {"smoke": smoke, "trained_at": pd.Timestamp.utcnow().isoformat()}

    # A1 — quality (rating) regressor
    quality_xy = quality[["text", "rating", "fee", "time_needed"]].copy()
    X = quality_xy[["text", "fee", "time_needed"]].astype(object).values
    y = quality_xy["rating"].astype(float)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )
    pipe = build_quality_pipeline(max_features or 5000)
    metrics = evaluate_regressor(pipe, X_train, X_test, y_train, y_test)
    metrics["target"] = "rating_0_5"
    metadata["quality"] = metrics
    joblib.dump(pipe, out_dir / "quality_model.joblib")
    logger.info(
        "Quality model  → MAE %.3f  RMSE %.3f (%d test rows)",
        metrics["mae"],
        metrics["rmse"],
        metrics["test_rows"],
    )

    # A2 — popularity regressor
    Xp = popularity["text"]
    yp = popularity["popularity"].astype(float)
    Xp_tr, Xp_te, yp_tr, yp_te = train_test_split(
        Xp, yp, test_size=0.2, random_state=RANDOM_STATE
    )
    pipe_p = build_popularity_pipeline(max_features or 3000)
    metrics_p = evaluate_regressor(pipe_p, Xp_tr, Xp_te, yp_tr, yp_te)
    metrics_p["target"] = "popularity"
    metrics_p["popularity_min"] = float(yp.min())
    metrics_p["popularity_max"] = float(yp.max())
    metadata["popularity"] = metrics_p
    joblib.dump(pipe_p, out_dir / "popularity_model.joblib")
    logger.info(
        "Popularity model → MAE %.3f  RMSE %.3f (%d test rows)",
        metrics_p["mae"],
        metrics_p["rmse"],
        metrics_p["test_rows"],
    )

    # B — content matcher
    vectorizer, matrix, names = build_content_matcher(corpus, max_features or 20000)
    joblib.dump(vectorizer, out_dir / "content_vectorizer.joblib")
    joblib.dump(matrix, out_dir / "content_matrix.joblib")
    (out_dir / "content_names.json").write_text(json.dumps(names))
    metadata["content"] = {"destinations": len(names)}

    # C1 — QA intent classifier (real user questions)
    intent = load_intent_dataset(training_dir, max_rows=limit)
    Xi = intent["question"]
    yi = intent["coarse_intent"]
    Xi_tr, Xi_te, yi_tr, yi_te = train_test_split(
        Xi, yi, test_size=0.2, random_state=RANDOM_STATE
    )
    pipe_i = build_intent_pipeline(max_features or 20000)
    metrics_i = evaluate_classifier(pipe_i, Xi_tr, Xi_te, yi_tr, yi_te)
    metrics_i["target"] = "coarse_intent"
    metadata["intent"] = metrics_i
    joblib.dump(pipe_i, out_dir / "intent_model.joblib")
    logger.info(
        "Intent model    → accuracy %.3f  f1 %.3f (%d test rows)",
        metrics_i["accuracy"],
        metrics_i["f1_macro"],
        metrics_i["test_rows"],
    )

    # C2 — QA retrieval index (nearest-question matching for chat fallback)
    qa_vec = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(2, 5),
        max_features=max_features or 20000,
        sublinear_tf=True,
        min_df=2,
    )
    qa_matrix = qa_vec.fit_transform(intent["question"])
    qa_index = [
        {"question": q, "coarse": c, "fine": f}
        for q, c, f in zip(
            intent["question"], intent["coarse_intent"], intent["fine_intent"]
        )
    ]
    joblib.dump(qa_vec, out_dir / "qa_vectorizer.joblib")
    joblib.dump(qa_matrix, out_dir / "qa_matrix.joblib")
    (out_dir / "qa_index.json").write_text(json.dumps(qa_index, ensure_ascii=False))
    metadata["qa"] = {"questions": len(qa_index)}

    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))
    logger.info("Artifacts written to %s", out_dir)
    return metadata


def main(argv=None):
    parser = argparse.ArgumentParser(description="Train Time To Travel ML artifacts")
    parser.add_argument("--training-dir", type=Path, default=TRAINING_DIR)
    parser.add_argument("--out-dir", type=Path, default=MODEL_DIR)
    parser.add_argument("--smoke", action="store_true", help="Tiny fast run for CI")
    args = parser.parse_args(argv)
    train(args.training_dir, args.out_dir, smoke=args.smoke)
    return 0


if __name__ == "__main__":
    sys.exit(main())
