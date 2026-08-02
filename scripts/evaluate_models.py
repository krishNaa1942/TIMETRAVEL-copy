#!/usr/bin/env python3
"""evaluate_models.py — evaluation + CI smoke test for ML artifacts.

Reruns the held-out evaluation for the trained models and (in --smoke mode)
fails hard if metrics regress beyond the thresholds stored in metadata.

Usage:
    python3 scripts/evaluate_models.py            # full report
    python3 scripts/evaluate_models.py --smoke    # CI gate (exit 1 on regress)
"""

import argparse
import json
import logging
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts import train_models as tm  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("evaluate_models")

REPO_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = REPO_DIR / "data" / "models"

# Hard gates for --smoke (CI). Tune only with evidence.
SMOKE_GATES = {
    "quality_mae": 0.6,
    "popularity_mae": 1.0,
    "content_precision_at_5": 0.30,
    # Contamination guard: the quality regressor may only ever train on real
    # Google ratings (top_indian_places / places.csv), never synthetic rows.
    "quality_synthetic_rows": 0,
    # QA intent classifier on real user questions (chance = 0.143).
    "intent_accuracy": 0.80,
}


def content_precision_at_5(corpus, vectorizer, matrix, names, k=5, sample=500):
    """Fraction of held-out destinations whose same-state neighbour appears in
    the top-k content matches. Sanity metric for the TF-IDF matcher."""
    rng = np.random.RandomState(tm.RANDOM_STATE)
    # Sample within the matrix dimension so smoke-trained artifacts
    # (smaller corpus) are evaluated consistently.
    size = min(sample, len(names), len(corpus))
    idx = rng.choice(len(names), size=size, replace=False)
    hits = 0
    total = 0
    from sklearn.metrics.pairwise import cosine_similarity

    name_to_state = {}
    app_json = REPO_DIR / "data" / "india_destinations.json"
    if app_json.exists():
        for d in json.loads(app_json.read_text()).get("destinations", []):
            name_to_state[d["name"].lower()] = d.get("state", "").lower()
    exp = pd.read_csv(REPO_DIR / "data" / "training" / "expanded_destinations.csv")
    for _, row in exp.iterrows():
        name_to_state.setdefault(str(row["Name"]).lower(), str(row["State"]).lower())
    top = pd.read_csv(REPO_DIR / "data" / "training" / "top_indian_places.csv")
    for _, row in top.iterrows():
        name_to_state.setdefault(str(row["Name"]).lower(), str(row["State"]).lower())

    for i in idx:
        state = name_to_state.get(corpus[i]["name"].lower())
        if not state:
            continue
        qvec = vectorizer.transform([corpus[i]["text"]])
        sims = cosine_similarity(qvec, matrix)[0]
        sims[i] = -1  # exclude self
        top_idx = np.argsort(sims)[-k:][::-1]
        if any(state == name_to_state.get(names[j].lower()) for j in top_idx):
            hits += 1
        total += 1
    return hits / max(total, 1)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Evaluate trained ML artifacts")
    parser.add_argument("--model-dir", type=Path, default=MODEL_DIR)
    parser.add_argument(
        "--smoke", action="store_true", help="CI gate with hard thresholds"
    )
    parser.add_argument(
        "--real-only",
        action="store_true",
        help="Restrict quality evaluation to real Google ratings "
        "(top_indian_places) and gate synthetic contamination",
    )
    args = parser.parse_args(argv)

    model_dir = args.model_dir
    if not (model_dir / "metadata.json").exists():
        logger.error(
            "No metadata.json in %s — run scripts/train_models.py first.", model_dir
        )
        return 1

    metadata = json.loads((model_dir / "metadata.json").read_text())

    report = {"quality": None, "popularity": None, "content_precision_at_5": None}
    gates = {
        "quality_mae": None,
        "popularity_mae": None,
        "content_precision_at_5": None,
    }
    # Re-run the same split/pipeline as the trainer for an honest recheck
    quality = tm.load_quality_dataset(tm.TRAINING_DIR)
    synthetic_rows = int(
        (quality["source"] == "synthetic").sum() if "source" in quality.columns else 0
    )
    gates["quality_synthetic_rows"] = synthetic_rows
    if args.real_only and "source" in quality.columns:
        quality = quality[quality["source"] != "synthetic"]
        logger.info(
            "Real-only mode: %d rows (synthetic: %d)", len(quality), synthetic_rows
        )
    Xq = quality[["text", "fee", "time_needed"]].astype(object).values
    yq = quality["rating"].astype(float)
    Xq_tr, Xq_te, yq_tr, yq_te = train_test_split(
        Xq, yq, test_size=0.2, random_state=tm.RANDOM_STATE
    )
    pipe_q = tm.build_quality_pipeline()
    pipe_q.fit(Xq_tr, yq_tr)
    pred_q = pipe_q.predict(Xq_te)
    q_mae = float(mean_absolute_error(yq_te, pred_q))
    q_rmse = float(np.sqrt(mean_squared_error(yq_te, pred_q)))
    report["quality"] = {"mae": round(q_mae, 4), "rmse": round(q_rmse, 4)}
    gates["quality_mae"] = q_mae
    print(
        f"quality  MAE={q_mae:.3f} RMSE={q_rmse:.3f}  "
        f"(trained {metadata['quality']['mae']:.3f}, synthetic rows: {synthetic_rows})"
    )

    pop = tm.load_popularity_dataset(tm.TRAINING_DIR)
    Xp = pop["text"]
    yp = pop["popularity"].astype(float)
    Xp_tr, Xp_te, yp_tr, yp_te = train_test_split(
        Xp, yp, test_size=0.2, random_state=tm.RANDOM_STATE
    )
    pipe_p = tm.build_popularity_pipeline()
    pipe_p.fit(Xp_tr, yp_tr)
    pred_p = pipe_p.predict(Xp_te)
    p_mae = float(mean_absolute_error(yp_te, pred_p))
    report["popularity"] = {
        "mae": round(p_mae, 4),
        "rmse": round(float(np.sqrt(mean_squared_error(yp_te, pred_p))), 4),
    }
    gates["popularity_mae"] = p_mae
    print(f"popularity MAE={p_mae:.3f}  (trained {metadata['popularity']['mae']:.3f})")

    corpus = tm.load_content_corpus(tm.TRAINING_DIR, REPO_DIR / "data")
    vectorizer = joblib.load(model_dir / "content_vectorizer.joblib")
    matrix = joblib.load(model_dir / "content_matrix.joblib")
    names = json.loads((model_dir / "content_names.json").read_text())
    p_at_5 = content_precision_at_5(corpus, vectorizer, matrix, names)
    report["content_precision_at_5"] = round(p_at_5, 4)
    gates["content_precision_at_5"] = p_at_5
    print(f"content   same-state precision@5 = {p_at_5:.3f}")

    intent = tm.load_intent_dataset(tm.TRAINING_DIR)
    Xi = intent["question"]
    yi = intent["coarse_intent"]
    Xi_tr, Xi_te, yi_tr, yi_te = train_test_split(
        Xi, yi, test_size=0.2, random_state=tm.RANDOM_STATE
    )
    pipe_i = tm.build_intent_pipeline()
    pipe_i.fit(Xi_tr, yi_tr)
    pred_i = pipe_i.predict(Xi_te)
    from sklearn.metrics import accuracy_score, f1_score

    i_acc = float(accuracy_score(yi_te, pred_i))
    i_f1 = float(f1_score(yi_te, pred_i, average="macro"))
    report["intent_accuracy"] = round(i_acc, 4)
    gates["intent_accuracy"] = i_acc
    print(
        f"intent    accuracy={i_acc:.3f} f1={i_f1:.3f}  (trained {metadata['intent']['accuracy']:.3f})"
    )

    (model_dir / "evaluation.json").write_text(json.dumps(report, indent=2))

    if args.smoke:
        failures = []
        higher_is_better = {
            g: g in ("content_precision_at_5", "intent_accuracy") for g in gates
        }
        for gate, value in gates.items():
            limit = SMOKE_GATES[gate]
            # Accuracy/precision gates: higher is better → fail when below.
            # MAE/count gates: lower is better → fail when above.
            failed = value < limit if higher_is_better[gate] else value > limit
            if failed:
                failures.append(f"{gate}={value:.3f} vs limit={limit}")
        if failures:
            logger.error("SMOKE FAILED: %s", "; ".join(failures))
            return 1
        print("SMOKE PASSED (all gates within thresholds).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
