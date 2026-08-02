#!/usr/bin/env python3
"""prepare_training_data.py — ingest, clean and validate training sources.

Two responsibilities:

1. ``ingest`` (requires --source-dir, e.g. your Downloads dataset folder):
   copies the raw sources into ``data/training/`` in a normalized form:
   * 5000TravelQuestionsDataset.csv  -> qa_questions.csv (UTF-8, header,
     trailing-newline tag noise removed)
   * cultural_events.json / historical_sites.json / local_traditions.json
     (validated, copied as-is)
   * tourism_destinations-*.csv      -> tourism_destinations.csv

2. ``validate`` (always runs): reads the committed raw CSVs and writes
   cleaned copies under ``data/training/clean/`` plus a
   ``validation_report.json``:
   * drops duplicate names and rows with invalid/empty states
   * canonicalizes state names (CITY_TO_STATE_MAPPING from the user's ETL)
   * flags synthetic rows (Place_N style names) — the whole
     tourism_destinations.csv is synthetic, so every row is flagged; the
     content-matcher trainer skips them to avoid polluting similarity.

Usage:
    python3 scripts/prepare_training_data.py --source-dir "<datasets dir>"
    python3 scripts/prepare_training_data.py            # CI: validate only
"""

import argparse
import json
import logging
import re
import sys
from pathlib import Path

import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("prepare_training_data")

REPO_DIR = Path(__file__).resolve().parent.parent
TRAINING_DIR = REPO_DIR / "data" / "training"
CLEAN_DIR = TRAINING_DIR / "clean"

VALID_INDIAN_STATES = {
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman And Nicobar Islands",
    "Chandigarh",
    "Dadra And Nagar Haveli And Daman And Diu",
    "Delhi",
    "Jammu And Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
}

CITY_TO_STATE_MAPPING = {
    "Ajanta And Ellora Caves": "Maharashtra",
    "Alibaug": "Maharashtra",
    "Alleppey": "Kerala",
    "Almora": "Uttarakhand",
    "Amarnath": "Jammu And Kashmir",
    "Andaman": "Andaman And Nicobar Islands",
    "Auli": "Uttarakhand",
    "Bodh Gaya": "Bihar",
    "Cherrapunji": "Meghalaya",
    "Chittorgarh": "Rajasthan",
    "Coorg": "Karnataka",
    "Dalhousie": "Himachal Pradesh",
    "Darjeeling": "West Bengal",
    "Dharamshala": "Himachal Pradesh",
    "Digha": "West Bengal",
    "Gulmarg": "Jammu And Kashmir",
    "Hogenakkal": "Tamil Nadu",
    "Jaisalmer": "Rajasthan",
    "Jim Corbett National Park": "Uttarakhand",
    "Kalimpong": "West Bengal",
    "Kanyakumari": "Tamil Nadu",
    "Kasauli": "Himachal Pradesh",
    "Kasol": "Himachal Pradesh",
    "Khajuraho": "Madhya Pradesh",
    "Khandala": "Maharashtra",
    "Kodaikanal": "Tamil Nadu",
    "Kovalam": "Kerala",
    "Lakshadweep": "Lakshadweep",
    "Lavasa": "Maharashtra",
    "Leh Ladakh": "Ladakh",
    "Lonavala": "Maharashtra",
    "Madikeri": "Karnataka",
    "Mahabaleshwar": "Maharashtra",
    "Manali": "Himachal Pradesh",
    "Matheran": "Maharashtra",
    "Mcleodganj": "Himachal Pradesh",
    "Mount Abu": "Rajasthan",
    "Munnar": "Kerala",
    "Mussoorie": "Uttarakhand",
    "Nahan": "Himachal Pradesh",
    "Nainital": "Uttarakhand",
    "Ooty": "Tamil Nadu",
    "Pachmarhi": "Madhya Pradesh",
    "Poovar": "Kerala",
    "Puri": "Odisha",
    "Pushkar": "Rajasthan",
    "Rameshwaram": "Tamil Nadu",
    "Ranthambore": "Rajasthan",
    "Rishikesh": "Uttarakhand",
    "Shimoga (Shivamogga)": "Karnataka",
    "Shirdi": "Maharashtra",
    "Vaishno Devi": "Jammu And Kashmir",
    "Varkala": "Kerala",
    "Vrindavan": "Uttar Pradesh",
    "Wayanad": "Kerala",
}

