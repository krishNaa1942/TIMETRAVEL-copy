#!/usr/bin/env python3
"""evaluate_chat_qa.py — end-to-end gate for the chatbot QA intent flow.

Feeds every real user question from qa_questions.csv through the full
two-tier `classify_intent()` (handcrafted pipeline, then the offline QA
model), and measures how often the final intent matches the annotated
coarse-intent mapped onto response templates.

Usage:
    python3 scripts/evaluate_chat_qa.py              # full report (real models)
    python3 scripts/evaluate_chat_qa.py --smoke      # CI gate (smoke models)
"""

import argparse
import json
import logging
import os
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts import train_models as tm  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("evaluate_chat_qa")

REPO_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = REPO_DIR / "data" / "models"

# Hard gate for the full two-tier chat flow on real artifacts.
# Chance / majority-class baseline for 7 intents = 0.244.
# Measured 0.840 before the classic tier was trained on real QA data,
# 0.930 after (classic tier covers 98% of questions itself).
CHAT_GATES = {
    "chat_intent_accuracy": 0.85,
}

# Structural gate for CI, where the learned tier is trained on the tiny
# smoke subset (200 rows) and cannot classify real questions reliably.
# These only catch flow collapse (all-fallback / crashes); the quality
# gate above is enforced on real artifacts (local/CI-cached full train).
SMOKE_CHAT_GATES = {
    "chat_intent_accuracy": 0.25,  # majority-class baseline = 0.244
    "fallback_rate": 0.80,
}


def build_qa_pairs(questions, coarse_intents, intent_map):
    """Pair QA questions with mapped template tags, dropping unmapped
    coarse intents (defensive: currently all 7 coarse intents are mapped)."""
    return [
        (str(q), intent_map[coarse])
        for q, coarse in zip(questions, coarse_intents)
        if coarse in intent_map
    ]


def chat_qa_report(classify_fn, questions, expected):
    """Score a classifier against QA labels.

    Args:
        classify_fn: callable question -> (intent_tag, confidence).
        questions: sequence of user question strings.
        expected: sequence of mapped template tags (same length).

    Returns:
        dict with accuracy, fallback_rate and per-intent recall.
    """
    if len(questions) != len(expected):
        raise ValueError("questions and expected must have equal length")

    correct = 0
    fallbacks = 0
    per_intent = Counter()
    per_intent_hits = Counter()
    predicted = [classify_fn(q) for q in questions]
    for q, (intent, _confidence), exp in zip(questions, predicted, expected):
        per_intent[exp] += 1
        if intent == exp:
            correct += 1
            per_intent_hits[exp] += 1
        if intent == "fallback":
            fallbacks += 1

    total = len(questions)
    return {
        "questions": total,
        "chat_intent_accuracy": round(correct / max(total, 1), 4),
        "fallback_rate": round(fallbacks / max(total, 1), 4),
        "per_intent_recall": {
            intent: round(per_intent_hits[intent] / max(count, 1), 4)
            for intent, count in sorted(per_intent.items())
        },
    }


LOWER_IS_BETTER = {"fallback_rate"}


def check_gates(metrics, gates):
    failures = []
    for gate, limit in gates.items():
        value = metrics[gate]
        if gate in LOWER_IS_BETTER:
            failed = value > limit
        else:
            failed = value < limit
        if failed:
            failures.append(f"{gate}={value:.3f} vs limit={limit}")
    return failures


def main(argv=None):
    parser = argparse.ArgumentParser(description="Evaluate chatbot QA flow")
    parser.add_argument("--model-dir", type=Path, default=MODEL_DIR)
    parser.add_argument("--smoke", action="store_true", help="CI gate mode")
    args = parser.parse_args(argv)

    if str(args.model_dir) != str(MODEL_DIR):
        os.environ["MODELS_DIR"] = str(args.model_dir)
    from app.chatbot.engine import QA_INTENT_MAP, classify_intent  # noqa: E402

    dataset = tm.load_intent_dataset(tm.TRAINING_DIR)
    pairs = build_qa_pairs(dataset["question"], dataset["coarse_intent"], QA_INTENT_MAP)
    questions = [q for q, _ in pairs]
    expected = [e for _, e in pairs]
    logger.info(
        "Evaluating classify_intent() on %d real QA questions (%d intents)",
        len(questions),
        len(set(expected)),
    )

    metrics = chat_qa_report(classify_intent, questions, expected)
    print(
        f"chat      accuracy={metrics['chat_intent_accuracy']:.3f} "
        f"fallback_rate={metrics['fallback_rate']:.3f} "
        f"({metrics['questions']} questions)"
    )
    for intent, recall in sorted(metrics["per_intent_recall"].items()):
        print(f"  {intent:20s} recall={recall:.3f}")

    (args.model_dir / "chat_evaluation.json").write_text(json.dumps(metrics, indent=2))

    if args.smoke:
        gates = SMOKE_CHAT_GATES
    else:
        gates = CHAT_GATES
    failures = check_gates(metrics, gates)
    if failures:
        logger.error("CHAT QA FAILED: %s", "; ".join(failures))
        return 1
    mode = "SMOKE" if args.smoke else "FULL"
    print(f"CHAT QA {mode} PASSED (all gates within thresholds).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