GARBAGE_NAME_RE = re.compile(
    r"^(Place_\d+|Place \d+|Sample\d*|Test\d*|Unknown|Unnamed|N/A|None)$",
    re.IGNORECASE,
)

STATE_TITLE_FIXES = {
    "Jammu & Kashmir": "Jammu And Kashmir",
    "Jammu and Kashmir": "Jammu And Kashmir",
    "Andaman & Nicobar Islands": "Andaman And Nicobar Islands",
    "Daman And Diu": "Dadra And Nagar Haveli And Daman And Diu",
    "Dadra And Nagar Haveli": "Dadra And Nagar Haveli And Daman And Diu",
    "Uttar Pradesh (UP)": "Uttar Pradesh",
    "Tamilnadu": "Tamil Nadu",
    "Karnatka": "Karnataka",
    "West-Bengal": "West Bengal",
}


def _canonical_state(value) -> str:
    """Best-effort canonicalization of an Indian state name."""
    if not isinstance(value, str) or not value.strip():
        return ""
    text = re.sub(r"\s+", " ", value.strip()).title()
    text = STATE_TITLE_FIXES.get(text, text)
    if text == "J&K":
        text = "Jammu And Kashmir"
    return text


def _is_valid_state(value) -> bool:
    return bool(value) and value in VALID_INDIAN_STATES


def _is_garbage_name(value) -> bool:
    return bool(GARBAGE_NAME_RE.match((value or "").strip()))


# ── Ingest ───────────────────────────────────────────────────
def ingest(source_dir: Path, training_dir: Path) -> None:
    """Copy raw external sources into data/training/ in normalized form."""
    source_dir = Path(source_dir)
    training_dir.mkdir(parents=True, exist_ok=True)

    qa_path = source_dir / "5000TravelQuestionsDataset.csv"
    if qa_path.exists():
        raw = pd.read_csv(qa_path, encoding="latin-1", header=None, dtype=str)
        qa = _clean_qa(raw)
        out = training_dir / "qa_questions.csv"
        qa.to_csv(out, index=False, encoding="utf-8")
        logger.info(
            "QA dataset: %d rows (dropped %d) -> %s",
            len(qa),
            len(raw) - len(qa),
            out.name,
        )
    else:
        logger.warning("Skipping QA ingest: %s not found", qa_path.name)

    for name, required_keys in (
        ("cultural_events.json", ("title", "state")),
        ("historical_sites.json", ("name", "state")),
        ("local_traditions.json", ("name", "state")),
    ):
        src = source_dir / name
        if not src.exists():
            logger.warning("Skipping %s: not found", name)
            continue
        data = json.loads(src.read_text())
        missing = sum(1 for item in data if not all(k in item for k in required_keys))
        if missing:
            logger.warning("%s: %d items missing required keys", name, missing)
        (training_dir / name).write_text(
            json.dumps(data, ensure_ascii=False), encoding="utf-8"
        )
        logger.info("%s: %d records copied", name, len(data))

    raw_csv = next(source_dir.glob("tourism_destinations-*.csv"), None)
    if raw_csv is not None:
        df = pd.read_csv(raw_csv)
        out = training_dir / "tourism_destinations.csv"
        df.to_csv(out, index=False)
        logger.info(
            "tourism_destinations.csv: %d rows copied from %s", len(df), raw_csv.name
        )
    else:
        logger.warning("Skipping tourism_destinations ingest: no source csv")


def _clean_qa(raw: pd.DataFrame) -> pd.DataFrame:
    """Normalize the headerless latin-1 QA file into question/coarse/fine."""
    qa = raw.copy()
    qa.columns = ["question", "coarse_intent", "fine_intent"]
    for col in ("coarse_intent", "fine_intent"):
        qa[col] = qa[col].fillna("").astype(str).str.strip()
    qa["question"] = qa["question"].fillna("").astype(str).str.strip()
    qa = qa[(qa["question"] != "") & (qa["coarse_intent"] != "")]
    return qa.reset_index(drop=True)


# ── Validate ─────────────────────────────────────────────────
def validate_tourism_destinations(df: pd.DataFrame) -> tuple:
    """Dedupe, canonicalize states, flag synthetic rows."""
    report = {
        "input_rows": int(len(df)),
        "duplicates_dropped": 0,
        "invalid_state_dropped": 0,
        "synthetic_rows": 0,
    }
    clean = df.copy()

    dup = clean["destination_name"].duplicated(keep="first")
    report["duplicates_dropped"] = int(dup.sum())
    clean = clean[~dup]

    clean["state_ut"] = clean["state_ut"].map(_canonical_state)
    invalid_state = ~clean["state_ut"].map(_is_valid_state)
    report["invalid_state_dropped"] = int(invalid_state.sum())
    clean = clean[~invalid_state]

    clean["is_synthetic"] = clean["destination_name"].map(_is_garbage_name)
    report["synthetic_rows"] = int(clean["is_synthetic"].sum())
    return clean.reset_index(drop=True), report


def validate_real_places(df: pd.DataFrame, state_col: str, name_col: str) -> tuple:
    """Dedupe real places; fill missing states via CITY_TO_STATE_MAPPING."""
    report = {
        "input_rows": int(len(df)),
        "duplicates_dropped": 0,
        "state_filled": 0,
        "unique_names": 0,
    }
    clean = df.copy()
    report["unique_names"] = int(clean[name_col].str.lower().nunique())

    dup = clean[name_col].str.lower().duplicated(keep="first")
    report["duplicates_dropped"] = int(dup.sum())
    clean = clean[~dup]

    def _fill_state(row):
        state = _canonical_state(row.get(state_col))
        if not _is_valid_state(state):
            city = str(row.get("city", "")).strip() if "city" in clean.columns else ""
            mapped = CITY_TO_STATE_MAPPING.get(city)
            if mapped:
                report["state_filled"] += 1
                return mapped
        return state

    if state_col in clean.columns:
        clean[state_col] = clean.apply(_fill_state, axis=1)
    return clean.reset_index(drop=True), report


def validate(training_dir: Path, clean_dir: Path) -> dict:
    """Validate all committed raw CSVs and write clean/ + report."""
    clean_dir.mkdir(parents=True, exist_ok=True)
    validation_report = {"generated_by": "prepare_training_data.py", "files": {}}

    spec = [
        (
            "tourism_destinations.csv",
            "tourism_destinations_clean.csv",
            "destination_name",
        ),
        ("top_indian_places.csv", "top_indian_places_clean.csv", "Name"),
        ("expanded_destinations.csv", "expanded_destinations_clean.csv", "Name"),
        ("places.csv", "places_clean.csv", "Place"),
    ]
    for raw_name, clean_name, name_col in spec:
        raw_path = training_dir / raw_name
        if not raw_path.exists():
            logger.warning("Skip validation: %s not found", raw_name)
            continue
        df = pd.read_csv(raw_path)
        if raw_name == "tourism_destinations.csv":
            state_col = "state_ut"
            clean_df, report = validate_tourism_destinations(df)
        else:
            state_col = "State" if "State" in df.columns else ""
            clean_df, report = (
                validate_real_places(df, state_col, name_col)
                if state_col
                else (df.reset_index(drop=True), {"input_rows": int(len(df))})
            )
        clean_df.to_csv(clean_dir / clean_name, index=False)
        report["output_rows"] = int(len(clean_df))
        validation_report["files"][raw_name] = report
        logger.info("%s -> %s (%d rows)", raw_name, clean_name, len(clean_df))

    (clean_dir / "validation_report.json").write_text(
        json.dumps(validation_report, indent=2)
    )
    logger.info("validation report -> %s", clean_dir / "validation_report.json")
    return validation_report


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Ingest, clean and validate ML training sources"
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=None,
        help="External dataset folder (skips ingest when omitted)",
    )
    parser.add_argument("--training-dir", type=Path, default=TRAINING_DIR)
    args = parser.parse_args(argv)

    if args.source_dir:
        ingest(args.source_dir, args.training_dir)

    report = validate(args.training_dir, args.training_dir / "clean")
    summary = report["files"].get("tourism_destinations.csv", {})
    logger.info(
        "Done. synthetic rows in tourism_destinations: %d (all Place_N names — "
        "excluded from content matching)",
        summary.get("synthetic_rows", 0),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
